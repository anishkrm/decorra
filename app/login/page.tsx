"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  return <Suspense><LoginForm /></Suspense>;
}

function LoginForm() {
  const next = useSearchParams().get("next") ?? "/new";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  const redirectTo = () => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo() },
    });
    if (error) { setError(error.message); setState("error"); } else setState("sent");
  }

  async function google() {
    await supabaseBrowser().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  }

  return (
    <main className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="glass rise relative w-full max-w-sm overflow-hidden rounded-3xl p-7">
        <div className="bg-gradient-brand pointer-events-none absolute -top-20 left-1/2 h-40 w-2/3 -translate-x-1/2 rounded-full opacity-30 blur-3xl" />
        <div className="relative space-y-6">
          <div className="space-y-2 text-center">
            <span className="bg-gradient-brand glow mx-auto grid h-11 w-11 place-items-center rounded-2xl text-lg font-bold text-white">D</span>
            <h1 className="font-display text-3xl">Welcome to Decorra</h1>
            <p className="text-sm text-muted">Save makeovers and share them with family.</p>
          </div>

          {state === "sent" ? (
            <div className="glass-strong space-y-1 rounded-2xl p-5 text-center">
              <p className="text-2xl">✉️</p>
              <p className="font-medium">Check your inbox</p>
              <p className="text-sm text-muted">We sent a sign-in link to <span className="text-foreground">{email}</span></p>
              <button onClick={() => setState("idle")} className="pt-2 text-xs text-faint underline">Use a different email</button>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com" autoComplete="email" className="input"
              />
              <button className="btn-primary" disabled={state === "sending"}>
                {state === "sending" ? "Sending…" : "Email me a magic link"}
              </button>
              {state === "error" && <p className="text-center text-sm text-rose-400">{error}</p>}
            </form>
          )}

          <div className="flex items-center gap-3 text-xs text-faint">
            <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
          </div>
          <button onClick={google} className="btn-ghost w-full">
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}
