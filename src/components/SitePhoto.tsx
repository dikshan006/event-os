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
  rounded = true,
}: {
  photo: PhotoView;
  /** Tells the browser how wide this image renders, so it picks the right rendition. */
  sizes: string;
  /** Set on the hero only: skips lazy-loading and raises fetch priority. */
  priority?: boolean;
  /** Crop to a fixed aspect ratio (e.g. 16 / 9). Omit to keep the natural ratio. */
  ratio?: number;
  className?: string;
  rounded?: boolean;
}) {
  const aspect = ratio ?? photo.width / photo.height;

  return (
    <figure
      className={`s-ph${rounded ? " rounded" : ""} ${className}`.trim()}
      style={{
        aspectRatio: String(aspect),
        backgroundImage: `url("${photo.blurData}")`,
      }}
    >
      {/*
        WebP only, deliberately.

        `<picture>` does not fall back when a browser *claims* to support a
        format and then fails to decode the file — it renders a broken image.
        That made the AVIF source a single point of failure: desktop Safari
        selected it and broke, while mobile Safari fell back to WebP and worked,
        on byte-identical URLs the server was returning 200 for.

        WebP is supported by every browser released this decade and still gives
        most of the saving over JPEG. The AVIF derivatives are still generated
        and stored, so re-enabling this source is a one-line change once the
        encoder settings have been verified against Safari.
      */}
      <img
        src={photo.src}
        srcSet={photo.webp}
        sizes={sizes}
        alt={photo.alt}
        width={photo.width}
        height={photo.height}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        fetchPriority={priority ? "high" : "auto"}
      />
      {photo.caption && <figcaption>{photo.caption}</figcaption>}
    </figure>
  );
}
