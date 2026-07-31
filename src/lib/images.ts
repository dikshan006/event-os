import "server-only";
import sharp from "sharp";
import { UserError } from "./errors";
import { NEUTRAL_TONE, type PhotoTone } from "./photo-tone";

/**
 * Upload-time image pipeline.
 *
 * Every derivative a browser will ever request is produced once, here, and
 * written to storage. The public site then serves plain <img srcset> — no
 * per-request transform, no image-optimization bill, and identical behaviour on
 * Vercel, Fly, a container, or a VPS.
 *
 * Two formats are emitted per size: AVIF (roughly 30-50% smaller, the reason
 * mobile stays fast on a wedding site that is mostly photographs) and WebP as
 * the fallback every current browser understands. JPEG is deliberately not
 * emitted — WebP support is universal in browsers released this decade.
 */

export const WIDTH_LADDER = [480, 960, 1600, 2400] as const;

/** Slot-specific ceilings: a story thumbnail never needs 2400px of data. */
export const SLOT_MAX_WIDTH = {
  HERO: 2400,
  COUPLE: 1600,
  STORY: 1600,
  GALLERY: 1600,
} as const;

/**
 * Vercel caps a serverless function's *request body* at 4.5 MB, and that cap
 * sits in front of the application — `serverActions.bodySizeLimit` cannot raise
 * it. Anything larger is rejected before this code runs, so advertising a
 * bigger limit would just produce an unexplained failure at the platform edge.
 * Lifting this properly means presigned direct-to-R2 uploads (see DEPLOYMENT.md).
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED = new Set(["jpeg", "jpg", "png", "webp", "avif", "tiff", "heif"]);

export type Variant = {
  format: "avif" | "webp";
  width: number;
  height: number;
  key: string;
  bytes: number;
};

export type ProcessedImage = {
  variants: Variant[];
  blurData: string;
  tone: PhotoTone;
  width: number;
  height: number;
  bytes: number;
};

/**
 * Measure a photograph so the site can present it consistently.
 *
 * Runs on a 64px-wide greyscale-plus-colour sample rather than the full image,
 * so the whole analysis is a few thousand pixels of arithmetic — negligible
 * next to the eight AVIF/WebP encodes happening around it.
 *
 * The focal point is a detail centroid: neighbouring-pixel differences
 * approximate local detail, and their weighted centre lands on the subject far
 * more often than the geometric middle does. Faces, being high-detail against
 * smoother backgrounds, attract it naturally. It is a heuristic, not face
 * detection — but the failure mode is simply the centre of the frame, which is
 * where a fixed crop would have been anyway.
 */
