import { supabase } from './supabase';
import { num } from './format';

/* --------------------------------- Types ---------------------------------- */

export const CREDIT_BUCKET = 'credit-documents';

export type IdType = 'kebele_id' | 'driving_license' | 'passport';

export const ID_TYPE_LABELS: Record<IdType, { en: string; am: string }> = {
  kebele_id: { en: 'Kebele ID', am: 'የቀበሌ መታወቂያ' },
  driving_license: { en: 'Driving License', am: 'መንጃ ፈቃድ' },
  passport: { en: 'Passport', am: 'ፓስፖርት' },
};

export type CreditStatus = 'active' | 'settled' | 'defaulted' | 'cancelled';

export type CreditItem = {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type Credit = {
  id: string;
  credit_number: string;
  customer_full_name: string;
  customer_phone: string;
  customer_city: string;
  customer_subcity_woreda: string;
  customer_kebele: string;
  customer_id_type: IdType;
  customer_id_number: string;
  id_document_url: string;
  items: CreditItem[];
  total_amount: number;
  total_amount_words: string;
  down_payment: number;
  remaining_balance: number;
  due_date: string;
  agreement_document_url: string;
  guarantor_full_name: string;
  guarantor_phone: string;
  guarantor_id_number: string;
  guarantor_address: string;
  collateral_details: string | null;
  registered_by: string;
  registered_by_role: string;
  registered_by_name: string;
  admin_justification: string;
  is_admin_authorized: boolean;
  status: CreditStatus;
  settled_at: string | null;
  created_at: string;
};

/** Form state. Numbers are kept as strings while typing. */
export type ItemDraft = { key: string; name: string; unit: string; quantity: string; unit_price: string };

export type CreditDraft = {
  customer_full_name: string;
  customer_phone: string;
  customer_city: string;
  customer_subcity_woreda: string;
  customer_kebele: string;
  customer_id_type: IdType | '';
  customer_id_number: string;
  id_file: File | null;
  items: ItemDraft[];
  total_amount_words: string;
  /** true once the admin typed their own words, so auto-fill stops overwriting */
  words_edited: boolean;
  down_payment: string;
  due_date: string;
  agreement_file: File | null;
  guarantor_full_name: string;
  guarantor_phone: string;
  guarantor_id_number: string;
  guarantor_address: string;
  collateral_details: string;
  admin_justification: string;
};

export const COMMON_ITEMS = ['Cement', 'Ferro / Rebar', 'Bricks', 'Sand', 'Gravel', 'Hollow block', 'Nails', 'Iron sheet'];
export const COMMON_UNITS = ['pcs', 'bag', 'quintal', 'kg', 'ton', 'm³', 'bundle'];

export function newItem(): ItemDraft {
  return { key: Math.random().toString(36).slice(2, 9), name: '', unit: 'pcs', quantity: '', unit_price: '' };
}

export function emptyDraft(): CreditDraft {
  return {
    customer_full_name: '',
    customer_phone: '',
    customer_city: '',
    customer_subcity_woreda: '',
    customer_kebele: '',
    customer_id_type: '',
    customer_id_number: '',
    id_file: null,
    items: [newItem()],
    total_amount_words: '',
    words_edited: false,
    down_payment: '',
    due_date: '',
    agreement_file: null,
    guarantor_full_name: '',
    guarantor_phone: '',
    guarantor_id_number: '',
    guarantor_address: '',
    collateral_details: '',
    admin_justification: '',
  };
}

/* ------------------------------- Calculations ------------------------------ */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function lineTotal(i: ItemDraft): number {
  return round2(num(i.quantity) * num(i.unit_price));
}

export function totalAmount(items: ItemDraft[]): number {
  return round2(items.reduce((s, i) => s + lineTotal(i), 0));
}

export function remainingBalance(items: ItemDraft[], down: string): number {
  return round2(totalAmount(items) - num(down));
}

/* ----------------------------- Amount in words ----------------------------- */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
  'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion'];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    parts.push(o ? `${t}-${ONES[o]}` : t);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'zero';
  const groups: string[] = [];
  let scale = 0;
  while (n > 0 && scale < SCALES.length) {
    const chunk = n % 1000;
    if (chunk) groups.unshift(`${below1000(chunk)}${SCALES[scale]}`);
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(' ');
}

