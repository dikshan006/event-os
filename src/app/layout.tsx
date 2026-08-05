import "./globals.css";
import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Italiana, Pinyon_Script, Playfair_Display, Sacramento } from "next/font/google";

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

/**
 * The hairline display face, used by templates whose character *is* their
 * typography. Declared here alongside the others rather than lazily, because a
 * font file is only fetched when a glyph actually renders in it — a template
 * that never asks for this face costs nothing to have declared.
 *
 * One weight, because that is all it has: its lightness is the design, not a
 * setting. It is a display face in the strict sense — beautiful at 80px, thin
 * to the point of illegibility at 14px — so nothing below heading size is ever
 * set in it.
 */
const display = Italiana({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * The monoline signature hand.
 *
 * A second script rather than the copperplate at a different size: the two are
 * different registers, not different weights. Pinyon is an engraved formal
 * hand with strong thick/thin contrast; this is an even-stroke handwritten
 * one, and a template whose identity rests on it cannot fake it with the other.
 *
 * Like the display face, declared globally and fetched only when a glyph
 * actually renders in it, so templates that never ask pay nothing.
 */
/**
 * The high-contrast transitional serif.
 *
 * Where Italiana is a hairline that needs size to exist, this has weight, and
 * a template whose names sit over a painting needs weight — a hairline face
 * disappears into a bouquet. Two display serifs is not redundancy; they solve
 * opposite problems.
 */
const didone = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-didone",
  display: "swap",
});

const scriptMono = Sacramento({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script-mono",
  display: "swap",
});

const script = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-script",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EventOS",
  description: "EventOS — the operating system for professional wedding planners.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${script.variable} ${display.variable} ${scriptMono.variable} ${didone.variable}`}>
      <body>{children}</body>
    </html>
  );
}
