/*
# Exclusive Admin <-> Security real-time chat

## Why it is built this way
This app does not use Supabase Auth: staff sign in through `staff_login()` and the
browser only holds the staff user's id. There is therefore no `auth.uid()` that an
RLS policy could check. Instead (same pattern as `credits`, `vehicles`, `staff_users`):

1. `admin_security_chats` has RLS ENABLED and NO policies, and all table privileges are
   revoked from `anon` / `authenticated`. The table cannot be read or written directly.
2. All access goes through SECURITY DEFINER functions that take the caller's staff id and
   verify in `staff_users` that the user is ACTIVE and has role `admin` or `gatekeeper`.
   Cashiers (and unknown ids) are rejected inside the database.
3. The sender role is read from `staff_users`, never trusted from the client, and the
   recipient is always the opposite role.

## Real-time
Postgres-changes events are only delivered for rows the subscriber may SELECT, which would
force a public SELECT policy on the chat table. To keep message text private, a tiny
`chat_events` table (id + timestamp only, no content) is published to Realtime. Clients
listen for new events and then re-fetch via `chat_list()`.

## Tables
- admin_security_chats(id, sender_id, sender_role, recipient_role, message, tag_type,
  tag_value, created_at)
- chat_events(id, created_at)  -- content-free "something new" pings

## Functions
- chat_list(p_user_id, p_limit)               -> latest messages (oldest first)
- chat_send(p_user_id, p_message, p_tag_type, p_tag_value) -> the inserted message
*/

-- ---------------------------------------------------------------------------
-- 1. Chat table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_security_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES staff_users(id),
  sender_role text NOT NULL CHECK (sender_role IN ('admin', 'gatekeeper')),
  recipient_role text NOT NULL CHECK (recipient_role IN ('admin', 'gatekeeper')),
  message text NOT NULL CHECK (length(btrim(message)) BETWEEN 1 AND 1000),
  tag_type text CHECK (tag_type IN ('truck', 'dispatch')),
  tag_value text CHECK (tag_value IS NULL OR length(tag_value) BETWEEN 1 AND 60),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT admin_security_chats_roles_differ CHECK (sender_role <> recipient_role),
  CONSTRAINT admin_security_chats_tag_pair CHECK ((tag_type IS NULL) = (tag_value IS NULL))
);

CREATE INDEX IF NOT EXISTS admin_security_chats_created_idx
  ON admin_security_chats (created_at DESC);

ALTER TABLE admin_security_chats ENABLE ROW LEVEL SECURITY;
-- Deliberately NO policies: anon/authenticated can never touch the table directly.
REVOKE ALL ON admin_security_chats FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Content-free realtime pings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_chat_events" ON chat_events;
CREATE POLICY "anon_read_chat_events" ON chat_events
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON chat_events FROM anon, authenticated;
GRANT SELECT ON chat_events TO anon, authenticated;

CREATE OR REPLACE FUNCTION chat_emit_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO chat_events DEFAULT VALUES;
  DELETE FROM chat_events WHERE created_at < now() - interval '1 day';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS admin_security_chats_emit ON admin_security_chats;
CREATE TRIGGER admin_security_chats_emit
  AFTER INSERT ON admin_security_chats
  FOR EACH ROW EXECUTE FUNCTION chat_emit_event();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_events;
  END IF;
EXCEPTION WHEN undefined_object THEN
  RAISE NOTICE 'supabase_realtime publication not found; enable Realtime for chat_events manually.';
END $$;

-- ---------------------------------------------------------------------------
-- 3. Access check (internal only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chat_require_staff(p_user_id uuid) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_role text;
BEGIN
  SELECT u.role INTO v_role
  FROM staff_users u
  WHERE u.id = p_user_id AND u.active = true;

  IF v_role IS NULL OR v_role NOT IN ('admin', 'gatekeeper') THEN
    RAISE EXCEPTION 'Chat access denied.' USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END;
$$;
REVOKE ALL ON FUNCTION chat_require_staff(uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Read messages
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chat_list(p_user_id uuid, p_limit integer DEFAULT 200)
RETURNS TABLE(
  id uuid,
  sender_id uuid,
  sender_role text,
  recipient_role text,
  message text,
  tag_type text,
  tag_value text,
  created_at timestamptz,
  sender_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
BEGIN
  PERFORM chat_require_staff(p_user_id);

  RETURN QUERY
  SELECT t.id, t.sender_id, t.sender_role, t.recipient_role, t.message,
         t.tag_type, t.tag_value, t.created_at, t.sender_name
  FROM (
    SELECT c.id, c.sender_id, c.sender_role, c.recipient_role, c.message,
           c.tag_type, c.tag_value, c.created_at, s.display_name AS sender_name
    FROM admin_security_chats c
    JOIN staff_users s ON s.id = c.sender_id
    ORDER BY c.created_at DESC
    LIMIT v_limit
  ) t
  ORDER BY t.created_at ASC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Send a message
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION chat_send(
  p_user_id uuid,
  p_message text,
  p_tag_type text DEFAULT NULL,
  p_tag_value text DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  sender_id uuid,
  sender_role text,
  recipient_role text,
  message text,
  tag_type text,
  tag_value text,
  created_at timestamptz,
  sender_name text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_role text;
  v_recipient text;
  v_msg text := btrim(coalesce(p_message, ''));
  v_tag_type text := nullif(btrim(coalesce(p_tag_type, '')), '');
  v_tag_value text := nullif(btrim(coalesce(p_tag_value, '')), '');
  v_row admin_security_chats%ROWTYPE;
BEGIN
  v_role := chat_require_staff(p_user_id);
  v_recipient := CASE WHEN v_role = 'admin' THEN 'gatekeeper' ELSE 'admin' END;

  IF length(v_msg) = 0 THEN
    RAISE EXCEPTION 'Message is empty.';
  END IF;
  IF length(v_msg) > 1000 THEN
    RAISE EXCEPTION 'Message is too long (max 1000 characters).';
  END IF;

  IF v_tag_type IS NULL OR v_tag_value IS NULL THEN
    v_tag_type := NULL;
    v_tag_value := NULL;
  ELSIF v_tag_type NOT IN ('truck', 'dispatch') THEN
    RAISE EXCEPTION 'Invalid tag type.';
  END IF;

  INSERT INTO admin_security_chats (sender_id, sender_role, recipient_role, message, tag_type, tag_value)
  VALUES (p_user_id, v_role, v_recipient, v_msg, v_tag_type, v_tag_value)
  RETURNING * INTO v_row;

  RETURN QUERY
  SELECT v_row.id, v_row.sender_id, v_row.sender_role, v_row.recipient_role, v_row.message,
         v_row.tag_type, v_row.tag_value, v_row.created_at,
         (SELECT s.display_name FROM staff_users s WHERE s.id = v_row.sender_id);
END;
$$;

REVOKE ALL ON FUNCTION chat_list(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION chat_send(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION chat_list(uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION chat_send(uuid, text, text, text) TO anon, authenticated;
