/**
 * The photograph presentation system.
 *
 * A planner uploads whatever their photographer delivered: a bright beach
 * portrait, a dim candlelit reception, an oversaturated phone snap. Dropping
 * those straight into a page of fine serif type is what makes a wedding site
 * look assembled rather than designed — the image reads as an asset pasted on
 * top instead of part of the composition.
 *
 * A single fixed overlay cannot solve that, because the correction a bright
 * image needs is the opposite of what a dark one needs. So each photograph is
 * measured once at upload (see `analyseImage` in images.ts) and the numbers
 * are stored alongside it. This module turns those measurements into the CSS
 * custom properties the renderer applies.
 *
 * The result: a consistent house style across every wedding and every
 * template, reached automatically, with nothing for the planner to adjust.
 */

/** Measurements taken from a photograph at upload time. */
export type PhotoTone = {
  /** Mean luminance, 0 (black) → 1 (white). */
  lum: number;
  /** Mean saturation, 0 (grey) → 1 (vivid). */
  sat: number;
  /** Luminance standard deviation, 0 → 1. A contrast proxy. */
  spread: number;
  /** Focal point as percentages, used for `object-position`. */
  focusX: number;
  focusY: number;
};

/** Neutral values for photographs uploaded before measurement existed. */
export const NEUTRAL_TONE: PhotoTone = { lum: 0.5, sat: 0.4, spread: 0.2, focusX: 50, focusY: 50 };

export function asTone(json: unknown): PhotoTone {
  if (!json || typeof json !== "object") return NEUTRAL_TONE;
  const t = json as Partial<PhotoTone>;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return {
    lum: num(t.lum, NEUTRAL_TONE.lum),
    sat: num(t.sat, NEUTRAL_TONE.sat),
    spread: num(t.spread, NEUTRAL_TONE.spread),
    focusX: num(t.focusX, NEUTRAL_TONE.focusX),
    focusY: num(t.focusY, NEUTRAL_TONE.focusY),
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round = (v: number, dp = 3) => Number(v.toFixed(dp));

/**
 * Derive the presentation for one photograph.
 *
 * Every rule below is a correction toward a common house tone, expressed as a
 * small adjustment rather than a heavy filter — the aim is that nobody notices
 * the treatment, only that the page looks considered.
 */
export function toneStyle(tone: PhotoTone): Record<string, string> {
  // --- Scrim -------------------------------------------------------------
  // A bright photograph next to text is what actually breaks the hierarchy, so
  // the wash of template background scales with luminance. Dark images already
  // sit back and get almost none, which stops them turning muddy.
  const scrim = clamp((tone.lum - 0.42) * 0.62, 0, 0.3);

  // A dark image is instead lifted very slightly, so it reads as intentional
  // low-key rather than underexposed.
  const lift = clamp((0.4 - tone.lum) * 0.22, 0, 0.09);

  // --- Saturation --------------------------------------------------------
  // Only vivid images are pulled back, and never below 0.82 — beyond that
  // skin tones go grey and the photograph looks broken rather than styled.
  const saturate = clamp(1 - (tone.sat - 0.34) * 0.42, 0.82, 1);

  // --- Contrast ----------------------------------------------------------
  // High-contrast frames fight fine serif type; flat ones look washed out
  // against it. Both are nudged toward the middle.
  const contrast = clamp(1 - (tone.spread - 0.22) * 0.34, 0.9, 1.06);

  // --- Vignette ----------------------------------------------------------
  // Enough to settle the edges into the page, more on brighter images where
  // the corners would otherwise glare.
  const vignette = clamp(0.1 + (tone.lum - 0.4) * 0.2, 0.08, 0.22);

  // --- Edge and depth ----------------------------------------------------
  // The photograph is framed rather than dissolved: a hairline plus a shadow
  // that sits tight to the edge. Both are mixed from the template's own ink
  // and background, never from pure black or white, so a sage invitation gets
  // a sage-grey edge and a champagne one gets a warm edge.
  //
  // Strength is inverted against luminance, because a bright photograph nearly
  // matches a pale page and needs the edge to define where it ends, while a
  // dark one already separates and would look outlined if given the same
  // weight. Both stay under 0.2 — the effect should register as depth, not as
  // a border.
  const edge = clamp(0.07 + (tone.lum - 0.42) * 0.16, 0.05, 0.15);
  const depth = clamp(0.05 + (tone.lum - 0.42) * 0.1, 0.04, 0.1);

  return {
    "--ph-scrim": String(round(scrim)),
    "--ph-lift": String(round(lift)),
    "--ph-saturate": String(round(saturate)),
    "--ph-contrast": String(round(contrast)),
    "--ph-vignette": String(round(vignette)),
    "--ph-edge": String(round(edge)),
    "--ph-depth": String(round(depth)),
    "--ph-focus-x": `${round(clamp(tone.focusX, 12, 88), 1)}%`,
    "--ph-focus-y": `${round(clamp(tone.focusY, 12, 88), 1)}%`,
  };
}
