"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Item = { id: string; url: string; download: string; style: string; generationId: string };
type Group = { roomId: string; roomType: string; createdAt: string; items: Item[] };

type Row = {
  id: string;
  image_path: string;
  generation_id: string;
  generations: { room_id: string; styles: { name: string }; rooms: { room_type: string; created_at: string } };
};

export default function Gallery() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [groups, setGroups] = useState<Group[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("concepts")
        .select("id, image_path, generation_id, generations(room_id, styles(name), rooms(room_type, created_at))")
        .eq("saved", true).order("created_at", { ascending: false });
      const rows = (data ?? []) as unknown as Row[];
      if (!rows.length) return setGroups([]);

      const paths = rows.map((r) => r.image_path);
      const [{ data: views }, { data: downloads }] = await Promise.all([
        sb.storage.from("concepts").createSignedUrls(paths, 3600),
        sb.storage.from("concepts").createSignedUrls(paths, 600, { download: true }),
      ]);

      const byRoom = new Map<string, Group>();
      rows.forEach((r, i) => {
        const g = byRoom.get(r.generations.room_id) ?? {
          roomId: r.generations.room_id,
          roomType: r.generations.rooms.room_type,
          createdAt: r.generations.rooms.created_at,
          items: [],
        };
        g.items.push({
          id: r.id,
          url: views?.[i]?.signedUrl ?? "",
          download: downloads?.[i]?.signedUrl ?? "",
          style: r.generations.styles.name,
          generationId: r.generation_id,
        });
        byRoom.set(g.roomId, g);
      });
      setGroups([...byRoom.values()]);
    })();
  }, [sb]);

  if (groups === null) {
    return (
      <main className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 pt-24 md:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="shimmer aspect-[4/3] rounded-3xl" />)}
      </main>
    );
  }

  if (!groups.length) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="glass rise max-w-md space-y-5 rounded-3xl p-10 text-center">
          <span className="bg-gradient-brand glow mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl text-white">♡</span>
          <div className="space-y-1">
            <h1 className="font-display text-3xl">Nothing saved yet</h1>
            <p className="text-muted">Save your favourite concepts and they&apos;ll show up here, grouped by room.</p>
          </div>
          <Link href="/new" className="btn-primary">Start your first makeover</Link>
        </div>
      </main>
    );
  }

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-4 pb-16 pt-8">
      <header className="rise flex items-end justify-between">
        <div>
          <p className="eyebrow">Gallery</p>
          <h1 className="font-display text-4xl md:text-5xl">Your saved <span className="text-gradient italic">spaces</span></h1>
        </div>
        <span className="glass rounded-full px-3 py-1 text-sm text-muted">{total} saved</span>
      </header>

      {groups.map((g) => (
        <section key={g.roomId} className="rise space-y-3">
          <h2 className="flex items-baseline gap-2 text-lg font-medium capitalize">
            {g.roomType}
            <span className="text-sm font-normal text-faint">{new Date(g.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {g.items.map((i) => (
              <figure key={i.id} className="glass group relative overflow-hidden rounded-3xl p-1">
                <Link href={`/generations/${i.generationId}`} className="block overflow-hidden rounded-[1.3rem]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={i.url} alt={`${i.style} concept`} loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-105" />
                </Link>
                <figcaption className="pointer-events-none absolute inset-x-1 bottom-1 flex items-end justify-between rounded-b-[1.3rem] bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
                  <span className="text-sm font-medium text-white">{i.style}</span>
                  <a href={i.download} aria-label={`Download ${i.style} concept`}
                    className="pointer-events-auto grid h-8 w-8 place-items-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white hover:text-black">↓</a>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
