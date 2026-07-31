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
