"use client";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Explain, GenStatus } from "@/lib/api/types";

type Concept = { id: string; variant: number; url: string; download: string; saved: boolean; explain: Explain | null };

const STAGES: { key: GenStatus; label: string }[] = [
  { key: "queued", label: "Starting" },
  { key: "analysing", label: "Analysing your room" },
  { key: "rendering", label: "Designing concepts" },
  { key: "post_processing", label: "Finishing touches" },
];

export default function Result({ params }: PageProps<"/generations/[id]">) {
  const { id } = use(params);
  const sb = useMemo(() => supabaseBrowser(), []);

  const [status, setStatus] = useState<GenStatus>("queued");
  const [meta, setMeta] = useState<{ style: string; variants: number; error: string | null }>();
  const [before, setBefore] = useState<string>();
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [active, setActive] = useState(0);
  const [holding, setHolding] = useState(false);
  const [showExplain, setShowExplain] = useState(false);
  const [longWait, setLongWait] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const signed = useRef(new Map<string, { url: string; download: string }>());

  const load = useCallback(async () => {
    // concepts!concepts_generation_id_fkey: generations<->concepts has a second FK
    // (generations.parent_concept_id, for the future refine flow), so the embed is
    // ambiguous unless the relationship is named explicitly.
    const { data: g, error: loadError } = await sb.from("generations")
      .select("status, variants, error, styles(name), rooms(original_path), concepts!concepts_generation_id_fkey(id, variant, image_path, saved, explain)")
      .eq("id", id).single();
    if (loadError) console.error("Failed to load generation:", loadError.message);
    if (!g) return;
    setStatus(g.status);
    const style = g.styles as unknown as { name: string } | null;
    setMeta({ style: style?.name ?? "", variants: g.variants, error: g.error });

    if (!signed.current.has("__before")) {
      const room = g.rooms as unknown as { original_path: string };
      const b = await sb.storage.from("originals").createSignedUrl(room.original_path, 3600);
      signed.current.set("__before", { url: b.data?.signedUrl ?? "", download: "" });
      setBefore(b.data?.signedUrl);
    }

    const rows = (g.concepts as { id: string; variant: number; image_path: string; saved: boolean; explain: Explain | null }[])
      .sort((a, b) => a.variant - b.variant);
    const next = await Promise.all(rows.map(async (c) => {
      let s = signed.current.get(c.id);
      if (!s) {
        const [v, d] = await Promise.all([
          sb.storage.from("concepts").createSignedUrl(c.image_path, 3600),
          sb.storage.from("concepts").createSignedUrl(c.image_path, 3600, { download: `decorra-${c.id}.jpg` }),
        ]);
        s = { url: v.data?.signedUrl ?? "", download: d.data?.signedUrl ?? "" };
        signed.current.set(c.id, s);
      }
      return { id: c.id, variant: c.variant, saved: c.saved, explain: c.explain, ...s };
    }));
    setConcepts(next);
  }, [sb, id]);

  useEffect(() => {
    // Initial fetch; load() only sets state after awaiting Supabase.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const ch = sb.channel(`gen-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generations", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "concepts", filter: `generation_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [sb, id, load]);

  // Polling fallback while the job is running, in case Realtime drops.
  useEffect(() => {
    if (status === "done" || status === "failed") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [status, load]);

  // Backgrounded tabs get their timers throttled by the browser (and Realtime's
  // socket can go stale too) — e.g. switching over to watch an n8n execution and
  // back. Force a fresh fetch the instant this tab becomes visible again instead
  // of waiting on a possibly-delayed poll.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [load]);

  // A generation that never gets a callback (a crashed render, a dropped webhook)
  // would otherwise spin here forever with no explanation. A background sweep on
  // the n8n side fails and refunds anything stuck for 10+ minutes regardless of
  // cause, so this is honest to promise rather than just a vague "still working".
  useEffect(() => {
    // Once done/failed, `running` below is false so the banner stops rendering
    // regardless of this flag's value — no need to reset it here.
    if (status === "done" || status === "failed") return;
    const t = setTimeout(() => setLongWait(true), 100_000);
    return () => clearTimeout(t);
  }, [status, id]);

  function step(dir: 1 | -1) {
    setActive((a) => (a + dir + concepts.length) % concepts.length);
  }

  async function toggleSave(c: Concept) {
    setConcepts((cs) => cs.map((x) => (x.id === c.id ? { ...x, saved: !x.saved } : x)));
    await sb.from("concepts").update({ saved: !c.saved }).eq("id", c.id);
  }

  const current = concepts[active];
  const running = status !== "done" && status !== "failed";
  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === status));

  if (status === "failed" && !concepts.length) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="glass rise max-w-md space-y-4 rounded-3xl p-8 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/15 text-xl">⚠︎</span>
          <h1 className="font-display text-3xl">That makeover didn&apos;t work</h1>
          <p className="text-muted">Your credits have been refunded. Try again with a brighter, straighter photo.</p>
          <Link href="/new" className="btn-primary">Try again</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-8">
      <div className="rise flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{running ? "Designing" : "Your concepts"}</p>
          <h1 className="font-display text-4xl">{meta?.style || "Your makeover"}</h1>
        </div>
        {meta && (
          <span className="glass rounded-full px-3 py-1 text-sm text-muted">
            {concepts.length}/{meta.variants} ready
          </span>
        )}
      </div>

      {running && longWait && (
        <p className="rise rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          This is taking longer than usual. Keep this page open — if it hasn&apos;t finished in a few more
          minutes, it will fail automatically and your credits will be refunded.
        </p>
      )}

      {running && !current && (
        <div className="glass relative overflow-hidden rounded-3xl p-1.5">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.25rem]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {before ? <img src={before} alt="" className="h-full w-full scale-110 object-cover blur-xl brightness-50" /> : <div className="shimmer h-full w-full" />}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgb(139_92_246/0.35),transparent_60%)]" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 text-center">
              <div className="relative h-16 w-16">
                <div className="bg-gradient-brand absolute inset-0 animate-spin rounded-full [mask:radial-gradient(farthest-side,transparent_calc(100%-3px),black_calc(100%-3px))]" />
                <div className="bg-gradient-brand absolute inset-3 animate-pulse rounded-full opacity-60 blur-md" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-medium">{STAGES[stageIndex]?.label ?? "Working"}…</p>
                <p className="text-sm text-white/60">Usually under a minute</p>
              </div>
              <ol className="flex gap-2">
                {STAGES.map((s, i) => (
                  <li key={s.key} className={`h-1.5 w-10 rounded-full transition ${i <= stageIndex ? "bg-gradient-brand" : "bg-white/15"}`} />
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {current && before && (
        <>
          <div className="glass rise overflow-hidden rounded-3xl p-1.5" onContextMenu={(e) => e.preventDefault()}>
            <div className="relative aspect-[4/3] select-none overflow-hidden rounded-[1.25rem]">
              {holding ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={before} alt="Original room" className="h-full w-full object-cover" />
              ) : (
                <ReactCompareSlider
                  className="h-full w-full"
                  itemOne={<ReactCompareSliderImage src={before} alt="Before" style={{ objectFit: "cover" }} />}
                  itemTwo={<ReactCompareSliderImage src={current.url} alt={`${meta?.style} concept ${current.variant}`} style={{ objectFit: "cover" }} />}
                />
              )}
              <span className="glass-overlay pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs">Before</span>
              <span className="glass-overlay pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs">After</span>
            </div>

            {concepts.length > 1 && (
              <div className="flex items-center justify-between gap-3 px-2 pb-1 pt-3">
                <button onClick={() => step(-1)} aria-label="Previous concept"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-muted transition hover:bg-foreground/10 hover:text-foreground">
                  ‹
                </button>
                <div className="flex gap-1.5">
                  {concepts.map((c, i) => (
                    <button key={c.id} onClick={() => setActive(i)} aria-label={`Go to concept ${c.variant}`}
                      className={`h-1.5 rounded-full transition-all ${i === active ? "w-4 bg-foreground" : "w-1.5 bg-foreground/25"}`} />
                  ))}
                </div>
                <button onClick={() => step(1)} aria-label="Next concept"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-lg text-muted transition hover:bg-foreground/10 hover:text-foreground">
                  ›
                </button>
              </div>
            )}
          </div>

          {(concepts.length > 1 || running) && (
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
              {concepts.map((c, i) => (
                <button key={c.id} onClick={() => setActive(i)}
                  className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl transition ${i === active ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-60 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={`Concept ${c.variant}`} className="h-full w-full object-cover" />
                  {c.saved && <span className="absolute right-1.5 top-1.5 text-xs text-rose-400 drop-shadow-[0_1px_2px_rgb(0_0_0/0.6)]">♥</span>}
                </button>
              ))}
              {running && <div className="shimmer h-20 w-28 shrink-0 rounded-2xl" />}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button onClick={() => toggleSave(current)}
              className={current.saved ? "btn-primary" : "btn-ghost"}>
              {current.saved ? "♥ Saved" : "♡ Save"}
            </button>
            <button
              onPointerDown={() => setHolding(true)} onPointerUp={() => setHolding(false)} onPointerLeave={() => setHolding(false)}
              className="btn-ghost">👁 Hold for original</button>
            <a href={current.download} className="btn-ghost">↓ Download</a>
            <button onClick={() => setShowExplain(true)} disabled={!current.explain} className="btn-ghost">
              ✦ {current.explain ? "Explain design" : "Explaining…"}
            </button>
          </div>
        </>
      )}

      {before && concepts.length > 1 && (
        <div className="space-y-3 pt-4">
          <button onClick={() => setShowAll((v) => !v)} className="btn-ghost w-full">
            {showAll ? "Hide all concepts" : `Show all ${concepts.length} concepts`}
          </button>
          {showAll && concepts.map((c) => (
            <div key={c.id} className="glass rise overflow-hidden rounded-3xl p-1.5" onContextMenu={(e) => e.preventDefault()}>
              <div className="relative aspect-[4/3] select-none overflow-hidden rounded-[1.25rem]">
                <ReactCompareSlider
                  className="h-full w-full"
                  itemOne={<ReactCompareSliderImage src={before} alt="Before" style={{ objectFit: "cover" }} />}
                  itemTwo={<ReactCompareSliderImage src={c.url} alt={`${meta?.style} concept ${c.variant}`} style={{ objectFit: "cover" }} />}
                />
                <span className="glass-overlay pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs">Before</span>
                <span className="glass-overlay pointer-events-none absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs">After</span>
                <span className="glass-overlay pointer-events-none absolute bottom-3 left-3 rounded-full px-2.5 py-1 text-xs">Concept {c.variant}</span>
                {c.saved && <span className="glass-overlay absolute bottom-3 right-3 rounded-full px-2.5 py-1 text-xs text-rose-400">♥ Saved</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showExplain && current?.explain && (
        <ExplainSheet explain={current.explain} onClose={() => setShowExplain(false)} />
      )}

      <Link href="/new" className="block pt-4 text-center text-sm text-muted transition hover:text-foreground">
        + Start another makeover
      </Link>
    </main>
  );
}

function ExplainSheet({ explain, onClose }: { explain: Explain; onClose: () => void }) {
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const low = explain.key_items.reduce((s, i) => s + i.inr_low, 0);
  const high = explain.key_items.reduce((s, i) => s + i.inr_high, 0);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="glass-strong rise max-h-[85vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-t-3xl bg-background/80 p-6 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto h-1 w-10 rounded-full bg-foreground/20 sm:hidden" />
        <div>
          <p className="eyebrow">Why it works</p>
          <p className="mt-1 text-lg leading-snug">{explain.why_it_works}</p>
        </div>
        <div className="flex h-12 overflow-hidden rounded-2xl">
          {explain.palette.map((c) => <span key={c} className="flex-1" style={{ background: c }} title={c} />)}
        </div>
        {explain.materials.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {explain.materials.map((m) => <span key={m} className="chip">{m}</span>)}
          </div>
        )}
        <div className="glass divide-y divide-line rounded-2xl">
          {explain.key_items.map((i) => (
            <div key={i.name} className="flex justify-between gap-4 px-4 py-3 text-sm">
              <span>{i.name}</span>
              <span className="whitespace-nowrap text-muted">{inr(i.inr_low)} – {inr(i.inr_high)}</span>
            </div>
          ))}
          <div className="flex justify-between px-4 py-3 font-medium">
            <span>Estimated total</span>
            <span className="text-gradient">{inr(low)} – {inr(high)}</span>
          </div>
        </div>
        <p className="text-center text-xs text-faint">AI estimate, not a quote. Prices vary by city and retailer.</p>
        <button onClick={onClose} className="btn-primary">Close</button>
      </div>
    </div>
  );
}
