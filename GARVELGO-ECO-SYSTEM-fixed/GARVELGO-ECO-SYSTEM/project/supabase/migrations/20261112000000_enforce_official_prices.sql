/*
# Official price enforcement

1. Only admins can set or change `materials.unit_price`.
   - `material_save(...)` is the only door: it checks the caller is an active admin
     (staff_users) and flips a transaction-local flag.
   - A trigger on `materials` rejects any INSERT, or any change of unit_price,
     coming from the anon / authenticated API roles unless that flag is set.
     (Stock edits and the stock deduction done by sales are not affected.
     Running SQL as postgres in the dashboard is also not affected.)

2. Every sale must use the official inventory price.
   - A BEFORE INSERT trigger on `sales` compares `unit_price` with the current
     `materials.unit_price` and rejects any difference, and checks
     subtotal = quantity * unit_price and total = subtotal + transport_fee.
   - This sits on the table, so it protects every version of `submit_sale`
     and any direct insert, whatever the browser sends.
*/

-- ---------------------------------------------------------------------------
-- 1. Admin-only price changes
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION materials_guard_price()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only the public API roles are restricted.
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF current_setting('app.price_admin', true) IS NOT DISTINCT FROM 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Only an admin can add products and set prices.';
  END IF;
  IF NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN
    RAISE EXCEPTION 'Only an admin can change unit prices.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS materials_guard_price_trg ON materials;
CREATE TRIGGER materials_guard_price_trg
  BEFORE INSERT OR UPDATE ON materials
  FOR EACH ROW EXECUTE FUNCTION materials_guard_price();

CREATE OR REPLACE FUNCTION material_save(
  p_staff_id uuid,
  p_id uuid,
  p_name_am text,
  p_name_en text,
  p_subtype text,
  p_unit text,
  p_unit_price numeric,
  p_stock_quantity numeric,
  p_low_stock_threshold numeric
) RETURNS materials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result materials;
BEGIN
  IF NOT is_admin_user(p_staff_id) THEN
    RAISE EXCEPTION 'Admin access required. Only an admin can set or edit prices.';
  END IF;
  IF trim(coalesce(p_name_am, '')) = '' OR trim(coalesce(p_name_en, '')) = '' THEN
    RAISE EXCEPTION 'Both Amharic and English names are required.';
  END IF;
  IF p_unit_price IS NULL OR p_unit_price < 0 THEN
    RAISE EXCEPTION 'Unit price must be 0 or more.';
  END IF;
  IF coalesce(p_stock_quantity, 0) < 0 OR coalesce(p_low_stock_threshold, 0) < 0 THEN
    RAISE EXCEPTION 'Stock and threshold cannot be negative.';
  END IF;

  PERFORM set_config('app.price_admin', 'on', true);  -- this transaction only

  IF p_id IS NULL THEN
    INSERT INTO materials (name_am, name_en, subtype, unit, unit_price, stock_quantity, low_stock_threshold)
    VALUES (trim(p_name_am), trim(p_name_en), nullif(trim(coalesce(p_subtype, '')), ''), p_unit,
            p_unit_price, coalesce(p_stock_quantity, 0), coalesce(p_low_stock_threshold, 0))
    RETURNING * INTO result;
  ELSE
    UPDATE materials
       SET name_am = trim(p_name_am),
           name_en = trim(p_name_en),
           subtype = nullif(trim(coalesce(p_subtype, '')), ''),
           unit = p_unit,
           unit_price = p_unit_price,
           stock_quantity = coalesce(p_stock_quantity, 0),
           low_stock_threshold = coalesce(p_low_stock_threshold, 0)
     WHERE id = p_id
     RETURNING * INTO result;
    IF NOT FOUND THEN RAISE EXCEPTION 'Material not found.'; END IF;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION material_save(uuid, uuid, text, text, text, text, numeric, numeric, numeric)
  TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Sales must use the official price
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sales_enforce_official_price()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE official numeric;
BEGIN
  IF NEW.material_id IS NOT NULL THEN
    SELECT unit_price INTO official FROM materials WHERE id = NEW.material_id;
    IF FOUND AND NEW.unit_price IS DISTINCT FROM official THEN
      RAISE EXCEPTION 'Price mismatch: the unit price must be the official inventory price (% ETB). Refresh the page and try again. / ዋጋው ከኦፊሴላዊው ዋጋ ጋር አይመሳሰልም።', official;
    END IF;
  END IF;
  IF abs(NEW.subtotal - NEW.quantity * NEW.unit_price) > 0.01 THEN
    RAISE EXCEPTION 'Invalid subtotal: it must equal quantity x unit price.';
  END IF;
  IF abs(NEW.total - (NEW.subtotal + coalesce(NEW.transport_fee, 0))) > 0.01 THEN
    RAISE EXCEPTION 'Invalid total: it must equal subtotal + transport fee.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_enforce_official_price_trg ON sales;
CREATE TRIGGER sales_enforce_official_price_trg
  BEFORE INSERT ON sales
  FOR EACH ROW EXECUTE FUNCTION sales_enforce_official_price();
