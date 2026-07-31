import "server-only";
import sharp from "sharp";
import { UserError } from "./errors";

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
  width: number;
  height: number;
  bytes: number;
};

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
  emit: (key: string, body: Buffer, contentType: string) => Promise<{ bytes: number }>,
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
      const stored = await emit(key, body, `image/${format}`);
      variants.push({ format, width, height, key, bytes: stored.bytes });
      bytes += stored.bytes;
    }
  }

  // Tiny inline placeholder: renders instantly, holds the layout, and blurs up
  // when the real file lands. Kept under ~1 KB so it is cheap to inline in HTML.
  const blur = await normalized.clone().resize({ width: 20 }).webp({ quality: 30 }).toBuffer();
  const blurData = `data:image/webp;base64,${blur.toString("base64")}`;

  return { variants, blurData, width: srcW, height: srcH, bytes };
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
