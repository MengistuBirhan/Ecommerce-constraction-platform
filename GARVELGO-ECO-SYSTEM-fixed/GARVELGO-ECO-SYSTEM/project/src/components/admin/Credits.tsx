import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, FileText, Plus, Search, Landmark, CalendarClock, Wallet, ExternalLink, Lock } from 'lucide-react';
import { useAdminAuth } from '@/lib/adminAuth';
import { fmtETB, fmtDate, fmtDateTime } from '@/lib/format';
import {
  ID_TYPE_LABELS,
  getDocumentUrl,
  listCredits,
  setCreditStatus,
  todayISO,
  type Credit,
  type CreditStatus,
} from '@/lib/credits';
import { Badge, Button, Card, EmptyState, Spinner, inputClass } from '@/components/ui';
import CreditRegistrationForm from '@/components/admin/CreditRegistrationForm';

const STATUS_TONE: Record<CreditStatus, 'amber' | 'green' | 'red' | 'slate'> = {
  active: 'amber',
  settled: 'green',
  defaulted: 'red',
  cancelled: 'slate',
};

export function AdminAuthorizedBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 whitespace-nowrap">
      <BadgeCheck className="w-3.5 h-3.5" /> Admin Authorized Credit
    </span>
  );
}

export default function Credits() {
  const { user } = useAdminAuth();
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Credit | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const canRegister = !!user && user.role === 'admin' && user.creditAuthorized;

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      setCredits(await listCredits(user.id));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load credits.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return credits;
    return credits.filter(
      (c) =>
        c.customer_full_name.toLowerCase().includes(q) ||
        c.customer_phone.includes(q) ||
        c.credit_number.toLowerCase().includes(q) ||
        c.customer_id_number.toLowerCase().includes(q),
    );
  }, [credits, search]);

  const today = todayISO();
  const outstanding = credits.filter((c) => c.status === 'active').reduce((s, c) => s + c.remaining_balance, 0);
  const overdue = credits.filter((c) => c.status === 'active' && c.due_date < today);

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Lock className="w-8 h-8 text-amber-500 mb-3" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Admin sign-in required</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
          Credit records contain ID scans and legal documents. Sign in with an admin account to view or register credit.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-7 h-7" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat icon={Landmark} label="Active credits" am="ንቁ ብድሮች" value={`${credits.filter((c) => c.status === 'active').length}`} accent="from-sky-400 to-blue-500" />
        <Stat icon={Wallet} label="Outstanding balance" am="ቀሪ ብድር" value={`${fmtETB(outstanding)} ETB`} accent="from-rose-400 to-red-500" />
        <Stat icon={CalendarClock} label="Past due date" am="ጊዜው ያለፈ" value={`${overdue.length}`} accent="from-amber-400 to-orange-500" />
      </div>

      {flash && (
        <div role="status" className="text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl px-4 py-3">
          {flash}
        </div>
      )}
      {loadError && (
        <div role="alert" className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-xl px-4 py-3">
          {loadError}. If this says the function does not exist, apply the latest Supabase migration.
        </div>
      )}

      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Credit Management</h3>
            <p className="am text-xs text-slate-500 dark:text-slate-400">የብድር አስተዳደር</p>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone, ID, CR-…" className={`${inputClass} pl-9 sm:w-64`} />
            </div>
            <Button onClick={() => setShowForm(true)} disabled={!canRegister} title={canRegister ? undefined : 'This admin account is not credit-authorized'}>
              <Plus className="w-4 h-4" /> Register credit
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={Landmark} title={credits.length === 0 ? 'No credits registered yet' : 'No credits match your search'} subtitle={credits.length === 0 ? 'Register a credit to record the customer, guarantor and signed agreement.' : undefined} />
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-3 py-2 font-semibold">Credit</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold text-right">Total</th>
                  <th className="px-3 py-2 font-semibold text-right">Balance</th>
                  <th className="px-3 py-2 font-semibold">Due</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/70">
                {filtered.map((c) => {
                  const late = c.status === 'active' && c.due_date < today;
                  return (
                    <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer">
                      <td className="px-3 py-3 align-top">
                        <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{c.credit_number}</div>
                        <div className="mt-1.5">{c.is_admin_authorized && <AdminAuthorizedBadge />}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="am font-semibold text-slate-800 dark:text-slate-100">{c.customer_full_name}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">{c.customer_phone} · guarantor {c.guarantor_full_name}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-right tabular-nums text-slate-600 dark:text-slate-300">{fmtETB(c.total_amount)}</td>
                      <td className="px-3 py-3 align-top text-right tabular-nums font-bold text-rose-600 dark:text-rose-400">{fmtETB(c.remaining_balance)}</td>
                      <td className="px-3 py-3 align-top whitespace-nowrap">
                        <div className="text-slate-700 dark:text-slate-200">{fmtDate(c.due_date)}</div>
                        {late && <Badge tone="red">overdue</Badge>}
                      </td>
                      <td className="px-3 py-3 align-top"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showForm && (
        <CreditRegistrationForm
          onClose={() => setShowForm(false)}
          onRegistered={(c) => {
            setShowForm(false);
            setFlash(`Credit ${c.credit_number} registered for ${c.customer_full_name}.`);
            load();
          }}
        />
      )}

      {selected && (
        <CreditDetail
          credit={selected}
          onClose={() => setSelected(null)}
          onStatus={async (status) => {
            const updated = await setCreditStatus(user.id, selected.id, status);
            setSelected({ ...selected, status: updated.status, settled_at: updated.settled_at });
            await load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, am, value, accent }: { icon: React.ComponentType<{ className?: string }>; label: string; am: string; value: string; accent: string }) {
  return (
    <Card className="p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${accent} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{label}</div>
        <div className="am text-[11px] text-slate-400 dark:text-slate-500 -mt-0.5">{am}</div>
        <div className="text-lg font-bold tabular-nums truncate">{value}</div>
      </div>
    </Card>
  );
}

function DocButton({ label, path }: { label: string; path: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function open() {
    setBusy(true);
    setErr(null);
    try {
      window.open(await getDocumentUrl(path), '_blank', 'noopener');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open the document.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Button variant="secondary" onClick={open} loading={busy}>
        <FileText className="w-4 h-4" /> {label} <ExternalLink className="w-3.5 h-3.5 opacity-70" />
      </Button>
      {err && <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">{err}</p>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-slate-100 dark:border-slate-800/70">
      <span className="text-slate-500 dark:text-slate-400 shrink-0">{k}</span>
      <span className="text-right text-slate-800 dark:text-slate-100 am break-words min-w-0">{v}</span>
    </div>
  );
}

function CreditDetail({ credit: c, onClose, onStatus }: { credit: Credit; onClose: () => void; onStatus: (s: CreditStatus) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function change(s: CreditStatus) {
    const labels: Record<CreditStatus, string> = { active: 'reopen', settled: 'mark as settled', defaulted: 'mark as defaulted', cancelled: 'cancel' };
    if (!window.confirm(`Are you sure you want to ${labels[s]} ${c.credit_number}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await onStatus(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not update status.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 font-mono">{c.credit_number}</h3>
              {c.is_admin_authorized && <AdminAuthorizedBadge />}
              <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
            </div>
            <p className="am text-sm text-slate-600 dark:text-slate-300 mt-1">{c.customer_full_name}</p>
          </div>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>

        <div className="p-5 grid md:grid-cols-2 gap-x-8 gap-y-6">
          <section>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Customer</h4>
            <Row k="Phone" v={c.customer_phone} />
            <Row k="Address" v={`${c.customer_city}, ${c.customer_subcity_woreda}, Kebele ${c.customer_kebele}`} />
            <Row k={ID_TYPE_LABELS[c.customer_id_type].en} v={c.customer_id_number} />
          </section>
          <section>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Guarantor</h4>
            <Row k="Name" v={c.guarantor_full_name} />
            <Row k="Phone" v={c.guarantor_phone} />
            <Row k="ID number" v={c.guarantor_id_number} />
            <Row k="Address" v={c.guarantor_address} />
            <Row k="Collateral" v={c.collateral_details || '—'} />
          </section>

          <section className="md:col-span-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Items</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-1.5 font-semibold">Item</th>
                    <th className="py-1.5 font-semibold text-right">Qty</th>
                    <th className="py-1.5 font-semibold text-right">Unit price</th>
                    <th className="py-1.5 font-semibold text-right">Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((it, i) => (
                    <tr key={i} className="border-b border-slate-50 dark:border-slate-800/60">
                      <td className="py-1.5 am text-slate-800 dark:text-slate-100">{it.name}</td>
                      <td className="py-1.5 text-right tabular-nums">{it.quantity} {it.unit}</td>
                      <td className="py-1.5 text-right tabular-nums">{fmtETB(it.unit_price)}</td>
                      <td className="py-1.5 text-right tabular-nums font-semibold">{fmtETB(it.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 grid sm:grid-cols-3 gap-3">
              <MiniStat label="Total" value={`${fmtETB(c.total_amount)} ETB`} />
              <MiniStat label="Down payment" value={`${fmtETB(c.down_payment)} ETB`} />
              <MiniStat label="Remaining balance" value={`${fmtETB(c.remaining_balance)} ETB`} danger />
            </div>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-2 am">In words: {c.total_amount_words}</p>
          </section>

          <section>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Terms</h4>
            <Row k="Due date" v={fmtDate(c.due_date)} />
            <div className="flex flex-wrap gap-2 mt-3">
              <DocButton label="Customer ID" path={c.id_document_url} />
              <DocButton label="Signed agreement" path={c.agreement_document_url} />
            </div>
          </section>
          <section>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Authorization</h4>
            <Row k="Registered by" v={`${c.registered_by_name} (${c.registered_by_role})`} />
            <Row k="User ID" v={<span className="font-mono text-[11px]">{c.registered_by}</span>} />
            <Row k="Registered at" v={fmtDateTime(c.created_at)} />
            <div className="mt-2 rounded-xl bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 p-3 text-sm text-violet-900 dark:text-violet-200 am whitespace-pre-wrap">
              {c.admin_justification}
            </div>
          </section>
        </div>

        <div className="px-5 pb-5">
          {err && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{err}</p>}
          <div className="flex flex-wrap gap-2">
            {c.status === 'active' ? (
              <>
                <Button onClick={() => change('settled')} loading={busy}>Mark settled</Button>
                <Button variant="secondary" onClick={() => change('defaulted')} disabled={busy}>Mark defaulted</Button>
                <Button variant="danger" onClick={() => change('cancelled')} disabled={busy}>Cancel credit</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => change('active')} loading={busy}>Reopen</Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
      <div className="text-[11px] text-slate-400 dark:text-slate-500 font-semibold">{label}</div>
      <div className={`text-base font-bold tabular-nums ${danger ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-slate-100'}`}>{value}</div>
    </div>
  );
}