/** 1250.5 → "One thousand two hundred fifty Birr and fifty cents only" */
export function amountToWords(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const cents = Math.round(amount * 100);
  const birr = Math.floor(cents / 100);
  const santim = cents % 100;
  let out = `${integerToWords(birr)} Birr`;
  if (santim) out += ` and ${integerToWords(santim)} cents`;
  out += ' only';
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* -------------------------------- Validation ------------------------------- */

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ACCEPT_ATTR = 'application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif';

/** Ethiopian mobile numbers: 09XXXXXXXX, 07XXXXXXXX, +2519XXXXXXXX, 2519XXXXXXXX. */
export function normalizePhone(v: string): string {
  return v.replace(/[\s-]/g, '');
}
export function isValidPhone(v: string): boolean {
  return /^(\+?251|0)?[79][0-9]{8}$/.test(normalizePhone(v));
}

export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export type Errors = Record<string, string>;
export type StepId = 'customer' | 'items' | 'legal' | 'guarantor' | 'authorization';

export const STEP_ORDER: StepId[] = ['customer', 'items', 'legal', 'guarantor', 'authorization'];

function fileError(f: File | null, what: string): string | null {
  if (!f) return `${what} is required.`;
  if (!ACCEPTED_FILE_TYPES.includes(f.type)) return `${what} must be a PDF or an image (JPG, PNG, WEBP, HEIC).`;
  if (f.size > MAX_FILE_BYTES) return `${what} is larger than 10 MB.`;
  if (f.size === 0) return `${what} is empty.`;
  return null;
}

export function validateStep(step: StepId, d: CreditDraft): Errors {
  const e: Errors = {};
  const req = (key: keyof CreditDraft, msg: string, min = 1) => {
    if (String(d[key] ?? '').trim().length < min) e[key] = msg;
  };

  if (step === 'customer') {
    req('customer_full_name', 'Enter the full name exactly as it appears on the ID (at least 3 characters).', 3);
    if (!d.customer_phone.trim()) e.customer_phone = 'Phone number is required.';
    else if (!isValidPhone(d.customer_phone)) e.customer_phone = 'Enter a valid phone number, e.g. 0911223344 or +251911223344.';
    req('customer_city', 'City is required.');
    req('customer_subcity_woreda', 'Sub-city / Woreda is required.');
    req('customer_kebele', 'Kebele is required.');
    if (!d.customer_id_type) e.customer_id_type = 'Choose the ID type.';
    req('customer_id_number', 'Official ID number is required (at least 3 characters).', 3);
    const fe = fileError(d.id_file, 'The scanned ID document');
    if (fe) e.id_file = fe;
  }

  if (step === 'items') {
    if (d.items.length === 0) e.items = 'Add at least one item.';
    d.items.forEach((it, idx) => {
      if (!it.name.trim()) e[`item_${idx}_name`] = 'Item name is required.';
      if (!(num(it.quantity) > 0)) e[`item_${idx}_quantity`] = 'Quantity must be more than 0.';
      if (!(num(it.unit_price) > 0)) e[`item_${idx}_unit_price`] = 'Unit price must be more than 0.';
    });
    const total = totalAmount(d.items);
    if (!(total > 0) && !e.items) e.items = 'Total amount must be more than 0.';
    if (!d.total_amount_words.trim()) e.total_amount_words = 'Amount in words is required.';
    const down = d.down_payment.trim();
    if (down !== '') {
      const dn = Number(down);
      if (!Number.isFinite(dn) || dn < 0) e.down_payment = 'Down payment must be 0 or more.';
      else if (total > 0 && dn > total) e.down_payment = 'Down payment cannot be more than the total amount.';
      else if (total > 0 && dn === total) e.down_payment = 'Down payment equals the total, so there is nothing left on credit.';
    }
  }

  if (step === 'legal') {
    if (!d.due_date) e.due_date = 'Choose the payment due date.';
    else if (d.due_date <= todayISO()) e.due_date = 'The due date must be after today.';
    const fe = fileError(d.agreement_file, 'The signed credit agreement / promissory note');
    if (fe) e.agreement_file = fe;
  }

  if (step === 'guarantor') {
    req('guarantor_full_name', 'Guarantor full name is required (at least 3 characters).', 3);
    if (!d.guarantor_phone.trim()) e.guarantor_phone = 'Guarantor phone number is required.';
    else if (!isValidPhone(d.guarantor_phone)) e.guarantor_phone = 'Enter a valid guarantor phone number.';
    req('guarantor_id_number', 'Guarantor ID number is required (at least 3 characters).', 3);
    req('guarantor_address', 'Guarantor address is required.');
  }

  if (step === 'authorization') {
    const len = d.admin_justification.trim().length;
    if (len === 0) e.admin_justification = 'Write why you are authorizing this credit. This is required.';
    else if (len < 20) e.admin_justification = `Explain in more detail (${len}/20 characters minimum).`;
  }

  return e;
}

export function validateAll(d: CreditDraft): { errors: Errors; firstBadStep: StepId | null } {
  let errors: Errors = {};
  let firstBadStep: StepId | null = null;
  for (const s of STEP_ORDER) {
    const stepErrors = validateStep(s, d);
    if (Object.keys(stepErrors).length > 0 && !firstBadStep) firstBadStep = s;
    errors = { ...errors, ...stepErrors };
  }
  return { errors, firstBadStep };
}

/* ---------------------------- Storage + database --------------------------- */

function extFor(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  if (fromName) return fromName;
  return file.type === 'application/pdf' ? 'pdf' : 'jpg';
}

/** Uploads to the private bucket under a random name and returns the object path. */
export async function uploadCreditDocument(file: File, kind: 'id-documents' | 'agreements'): Promise<string> {
  const path = `${kind}/${crypto.randomUUID()}.${extFor(file)}`;
  const { error } = await supabase.storage.from(CREDIT_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw new Error(`Upload failed (${file.name}): ${error.message}`);
  return path;
}

/** Short-lived link (10 min) for opening a stored document. */
export async function getDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(CREDIT_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Could not open the document.');
  return data.signedUrl;
}

export async function registerCredit(staffId: string, d: CreditDraft): Promise<Credit> {
  const { errors } = validateAll(d);
  if (Object.keys(errors).length > 0) throw new Error('Please fix the highlighted fields first.');

  // Files first: the database function checks both objects exist.
  const idPath = await uploadCreditDocument(d.id_file as File, 'id-documents');
  const agreementPath = await uploadCreditDocument(d.agreement_file as File, 'agreements');

  const payload = {
    customer_full_name: d.customer_full_name.trim(),
    customer_phone: normalizePhone(d.customer_phone),
    customer_city: d.customer_city.trim(),
    customer_subcity_woreda: d.customer_subcity_woreda.trim(),
    customer_kebele: d.customer_kebele.trim(),
    customer_id_type: d.customer_id_type,
    customer_id_number: d.customer_id_number.trim(),
    id_document_url: idPath,
    items: d.items.map((i) => ({
      name: i.name.trim(),
      unit: i.unit.trim(),
      quantity: num(i.quantity),
      unit_price: num(i.unit_price),
    })),
    total_amount_words: d.total_amount_words.trim(),
    down_payment: num(d.down_payment),
    due_date: d.due_date,
    agreement_document_url: agreementPath,
    guarantor_full_name: d.guarantor_full_name.trim(),
    guarantor_phone: normalizePhone(d.guarantor_phone),
    guarantor_id_number: d.guarantor_id_number.trim(),
    guarantor_address: d.guarantor_address.trim(),
    collateral_details: d.collateral_details.trim(),
    admin_justification: d.admin_justification.trim(),
  };

  const { data, error } = await supabase.rpc('credit_register', { p_staff_id: staffId, p: payload });
  if (error) throw new Error(error.message);
  return data as Credit;
}

export async function listCredits(staffId: string): Promise<Credit[]> {
  const { data, error } = await supabase.rpc('credit_list', { p_staff_id: staffId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Credit[]).map((c) => ({
    ...c,
    total_amount: Number(c.total_amount),
    down_payment: Number(c.down_payment),
    remaining_balance: Number(c.remaining_balance),
  }));
}

export async function setCreditStatus(staffId: string, creditId: string, status: CreditStatus): Promise<Credit> {
  const { data, error } = await supabase.rpc('credit_set_status', {
    p_staff_id: staffId,
    p_credit_id: creditId,
    p_status: status,
  });
  if (error) throw new Error(error.message);
  return data as Credit;
}
