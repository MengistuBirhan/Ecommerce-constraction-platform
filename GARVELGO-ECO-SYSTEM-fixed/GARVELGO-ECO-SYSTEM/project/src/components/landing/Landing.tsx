import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardHat,
  ArrowRight,
  LogIn,
  Menu,
  X,
  Phone,
  Mail,
  Clock,
  MapPin,
  Navigation,
  ExternalLink,
  Building2,
  Package,
  Truck,
  ShieldCheck,
  Wallet,
  Check,
} from 'lucide-react';
import AdminLogin from '@/components/AdminLogin';
import { ThemeToggle } from '@/lib/theme';
import { useRole, getHomeTab } from '@/lib/rbac';
import { useAdminAuth } from '@/lib/adminAuth';
import {
  COMPANY_INFO,
  telHref,
  mapEmbedUrl,
  mapDirectionsUrl,
  mapOpenUrl,
  type Service,
} from '@/config/company';

const NAV_LINKS = [
  { href: '#about', en: 'About', am: 'ስለ እኛ' },
  { href: '#services', en: 'Services', am: 'አገልግሎቶች' },
  { href: '#branches', en: 'Branches', am: 'ቅርንጫፎች' },
  { href: '#contact', en: 'Contact', am: 'ያግኙን' },
];

const SERVICE_ICON: Record<Service['key'], typeof Package> = {
  materials: Package,
  delivery: Truck,
  payments: Wallet,
  gate: ShieldCheck,
};

