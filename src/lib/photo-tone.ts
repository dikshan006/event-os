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
  // --- Exposure ----------------------------------------------------------
  // The single biggest reason an uploaded photograph reads as pasted on: it
  // arrives at whatever exposure the camera chose, which is almost always
  // brighter than a page of cream and fine serif type wants.
  //
  // Everything is brought down, but not by a fixed amount. A bright frame is
  // the one actually competing with the type and takes the most; a dim
  // candlelit reception takes very little, because crushing it further turns
  // it muddy and the guest sees a broken photo rather than a styled one.
  // A normal exposure lands around 0.84 — the 15–20% the house style wants.
  const bright = clamp(0.84 - (tone.lum - 0.45) * 0.28, 0.78, 0.93);

  // --- Scrim -------------------------------------------------------------
  // Now that exposure does the global work, the scrim is only what it should
  // always have been: a gradient at the top and bottom edges so overlaid type
  // has something to sit on. Much lighter than before, or the two treatments
  // compound and a bright photograph goes grey.
  const scrim = clamp((tone.lum - 0.5) * 0.34, 0, 0.16);

  // --- Saturation --------------------------------------------------------
  // A gentle, near-universal pull — 5–10% on a normal frame, more on a vivid
  // one. Never below 0.82: past that, skin goes grey and it stops reading as
  // art direction.
  const saturate = clamp(0.95 - (tone.sat - 0.34) * 0.35, 0.82, 0.97);

  // --- Warmth ------------------------------------------------------------
  // A trace of sepia, so a cool phone photograph and a warm film scan sit in
  // the same family on the same page. At this strength it is invisible on any
  // single image and only shows as coherence across several — which is the
  // entire objective. Slightly more on brighter frames, where a cool cast is
  // most obvious against cream.
  const warm = clamp(0.04 + (tone.lum - 0.45) * 0.06, 0.03, 0.08);

  // --- Contrast ----------------------------------------------------------
  // High-contrast frames fight fine serif type; flat ones look washed out
  // against it. Both are nudged toward the middle.
  const contrast = clamp(1 - (tone.spread - 0.22) * 0.34, 0.9, 1.06);

  // --- Vignette ----------------------------------------------------------
  // Enough to settle the edges into the page, more on brighter images where
  // the corners would otherwise glare.
  const vignette = clamp(0.09 + (tone.lum - 0.4) * 0.18, 0.07, 0.2);

  // --- Edge and depth ----------------------------------------------------
  // The photograph is framed rather than dissolved: a hairline plus a shadow
  // held tight to the edge — a print resting on paper, not a card floating
  // above it.
  //
  // Strength is inverted against luminance, because a bright photograph nearly
  // matches a pale page and needs the edge to define where it ends, while a
  // dark one already separates and would look outlined if given the same
  // weight. Both stay low: the effect should register as depth, not a border.
  // The rule is drawn on the page, outside the photograph, so it meets the
  // template background rather than the image — which is why it no longer
  // varies much. It used to be inverted against luminance and inset, and the
  // result was that a dark reception photo got the faintest line of all,
  // drawn in dark ink on a dark image: invisible exactly where an edge was
  // most needed. A near-constant weight is both more visible and more like a
  // print, which does not change its mount to suit the exposure.
  //
  // These two are per-photograph only. How hard each is pushed also depends on
  // the page the print is mounted on, and that is not knowable here: this runs
  // once at upload, while the template can be changed afterwards and the same
  // photograph then has to work on a different ground. So the template's half
  // of the calculation is applied in CSS, as `--s-edge-k` and `--s-depth-k`
  // (see `themeVars` in themes.ts). Splitting it this way means switching a
  // wedding from a cream template to a near-black one re-mounts every existing
  // photograph correctly, with nothing reprocessed.
  const edge = clamp(0.34 + (tone.lum - 0.45) * 0.1, 0.3, 0.42);
  const depth = clamp(0.06 + (tone.lum - 0.42) * 0.1, 0.05, 0.12);

  return {
    "--ph-bright": String(round(bright)),
    "--ph-warm": String(round(warm)),
    "--ph-scrim": String(round(scrim)),
    "--ph-saturate": String(round(saturate)),
    "--ph-contrast": String(round(contrast)),
    "--ph-vignette": String(round(vignette)),
    "--ph-edge": String(round(edge)),
    "--ph-depth": String(round(depth)),
    "--ph-focus-x": `${round(clamp(tone.focusX, 12, 88), 1)}%`,
    "--ph-focus-y": `${round(clamp(tone.focusY, 12, 88), 1)}%`,
  };
}
