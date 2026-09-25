import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Decorra: AI makeovers for Indian homes",
  description: "Upload a room photo and see it redesigned in Indian and global styles, with budgets in rupees.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07060b" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes
    // to <html>/<body> before React hydrates. This only affects these two elements, not children.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <div className="aurora" aria-hidden><span /></div>
        <div className="grid-fade" aria-hidden />
        <div className="grain" aria-hidden />

        {/* Edge-to-edge, near-opaque bar (not just a floating pill) so nothing scrolling behind
            it — including large, bold hero text — can show through at the sides or through blur. */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-background/95 backdrop-blur-xl">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="bg-gradient-brand grid h-7 w-7 place-items-center rounded-lg text-sm font-bold text-white">D</span>
              <span className="text-[17px] font-semibold tracking-tight">Decorra</span>
            </Link>
            <div className="flex items-center gap-1 text-sm">
              <Link href="/gallery" className="rounded-xl px-3 py-1.5 text-muted transition hover:bg-white/5 hover:text-foreground">
                Gallery
              </Link>
              <Link href="/new" className="rounded-xl bg-white px-3.5 py-1.5 font-medium text-black transition hover:bg-white/90">
                New makeover
              </Link>
            </div>
          </nav>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="px-4 py-8 text-center text-xs text-faint">
          Made for Indian homes · Your photos stay private and are never used for training
        </footer>
      </body>
    </html>
  );
}
