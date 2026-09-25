"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

type AuthUser = { id: string; email: string | null };

// Shows who (if anyone) is signed in, their live credit balance, and a sign-out
// menu — so the logged-in and logged-out states of the header are unmistakable.
export default function AuthStatus() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadCredits(id: string) {
      const { data } = await sb.from("profiles").select("credits").eq("id", id).maybeSingle();
      if (active) setCredits(data?.credits ?? null);
    }

    sb.auth.getUser().then(({ data }) => {
      if (!active) return;
      const u = data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
      setUser(u);
      setReady(true);
      if (u) loadCredits(u.id);
    });

    // Keeps this in sync the moment a sign-in/sign-out happens, without needing a full reload.
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ? { id: session.user.id, email: session.user.email ?? null } : null;
      setUser(u);
      setReady(true);
      if (u) loadCredits(u.id);
      else setCredits(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [sb]);

  // Live credit balance: updates the instant a generation spends or refunds credits,
  // even if that happened on another tab or page.
  useEffect(() => {
    if (!user) return;
    const ch = sb
      .channel(`profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => setCredits((payload.new as { credits: number }).credits)
      )
      .subscribe();
    return () => {
      sb.removeChannel(ch);
    };
  }, [sb, user]);

  async function signOut() {
    setMenuOpen(false);
    await sb.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (!ready) {
    return <div className="h-8 w-20 animate-pulse rounded-xl bg-foreground/5" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="rounded-xl px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-foreground/10 hover:text-foreground"
      >
        Sign in
      </Link>
    );
  }

  const initial = (user.email ?? "?").charAt(0).toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-expanded={menuOpen}
        className="glass flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm transition hover:border-line-strong"
      >
        <span className="bg-gradient-brand grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white">
          {initial}
        </span>
        <span className="hidden max-w-[9rem] truncate text-muted sm:inline">{user.email}</span>
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium">
          ✦ {credits ?? "…"}
        </span>
      </button>

      {menuOpen && (
        <>
          {/* Click-outside catcher */}
          <button
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div className="glass-strong absolute right-0 top-full z-40 mt-2 w-60 space-y-1 rounded-2xl p-2 text-sm">
            <div className="border-b border-line px-3 py-2">
              <p className="truncate font-medium">{user.email}</p>
              <p className="text-xs text-muted">{credits ?? 0} credit{credits === 1 ? "" : "s"} remaining</p>
            </div>
            <Link
              href="/gallery"
              onClick={() => setMenuOpen(false)}
              className="block rounded-xl px-3 py-2 transition hover:bg-foreground/10"
            >
              Your gallery
            </Link>
            <button
              onClick={signOut}
              className="block w-full rounded-xl px-3 py-2 text-left text-rose-400 transition hover:bg-rose-500/10"
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
