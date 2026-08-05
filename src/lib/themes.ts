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
  face: "serif" | "display" | "didone";
  /**
   * What body copy is set in.
   *
   * Every template currently answers `serif`, and the option exists because
   * one of them briefly did not. Velvet Botanical was built with a sans
   * underneath its display serif on the theory that two serifs would compete;
   * what actually happened is that paragraphs of Inter made a wedding
   * invitation read as a product page. A wedding site is a piece of
   * stationery, and stationery is set in a serif. The axis stays because a
   * future template may genuinely want otherwise, but the default is not a
   * close call.
   */
  body: "serif" | "sans";
  /**
   * Full-bleed artwork behind the masthead.
   *
   * A raster, unlike the drawn ornament, and deliberately so: at hero scale a
   * generated vector reads as illustration rather than as paint. Kept as a
   * standalone asset (public/art) precisely so it can be swapped for licensed
   * artwork without touching a line of this file.
   */
  art: "none" | "floral";
  /**
   * Which script the template writes in.
   *
   * `formal` is the house copperplate. `monoline` is the fine even-weight
   * signature hand — a different register entirely, and the whole visual
   * identity of the templates that use it, so it could not simply be the
   * house script at a different size.
   */
  script: "formal" | "monoline";
  /**
   * What the page is printed on.
   *
   * `plain` is a flat colour. `paper` lays a procedural grain and soft washes
   * over it — generated in CSS rather than shipped as an image, so it costs
   * nothing to download, tiles at any size and takes its colour from the
   * palette like everything else.
   */
  surface: "plain" | "paper";
  /**
   * Whether the couple's names sit above the navigation.
   *
   * A masthead in the bar rather than only further down the page. It changes
   * the whole proportion of the first screen, so it belongs to the template
   * rather than to the nav component.
   */
  navMark: boolean;
  /**
   * Decoration at the page's corners.
   *
   * Opt-in per template and drawn in the template's own colours, so it is a
   * property of the palette rather than a hard-coded flourish. `none` is the
   * right answer for most: an ornament that appears everywhere stops being one.
   */
  ornament: "none" | "botanical";
};

export const THEMES: Record<TemplateKey, Theme> = {
  // The accent carries the event times, the links and the script conjunction —
  // small text, all of it, and it has now been darkened twice for the same
  // reason. It began at #9B5B63, which measured 4.53:1 here: over AA by three
  // hundredths, which is not a margin, it is a coincidence. #94555D took it to
  // 5.09:1 against a flat page. The photographic ground is not flat — the
  // darkest place the couple's own photograph can put behind this text
  // measured 4.33:1, and the whole point of the ground is that we do not get
  // to choose the photograph. #8F5158 is indistinguishable by eye and holds
  // 4.63:1 at that worst pixel, 5.29:1 on plain background.
  BLUSH_ROMANCE: {
    bg: "#F6EFEA", ink: "#211E1B", accent: "#8F5158", deep: "#211E1B",
    names: "caps", nameInk: "ink", face: "serif", body: "serif", art: "none", ornament: "none",
    script: "formal", surface: "plain", navMark: false,
  },
  // Sage was #87A07A on white: 2.86:1, which fails WCAG AA even for large
  // text, and it carried every link and the RSVP button. Darkened until both
  // the text-on-background and white-on-button directions pass.
  MODERN_SAGE: {
    bg: "#FFFFFF", ink: "#414B3C", accent: "#5E7052", deep: "#54654A",
    names: "caps", nameInk: "deep", face: "serif", body: "serif", art: "none", ornament: "none",
    script: "formal", surface: "plain", navMark: false,
  },
  CLASSIC_ELEGANCE: {
    bg: "#F7F2E4", ink: "#5a4038", accent: "#A93A42", deep: "#A93A42",
    names: "script", nameInk: "ink", face: "serif", body: "serif", art: "none", ornament: "none",
    script: "formal", surface: "plain", navMark: false,
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
    names: "caps", nameInk: "ink", face: "display", body: "serif", art: "none", ornament: "botanical",
    script: "formal", surface: "plain", navMark: true,
  },
  /**
   * Pacific Linen — bright, textured, almost monochrome.
   *
   * The ground is the design. A flat off-white would be a blank page; the
   * grain and the pale washes are what make it read as something *printed on*,
   * which is the whole difference between this and a minimal white template.
   *
   * The accent carries two points of blue rather than being a true black, so
   * it sits with the washes instead of against them, and it is dark enough
   * (11.6:1) to do the work black would have done: the script names, the
   * links and the solid RSVP block. A page this pale has nowhere to hide a
   * weak accent.
   */
  PACIFIC_LINEN: {
    bg: "#F3F0E9", ink: "#2A2825", accent: "#26313A", deep: "#26313A",
    names: "script", nameInk: "ink", face: "serif", body: "serif", art: "none", ornament: "none",
    script: "monoline", surface: "paper", navMark: false,
  },
  /**
   * Velvet Botanical — a painted still life brought onto the web.
   *
   * The artwork carries the page, so everything else gets out of its way: one
   * high-contrast serif for the names and headings, a sans for everything that
   * has to be read over paint, and no ornament at all. An ornament on top of a
   * full-bleed bouquet is decoration on decoration.
   *
   * The accent is a warm blush lifted straight out of the painting rather than
   * one of its reds. Every red in that palette is too dark to carry text on
   * near-black — the deepest measures 3.0:1, which fails AA — while this
   * measures 10.2:1 and still belongs to the arrangement.
   */
  VELVET_BOTANICAL: {
    bg: "#14100F", ink: "#F0E7DA", accent: "#DDB9AD", deep: "#F7F1E6",
    names: "caps", nameInk: "deep", face: "didone", body: "serif", art: "floral",
    ornament: "none", script: "formal", surface: "plain", navMark: true,
  },
};

