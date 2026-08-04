import type { TemplateKey } from "@prisma/client";

/**
 * Template palettes.
 *
 * The `lace`, `heart` and `rule` flags are gone: repeating-dot borders, a ♥
 * glyph and a double rule are the visual signature of a 2010s wedding
 * template, and they were the loudest thing on the page. Distinction now comes
 * from typography, rhythm and how the photography is toned.
 */
export const THEMES = {
  BLUSH_ROMANCE: { bg: "#F6EFEA", ink: "#211E1B", accent: "#9B5B63", deep: "#211E1B", names: "caps",
    photo: "linear-gradient(120deg,#4a4340,#7c655b 60%,#a3897a)" },
  // Sage was #87A07A on white: 2.86:1, which fails WCAG AA even for large
  // text, and it carried every link and the RSVP button. Darkened until both
  // the text-on-background and white-on-button directions pass.
  MODERN_SAGE: { bg: "#FFFFFF", ink: "#414B3C", accent: "#5E7052", deep: "#54654A", names: "caps",
    photo: "linear-gradient(120deg,#1f2a22,#3c5240 55%,#6e8264)" },
  CLASSIC_ELEGANCE: { bg: "#F7F2E4", ink: "#5a4038", accent: "#A93A42", deep: "#A93A42", names: "script",
    photo: "linear-gradient(120deg,#241f24,#57404a 55%,#8d6f72)" },
} as const;

export type Theme = (typeof THEMES)[TemplateKey];
