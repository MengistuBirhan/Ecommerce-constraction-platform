/*
# Admin credit registration (legally binding credit records)

Adds the `credits` table, admin-only functions to register / list credits, and
a private Storage bucket (`credit-documents`) for the scanned ID and the signed
credit agreement / promissory note.

## Table `credits`

1. Customer identification (all mandatory)
   customer_full_name, customer_phone, customer_city, customer_subcity_woreda,
   customer_kebele, customer_id_type (kebele_id | driving_license | passport),
   customer_id_number, id_document_url
2. Credit transaction
   items (jsonb array of {name, unit, quantity, unit_price, line_total}),
   total_amount, total_amount_words, down_payment (default 0),
   remaining_balance (= total_amount - down_payment, enforced by CHECK)
3. Terms: due_date, agreement_document_url (mandatory signed agreement)
4. Guarantor: guarantor_full_name, guarantor_phone, guarantor_id_number,
   guarantor_address, collateral_details (optional)
5. Audit: registered_by (staff_users.id), registered_by_role, registered_by_name,
   created_at (server clock), admin_justification (mandatory, >= 20 chars),
   is_admin_authorized (always true for rows written by credit_register)

`id_document_url` / `agreement_document_url` hold the object path inside the
private bucket (e.g. `id-documents/<uuid>.jpg`). The app turns the path into a
short-lived signed URL when someone opens the document.

## Security

- RLS is enabled on `credits` and NO policies are created: anon/authenticated
  can never read or write the table directly. All access goes through the
  SECURITY DEFINER functions below, which verify the caller is an active admin
  with credit_authorized = true (same staff_users model as the rest of the app).
- `credit_register` takes registered_by / role / name from staff_users (never
  from the client), recomputes every total on the server, and checks that both
  uploaded files really exist in the bucket.
- A trigger blocks DELETE and any change to the legal columns; only `status`
  (and settled_at) may change after registration.

## Storage

Bucket `credit-documents` is PRIVATE, 10 MB per file, PDF / JPEG / PNG / WEBP /
HEIC only. Policies allow INSERT (new files only) and SELECT (needed to create
signed URLs) for this bucket; there is no UPDATE or DELETE policy, so evidence
cannot be overwritten or removed through the API.

NOTE: this app signs staff in with its own `staff_login` function, not with
Supabase Auth, so Storage policies cannot tell an admin from any other holder
of the anon key. File names are random UUIDs and the table is unreadable, but
for stronger protection move document signing into an edge function that checks
the staff session, or migrate staff to Supabase Auth.
*/

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS credit_number_seq START 1;

CREATE TABLE IF NOT EXISTS credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_number text UNIQUE NOT NULL
    DEFAULT ('CR-' || lpad(nextval('credit_number_seq')::text, 6, '0')),

  -- 1. Customer identification
  customer_full_name text NOT NULL CHECK (length(trim(customer_full_name)) >= 3),
  customer_phone text NOT NULL CHECK (customer_phone ~ '^(\+?251|0)?[79][0-9]{8}$'),
  customer_city text NOT NULL CHECK (length(trim(customer_city)) > 0),
  customer_subcity_woreda text NOT NULL CHECK (length(trim(customer_subcity_woreda)) > 0),
  customer_kebele text NOT NULL CHECK (length(trim(customer_kebele)) > 0),
  customer_id_type text NOT NULL CHECK (customer_id_type IN ('kebele_id', 'driving_license', 'passport')),
  customer_id_number text NOT NULL CHECK (length(trim(customer_id_number)) >= 3),
  id_document_url text NOT NULL CHECK (length(trim(id_document_url)) > 0),

  -- 2. Credit transaction
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) > 0),
  total_amount numeric(14, 2) NOT NULL CHECK (total_amount > 0),
  total_amount_words text NOT NULL CHECK (length(trim(total_amount_words)) > 0),
  down_payment numeric(14, 2) NOT NULL DEFAULT 0 CHECK (down_payment >= 0),
  remaining_balance numeric(14, 2) NOT NULL CHECK (remaining_balance >= 0),
  CONSTRAINT credits_balance_matches CHECK (remaining_balance = total_amount - down_payment),
  CONSTRAINT credits_down_not_above_total CHECK (down_payment <= total_amount),

  -- 3. Terms & timeline
  due_date date NOT NULL,
  agreement_document_url text NOT NULL CHECK (length(trim(agreement_document_url)) > 0),

  -- 4. Guarantor / collateral
  guarantor_full_name text NOT NULL CHECK (length(trim(guarantor_full_name)) >= 3),
  guarantor_phone text NOT NULL CHECK (guarantor_phone ~ '^(\+?251|0)?[79][0-9]{8}$'),
  guarantor_id_number text NOT NULL CHECK (length(trim(guarantor_id_number)) >= 3),
  guarantor_address text NOT NULL CHECK (length(trim(guarantor_address)) > 0),
  collateral_details text,

  -- 5. Audit / authorization
  registered_by uuid NOT NULL REFERENCES staff_users(id),
  registered_by_role text NOT NULL,
  registered_by_name text NOT NULL,
  admin_justification text NOT NULL CHECK (length(trim(admin_justification)) >= 20),
  is_admin_authorized boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled', 'defaulted', 'cancelled')),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credits_created_at_idx ON credits (created_at DESC);
