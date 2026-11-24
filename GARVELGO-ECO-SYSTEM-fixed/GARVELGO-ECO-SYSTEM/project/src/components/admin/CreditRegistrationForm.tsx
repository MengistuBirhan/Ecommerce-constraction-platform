import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  UserRound,
  PackageOpen,
  FileSignature,
  ShieldCheck,
  BadgeCheck,
  Plus,
  Trash2,
  Camera,
  Upload,
  FileText,
  X,
  Check,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button, Card, inputClass } from '@/components/ui';
import { fmtETB } from '@/lib/format';
import { useAdminAuth } from '@/lib/adminAuth';
import {
  ACCEPT_ATTR,
  COMMON_ITEMS,
  COMMON_UNITS,
  ID_TYPE_LABELS,
  STEP_ORDER,
  amountToWords,
  emptyDraft,
  lineTotal,
  newItem,
  registerCredit,
  remainingBalance,
  todayISO,
  totalAmount,
  validateAll,
  validateStep,
  type Credit,
  type CreditDraft,
  type Errors,
  type IdType,
  type StepId,
} from '@/lib/credits';

const STEPS: { id: StepId; label: string; am: string; icon: typeof UserRound }[] = [
  { id: 'customer', label: 'Customer Info', am: 'የደንበኛ መረጃ', icon: UserRound },
  { id: 'items', label: 'Items & Financials', am: 'እቃዎች እና ገንዘብ', icon: PackageOpen },
  { id: 'legal', label: 'Legal Agreement & Due Date', am: 'ስምምነት እና የክፍያ ቀን', icon: FileSignature },
  { id: 'guarantor', label: 'Guarantor', am: 'ዋስ', icon: ShieldCheck },
  { id: 'authorization', label: 'Admin Authorization', am: 'የአስተዳዳሪ ፈቃድ', icon: BadgeCheck },
];

const errorClass = 'border-red-400 dark:border-red-500/70 focus:ring-red-400';

function FieldShell({
  label,
  am,
  error,
  hint,
  required = true,
  children,
}: {
  label: string;
  am?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="flex items-baseline gap-1.5 text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label}
        {required && <span className="text-red-500" aria-hidden>*</span>}
        {am && <span className="am text-slate-400 dark:text-slate-500 text-xs">{am}</span>}
      </span>
      {children}
      {error ? (
        <span role="alert" className="flex items-start gap-1 text-[12px] text-red-600 dark:text-red-400 mt-1">
          <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> {error}
        </span>
      ) : (
        hint && <span className="block text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</span>
      )}
    </div>
  );
}

function SectionTitle({ title, am, sub }: { title: string; am: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="am text-xs text-slate-500 dark:text-slate-400">{am}</p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">{sub}</p>}
    </div>
  );
}

