import type { TemplateKey } from "@prisma/client";

/**
 * Template palettes, and the tokens derived from them.
 *
 * The `lace`, `heart` and `rule` flags are gone: repeating-dot borders, a ♥
 * glyph and a double rule are the visual signature of a 2010s wedding
 * template, and they were the loudest thing on the page. Distinction now comes
 * from typography, rhythm and how the photography is toned.
 */

export type Theme = {
  bg: string;
  ink: string;
  accent: string;
  deep: string;
  /** How the couple's names are set. */
  names: "caps" | "script";
  /** Which ink the names take. `deep` where the body ink is too light to carry display sizes. */
  nameInk: "ink" | "deep";
  /**
   * The face used for the names and section headings.
   *
   * `serif` is the house Cormorant. `display` is the hairline face loaded for
   * templates whose entire character is the typography — see app/layout.tsx.
   * A token rather than a raw font stack, so a template never has to know the
   * font's actual name.
   */
  face: "serif" | "display";
  /**
   * Decoration at the page's corners.
   *
   * Opt-in per template and drawn in the template's own colours, so it is a
   * property of the palette rather than a hard-coded flourish. `none` is the
   * right answer for most: an ornament that appears everywhere stops being one.
   */
  ornament: "none" | "botanical";
  /** Stands in for the hero before a photograph is uploaded. */
  photo: string;
};

export const THEMES: Record<TemplateKey, Theme> = {
  BLUSH_ROMANCE: {
    bg: "#F6EFEA", ink: "#211E1B", accent: "#9B5B63", deep: "#211E1B",
    names: "caps", nameInk: "ink", face: "serif", ornament: "none",
    photo: "linear-gradient(120deg,#4a4340,#7c655b 60%,#a3897a)",
  },
  // Sage was #87A07A on white: 2.86:1, which fails WCAG AA even for large
  // text, and it carried every link and the RSVP button. Darkened until both
  // the text-on-background and white-on-button directions pass.
  MODERN_SAGE: {
    bg: "#FFFFFF", ink: "#414B3C", accent: "#5E7052", deep: "#54654A",
    names: "caps", nameInk: "deep", face: "serif", ornament: "none",
    photo: "linear-gradient(120deg,#1f2a22,#3c5240 55%,#6e8264)",
  },
  CLASSIC_ELEGANCE: {
    bg: "#F7F2E4", ink: "#5a4038", accent: "#A93A42", deep: "#A93A42",
    names: "script", nameInk: "ink", face: "serif", ornament: "none",
    photo: "linear-gradient(120deg,#241f24,#57404a 55%,#8d6f72)",
  },
  /**
   * Midnight Bloom — the first dark template.
   *
   * A warm near-black rather than #000. Black is what a screen does when it is
   * switched off, and against it warm off-white type reads faintly blue. Two
   * points of red in the background is the whole difference between a page
   * that looks like ink on a dark ground and one that looks like a power-saving
   * mode.
   *
   * The accent is a dusty rose taken off the botanical rather than a metallic
   * gold. Gold on black is the obvious move and ends up looking like a
   * certificate; this measures 8.9:1 on the background, so it can carry small
   * text as well as ornament, which a true gold cannot.
   */
  MIDNIGHT_BLOOM: {
    bg: "#100F0E", ink: "#EFE9DF", accent: "#C8A99E", deep: "#F3EEE6",
    names: "caps", nameInk: "ink", face: "display", ornament: "botanical",
    photo: "linear-gradient(120deg,#141312,#2b2320 55%,#4b3c36)",
  },
};

/* --------------------------------------------------------------- polarity -- */

/** Relative luminance, WCAG 2.x. */
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
  const ch = [0, 2, 4].map(i => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * Is this template's page dark?
 *
 * Measured rather than declared, so a template author picks colours and every
 * system downstream adjusts on its own. The threshold sits well clear of both
 * ends: the darkest light template measures 0.83, Midnight Bloom 0.005.
 */
export const isDarkTheme = (t: Theme) => luminance(t.bg) < 0.2;

/**
 * The custom properties a template contributes to `.site`.
 *
 * Beyond the four colours, this is where page polarity is resolved. The photo
 * frame, the rules and the nav all cast shadows, and every one of them assumed
 * a pale page — on a near-black one they produce a *glow* around the elements
 * that were supposed to recede.
 *
 *   --s-shade    what a shadow is made of. Ink on a pale page, which is the
 *                darkest thing in that palette. On a dark page, darker than the
 *                page itself, since nothing lighter can read as shadow.
 *   --s-edge-k   how hard the hairline around a photograph is pushed. A dark
 *                page separates a print far less than cream does, so the rule
 *                has to do proportionally more of the work.
 *   --s-depth-k  and the shadow correspondingly less: a soft dark halo on a
 *                dark ground is invisible however strong it is made, and past a
 *                point only muddies the edge above it.
 *   --s-line     hairline rules, mixed off the ink so they belong to the
 *                palette instead of being a fixed black at 6% that disappears.
 */
export function themeVars(t: Theme): Record<string, string> {
  const dark = isDarkTheme(t);
  return {
    "--sb": t.bg,
    "--si": t.ink,
    "--sa": t.accent,
    "--sd": t.deep,
    "--s-name-ink": t.nameInk === "deep" ? t.deep : t.ink,
    "--s-face": t.face === "display" ? "var(--display)" : "var(--serif)",
    "--s-shade": dark ? "#000000" : t.ink,
    "--s-edge-k": dark ? "1.6" : "1",
    "--s-depth-k": dark ? "0.5" : "1",
    "--s-line": dark ? "14%" : "8%",
  };
}
