import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Decorra: AI makeovers for Indian homes",
  description: "Upload a room photo and see it redesigned in Indian and global styles, with budgets in rupees.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#b5532a" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes
    // to <html>/<body> before React hydrates. This only affects these two elements, not children.
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-10 border-b border-line bg-background/90 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Decorra<span className="text-brand">.</span>
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/new">New makeover</Link>
              <Link href="/gallery">Gallery</Link>
            </div>
          </nav>
        </header>
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
