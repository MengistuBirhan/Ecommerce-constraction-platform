# Garvelgo Material Supply — Sales, Truck & Gate System

## Workflow

1. **Admin** registers trucks (plate, driver, phone, model) under **Trucks & Settings** → status `Available`.
2. **Cashier** (POS) fills in the sale, picks an **Available** truck from the drop-down (no free typing) and submits.
   Sale → `Pending Admin Verification`, truck is reserved.
3. **Admin** (Payment Approvals) verifies the payment → **Approve** or **Reject**.
   - Approve → `Approved / Ready for Exit`, gate pass is created, receipt + gate pass are emailed.
   - Reject → truck becomes `Available` again and stock is restored.
4. **Security** (Gate Pass & Trucks): **Confirm Exit** (`ወጥቷል / Exited`) → **Confirm Return** (`ተመልሷል`) → truck is `Available / ዝግጁ ነው` and shows up in the cashier drop-down again.
5. Everyone gets live in-app alerts (bell + toast) on each status change.

## Delivery address & navigation

The cashier must enter City, Kebele, Specific Area/Sefer and a Google Maps link (or `lat,lng` pin). On approval the
address and link are copied onto the gate pass and into the approval email (clickable "Open in Google Maps" button).
Security's truck cards also have a **Navigate** link.

## Payment rules

- Telebirr: `0942836279` (Garvelgo Material Supply)
- CBE: `1000474209637` (Garvelgo Material Supply). The account number is read from the uploaded receipt when possible (otherwise the cashier enters it); anything else is rejected with the Amharic error message (checked in the UI, the `submit_sale` function and a DB trigger).
- CBE Transaction ID is required and must match `FT` + 8–14 letters/digits (edit `CBE_TXN_ID_PATTERN` in `src/lib/location.ts` and the regex in `submit_sale` if your receipts differ). A transaction ID can only be used once.
- Cash is removed. Credit needs an admin-authorized user (admin signed in).

## Official prices (admin authority)

- Only admins set prices. Inventory's **Unit Price** field is editable only for a signed-in admin; everyone else sees it read-only and cannot add products.
- POS **Unit Price** is read-only (`readOnly` + `disabled`) for the cashier role and is locked to the inventory price once a material is selected. The app re-reads the official price just before submitting.
- Database enforcement (`20261112000000_enforce_official_prices.sql`): `material_save()` is the only way for the API to create products or change a price (admin check inside), and a trigger on `sales` rejects any sale whose `unit_price` differs from the current inventory price, or whose subtotal/total do not add up. This protects against edited browser state or direct API calls.

## Admin credit registration (Credit Management)

Admin-only tab **Credit Management** (`/credits`). A credit-authorized admin registers each credit through a 5-step form:
Customer Info, Items & Financials, Legal Agreement & Due Date, Guarantor, Admin Authorization.

- Required: customer name/phone/address/ID number + ID scan (upload or camera), itemized materials, due date,
  signed agreement / promissory note, guarantor name/phone/ID/address, and an admin justification (min. 20 characters).
  Optional: down payment (defaults to 0), collateral details.
- Total, remaining balance and amount in words are calculated automatically (the words field can be edited).
- `registered_by`, role, name and `created_at` are set by the database from the signed-in staff account, never by the browser.
- Records show an **Admin Authorized Credit** badge. Registered details are immutable; only the status
  (active / settled / defaulted / cancelled) can change.
- Database: migration `20261111000000_admin_credit_registration.sql` creates `credits`, the functions
  `credit_register`, `credit_list`, `credit_set_status`, and the private bucket `credit-documents`. Apply it with `supabase db push`.
- `credits` has RLS enabled with no policies, so it can only be reached through those admin-checked functions.
- Document columns (`id_document_url`, `agreement_document_url`) store the file path in the private bucket;
  the app opens files through 10-minute signed links.
- Limitation: staff sign in with the app's own `staff_login`, not Supabase Auth, so Storage policies cannot tell admins
  from other holders of the anon key. For stronger protection, sign document links in an edge function that checks the staff session.

## Payment receipt screenshot + automatic reference number

For Telebirr and CBE sales the cashier no longer types the reference by hand:

1. The payer pays to the company account/number shown in the POS using mobile banking.
2. The cashier taps **Upload receipt screenshot** in the POS. The browser reads the image (Tesseract OCR,
   `src/lib/receiptOcr.ts`) and fills in the **Transaction Reference** automatically. For CBE it also fills the
   account number when the company account is visible on the receipt. The reference stays editable in case the OCR misreads a character.
3. Soft hints appear under the preview: *Paid to the Garvelgo account ✓* and *Total found on the receipt ✓ / not found*.
   They never block the sale; the admin decides.
