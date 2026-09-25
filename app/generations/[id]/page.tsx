"use client";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Result({ params }: PageProps<"/generations/[id]">) {
  const { id } = use(params);
  const sb = useMemo(() => supabaseBrowser(), []);
  const [status, setStatus] = useState("queued");
  const [before, setBefore] = useState<string>();
  const [after, setAfter] = useState<string>();
  const [conceptId, setConceptId] = useState<string>();

  async function load() {
    const { data: g } = await sb.from("generations")
      .select("status, rooms(original_path), concepts(id, image_path)").eq("id", id).single();
    if (!g) return;
    setStatus(g.status);
    const room = g.rooms as any;
    const b = await sb.storage.from("originals").createSignedUrl(room.original_path, 3600);
    setBefore(b.data?.signedUrl);
    const c = (g.concepts as any[])[0];
    if (c) {
      const a = await sb.storage.from("concepts").createSignedUrl(c.image_path, 3600);
      setAfter(a.data?.signedUrl); setConceptId(c.id);
    }
  }

  useEffect(() => {
    load();
    const ch = sb.channel(`gen-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "generations", filter: `id=eq.${id}` },
        () => load())
      .subscribe();
    const poll = setInterval(load, 5000);
    // fallback if Realtime drops
    return () => { sb.removeChannel(ch); clearInterval(poll); };
  }, [id]);

  async function save() {
    await sb.from("concepts").update({ saved: true }).eq("id", conceptId);
    alert("Saved to your gallery");
  }

  if (status === "failed") return <p className="p-4">Something went wrong. Please try another photo.</p>;
  if (status !== "done" || !before || !after)
    return <p className="p-4">{status === "rendering" ? "Designing your room..." : "Starting..."}</p>;

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-3">
      <ReactCompareSlider
        itemOne={<ReactCompareSliderImage src={before} alt="Before" />}
        itemTwo={<ReactCompareSliderImage src={after} alt="After" />} />
      <button onClick={save} className="w-full rounded bg-black py-3 text-white">Save to gallery</button>
    </main>
  );
}