CREATE INDEX IF NOT EXISTS credits_due_date_idx ON credits (due_date);
CREATE INDEX IF NOT EXISTS credits_customer_id_number_idx ON credits (customer_id_number);

-- RLS on, deliberately no policies: only the SECURITY DEFINER functions below
-- can touch this table.
ALTER TABLE credits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON credits FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Immutability of the legal record
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credits_protect_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Credit records cannot be deleted. Set the status to cancelled instead.';
  END IF;
  IF (to_jsonb(NEW) - 'status' - 'settled_at') IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'settled_at') THEN
    RAISE EXCEPTION 'Registered credit details cannot be edited. Only the status can change.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credits_protect_record_trg ON credits;
CREATE TRIGGER credits_protect_record_trg
  BEFORE UPDATE OR DELETE ON credits
  FOR EACH ROW EXECUTE FUNCTION credits_protect_record();

-- ---------------------------------------------------------------------------
-- 3. Storage bucket + policies
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'credit-documents',
  'credit-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "credit_docs_insert" ON storage.objects;
CREATE POLICY "credit_docs_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'credit-documents'
    AND (storage.foldername(name))[1] IN ('id-documents', 'agreements')
  );

DROP POLICY IF EXISTS "credit_docs_select" ON storage.objects;
CREATE POLICY "credit_docs_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'credit-documents'
    AND (storage.foldername(name))[1] IN ('id-documents', 'agreements')
  );

-- No UPDATE / DELETE policies: uploaded evidence is append-only via the API.

-- ---------------------------------------------------------------------------
-- 4. credit_register: the only way to create a credit
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_register(p_staff_id uuid, p jsonb)
RETURNS credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  staff staff_users%ROWTYPE;
  item jsonb;
  clean_items jsonb := '[]'::jsonb;
  qty numeric;
  price numeric;
  line numeric;
  total numeric := 0;
  down numeric;
  due date;
  id_path text := trim(coalesce(p->>'id_document_url', ''));
  agr_path text := trim(coalesce(p->>'agreement_document_url', ''));
  phone_re constant text := '^(\+?251|0)?[79][0-9]{8}$';
  g_phone text := regexp_replace(coalesce(p->>'guarantor_phone', ''), '[\s-]', '', 'g');
  c_phone text := regexp_replace(coalesce(p->>'customer_phone', ''), '[\s-]', '', 'g');
  result credits;