4. **Submit for Admin Verification** uploads the screenshot to the private `payment-receipts` bucket and records the sale with `sales.receipt_path`.
5. In **Payment Approvals** the admin sees *View receipt screenshot* on each pending sale: the image opens next to the entered reference and amount, then the admin approves or rejects.

Rules (database, migration `20261114000000_payment_receipts.sql`):
- Telebirr / CBE sales are rejected without a receipt (test mode and credit sales are exempt). The path must be a real object in the bucket.
- The existing checks still apply: reference format, one-time use of a reference, company account for CBE.
- OCR is a convenience, not proof of payment: a screenshot can be faked, so the admin must still compare it with the bank/Telebirr records.
- Needs internet on first use: the OCR engine and English language data are downloaded from a CDN (`tesseract.js` defaults) and then cached by the browser.
- As with credit documents, staff sign in through the app's own login, so Storage policies cannot tell admins from other holders of the anon key.

## Setup

```bash
npm install
# 1. Apply DB migrations (Supabase SQL editor or CLI)
supabase db push
# 2. Email function (Resend)
supabase secrets set RESEND_API_KEY=... MAIL_FROM="Garvelgo Material Supply <noreply@your-domain.com>" ADMIN_NOTIFY_EMAIL=you@example.com
supabase functions deploy send-approval-email
npm run dev
```

Realtime: the migration adds `notifications`, `sales`, `vehicles` to the `supabase_realtime` publication.
(If it fails, enable Realtime for those tables in the dashboard. The app also polls every 15–20 s as a fallback.)

## Admin access

- Default admin: `admin` / `ChangeMe123!` (must be changed on first login).
- Forgot password → **Forgot password?** on the admin login → enter the recovery key.
  Default recovery key: `GARVELGO-RESET-2026`. **Change it** under Trucks & Settings → *Admin recovery key*.

## Security note

This app has no Supabase Auth: staff identity is the staff id kept in the browser, and Security/Cashier are session roles.
Admin-only actions (approve, reject, truck management, credit) are checked server-side against that staff id,
but a determined person with the public anon key could still call exit/return directly. For stronger guarantees,
move staff to Supabase Auth and tighten the RLS policies.

## Admin ↔ Security chat (real-time)

A floating **Chat / ውይይት** button (bottom-right) opens a private chat between **Admin** and **Security** staff.
It is rendered only when the person is **signed in** (header **Sign in** button) as an active `admin` or `gatekeeper`
staff user **and** the session role is Admin or Security. Cashiers and signed-out visitors never see it.

- Messages can be tagged with a **truck plate** or a **dispatch / invoice number**; the list auto-scrolls to new messages.
- Migration: `supabase/migrations/20261113000000_admin_security_chat.sql` (run it in the Supabase SQL editor or `supabase db push`).
- **Security model.** The app uses its own staff login (no Supabase Auth), so there is no `auth.uid()` for RLS to check.
  `admin_security_chats` therefore has RLS enabled with **no policies** and all table privileges revoked from `anon`/`authenticated`.
  Reads and writes go through `chat_list()` / `chat_send()` (SECURITY DEFINER), which verify in `staff_users` that the caller is an
  active admin or gatekeeper, take the sender role from the database, and set the recipient to the opposite role.
- **Real-time.** Realtime only delivers rows a client may SELECT, so a content-free `chat_events` table (id + timestamp) is published
  instead; the client re-fetches through `chat_list()` on each ping (10 s polling fallback if Realtime is off).

### Creating a Security account
Security staff need a `staff_users` row with role `gatekeeper` (run once in the SQL editor, change the values):

```sql
INSERT INTO staff_users (username, display_name, password_hash, role, must_change_password)
VALUES ('security1', 'Gate Security', extensions.crypt('TempPass#2026', extensions.gen_salt('bf')), 'gatekeeper', true);
```
They are asked to set a new password at first sign-in.

## Landing page (መግቢያ ገጽ)

The app now opens on a public bilingual landing page at `/` (hero greeting, About, Services, branch selector with map and
directions, contact details, footer). **Enter Sales System** goes to the home page of the current session role; **Staff Sign in**
opens the staff login. Every other URL (`/pos`, `/dashboard`, …) loads the existing app unchanged, and the sidebar has a
**Home page / መግቢያ ገጽ** button back to the landing page.

**Edit the content in one place: `src/config/company.ts`** — phones, emails, working hours, About text, services, and the branch
list (name, address, directions, phone, hours, map coordinates). All values there are placeholders. Maps use Google Maps embeds
(no API key needed, internet required); set `lat`/`lng` or a `mapQuery` text per branch.
