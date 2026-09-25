"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Item = { id: string; url: string; download: string; style: string; room: string };

export default function Gallery() {
  const sb = supabaseBrowser();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("concepts")
        .select("id, image_path, generations(room_id, styles(name))")
        .eq("saved", true).order("created_at", { ascending: false });
      const rows = await Promise.all((data ?? []).map(async (c: any) => {
        const view = await sb.storage.from("concepts").createSignedUrl(c.image_path, 3600);
        const dl = await sb.storage.from("concepts")
          .createSignedUrl(c.image_path, 600, { download: `decorra-${c.id}.jpg` });
        return { id: c.id, url: view.data!.signedUrl, download: dl.data!.signedUrl,
                 style: c.generations.styles.name, room: c.generations.room_id };
      }));
      setItems(rows);
    })();
  }, []);

  if (!items.length) return <p className="p-4">No saved designs yet. Start your first makeover.</p>;
  return (
    <main className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3">
      {items.map(i => (
        <figure key={i.id} className="space-y-1">
          <img src={i.url} alt={`${i.style} concept`} className="rounded-lg" loading="lazy" />
          <figcaption className="flex justify-between text-sm">
            <span>{i.style}</span><a href={i.download} className="underline">Download</a>
          </figcaption>
        </figure>
      ))}
    </main>
  );
}
