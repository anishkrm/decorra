"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { prepareImage } from "@/lib/prepareImage";
import { BUDGET_TIERS, ROOM_TYPES, type Style } from "@/lib/api/types";

const TIER_LABEL: Record<(typeof BUDGET_TIERS)[number], string> = {
  refresh: "Refresh · under ₹25k",
  mid: "Mid · ₹25k–1L",
  premium: "Premium · ₹1L+",
};

export default function NewMakeover() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [styles, setStyles] = useState<Style[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const [roomType, setRoomType] = useState<(typeof ROOM_TYPES)[number]>("living room");
  const [styleId, setStyleId] = useState("");
  const [tier, setTier] = useState<(typeof BUDGET_TIERS)[number]>("mid");
  const [renter, setRenter] = useState(false);
  const [variants, setVariants] = useState(2);
  const [note, setNote] = useState("");
  const [idemKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    sb.from("styles").select("id,slug,name,region,tagline,palette,sample_image").eq("active", true).order("sort")
      .then(({ data }) => {
        setStyles((data as Style[]) ?? []);
        if (data?.[0]) setStyleId(data[0].id);
      });
    sb.from("profiles").select("credits").maybeSingle().then(({ data }) => setCredits(data?.credits ?? null));
  }, [sb]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setError("");
    setUploading(true);
    try {
      const file = await prepareImage(raw);
      const { data: { user } } = await sb.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const id = crypto.randomUUID();
      const path = `${user.id}/${id}.jpg`;
      const up = await sb.storage.from("originals").upload(path, file, { contentType: "image/jpeg" });
      if (up.error) throw up.error;
      const ins = await sb.from("rooms").insert({ id, user_id: user.id, original_path: path, room_type: roomType });
      if (ins.error) throw ins.error;
      setRoomId(id);
      setPreview(URL.createObjectURL(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    setStarting(true);
    setError("");
    const res = await fetch("/api/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId, styleId, budgetTier: tier, renterMode: renter, variants,
        note: note.trim() || undefined, roomType, idempotencyKey: idemKey,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error?.message ?? "Something went wrong.");
      setStarting(false);
      return;
    }
    router.push(`/generations/${json.generationId}`);
  }

  const india = styles.filter((s) => s.region === "india");
  const global = styles.filter((s) => s.region !== "india");
  const notEnough = credits !== null && credits < variants;
  const selected = styles.find((s) => s.id === styleId);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 pb-40 pt-8">
      <header className="rise space-y-2">
        <p className="eyebrow">New makeover</p>
        <h1 className="font-display text-4xl md:text-5xl">
          Let&apos;s <span className="text-gradient italic">transform</span> your room
        </h1>
      </header>

      <Step n={1} title="Your room photo">
        {!preview ? (
          <label className="glass group relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border-dashed p-6 text-center transition hover:border-line-strong">
            <div className="bg-gradient-brand pointer-events-none absolute inset-x-10 top-1/3 h-32 rounded-full opacity-0 blur-3xl transition group-hover:opacity-25" />
            {uploading ? (
              <>
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-foreground/15 border-t-foreground" />
                <p className="font-medium">Preparing your photo…</p>
              </>
            ) : (
              <>
                <span className="bg-gradient-brand glow grid h-14 w-14 place-items-center rounded-2xl text-2xl text-white">＋</span>
                <div className="space-y-1">
                  <p className="text-lg font-medium">Take or upload a photo</p>
                  <p className="text-sm text-muted">JPG, PNG or HEIC · up to 30 MB</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 text-xs text-faint">
                  <span className="glass rounded-full px-2.5 py-1">📐 Shoot from a corner</span>
                  <span className="glass rounded-full px-2.5 py-1">💡 Lights on</span>
                  <span className="glass rounded-full px-2.5 py-1">🔭 0.5× lens</span>
                </div>
              </>
            )}
            <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        ) : (
          <div className="glass relative overflow-hidden rounded-3xl p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your room" className="w-full rounded-[1.25rem]" />
            <button
              onClick={() => { setPreview(null); setRoomId(null); }}
              className="glass-overlay absolute right-4 top-4 rounded-full px-3.5 py-1.5 text-sm"
            >
              Change photo
            </button>
            <span className="glass-overlay absolute bottom-4 left-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Uploaded privately
            </span>
          </div>
        )}
      </Step>

      {roomId && (
        <>
          <Step n={2} title="Which room is this?">
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map((r) => (
                <button key={r} className="chip capitalize" data-on={roomType === r} onClick={() => setRoomType(r)}>{r}</button>
              ))}
            </div>
          </Step>

          <Step n={3} title="Pick a style">
            <StyleRail label="Made for Indian homes" badge="Exclusive" styles={india} value={styleId} onChange={setStyleId} />
            <StyleRail label="Global" styles={global} value={styleId} onChange={setStyleId} />
          </Step>

          <Step n={4} title="Budget">
            <div className="grid grid-cols-3 gap-2">
              {BUDGET_TIERS.map((t) => {
                const [name, range] = TIER_LABEL[t].split(" · ");
                return (
                  <button key={t} onClick={() => setTier(t)} data-on={tier === t}
                    className="glass rounded-2xl p-3 text-left transition hover:border-line-strong data-[on=true]:border-transparent data-[on=true]:bg-foreground data-[on=true]:text-background">
                    <p className="font-medium">{name}</p>
                    <p className="text-xs opacity-60">{range}</p>
                  </button>
                );
              })}
            </div>
          </Step>

          <Step n={5} title="Fine-tune">
            <div className="glass divide-y divide-line rounded-3xl">
              <label className="flex cursor-pointer items-center justify-between gap-4 p-4">
                <span>
                  <span className="block font-medium">Renter mode</span>
                  <span className="text-sm text-muted">Only decor, textiles and lighting. No paint, no drilling.</span>
                </span>
                <Toggle on={renter} onChange={setRenter} />
              </label>
              <div className="flex items-center justify-between gap-4 p-4">
                <span>
                  <span className="block font-medium">Concepts</span>
                  <span className="text-sm text-muted">1 credit each</span>
                </span>
                <div className="flex rounded-full bg-foreground/5 p-1">
                  {[1, 2, 3, 4].map((n) => (
                    <button key={n} onClick={() => setVariants(n)}
                      className={`h-8 w-8 rounded-full text-sm transition ${variants === n ? "bg-foreground text-background" : "text-muted hover:text-foreground"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
                  placeholder="Anything else? e.g. keep the sofa, add plants" className="input" />
              </div>
            </div>
          </Step>
        </>
      )}

      {error && (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">{error}</p>
      )}

      {roomId && (
        <div className="fixed inset-x-0 bottom-0 z-20 p-3">
          <div className="glass-strong mx-auto flex max-w-2xl items-center gap-3 rounded-3xl p-2.5 pl-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{selected?.name ?? "Pick a style"}</p>
              <p className="truncate text-xs text-muted">
                {notEnough
                  ? "Not enough credits"
                  : `${TIER_LABEL[tier].split(" · ")[0]}${renter ? " · Renter" : ""} · ${variants} credit${variants > 1 ? "s" : ""}${credits !== null ? ` of ${credits}` : ""}`}
              </p>
            </div>
            <button className="btn-primary w-auto shrink-0 px-6" disabled={!styleId || starting || notEnough} onClick={generate}>
              {starting ? "Starting…" : "Generate ✦"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rise space-y-3">
      <h2 className="flex items-center gap-3 text-lg font-medium">
        <span className="grid h-7 w-7 place-items-center rounded-full border border-line bg-foreground/5 text-xs text-muted">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="h-7 w-12 rounded-full bg-foreground/10 transition peer-checked:bg-gradient-brand peer-focus-visible:ring-2 peer-focus-visible:ring-foreground/50" />
      <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </span>
  );
}

function StyleRail({ label, badge, styles, value, onChange }: {
  label: string; badge?: string; styles: Style[]; value: string; onChange: (id: string) => void;
}) {
  if (!styles.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm text-muted">
        {label}
        {badge && <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-[10px] font-medium text-white">{badge}</span>}
      </p>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
        {styles.map((s) => {
          const on = value === s.id;
          return (
            <button key={s.id} onClick={() => onChange(s.id)}
              className={`relative w-44 shrink-0 snap-start overflow-hidden rounded-3xl text-left transition ${on ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : "opacity-80 hover:opacity-100"}`}>
              <div className="relative aspect-[4/5]">
                {s.sample_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.sample_image} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${s.palette.join(", ")})` }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                {on && <span className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-white text-xs text-black">✓</span>}
                <div className="absolute inset-x-0 bottom-0 space-y-0.5 p-3">
                  <p className="font-medium text-white">{s.name}</p>
                  <p className="line-clamp-2 text-xs text-white/70">{s.tagline}</p>
                  <div className="flex gap-1 pt-1.5">
                    {s.palette.slice(0, 5).map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full ring-1 ring-white/30" style={{ background: c }} />)}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