/**
 * The palette for a template, with a floor under it.
 *
 * `THEMES[key]` is typed as total, and it is — for values this build knows
 * about. A database is older and longer-lived than a deployment: a row written
 * by a newer build, or a value removed from the enum in a later one, arrives
 * here as a string with no entry. Indexing straight into the record then yields
 * `undefined`, and the first property read on it takes down the render of an
 * entire wedding site with a 500.
 *
 * A wedding site that renders in the wrong palette is a cosmetic problem a
 * planner can fix in one click. A wedding site that does not render at all, on
 * the morning guests are opening their invitations, is not.
 */
export function themeFor(key: string): Theme {
  const theme = (THEMES as Record<string, Theme | undefined>)[key];
  if (theme) return theme;
  console.error(
    `[themes] unknown template ${JSON.stringify(key)} — falling back to ${FALLBACK_TEMPLATE}. ` +
      `This row was probably written by a different build.`,
  );
  return THEMES[FALLBACK_TEMPLATE];
}

/** The template anything unrecognised is rendered in. */
const FALLBACK_TEMPLATE = "BLUSH_ROMANCE" as const;

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
    "--s-face": { display: "var(--display)", didone: "var(--didone)", serif: "var(--serif)" }[t.face],
    "--s-body": t.body === "sans" ? "var(--sans)" : "var(--serif)",
    "--s-script": t.script === "monoline" ? "var(--script-mono)" : "var(--script)",
    /**
     * The accent, adjusted for a page that sits on a photograph.
     *
     * The accent carries the small text — event times, the table number, the
     * registry vendor lines, the links — and on a pale template it is a
     * mid-tone that starts at around 5:1 against flat background. That is a
     * tenth of the ratio in hand, and a photograph showing through the section
     * panels spends it immediately: measured at 4.0:1 with the panel at 80%
     * and 1.1:1 with no panel at all.
     *
     * So it was the accent, not the panel, that was forcing the panels to be
     * nearly opaque — and an opaque panel over a photograph is a photograph
     * you cannot see. Mixing the accent a little under halfway toward the ink
     * darkens it while holding the hue: the rose is still rose, the sage still
     * sage, and all three pale templates clear AA by about 0.2 at a panel thin
     * enough to read the picture through. Derived rather than hand-picked, so
     * it stays correct for a palette nobody has written yet — the three
     * existing accents needed different amounts and one ratio covers them.
     *
     * Dark templates are the opposite case — a light accent on a darkened
     * ground, already at 9:1 — and mixing toward their light ink would do
     * nothing useful, so they keep the accent as designed.
     */
    "--s-accent-ground": dark ? t.accent : `color-mix(in srgb, ${t.accent} 55%, ${t.ink})`,
    /**
     * And the same for `deep`, which on two of the three pale templates is the
     * accent again under another name and carries its own share of small text.
     * Adjusting one and not the other left exactly one line still failing.
     */
    "--s-deep-ground": dark ? t.deep : `color-mix(in srgb, ${t.deep} 55%, ${t.ink})`,
    "--s-shade": dark ? "#000000" : t.ink,
    "--s-edge-k": dark ? "1.6" : "1",
    "--s-depth-k": dark ? "0.5" : "1",
    "--s-line": dark ? "14%" : "8%",
  };
}
