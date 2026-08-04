import type { PhotoView } from "@/lib/photo-view";

/**
 * One responsive, lazily-loaded photograph.
 *
 * Deliberately a plain <picture> rather than next/image: every rendition was
 * already generated at upload time, so there is nothing left to optimize at
 * request time — and this way the wedding site costs nothing per image view and
 * behaves the same on any host.
 *
 * The blur placeholder is painted as a scaled-up background beneath the real
 * file, so the frame is never empty and never shifts: the wrapper reserves the
 * exact aspect ratio before a byte of the photo arrives (zero CLS).
 */
export function SitePhoto({
  photo,
  sizes,
  priority = false,
  ratio,
  className = "",
  treatment = "page",
}: {
  photo: PhotoView;
  /** Tells the browser how wide this image renders, so it picks the right rendition. */
  sizes: string;
  /** Set on the hero only: skips lazy-loading and raises fetch priority. */
  priority?: boolean;
  /** Crop to a fixed aspect ratio (e.g. 16 / 9). Omit to keep the natural ratio. */
  ratio?: number;
  className?: string;
  /**
   * How much of the house treatment to apply.
   *
   * `page` — the default. Exposure, colour, hairline and contact shadow, plus
   * the gradients that settle the photograph into a page of serif type.
   *
   * `print` — everything except those gradients. Used in the full-screen
   * gallery, where there is no type for the image to sit under and a vignette
   * would read as a filter. The frame and the colour still apply, so a
   * photograph looks like the same photograph in both places.
   *
   * There is no way to opt out entirely, and that is the point: the treatment
   * is what makes twenty uploads from four cameras look like one album.
   */
  treatment?: "page" | "print";
}) {
  const aspect = ratio ?? photo.width / photo.height;

  return (
    <figure
      className={`s-ph ${treatment === "page" ? "toned" : "framed"} ${className}`.trim()}
      style={{
        aspectRatio: String(aspect),
        backgroundImage: `url("${photo.blurData}")`,
        // Per-image measurements, resolved server-side. The CSS reads these
        // rather than hard-coding one treatment for every photograph.
        ...photo.style,
      } as React.CSSProperties}
    >
      <picture>
        <source type="image/avif" srcSet={photo.avif} sizes={sizes} />
        <source type="image/webp" srcSet={photo.webp} sizes={sizes} />
        <img
          src={photo.src}
          alt={photo.alt}
          width={photo.width}
          height={photo.height}
          loading={priority ? "eager" : "lazy"}
          decoding={priority ? "sync" : "async"}
          fetchPriority={priority ? "high" : "auto"}
        />
      </picture>
      {photo.caption && <figcaption>{photo.caption}</figcaption>}
    </figure>
  );
}
