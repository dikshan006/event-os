import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Pinyon_Script } from "next/font/google";

/**
 * Fonts are loaded through next/font rather than an @import inside globals.css.
 *
 * The @import was render-blocking: the browser had to fetch the CSS, discover
 * the font URLs, then fetch those, before any text painted. next/font
 * self-hosts the files, preloads them, and — critically for a site whose whole
 * impression rests on typography — generates a size-adjusted fallback so the
 * swap does not reflow the page. That removes the last source of layout shift.
 */
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const script = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wedding Planner OS",
  description: "The operating system for professional wedding planners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${script.variable}`}>
      <body>{children}</body>
    </html>
  );
}
