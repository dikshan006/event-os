/**
 * The studio's own typography — how a planner's name is set, everywhere it
 * appears.
 *
 * Scope matters here, and it is narrow on purpose. This chooses the face for
 * the *studio's* brand line: the sidebar, the "Designed by" credit under a
 * wedding site, the letterhead on an email. It does not touch the wedding
 * templates. A template's typography is the design a couple chose and it is
 * internally consistent — letting a planner set Sacramento across Midnight
 * Bloom would break the one thing those six files exist to guarantee.
 *
 * Every face here is already declared in app/layout.tsx and self-hosted by
 * next/font. Nothing new is fetched: a font file is only downloaded when a
 * glyph actually renders in it, so six choices cost exactly as much as one.
 *
 * No "server-only" — a client component (the settings preview) imports this,
 * and it is a table of constants with nothing to leak.
 */

export type BrandFontKey =
  | "CLASSIC"
  | "MODERN"
  | "EDITORIAL"
  | "REFINED"
  | "SCRIPT"
  | "HAND";

export type BrandFont = {
  /** What the planner sees in the picker. */
  label: string;
  /** One line on when it works, written for someone choosing rather than reading. */
  blurb: string;
  /** The CSS stack, resolving a next/font variable with a real fallback behind it. */
  stack: string;
  /**
   * How the brand line is cased and tracked.
   *
   * A studio name in tracked uppercase reads as a letterhead, which is right
   * for the two text faces. It is wrong for a script: capitals in a joined
   * hand do not connect, and letter-spacing a script pulls the strokes apart
   * into something that reads as broken rather than as elegant.
   */
  treatment: "tracked" | "natural";
  /**
   * The email equivalent.
   *
   * Email clients cannot use a self-hosted webfont — Outlook ignores @font-face
   * entirely, and Gmail strips it. So each choice maps to the nearest face that
   * is genuinely resident on the reader's machine, and the mail degrades to a
   * system serif or sans rather than to Times by accident.
   */
  emailStack: string;
};

export const BRAND_FONTS: Record<BrandFontKey, BrandFont> = {
  CLASSIC: {
    label: "Classic",
    blurb: "A quiet garamond. Reads as stationery and never competes with the work.",
    stack: "var(--font-serif), 'Cormorant Garamond', Georgia, serif",
    treatment: "tracked",
    emailStack: "Georgia, 'Times New Roman', serif",
  },
  MODERN: {
    label: "Modern",
    blurb: "A clean grotesque. Best for studios whose identity is minimal and current.",
    stack: "var(--font-sans), Inter, 'Helvetica Neue', Arial, sans-serif",
    treatment: "tracked",
    emailStack: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  },
  EDITORIAL: {
    label: "Editorial",
    blurb: "High-contrast and confident. Carries weight at small sizes.",
    stack: "var(--font-didone), 'Playfair Display', Georgia, serif",
    treatment: "tracked",
    emailStack: "Georgia, 'Times New Roman', serif",
  },
  REFINED: {
    label: "Refined",
    blurb: "A hairline display face. Beautiful set large and given room.",
    stack: "var(--font-display), Italiana, Georgia, serif",
    treatment: "tracked",
    emailStack: "'Didot', Georgia, serif",
  },
  SCRIPT: {
    label: "Script",
    blurb: "An engraved formal hand, in the spirit of an invitation.",
    stack: "var(--font-script), 'Pinyon Script', cursive",
    treatment: "natural",
    emailStack: "'Snell Roundhand', 'Apple Chancery', cursive",
  },
  HAND: {
    label: "Signature",
    blurb: "An even-stroke handwritten hand. Warm rather than formal.",
    stack: "var(--font-script-mono), Sacramento, cursive",
    treatment: "natural",
    emailStack: "'Apple Chancery', 'Segoe Script', cursive",
  },
};

export const BRAND_FONT_KEYS = Object.keys(BRAND_FONTS) as BrandFontKey[];

export const DEFAULT_BRAND_FONT: BrandFontKey = "CLASSIC";

/**
 * Read a stored value back as a key.
 *
 * The column is a String, so this is the single place that decides what an
 * unrecognised value means — and it means CLASSIC, not a crash. A studio whose
 * row predates a renamed key, or was edited by hand, renders in the house serif
 * and stays usable.
 */
export function brandFont(value: string | null | undefined): BrandFont & { key: BrandFontKey } {
  /**
   * `Object.hasOwn`, not `in`.
   *
   * `"__proto__" in BRAND_FONTS` is true — `in` walks the prototype chain — so
   * the obvious version accepts `__proto__`, `toString` and `constructor` as
   * valid keys and then spreads `Object.prototype` into the result, producing a
   * "font" with no stack and no label. Nothing renders and nothing throws,
   * which is the worst shape a bug can take. The value arrives from a database
   * column that is a plain String, so this is the boundary that has to hold.
   */
  const key: BrandFontKey =
    value && Object.hasOwn(BRAND_FONTS, value) ? (value as BrandFontKey) : DEFAULT_BRAND_FONT;
  return { key, ...BRAND_FONTS[key] };
}

/**
 * The studio's brand as render-ready values.
 *
 * One function so the sidebar, the wedding-site footer and the settings preview
 * cannot drift apart — each of them previously would have had to decide for
 * itself what "no logo" or "unknown font" looked like.
 */
export function brandingFor(studio: {
  name: string;
  brandColor: string;
  brandFont?: string | null;
  logoUrl?: string | null;
  logoWidth?: number | null;
  logoHeight?: number | null;
}) {
  const font = brandFont(studio.brandFont);
  return {
    name: studio.name,
    color: studio.brandColor,
    font,
    /**
     * A logo is only usable if we know how big it is. Without dimensions the
     * <img> cannot reserve space, and the alternative — rendering it anyway and
     * accepting the shift — is worse than the wordmark it replaces.
     */
    logo:
      studio.logoUrl && studio.logoWidth && studio.logoHeight
        ? { src: studio.logoUrl, width: studio.logoWidth, height: studio.logoHeight }
        : null,
  };
}

export type Branding = ReturnType<typeof brandingFor>;

/**
 * The CSS custom properties a branded subtree needs.
 *
 * Returned as a plain object for `style={...}` rather than written into a
 * stylesheet, because the values are per-studio and a stylesheet is shared.
 */
/**
 * The same brand, shaped for an email.
 *
 * Separate from `brandingFor` because mail is a different medium with different
 * constraints, not a smaller screen: no webfonts, no CSS variables, and a
 * relative URL that resolves to nothing. Keeping this in one place means the
 * invitation and the RSVP confirmation cannot render the letterhead
 * differently, which is exactly the sort of drift nobody notices until a
 * planner forwards both.
 */
export function emailBrandingFor(studio: {
  name: string;
  brandColor: string;
  brandFont?: string | null;
  logoUrl?: string | null;
  logoWidth?: number | null;
  logoHeight?: number | null;
}) {
  const b = brandingFor(studio);
  return {
    brand: b.name,
    color: b.color,
    face: b.font.emailStack,
    // Only an absolute URL is usable: a mail client has no origin to resolve
    // against. Anything else is dropped and the name is used instead.
    logo: b.logo && /^https?:\/\//i.test(b.logo.src) ? b.logo : null,
  };
}

export function brandVars(b: Branding): React.CSSProperties {
  return {
    "--accent": b.color,
    "--accent-soft": `${b.color}1A`,
    "--brand-face": b.font.stack,
  } as React.CSSProperties;
}
