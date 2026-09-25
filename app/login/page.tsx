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
    <main className="mx-auto max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in to Decorra</h1>
      <p className="text-sm text-muted">Save your makeovers and share them with family.</p>
      {state === "sent" ? (
        <p className="rounded-xl bg-card p-4">Check <b>{email}</b> for a sign-in link.</p>
      ) : (
        <form onSubmit={sendLink} className="space-y-3">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" autoComplete="email"
            className="w-full rounded-xl border border-line bg-card px-4 py-3"
          />
          <button className="btn-primary" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Email me a link"}
          </button>
          {state === "error" && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
      <button onClick={google} className="w-full rounded-xl border border-line py-3">Continue with Google</button>
    </main>
  );
}
