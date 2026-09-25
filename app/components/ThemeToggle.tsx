"use client";
import { useEffect, useState } from "react";
import { getTheme, setTheme, type Theme } from "@/lib/theme";

export default function ThemeToggle() {
  // Server has no theme (the anti-flash script sets it client-side only), so we
  // render a neutral placeholder until mounted to avoid a hydration mismatch.
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    // Reads the attribute the anti-flash script already set on <html>; this can only
    // run client-side (no `document` during SSR), so it can't be a lazy useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(getTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    setThemeState(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-foreground/10 hover:text-foreground"
    >
      {theme === null ? null : theme === "light" ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.4 14.7A8.5 8.5 0 1 1 9.3 3.6a7 7 0 0 0 11.1 11.1Z" />
        </svg>
      )}
    </button>
  );
}
