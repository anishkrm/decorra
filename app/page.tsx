import Link from "next/link";
import BeforeAfterSlider from "./components/BeforeAfterSlider";

const STYLES = [
  "Kerala Traditional", "Modern Indian", "Chettinad", "Rajasthani", "Indo-Contemporary",
  "Japandi", "Scandinavian", "Modern Luxe", "Industrial", "Bohemian", "Coastal", "Mid-Century",
];

const SHOWCASES = [
  {
    room: "Living room",
    style: "Modern Indian",
    before: "/showcase/living-room-before.webp",
    after: "/showcase/living-room-after-modern-indian.webp",
  },
  {
    room: "Bedroom",
    style: "Renter-friendly Japandi",
    before: "/showcase/bedroom-before.webp",
    after: "/showcase/bedroom-after-japandi.webp",
  },
  {
    room: "Kitchen",
    style: "Indo-Contemporary refresh",
    before: "/showcase/kitchen-before.webp",
    after: "/showcase/kitchen-after-indo-contemporary.webp",
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4">
      {/* ---------- hero ---------- */}
      <section className="grid items-center gap-10 pb-16 pt-14 md:grid-cols-[1.05fr_1fr] md:pt-20">
        <div className="rise space-y-6">
          <span className="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            AI interior design · built for India
          </span>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight md:text-7xl">
            Your room,<br />
            <span className="text-gradient italic">reimagined</span> in<br />
            under a minute.
          </h1>
          <p className="max-w-md text-lg text-muted">
            Snap one photo and get photoreal redesigns in Kerala, Chettinad, Japandi and more, with a budget
            in rupees before you spend a single one.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/new" className="btn-primary w-auto px-7">
              Try with your room <span aria-hidden>→</span>
            </Link>
            <span className="text-sm text-faint">5 free concepts · no card needed</span>
          </div>
        </div>

        <HeroVisual />
      </section>

      {/* ---------- style marquee ---------- */}
      <section className="relative -mx-4 overflow-hidden py-4 [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
        <div className="flex w-max animate-[marquee_40s_linear_infinite] gap-3 motion-reduce:animate-none">
          {[...STYLES, ...STYLES].map((s, i) => (
            <span key={i} className="glass whitespace-nowrap rounded-full px-4 py-2 text-sm text-muted">{s}</span>
          ))}
        </div>
      </section>

      {/* ---------- real before / after showcases ---------- */}
      <section className="space-y-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">Realistic transformations</p>
          <h2 className="mt-2 font-display text-4xl md:text-5xl">
            Same room. <span className="text-gradient italic">Fresh perspective.</span>
          </h2>
          <p className="mt-3 text-muted">Drag each divider to see what changes—and what stays exactly where it belongs.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {SHOWCASES.map((item) => (
            <article key={item.room} className="glass overflow-hidden rounded-3xl p-1.5">
              <div className="overflow-hidden rounded-[1.3rem]">
                <BeforeAfterSlider
                  before={item.before}
                  after={item.after}
                  beforeAlt={`${item.room} before redesign`}
                  afterAlt={`${item.room} after ${item.style} redesign`}
                />
              </div>
              <div className="px-3 pb-3 pt-3">
                <p className="text-sm font-medium">{item.room}</p>
                <p className="text-xs text-muted">{item.style}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- bento ---------- */}
      <section className="grid gap-4 py-16 md:grid-cols-6">
        <Bento className="md:col-span-4" eyebrow="Made for Indian homes" title="Styles no one else has">
          Five Indian styles tuned on real Indian flats: Kerala teak and red oxide, Chettinad Athangudi tiles,
          Rajasthani jharokhas, and more. Pooja rooms and compact 2BHKs are handled too.
        </Bento>
        <Bento className="md:col-span-2" eyebrow="Budget-aware" title="Priced in ₹">
          <div className="mt-3 space-y-2 text-sm">
            <Tier label="Refresh" value="< ₹25k" w="w-1/3" />
            <Tier label="Mid" value="₹25k–1L" w="w-2/3" />
            <Tier label="Premium" value="₹1L+" w="w-full" />
          </div>
        </Bento>
        <Bento className="md:col-span-2" eyebrow="Renter mode" title="No drilling. No paint.">
          Only decor, textiles and lighting change, so your deposit stays safe.
        </Bento>
        <Bento className="md:col-span-2" eyebrow="Structure-safe" title="Your walls stay put">
          Windows, doors and the camera angle stay the same. Only the design changes.
        </Bento>
        <Bento className="md:col-span-2" eyebrow="Decide together" title="Family vote">
          Share three concepts. Everyone taps a favourite, and no sign-in is needed.
        </Bento>
      </section>

      {/* ---------- how it works ---------- */}
      <section className="py-10">
        <p className="eyebrow mb-6 text-center">How it works</p>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ["Snap", "Take one photo from a corner with the lights on."],
            ["Style", "Pick a style, a budget and renter mode if you need it."],
            ["Compare", "Slide between before and after, then save your favourites."],
          ].map(([t, d], i) => (
            <li key={t} className="glass rounded-3xl p-6">
              <span className="font-display text-4xl text-gradient">0{i + 1}</span>
              <h3 className="mt-2 text-lg font-medium">{t}</h3>
              <p className="text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="glass-strong relative my-16 overflow-hidden rounded-3xl p-10 text-center">
        <div className="bg-gradient-brand absolute -top-24 left-1/2 h-48 w-2/3 -translate-x-1/2 rounded-full opacity-30 blur-3xl" />
        <h2 className="font-display relative text-4xl md:text-5xl">See it before you <span className="text-gradient italic">spend</span> it.</h2>
        <Link href="/new" className="btn-primary relative mx-auto mt-6 w-auto px-8">Start your makeover</Link>
      </section>
    </main>
  );
}

function HeroVisual() {
  return (
    <div className="rise relative [animation-delay:120ms]">
      <div className="bg-gradient-brand absolute -inset-6 rounded-[2rem] opacity-25 blur-3xl" />
      <div className="glass relative overflow-hidden rounded-[1.75rem] p-2">
        <div className="overflow-hidden rounded-[1.35rem]">
          <BeforeAfterSlider
            before="/showcase/living-room-before.webp"
            after="/showcase/living-room-after-modern-indian.webp"
            beforeAlt="Living room before redesign"
            afterAlt="Living room after Modern Indian redesign"
          />
        </div>
      </div>

      {/* floating chips: these overlay the mock room graphic, not the page background,
          so they use the fixed-dark glass-overlay treatment rather than theme-aware glass. */}
      <div className="glass-overlay absolute bottom-10 left-3 z-10 rounded-2xl px-3.5 py-2.5 text-sm md:-left-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">Style</p>
        <p className="font-medium">Modern Indian</p>
      </div>
      <div className="glass-overlay absolute right-4 top-[30%] z-10 rounded-2xl px-3.5 py-2.5 text-sm">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/60">AI estimate</p>
        <p className="font-medium">₹48k – ₹92k</p>
      </div>
      <div className="glass-overlay absolute -bottom-4 right-8 z-10 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Renter-safe
      </div>
    </div>
  );
}

function Bento({ eyebrow, title, children, className = "" }: {
  eyebrow: string; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`glass group relative overflow-hidden rounded-3xl p-6 transition hover:border-line-strong ${className}`}>
      <div className="bg-gradient-brand pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition group-hover:opacity-30" />
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="mt-1 text-xl font-medium">{title}</h3>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </div>
  );
}

function Tier({ label, value, w }: { label: string; value: string; w: string }) {
  return (
    <div>
      <div className="flex justify-between"><span>{label}</span><span className="text-foreground">{value}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-foreground/10"><div className={`bg-gradient-brand h-full rounded-full ${w}`} /></div>
    </div>
  );
}
