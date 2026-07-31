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
  tone = true,
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
   * Blend the photograph into the page palette.
   *
   * Uploaded photos arrive at whatever contrast and colour temperature the
   * camera produced, and a bright, saturated frame next to fine serif type
   * fights it. A small desaturation plus a wash of the template's own
   * background colour settles the image into the layout so it reads as art
   * direction rather than an asset dropped onto the page. Disabled inside the
   * gallery, where the photographs are the subject.
   */
  tone?: boolean;
}) {
  const aspect = ratio ?? photo.width / photo.height;

  return (
    <figure
      className={`s-ph${tone ? " toned" : ""} ${className}`.trim()}
      style={{
        aspectRatio: String(aspect),
        backgroundImage: `url("${photo.blurData}")`,
        // Per-image measurements, resolved server-side. The CSS below reads
        // these rather than hard-coding one treatment for every photograph.
        ...(tone ? photo.style : undefined),
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
