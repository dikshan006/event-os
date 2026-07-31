/**
 * The only shape rendering components ever see.
 *
 * URLs are resolved server-side by the storage driver before this crosses into
 * a component, which keeps `storage()` (and therefore the AWS SDK) out of every
 * render path and makes the photo components pure, driver-agnostic, and
 * trivially testable with a literal object.
 */
export type PhotoView = {
  id: string;
  alt: string;
  caption: string | null;
  width: number;
  height: number;
  /** Inline blur-up placeholder, ~1 KB data URI. */
  blurData: string;
  /** AVIF srcset — offered first, browsers that support it save 30-50%. */
  avif: string;
  /** WebP srcset — the universal fallback. */
  webp: string;
  /** Largest WebP rendition, used as the plain `src`. */
  src: string;
};

export type PhotoSet = {
  hero: PhotoView | null;
  couple: PhotoView[];
  story: PhotoView[];
  gallery: PhotoView[];
};

export const EMPTY_PHOTOS: PhotoSet = { hero: null, couple: [], story: [], gallery: [] };