BEGIN
  -- Authorization: active admin that is allowed to give credit.
  SELECT * INTO staff FROM staff_users WHERE id = p_staff_id AND active = true;
  IF NOT FOUND OR staff.role <> 'admin' THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  IF NOT staff.credit_authorized THEN
    RAISE EXCEPTION 'This admin account is not authorized to register credit.';
  END IF;

  -- 1. Customer identification
  IF length(trim(coalesce(p->>'customer_full_name', ''))) < 3 THEN
    RAISE EXCEPTION 'Customer full name (as on the official ID) is required.';
  END IF;
  IF c_phone !~ phone_re THEN
    RAISE EXCEPTION 'A valid customer phone number is required (e.g. 0911223344).';
  END IF;
  IF trim(coalesce(p->>'customer_city', '')) = ''
     OR trim(coalesce(p->>'customer_subcity_woreda', '')) = ''
     OR trim(coalesce(p->>'customer_kebele', '')) = '' THEN
    RAISE EXCEPTION 'Customer city, sub-city/woreda and kebele are required.';
  END IF;
  IF coalesce(p->>'customer_id_type', '') NOT IN ('kebele_id', 'driving_license', 'passport') THEN
    RAISE EXCEPTION 'Choose the ID type: Kebele ID, Driving License or Passport.';
  END IF;
  IF length(trim(coalesce(p->>'customer_id_number', ''))) < 3 THEN
    RAISE EXCEPTION 'Customer official ID number is required.';
  END IF;
  IF id_path = '' OR id_path NOT LIKE 'id-documents/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'credit-documents' AND name = id_path) THEN
    RAISE EXCEPTION 'The scanned customer ID document is missing or was not uploaded.';
  END IF;

  -- 2. Items & financials (totals are always recomputed here)
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p->'items') = 0 THEN
    RAISE EXCEPTION 'Add at least one item taken on credit.';
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p->'items') LOOP
    IF trim(coalesce(item->>'name', '')) = '' THEN
      RAISE EXCEPTION 'Every item needs a name.';
    END IF;
    BEGIN
      qty := (item->>'quantity')::numeric;
      price := (item->>'unit_price')::numeric;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Item "%": quantity and unit price must be numbers.', item->>'name';
    END;
    IF qty IS NULL OR qty <= 0 THEN
      RAISE EXCEPTION 'Item "%": quantity must be greater than 0.', item->>'name';
    END IF;
    IF price IS NULL OR price <= 0 THEN
      RAISE EXCEPTION 'Item "%": unit price must be greater than 0.', item->>'name';
    END IF;
    line := round(qty * price, 2);
    total := total + line;
    clean_items := clean_items || jsonb_build_array(jsonb_build_object(
      'name', trim(item->>'name'),
      'unit', trim(coalesce(item->>'unit', '')),
      'quantity', qty,
      'unit_price', price,
      'line_total', line
    ));
  END LOOP;
  IF trim(coalesce(p->>'total_amount_words', '')) = '' THEN
    RAISE EXCEPTION 'Total amount in words is required.';
  END IF;
  BEGIN
    down := coalesce(nullif(trim(coalesce(p->>'down_payment', '')), '')::numeric, 0);
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Down payment must be a number.';
  END;
  IF down < 0 THEN RAISE EXCEPTION 'Down payment cannot be negative.'; END IF;
  IF down > total THEN RAISE EXCEPTION 'Down payment cannot be more than the total amount.'; END IF;
  IF down = total THEN RAISE EXCEPTION 'Down payment equals the total, so this is not a credit. Use a normal sale instead.'; END IF;

  -- 3. Terms & timeline
  BEGIN
    due := (p->>'due_date')::date;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'Payment due date is required.';
  END;
  IF due IS NULL THEN RAISE EXCEPTION 'Payment due date is required.'; END IF;
  IF due <= (now() AT TIME ZONE 'Africa/Addis_Ababa')::date THEN
    RAISE EXCEPTION 'Payment due date must be after today.';
  END IF;
  IF agr_path = '' OR agr_path NOT LIKE 'agreements/%'
     OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'credit-documents' AND name = agr_path) THEN
    RAISE EXCEPTION 'The signed credit agreement / promissory note is missing or was not uploaded.';
  END IF;

  -- 4. Guarantor
  IF length(trim(coalesce(p->>'guarantor_full_name', ''))) < 3 THEN
    RAISE EXCEPTION 'Guarantor full name is required.';
  END IF;
  IF g_phone !~ phone_re THEN
    RAISE EXCEPTION 'A valid guarantor phone number is required.';
  END IF;
  IF length(trim(coalesce(p->>'guarantor_id_number', ''))) < 3 THEN
    RAISE EXCEPTION 'Guarantor ID number is required.';
  END IF;
  IF trim(coalesce(p->>'guarantor_address', '')) = '' THEN
    RAISE EXCEPTION 'Guarantor address is required.';
  END IF;

  -- 5. Admin authorization
  IF length(trim(coalesce(p->>'admin_justification', ''))) < 20 THEN
    RAISE EXCEPTION 'Admin justification is required (at least 20 characters explaining why this credit is authorized).';
  END IF;

  INSERT INTO credits (
    customer_full_name, customer_phone, customer_city, customer_subcity_woreda, customer_kebele,
    customer_id_type, customer_id_number, id_document_url,
    items, total_amount, total_amount_words, down_payment, remaining_balance,
    due_date, agreement_document_url,
    guarantor_full_name, guarantor_phone, guarantor_id_number, guarantor_address, collateral_details,
    registered_by, registered_by_role, registered_by_name, admin_justification, is_admin_authorized
  ) VALUES (
    trim(p->>'customer_full_name'), c_phone, trim(p->>'customer_city'),
    trim(p->>'customer_subcity_woreda'), trim(p->>'customer_kebele'),
    p->>'customer_id_type', trim(p->>'customer_id_number'), id_path,
    clean_items, round(total, 2), trim(p->>'total_amount_words'), round(down, 2), round(total - down, 2),
    due, agr_path,
    trim(p->>'guarantor_full_name'), g_phone, trim(p->>'guarantor_id_number'),
    trim(p->>'guarantor_address'), nullif(trim(coalesce(p->>'collateral_details', '')), ''),
    staff.id, staff.role, staff.display_name, trim(p->>'admin_justification'), true
  )
  RETURNING * INTO result;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. credit_list: admin-only read
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_list(p_staff_id uuid)
RETURNS SETOF credits
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin_user(p_staff_id) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;
  RETURN QUERY SELECT * FROM credits ORDER BY created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. credit_set_status: settle / default / cancel (the only allowed edit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION credit_set_status(p_staff_id uuid, p_credit_id uuid, p_status text)
RETURNS credits
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result credits;
BEGIN
  IF NOT is_admin_user(p_staff_id) THEN RAISE EXCEPTION 'Admin access required.'; END IF;
  IF p_status NOT IN ('active', 'settled', 'defaulted', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status.';
  END IF;
  UPDATE credits
     SET status = p_status,
         settled_at = CASE WHEN p_status = 'settled' THEN now() ELSE NULL END
   WHERE id = p_credit_id
   RETURNING * INTO result;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credit record not found.'; END IF;
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION credit_register(uuid, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_list(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION credit_set_status(uuid, uuid, text) TO anon, authenticated;
