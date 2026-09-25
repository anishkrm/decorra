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

  return (
    <main className="mx-auto max-w-xl space-y-6 p-4 pb-28">
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold">New makeover</h1>
        {!preview ? (
          <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-card p-6 text-center">
            <span className="text-lg font-medium">{uploading ? "Preparing photo…" : "Take or choose a room photo"}</span>
            <span className="text-sm text-muted">Stand in a corner, lights on, 0.5× lens if you have one.</span>
            <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={onFile} disabled={uploading} />
          </label>
        ) : (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Your room" className="w-full rounded-2xl" />
            <button onClick={() => { setPreview(null); setRoomId(null); }}
              className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">Change</button>
          </div>
        )}
      </section>

      {roomId && (
        <>
          <Section title="Room">
            <div className="flex flex-wrap gap-2">
              {ROOM_TYPES.map((r) => (
                <button key={r} className="chip capitalize" data-on={roomType === r} onClick={() => setRoomType(r)}>{r}</button>
              ))}
            </div>
          </Section>

          <Section title="Style">
            <StyleGrid label="Made for Indian homes" styles={india} value={styleId} onChange={setStyleId} />
            <StyleGrid label="Global" styles={global} value={styleId} onChange={setStyleId} />
          </Section>

          <Section title="Budget">
            <div className="flex flex-wrap gap-2">
              {BUDGET_TIERS.map((t) => (
                <button key={t} className="chip" data-on={tier === t} onClick={() => setTier(t)}>{TIER_LABEL[t]}</button>
              ))}
            </div>
          </Section>

          <Section title="Options">
            <label className="flex items-center justify-between rounded-xl bg-card p-3">
              <span>
                <span className="block font-medium">Renter mode</span>
                <span className="text-sm text-muted">Decor, textiles and lighting only. No paint or structural changes.</span>
              </span>
              <input type="checkbox" checked={renter} onChange={(e) => setRenter(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />
            </label>
            <div className="flex items-center justify-between rounded-xl bg-card p-3">
              <span className="font-medium">Concepts</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <button key={n} className="chip" data-on={variants === n} onClick={() => setVariants(n)}>{n}</button>
                ))}
              </div>
            </div>
            <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200}
              placeholder="Optional note, e.g. keep the sofa, add plants"
              className="w-full rounded-xl border border-line bg-card px-4 py-3" />
          </Section>
        </>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {roomId && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto max-w-xl space-y-1">
            <button className="btn-primary" disabled={!styleId || starting || notEnough} onClick={generate}>
              {starting ? "Starting…" : `Generate ${variants} concept${variants > 1 ? "s" : ""}`}
            </button>
            {credits !== null && (
              <p className="text-center text-xs text-muted">
                {notEnough ? "Not enough credits for this many concepts." : `Uses ${variants} of your ${credits} credits`}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function StyleGrid({ label, styles, value, onChange }: {
  label: string; styles: Style[]; value: string; onChange: (id: string) => void;
}) {
  if (!styles.length) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm">{label}</p>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {styles.map((s) => (
          <button key={s.id} onClick={() => onChange(s.id)}
            className={`w-40 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-card text-left ${value === s.id ? "border-brand" : "border-transparent"}`}>
            {s.sample_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.sample_image} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3]">
                {s.palette.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}
              </div>
            )}
            <div className="p-2">
              <p className="text-sm font-medium">{s.name}</p>
              <p className="line-clamp-2 text-xs text-muted">{s.tagline}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
