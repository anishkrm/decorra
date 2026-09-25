import Link from "next/link";

const STYLES = [
  "Kerala Traditional", "Modern Indian", "Chettinad", "Rajasthani", "Indo-Contemporary",
  "Japandi", "Scandinavian", "Modern Luxe", "Industrial", "Bohemian", "Coastal", "Mid-Century",
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
        <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem]">
          {/* "before": desaturated bare room */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#3b3a40_0%,#2a292e_62%,#1d1c20_62%,#232226_100%)]" />
          <div className="absolute left-[12%] top-[14%] h-[34%] w-[22%] rounded-sm border border-white/10 bg-white/10" />
          {/* "after": warm styled room, clipped to the right half */}
          <div className="absolute inset-0 [clip-path:inset(0_0_0_52%)]">
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#6b3e26_0%,#8e4a2b_62%,#8e2b1e_62%,#6b1f16_100%)]" />
            <div className="absolute left-[12%] top-[14%] h-[34%] w-[22%] rounded-sm bg-amber-200/30" />
            <div className="absolute bottom-[22%] right-[10%] h-[18%] w-[34%] rounded-t-2xl bg-[#c9a227]/80" />
            <div className="absolute bottom-[40%] right-[18%] h-[20%] w-[3%] bg-[#c9a227]" />
            <div className="absolute bottom-[58%] right-[14%] h-[8%] w-[11%] rounded-full bg-amber-300/80 blur-[2px]" />
            <div className="absolute bottom-[12%] right-[6%] h-[6%] w-[48%] rounded-full bg-[#f2e3c6]/40" />
          </div>
          {/* slider handle */}
          <div className="absolute inset-y-0 left-[52%] w-px bg-white/80">
            <div className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xs text-black shadow-xl">⟷</div>
          </div>
          <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] backdrop-blur">Before</span>
          <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] backdrop-blur">After</span>
        </div>
      </div>

      {/* floating chips */}
      <div className="glass-strong absolute bottom-10 left-3 rounded-2xl px-3.5 py-2.5 text-sm md:-left-8">
        <p className="eyebrow">Style</p>
        <p className="font-medium">Kerala Traditional</p>
      </div>
      <div className="glass-strong absolute right-4 top-[30%] rounded-2xl px-3.5 py-2.5 text-sm">
        <p className="eyebrow">AI estimate</p>
        <p className="font-medium">₹48k – ₹92k</p>
      </div>
      <div className="glass-strong absolute -bottom-4 right-8 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
        <span className="h-2 w-2 rounded-full bg-emerald-400" /> Renter-safe
      </div>
    </div>
  );
}

function Bento({ eyebrow, title, children, className = "" }: {
  eyebrow: string; title: string; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`glass group relative overflow-hidden rounded-3xl p-6 transition hover:border-white/20 ${className}`}>
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
      <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className={`bg-gradient-brand h-full rounded-full ${w}`} /></div>
    </div>
  );
}