export default function Landing() {
  const navigate = useNavigate();
  const { role } = useRole();
  const { user, logout } = useAdminAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const enterSystem = () => navigate(`/${getHomeTab(role)}`);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* ───────── Top bar ───────── */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800 text-white">
        <div className="max-w-6xl mx-auto h-16 px-4 lg:px-8 flex items-center gap-4">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <HardHat className="w-5 h-5 text-slate-900" strokeWidth={2.2} />
            </span>
            <span className="leading-tight">
              <span className="block font-bold text-sm tracking-tight">{COMPANY_INFO.name}</span>
              <span className="am block text-[10px] text-slate-400">{COMPANY_INFO.taglineAm}</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-1 ml-6">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                {l.en} <span className="am text-[11px] text-slate-500">{l.am}</span>
              </a>
            ))}
          </nav>

          <div className="flex-1" />

          <ThemeToggle />
          {user ? (
            <div className="hidden sm:flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5">
              <span className="text-[13px] font-semibold text-amber-300">{user.displayName}</span>
              <button onClick={logout} className="text-[11px] font-semibold text-amber-200/80 hover:text-white">
                Log out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-[13px] font-semibold text-slate-100 hover:bg-slate-700 transition-colors"
            >
              <LogIn className="w-4 h-4 text-amber-400" />
              Staff Sign in <span className="am text-[11px] text-slate-400">መግቢያ</span>
            </button>
          )}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg hover:bg-white/10 text-slate-200"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1 bg-slate-950">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/10"
              >
                {l.en} <span className="am text-xs text-slate-500">{l.am}</span>
              </a>
            ))}
            {!user && (
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setLoginOpen(true);
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold text-amber-300 hover:bg-white/10"
              >
                Staff Sign in <span className="am text-xs text-slate-400">የሰራተኛ መግቢያ</span>
              </button>
            )}
          </div>
        )}
      </header>

      <main id="top">
        {/* ───────── Hero ───────── */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div
            aria-hidden
            className="absolute inset-0 opacity-70"
            style={{
              backgroundImage:
                'radial-gradient(60rem 30rem at 85% -10%, rgba(245,158,11,0.28), transparent 60%), radial-gradient(40rem 24rem at 0% 110%, rgba(249,115,22,0.20), transparent 60%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.06]"
            style={{
              backgroundImage:
                'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div className="relative max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-24 grid lg:grid-cols-5 gap-10 items-center">
            <div className="lg:col-span-3 animate-fade-in-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {COMPANY_INFO.tagline} <span className="am text-[11px] text-amber-200/70">· መግቢያ ገጽ</span>
              </span>

              <h1 className="am mt-5 text-3xl sm:text-5xl font-bold leading-[1.25] tracking-tight">
                እንኳን ወደ ድርጅቱ ሽያጭ ማዕከል
                <span className="block bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent">
                  በሰላም መጣችሁ
                </span>
              </h1>
              <p className="mt-3 text-xl sm:text-2xl font-semibold text-slate-200 tracking-tight">
                Welcome to our Company Sales Center
              </p>
              <p className="mt-4 max-w-xl text-sm sm:text-base text-slate-400 leading-relaxed">
                {COMPANY_INFO.about.text}
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={enterSystem}
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 px-6 py-4 text-slate-900 shadow-xl shadow-orange-500/30 hover:from-amber-300 hover:to-orange-400 transition-all focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-slate-950"
                >
                  <span className="text-left leading-tight">
                    <span className="am block text-base font-bold">ወደ ሽያጭ ገጽ ይግቡ</span>
                    <span className="block text-sm font-semibold text-slate-800/80">Enter Sales System</span>
                  </span>
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" strokeWidth={2.6} />
                </button>
                <a
                  href="#branches"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-100 hover:bg-white/10 transition-colors"
                >
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="leading-tight text-left">
                    Find a Branch
                    <span className="am block text-[11px] font-normal text-slate-400">ቅርንጫፍ ያግኙ</span>
                  </span>
                </a>
              </div>
            </div>

            {/* Quick info card */}
            <aside className="lg:col-span-2 animate-fade-in-up">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur p-6 space-y-5 shadow-2xl shadow-black/30">
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-amber-300" />
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Call us · <span className="am normal-case">ይደውሉልን</span>
                    </div>
                    <a href={telHref(COMPANY_INFO.phones[0].number)} className="text-lg font-bold hover:text-amber-300">
                      {COMPANY_INFO.phones[0].number}
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-amber-300" />
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Opening hours · <span className="am normal-case">የስራ ሰዓት</span>
                    </div>
                    <div className="text-sm font-semibold">
                      {COMPANY_INFO.hours[0].days}, {COMPANY_INFO.hours[0].time}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-xl bg-amber-400/15 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-amber-300" />
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400">
                      Locations · <span className="am normal-case">አድራሻዎች</span>
                    </div>
                    <div className="text-sm font-semibold">
                      {COMPANY_INFO.branches.length} branches · Main office:{' '}
                      {(COMPANY_INFO.branches.find((b) => b.isMain) ?? COMPANY_INFO.branches[0]).address.split(',')[0]}
                    </div>
                  </div>
                </div>
                <ul className="pt-4 border-t border-white/10 space-y-2 text-sm text-slate-300">
                  {['Official, transparent prices', 'Telebirr & CBE verified payments', 'Tracked truck delivery'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" strokeWidth={3} />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>

        {/* ───────── About ───────── */}
        <section id="about" className="scroll-mt-20 max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-20">
          <SectionTitle en="About Us" am="ስለ ድርጅታችን" />
          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{COMPANY_INFO.about.text}</p>
              <p className="am mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">{COMPANY_INFO.about.textAm}</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { v: `${COMPANY_INFO.branches.length}`, en: 'Branches', am: 'ቅርንጫፎች' },
                { v: 'Telebirr · CBE', en: 'Verified payments', am: 'የተረጋገጠ ክፍያ' },
                { v: 'Gate Pass', en: 'Secure dispatch', am: 'ደህንነቱ የተጠበቀ ዝውውር' },
              ].map((s) => (
                <div
                  key={s.en}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center shadow-sm flex flex-col justify-center"
                >
                  <div className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400 leading-tight">{s.v}</div>
                  <div className="text-xs font-semibold mt-1">{s.en}</div>
                  <div className="am text-[11px] text-slate-400">{s.am}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ───────── Services ───────── */}
        <section id="services" className="scroll-mt-20 bg-white dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-20">
            <SectionTitle en="Our Services" am="አገልግሎቶቻችን" />
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {COMPANY_INFO.services.map((s) => {
                const Icon = SERVICE_ICON[s.key];
                return (
                  <div
                    key={s.key}
                    className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-5 hover:border-amber-300 dark:hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 transition-all"
                  >
                    <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/20">
                      <Icon className="w-5 h-5 text-slate-900" strokeWidth={2.2} />
                    </span>
                    <h3 className="mt-4 font-bold leading-tight">{s.title}</h3>
                    <div className="am text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">{s.titleAm}</div>
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{s.desc}</p>
                    <p className="am mt-2 text-xs text-slate-500 dark:text-slate-500 leading-relaxed">{s.descAm}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ───────── Branches + map ───────── */}
        <BranchSection />

        {/* ───────── Contact ───────── */}
        <section id="contact" className="scroll-mt-20 bg-white dark:bg-slate-900/40 border-y border-slate-200 dark:border-slate-800">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-20">
            <SectionTitle en="For More Information" am="ለበለጠ መረጃ" />
            <div className="mt-8 grid md:grid-cols-3 gap-5">
              <InfoCard icon={Phone} en="Phone" am="ስልክ">
                <ul className="space-y-3">
                  {COMPANY_INFO.phones.map((p) => (
                    <li key={p.number}>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.label} <span className="am">· {p.labelAm}</span>
                      </div>
                      <a href={telHref(p.number)} className="font-bold text-lg hover:text-amber-600 dark:hover:text-amber-400">
                        {p.number}
                      </a>
                    </li>
                  ))}
                </ul>
              </InfoCard>

              <InfoCard icon={Mail} en="Email" am="ኢሜይል">
                <ul className="space-y-3">
                  <li>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      General <span className="am">· አጠቃላይ</span>
                    </div>
                    <a href={`mailto:${COMPANY_INFO.email}`} className="font-bold break-all hover:text-amber-600 dark:hover:text-amber-400">
                      {COMPANY_INFO.email}
                    </a>
                  </li>
                  <li>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Support <span className="am">· ድጋፍ</span>
                    </div>
                    <a
                      href={`mailto:${COMPANY_INFO.supportEmail}`}
                      className="font-bold break-all hover:text-amber-600 dark:hover:text-amber-400"
                    >
                      {COMPANY_INFO.supportEmail}
                    </a>
                  </li>
                </ul>
              </InfoCard>

              <InfoCard icon={Clock} en="Working Hours" am="የስራ ሰዓት">
                <ul className="space-y-3">
                  {COMPANY_INFO.hours.map((h) => (
                    <li key={h.days}>
                      <div className="font-bold">
                        {h.days} <span className="am text-xs font-normal text-slate-400">{h.daysAm}</span>
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">{h.time}</div>
                      <div className="am text-xs text-slate-400">{h.timeAm}</div>
                    </li>
                  ))}
                </ul>
              </InfoCard>
            </div>
          </div>
        </section>
      </main>

      {/* ───────── Footer ───────── */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-10 grid sm:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                <HardHat className="w-5 h-5 text-slate-900" strokeWidth={2.2} />
              </span>
              <span className="font-bold text-white">{COMPANY_INFO.nameFull}</span>
            </div>
            <p className="am mt-3 text-sm">{COMPANY_INFO.nameAm}</p>
            <p className="text-xs mt-1">{COMPANY_INFO.tagline}</p>
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-3">
              Quick links <span className="am text-xs font-normal text-slate-500">ፈጣን አገናኞች</span>
            </div>
            <ul className="space-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-amber-300">
                    {l.en} <span className="am text-xs text-slate-500">{l.am}</span>
                  </a>
                </li>
              ))}
              <li>
                <button onClick={enterSystem} className="hover:text-amber-300">
                  Enter Sales System <span className="am text-xs text-slate-500">ወደ ሽያጭ ገጽ</span>
                </button>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold text-white mb-3">
              Contact <span className="am text-xs font-normal text-slate-500">ያግኙን</span>
            </div>
            <ul className="space-y-2 text-sm">
              <li>{COMPANY_INFO.phones[0].number}</li>
              <li className="break-all">{COMPANY_INFO.email}</li>
              <li>{(COMPANY_INFO.branches.find((b) => b.isMain) ?? COMPANY_INFO.branches[0]).address}</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800 py-4 px-4 text-center">
          <p className="text-[12px] leading-relaxed">
            Developed by Developer Mengistu
            <span className="mx-1.5 text-slate-700">|</span>
            <span className="am">© 2019 ዓ.ም. መብቱ በህግ የተጠበቀ ነው።</span>
            <span className="mx-1.5 text-slate-700">(All Rights Reserved)</span>
          </p>
        </div>
      </footer>

      {loginOpen && (
        <AdminLogin
          onClose={() => setLoginOpen(false)}
          onSuccess={() => {
            setLoginOpen(false);
            enterSystem();
          }}
        />
      )}
    </div>
  );
}

function SectionTitle({ en, am }: { en: string; am: string }) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{en}</h2>
      <p className="am text-sm text-amber-600 dark:text-amber-400 font-semibold mt-1">{am}</p>
      <div className="mt-3 h-1 w-14 rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
    </div>
  );
}

function InfoCard({
  icon: Icon,
  en,
  am,
  children,
}: {
  icon: typeof Phone;
  en: string;
  am: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
          <Icon className="w-5 h-5 text-slate-900" strokeWidth={2.2} />
        </span>
        <div className="leading-tight">
          <div className="font-bold">{en}</div>
          <div className="am text-xs text-slate-400">{am}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function BranchSection() {
  const branches = COMPANY_INFO.branches;
  const [selectedId, setSelectedId] = useState<string>(
    (branches.find((b) => b.isMain) ?? branches[0]).id,
  );
  const selected = useMemo(() => branches.find((b) => b.id === selectedId) ?? branches[0], [branches, selectedId]);

  return (
    <section id="branches" className="scroll-mt-20 max-w-6xl mx-auto px-4 lg:px-8 py-16 sm:py-20">
      <SectionTitle en="Our Locations" am="አድራሻቸው የት እንዳለ የሚመረጥበት ቦታ" />
      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Choose a branch to see its address, directions and map.{' '}
        <span className="am">ቅርንጫፍ ይምረጡ — አድራሻ፣ አቅጣጫና ካርታ ይመልከቱ።</span>
      </p>

      {/* Mobile: dropdown */}
      <div className="mt-6 sm:hidden">
        <label className="block text-[13px] font-medium text-slate-700 dark:text-slate-300 mb-1.5">
          Select branch <span className="am text-xs text-slate-400">ቅርንጫፍ ይምረጡ</span>
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full px-3.5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tablet / desktop: cards */}
      <div className="mt-6 hidden sm:grid sm:grid-cols-3 gap-4">
        {branches.map((b) => {
          const active = b.id === selectedId;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedId(b.id)}
              aria-pressed={active}
              className={`text-left rounded-2xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                active
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-500/10 shadow-lg shadow-amber-500/10'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-amber-300 dark:hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${active ? 'text-amber-600' : 'text-slate-400'}`} />
                {b.isMain && (
                  <span className="rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold px-2 py-0.5">
                    Main · <span className="am">ዋና</span>
                  </span>
                )}
              </div>
              <div className="mt-2 font-bold leading-tight">{b.name}</div>
              <div className="am text-xs text-slate-500 dark:text-slate-400 mt-0.5">{b.nameAm}</div>
            </button>
          );
        })}
      </div>

      {/* Selected branch: details + map */}
      <div key={selected.id} className="mt-6 grid lg:grid-cols-5 gap-6 animate-fade-in-up">
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold leading-tight">{selected.name}</h3>
            {selected.isMain && (
              <span className="rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-bold px-2.5 py-0.5">
                Main Office <span className="am">ዋና ቢሮ</span>
              </span>
            )}
          </div>
          <div className="am text-sm text-slate-500 dark:text-slate-400">{selected.nameAm}</div>

          <dl className="mt-5 space-y-4 text-sm">
            <Detail icon={MapPin} label="Address" labelAm="አድራሻ">
              <div>{selected.address}</div>
              <div className="am text-slate-500 dark:text-slate-400">{selected.addressAm}</div>
            </Detail>
            <Detail icon={Navigation} label="How to find us" labelAm="እንዴት ማግኘት ይቻላል">
              <div>{selected.directions}</div>
              <div className="am text-slate-500 dark:text-slate-400">{selected.directionsAm}</div>
            </Detail>
            <Detail icon={Phone} label="Phone" labelAm="ስልክ">
              <a href={telHref(selected.phone)} className="font-semibold hover:text-amber-600 dark:hover:text-amber-400">
                {selected.phone}
              </a>
            </Detail>
            <Detail icon={Clock} label="Hours" labelAm="የስራ ሰዓት">
              <div>{selected.hours}</div>
              <div className="am text-slate-500 dark:text-slate-400">{selected.hoursAm}</div>
            </Detail>
          </dl>

          <div className="mt-6 flex flex-col sm:flex-row lg:flex-col xl:flex-row gap-3">
            <a
              href={mapDirectionsUrl(selected)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-md shadow-orange-500/20 hover:from-amber-400 hover:to-orange-400 transition-all"
            >
              <Navigation className="w-4 h-4" />
              Get Directions <span className="am text-xs font-medium">አቅጣጫ</span>
            </a>
            <a
              href={mapOpenUrl(selected)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open in Maps
            </a>
          </div>
        </div>

        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-200 dark:bg-slate-800 shadow-sm min-h-[320px] lg:min-h-[440px] relative">
          <iframe
            title={`Map — ${selected.name}`}
            src={mapEmbedUrl(selected)}
            className="absolute inset-0 w-full h-full border-0"
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </section>
  );
}

function Detail({
  icon: Icon,
  label,
  labelAm,
  children,
}: {
  icon: typeof Phone;
  label: string;
  labelAm: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
        <Icon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
      </span>
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 font-semibold">
          {label} · <span className="am normal-case">{labelAm}</span>
        </dt>
        <dd className="mt-0.5 text-slate-800 dark:text-slate-200 leading-relaxed">{children}</dd>
      </div>
    </div>
  );
}