function fmtSize(b: number) {
  return b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function FileField({
  label,
  am,
  file,
  onChange,
  error,
  allowCapture,
  hint,
}: {
  label: string;
  am?: string;
  file: File | null;
  onChange: (f: File | null) => void;
  error?: string;
  allowCapture?: boolean;
  hint?: string;
}) {
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (file && file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (f) onChange(f);
    e.target.value = '';
  };

  return (
    <FieldShell label={label} am={am} error={error} hint={hint}>
      <div
        className={`rounded-xl border border-dashed p-3.5 bg-slate-50/60 dark:bg-slate-800/40 ${
          error ? 'border-red-400 dark:border-red-500/70' : 'border-slate-300 dark:border-slate-700'
        }`}
      >
        {file ? (
          <div className="flex items-center gap-3">
            {preview ? (
              <img src={preview} alt="" className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-slate-500 dark:text-slate-300" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{file.name}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{fmtSize(file.size)}</div>
            </div>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
              aria-label={`Remove ${label}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="secondary" onClick={() => pickRef.current?.click()}>
              <Upload className="w-4 h-4" /> Upload file
            </Button>
            {allowCapture && (
              <Button type="button" variant="ghost" onClick={() => camRef.current?.click()}>
                <Camera className="w-4 h-4" /> Take photo
              </Button>
            )}
            <span className="text-[11px] text-slate-400 dark:text-slate-500">PDF, JPG, PNG, WEBP or HEIC, up to 10 MB</span>
          </div>
        )}
        <input ref={pickRef} type="file" accept={ACCEPT_ATTR} className="hidden" onChange={onPick} />
        {allowCapture && (
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
        )}
      </div>
    </FieldShell>
  );
}

export default function CreditRegistrationForm({
  onClose,
  onRegistered,
}: {
  onClose: () => void;
  onRegistered: (c: Credit) => void;
}) {
  const { user } = useAdminAuth();
  const [d, setD] = useState<CreditDraft>(emptyDraft);
  const [stepIdx, setStepIdx] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIdx];
  const total = useMemo(() => totalAmount(d.items), [d.items]);
  const balance = useMemo(() => remainingBalance(d.items, d.down_payment), [d.items, d.down_payment]);
  const autoWords = useMemo(() => amountToWords(total), [total]);

  // Keep "amount in words" in sync with the total until the admin edits it by hand.
  useEffect(() => {
    if (!d.words_edited) setD((p) => (p.total_amount_words === autoWords ? p : { ...p, total_amount_words: autoWords }));
  }, [autoWords, d.words_edited]);

  const set = <K extends keyof CreditDraft>(key: K, value: CreditDraft[K]) => {
    setD((p) => ({ ...p, [key]: value }));
    if (errors[key as string]) setErrors((p) => ({ ...p, [key as string]: '' }));
  };

  const setItem = (idx: number, patch: Partial<CreditDraft['items'][number]>) => {
    setD((p) => ({ ...p, items: p.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));
    const keys = Object.keys(patch).map((k) => `item_${idx}_${k}`);
    setErrors((p) => {
      const next = { ...p, items: '' };
      keys.forEach((k) => (next[k] = ''));
      return next;
    });
  };

  const scrollTop = () => bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const stepHasErrors = (id: StepId, e: Errors) => {
    const probe = validateStep(id, d);
    return Object.keys(probe).some((k) => e[k]);
  };

  function next() {
    const e = validateStep(step.id, d);
    setErrors((p) => ({ ...p, ...e }));
    if (Object.keys(e).length > 0) {
      setSubmitError(null);
      scrollTop();
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    scrollTop();
  }

  async function submit() {
    setSubmitError(null);
    if (!user) return setSubmitError('Your admin session has expired. Sign in again.');
    const { errors: all, firstBadStep } = validateAll(d);
    if (firstBadStep) {
      setErrors(all);
      setStepIdx(STEP_ORDER.indexOf(firstBadStep));
      setSubmitError('Some required information is missing or invalid. Fix the highlighted fields, then register again.');
      scrollTop();
      return;
    }
    setSubmitting(true);
    try {
      const credit = await registerCredit(user.id, d);
      onRegistered(credit);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not register the credit.');
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  }

  const isLast = stepIdx === STEPS.length - 1;
  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-5xl sm:rounded-2xl shadow-2xl flex flex-col max-h-screen sm:max-h-[94vh] border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sm:rounded-t-2xl">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Register Credit</h2>
            <p className="am text-xs text-slate-500 dark:text-slate-400">የብድር ምዝገባ (በአስተዳዳሪ)</p>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        <ol className="flex gap-1.5 overflow-x-auto px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === stepIdx;
            const done = i < stepIdx;
            const bad = stepHasErrors(s.id, errors);
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  disabled={i > stepIdx || submitting}
                  onClick={() => setStepIdx(i)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-gradient-to-br from-amber-500 to-orange-500 text-slate-900 shadow-md shadow-orange-500/20'
                      : bad
                      ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300'
                      : done
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  } ${i > stepIdx ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  {done && !bad ? <Check className="w-4 h-4" /> : bad ? <AlertTriangle className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  <span>
                    <span className="block">{s.label}</span>
                    <span className="am block text-[10px] font-normal opacity-80">{s.am}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-5 grid lg:grid-cols-[1fr_16rem] gap-5 items-start">
          <div className="space-y-4 min-w-0">
            {(submitError || errorCount > 0) && (
              <div role="alert" className="flex items-start gap-2 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{submitError ?? `Fix ${errorCount} highlighted field${errorCount === 1 ? '' : 's'} to continue.`}</span>
              </div>
            )}

            <Card className="p-5">
              {step.id === 'customer' && (
                <>
                  <SectionTitle title="Customer identification" am="የደንበኛ መለያ" sub="All fields are required. Enter the details exactly as they appear on the customer's official ID." />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <FieldShell label="Full name (as on official ID)" am="ሙሉ ስም" error={errors.customer_full_name}>
                        <input value={d.customer_full_name} onChange={(e) => set('customer_full_name', e.target.value)} className={`${inputClass} am ${errors.customer_full_name ? errorClass : ''}`} autoComplete="off" />
                      </FieldShell>
                    </div>
                    <FieldShell label="Phone number" am="ስልክ" error={errors.customer_phone}>
                      <input value={d.customer_phone} onChange={(e) => set('customer_phone', e.target.value)} inputMode="tel" placeholder="0911223344" className={`${inputClass} ${errors.customer_phone ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="City" am="ከተማ" error={errors.customer_city}>
                      <input value={d.customer_city} onChange={(e) => set('customer_city', e.target.value)} className={`${inputClass} am ${errors.customer_city ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="Sub-city / Woreda" am="ክፍለ ከተማ / ወረዳ" error={errors.customer_subcity_woreda}>
                      <input value={d.customer_subcity_woreda} onChange={(e) => set('customer_subcity_woreda', e.target.value)} className={`${inputClass} am ${errors.customer_subcity_woreda ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="Kebele" am="ቀበሌ" error={errors.customer_kebele}>
                      <input value={d.customer_kebele} onChange={(e) => set('customer_kebele', e.target.value)} className={`${inputClass} am ${errors.customer_kebele ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="ID type" am="የመታወቂያ አይነት" error={errors.customer_id_type}>
                      <select value={d.customer_id_type} onChange={(e) => set('customer_id_type', e.target.value as IdType | '')} className={`${inputClass} ${errors.customer_id_type ? errorClass : ''}`}>
                        <option value="">Select…</option>
                        {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((k) => (
                          <option key={k} value={k}>{ID_TYPE_LABELS[k].en} · {ID_TYPE_LABELS[k].am}</option>
                        ))}
                      </select>
                    </FieldShell>
                    <FieldShell label="Official ID number" am="የመታወቂያ ቁጥር" error={errors.customer_id_number}>
                      <input value={d.customer_id_number} onChange={(e) => set('customer_id_number', e.target.value)} className={`${inputClass} ${errors.customer_id_number ? errorClass : ''}`} autoComplete="off" />
                    </FieldShell>
                    <div className="sm:col-span-2">
                      <FileField label="Scanned ID document" am="የመታወቂያ ቅጂ" file={d.id_file} onChange={(f) => set('id_file', f)} error={errors.id_file} allowCapture hint="Kebele ID, Driving License or Passport. Both sides if the ID has two." />
                    </div>
                  </div>
                </>
              )}

              {step.id === 'items' && (
                <>
                  <SectionTitle title="Items & financials" am="እቃዎች እና ገንዘብ" sub="List every material taken on credit. The total and remaining balance are calculated for you." />
                  {errors.items && (
                    <div role="alert" className="text-[12px] text-red-600 dark:text-red-400 mb-3 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> {errors.items}
                    </div>
                  )}
                  <datalist id="credit-item-names">{COMMON_ITEMS.map((n) => <option key={n} value={n} />)}</datalist>
                  <datalist id="credit-item-units">{COMMON_UNITS.map((n) => <option key={n} value={n} />)}</datalist>
                  <div className="space-y-3">
                    {d.items.map((it, idx) => (
                      <div key={it.key} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-800/30">
                        <div className="grid grid-cols-2 md:grid-cols-[1fr_6rem_6rem_8rem_auto] gap-3 items-start">
                          <div className="col-span-2 md:col-span-1">
                            <FieldShell label="Item" error={errors[`item_${idx}_name`]}>
                              <input list="credit-item-names" value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} placeholder="Cement, Ferro/Rebar, Bricks…" className={`${inputClass} ${errors[`item_${idx}_name`] ? errorClass : ''}`} />
                            </FieldShell>
                          </div>
                          <FieldShell label="Unit" required={false}>
                            <input list="credit-item-units" value={it.unit} onChange={(e) => setItem(idx, { unit: e.target.value })} className={inputClass} />
                          </FieldShell>
                          <FieldShell label="Qty" error={errors[`item_${idx}_quantity`]}>
                            <input type="number" min="0" step="any" inputMode="decimal" value={it.quantity} onChange={(e) => setItem(idx, { quantity: e.target.value })} className={`${inputClass} tabular-nums ${errors[`item_${idx}_quantity`] ? errorClass : ''}`} />
                          </FieldShell>
                          <FieldShell label="Unit price (ETB)" error={errors[`item_${idx}_unit_price`]}>
                            <input type="number" min="0" step="any" inputMode="decimal" value={it.unit_price} onChange={(e) => setItem(idx, { unit_price: e.target.value })} className={`${inputClass} tabular-nums ${errors[`item_${idx}_unit_price`] ? errorClass : ''}`} />
                          </FieldShell>
                          <div className="col-span-2 md:col-span-1 flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 md:pt-7">
                            <div className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">{fmtETB(lineTotal(it))}</div>
                            <button
                              type="button"
                              disabled={d.items.length === 1}
                              onClick={() => setD((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="ghost" className="mt-3" onClick={() => setD((p) => ({ ...p, items: [...p.items, newItem()] }))}>
                    <Plus className="w-4 h-4" /> Add item
                  </Button>

                  <div className="grid sm:grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
                    <FieldShell label="Total amount (ETB)" am="ጠቅላላ ዋጋ" required={false}>
                      <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtETB(total)}</div>
                    </FieldShell>
                    <FieldShell label="Down payment (ETB)" am="የቅድሚያ ክፍያ" required={false} error={errors.down_payment} hint="Optional. Leave empty for 0.">
                      <input type="number" min="0" step="any" inputMode="decimal" value={d.down_payment} onChange={(e) => set('down_payment', e.target.value)} placeholder="0" className={`${inputClass} tabular-nums ${errors.down_payment ? errorClass : ''}`} />
                    </FieldShell>
                    <div className="sm:col-span-2">
                      <FieldShell label="Total amount in words" am="በፊደል" error={errors.total_amount_words} hint="Filled in automatically in English. Edit it if the agreement is written in Amharic.">
                        <input
                          value={d.total_amount_words}
                          onChange={(e) => {
                            setD((p) => ({ ...p, total_amount_words: e.target.value, words_edited: true }));
                            if (errors.total_amount_words) setErrors((p) => ({ ...p, total_amount_words: '' }));
                          }}
                          className={`${inputClass} am ${errors.total_amount_words ? errorClass : ''}`}
                        />
                      </FieldShell>
                      {d.words_edited && autoWords && d.total_amount_words !== autoWords && (
                        <button type="button" className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mt-1" onClick={() => setD((p) => ({ ...p, total_amount_words: autoWords, words_edited: false }))}>
                          Reset to automatic words
                        </button>
                      )}
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 flex items-center justify-between">
                      <span className="text-sm text-rose-700 dark:text-rose-300">Remaining balance (on credit)</span>
                      <span className="font-bold tabular-nums text-rose-700 dark:text-rose-300">{fmtETB(balance)} ETB</span>
                    </div>
                  </div>
                </>
              )}

              {step.id === 'legal' && (
                <>
                  <SectionTitle title="Legal agreement & due date" am="ስምምነት እና የክፍያ ቀን" sub="Upload the scan or photo of the credit agreement / promissory note after it has been signed by the customer." />
                  <div className="grid gap-4 max-w-xl">
                    <FieldShell label="Payment due date / deadline" am="የክፍያ ማብቂያ ቀን" error={errors.due_date}>
                      <input type="date" min={todayISO()} value={d.due_date} onChange={(e) => set('due_date', e.target.value)} className={`${inputClass} ${errors.due_date ? errorClass : ''}`} />
                    </FieldShell>
                    <FileField label="Signed credit agreement / promissory note" am="የተፈረመ የብድር ስምምነት" file={d.agreement_file} onChange={(f) => set('agreement_file', f)} error={errors.agreement_file} allowCapture hint="Required. The credit cannot be registered without the signed document." />
                  </div>
                </>
              )}

              {step.id === 'guarantor' && (
                <>
                  <SectionTitle title="Guarantor & collateral" am="ዋስ እና መያዣ" sub="A guarantor is mandatory for legal accountability. Collateral is optional." />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <FieldShell label="Guarantor full name" am="የዋስ ሙሉ ስም" error={errors.guarantor_full_name}>
                      <input value={d.guarantor_full_name} onChange={(e) => set('guarantor_full_name', e.target.value)} className={`${inputClass} am ${errors.guarantor_full_name ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="Guarantor phone" am="ስልክ" error={errors.guarantor_phone}>
                      <input value={d.guarantor_phone} onChange={(e) => set('guarantor_phone', e.target.value)} inputMode="tel" placeholder="0911223344" className={`${inputClass} ${errors.guarantor_phone ? errorClass : ''}`} />
                    </FieldShell>
                    <FieldShell label="Guarantor ID number" am="የመታወቂያ ቁጥር" error={errors.guarantor_id_number}>
                      <input value={d.guarantor_id_number} onChange={(e) => set('guarantor_id_number', e.target.value)} className={`${inputClass} ${errors.guarantor_id_number ? errorClass : ''}`} autoComplete="off" />
                    </FieldShell>
                    <FieldShell label="Guarantor address" am="አድራሻ" error={errors.guarantor_address}>
                      <input value={d.guarantor_address} onChange={(e) => set('guarantor_address', e.target.value)} className={`${inputClass} am ${errors.guarantor_address ? errorClass : ''}`} />
                    </FieldShell>
                    <div className="sm:col-span-2">
                      <FieldShell label="Collateral details" am="የመያዣ ዝርዝር" required={false} hint="Optional. Vehicle plate number, house deed, or other asset.">
                        <textarea rows={3} value={d.collateral_details} onChange={(e) => set('collateral_details', e.target.value)} className={`${inputClass} am`} />
                      </FieldShell>
                    </div>
                  </div>
                </>
              )}

              {step.id === 'authorization' && (
                <>
                  <SectionTitle title="Admin authorization" am="የአስተዳዳሪ ፈቃድ" sub="This credit will be recorded under your account with the exact time of registration. It cannot be edited afterwards." />
                  <div className="grid sm:grid-cols-2 gap-3 mb-4">
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Registered by</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.displayName ?? '—'}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 break-all">ID {user?.id ?? '—'}</div>
                    </div>
                    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Role</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{user?.role ?? '—'}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">Timestamp is set by the server on save</div>
                    </div>
                  </div>
                  <FieldShell label="Admin override justification" am="የፈቃድ ምክንያት" error={errors.admin_justification} hint={`${d.admin_justification.trim().length} characters. Minimum 20.`}>
                    <textarea
                      rows={5}
                      value={d.admin_justification}
                      onChange={(e) => set('admin_justification', e.target.value)}
                      placeholder="Why are you registering / authorizing this credit?"
                      className={`${inputClass} am ${errors.admin_justification ? errorClass : ''}`}
                    />
                  </FieldShell>
                </>
              )}
            </Card>
          </div>

          {/* Live summary */}
          <aside className="lg:sticky lg:top-0 space-y-3">
            <Card className="p-4">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Total</div>
              <div className="text-lg font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtETB(total)} ETB</div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Down payment</div>
              <div className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{fmtETB(Number(d.down_payment) || 0)} ETB</div>
              <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">Remaining balance</div>
              <div className="text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">{fmtETB(balance)} ETB</div>
            </Card>
            <Card className="p-4 text-[12px] space-y-1.5">
              <Check2 ok={!!d.id_file} label="ID document attached" />
              <Check2 ok={!!d.agreement_file} label="Signed agreement attached" />
              <Check2 ok={!!d.due_date} label="Due date set" />
              <Check2 ok={d.admin_justification.trim().length >= 20} label="Justification written" />
            </Card>
          </aside>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sm:rounded-b-2xl">
          <Button type="button" variant="ghost" onClick={() => (stepIdx === 0 ? onClose() : setStepIdx(stepIdx - 1))} disabled={submitting}>
            {stepIdx === 0 ? 'Cancel' : (<><ChevronLeft className="w-4 h-4" /> Back</>)}
          </Button>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">Step {stepIdx + 1} of {STEPS.length}</div>
          {isLast ? (
            <Button type="button" onClick={submit} loading={submitting}>
              <BadgeCheck className="w-4 h-4" /> Register credit
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Check2({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>
      <span className={`w-4 h-4 rounded-full flex items-center justify-center ${ok ? 'bg-emerald-100 dark:bg-emerald-500/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
        {ok && <Check className="w-3 h-3" />}
      </span>
      {label}
    </div>
  );
}