async function analyseImage(img: sharp.Sharp): Promise<PhotoTone> {
  const W = 64;
  const { data, info } = await img
    .clone()
    .resize({ width: W, fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const px = w * h;
  if (!px) return NEUTRAL_TONE;

  const lumAt = (i: number) => {
    const o = i * 3;
    // Rec. 709 luma: matches how the eye weights the channels.
    return (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  };

  let lumSum = 0;
  let lumSq = 0;
  let satSum = 0;
  for (let i = 0; i < px; i++) {
    const o = i * 3;
    const r = data[o] / 255, g = data[o + 1] / 255, b = data[o + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    // HSL saturation, guarded at the extremes where it is meaningless.
    const l = (max + min) / 2;
    satSum += max === min ? 0 : (max - min) / (l > 0.5 ? 2 - max - min : max + min || 1);
    const y = lumAt(i);
    lumSum += y;
    lumSq += y * y;
  }

  const lum = lumSum / px;
  const spread = Math.sqrt(Math.max(0, lumSq / px - lum * lum));

  // Detail centroid.
  let wx = 0, wy = 0, wsum = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const dx = Math.abs(lumAt(i + 1) - lumAt(i - 1));
      const dy = Math.abs(lumAt(i + w) - lumAt(i - w));
      // Squared so genuinely detailed regions dominate mild texture.
      const weight = (dx + dy) ** 2;
      wx += x * weight;
      wy += y * weight;
      wsum += weight;
    }
  }

  const focusX = wsum > 0 ? (wx / wsum / (w - 1)) * 100 : 50;
  const focusY = wsum > 0 ? (wy / wsum / (h - 1)) * 100 : 50;

  return {
    lum,
    sat: satSum / px,
    spread,
    // Pulled toward centre: a centroid is a rough signal, and an aggressive
    // crop offset is far more noticeable when wrong than a gentle one.
    focusX: 50 + (focusX - 50) * 0.6,
    focusY: 50 + (focusY - 50) * 0.6,
  };
}

/** A problem with the submitted image that the planner can act on. */
export class ImageError extends UserError {}

/**
 * Decode, validate, and render the full derivative ladder for one upload.
 *
 * `emit` receives each generated buffer and is responsible for persisting it —
 * keeping this module free of any storage knowledge, which is what makes it
 * testable without a bucket.
 */
export async function processImage(
  input: Buffer,
  slot: keyof typeof SLOT_MAX_WIDTH,
  basePath: string,
  emit: (key: string, body: Buffer, contentType: string) => Promise<{ key: string; bytes: number }>,
): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageError(`Image is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  // `failOn: "none"` keeps slightly-malformed but decodable camera files
  // working; the metadata check below is what actually rejects non-images.
  const source = sharp(input, { failOn: "none" });
  const meta = await source.metadata();

  if (!meta.format || !ACCEPTED.has(meta.format)) {
    throw new ImageError("That file is not an image we can process (use JPEG, PNG, WebP, AVIF or HEIC).");
  }
  if (!meta.width || !meta.height) throw new ImageError("Could not read the image dimensions.");
  if (meta.width < 400 || meta.height < 400) {
    throw new ImageError("That image is too small — please upload at least 400×400 pixels.");
  }
  // A decompression-bomb guard: 100 MP is far beyond any real camera output.
  if (meta.width * meta.height > 100_000_000) throw new ImageError("That image is too large to process.");

  // `.rotate()` with no argument bakes in the EXIF orientation; combined with
  // the re-encode below, all other EXIF (including GPS coordinates from the
  // photographer's camera) is dropped rather than published to the web.
  const normalized = sharp(await source.rotate().toBuffer(), { failOn: "none" });
  const base = await normalized.metadata();
  const srcW = base.width as number;
  const srcH = base.height as number;

  const ceiling = Math.min(SLOT_MAX_WIDTH[slot], srcW);
  const widths: number[] = WIDTH_LADDER.filter(w => w <= ceiling);
  // Always keep at least one rendition, even for a source smaller than 480px,
  // and top the ladder out at the source width rather than upscaling.
  if (!widths.length || widths[widths.length - 1] < ceiling) widths.push(ceiling);

  const variants: Variant[] = [];
  let bytes = 0;

  for (const width of widths) {
    const height = Math.round((srcH / srcW) * width);
    const resized = normalized.clone().resize({ width, withoutEnlargement: true });

    for (const format of ["avif", "webp"] as const) {
      const body =
        format === "avif"
          ? await resized.clone().avif({ quality: 55, effort: 4 }).toBuffer()
          : await resized.clone().webp({ quality: 78 }).toBuffer();

      const key = `${basePath}/${width}.${format}`;
      // Persist the key the driver actually stored under: S3 echoes ours back,
      // Vercel Blob returns its own absolute URL.
      const stored = await emit(key, body, `image/${format}`);
      variants.push({ format, width, height, key: stored.key, bytes: stored.bytes });
      bytes += stored.bytes;
    }
  }

  // Tiny inline placeholder: renders instantly, holds the layout, and blurs up
  // when the real file lands. Kept under ~1 KB so it is cheap to inline in HTML.
  const blur = await normalized.clone().resize({ width: 20 }).webp({ quality: 30 }).toBuffer();
  const blurData = `data:image/webp;base64,${blur.toString("base64")}`;

  // Measured from the normalised image so orientation is already applied.
  const tone = await analyseImage(normalized);

  return { variants, blurData, tone, width: srcW, height: srcH, bytes };
}

/* ------------------------------------------------- rendering helpers ------ */

/** Narrowing helper: `variants` comes back from Prisma as `Json`. */
export function asVariants(json: unknown): Variant[] {
  return Array.isArray(json) ? (json as Variant[]) : [];
}

/** `srcset` string for one format, e.g. "…/960.avif 960w, …/1600.avif 1600w". */
export function srcSet(variants: Variant[], format: Variant["format"], url: (key: string) => string) {
  return variants
    .filter(v => v.format === format)
    .sort((a, b) => a.width - b.width)
    .map(v => `${url(v.key)} ${v.width}w`)
    .join(", ");
}

/** Largest WebP rendition — the `src` every browser can fall back to. */
export function fallbackSrc(variants: Variant[], url: (key: string) => string) {
  const webp = variants.filter(v => v.format === "webp").sort((a, b) => b.width - a.width);
  return webp.length ? url(webp[0].key) : "";
}
