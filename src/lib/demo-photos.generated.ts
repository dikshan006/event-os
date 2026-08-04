/**
 * GENERATED — do not edit by hand.
 *
 * Produced by `scripts/build-demo-photos.ts`, using the same `processImage`
 * pipeline a planner's upload goes through. The tone values below were measured
 * from the photographs themselves, which is why the template previews show the
 * real photo treatment rather than an approximation of it.
 *
 * To give a template its own photography, drop a `hero` and a `story` into a
 * folder named for that template and re-run the script.
 */
import type { PhotoView } from "./photo-view";

export const HERO_9EDA8650: PhotoView = {
  "id": "demo-hero-9eda8650",
  "alt": "The couple photographed together on the evening of their engagement.",
  "caption": null,
  "width": 736,
  "height": 981,
  "blurData": "data:image/webp;base64,UklGRqgAAABXRUJQVlA4IJwAAADwBACdASoUABsAPxF8tFOsJ6SiqAqpgCIJZQC+SA6yz7uhU4YEJ9aELq2ioivAxIAA/tj841ZtBxSl3k7sqJVKsVaxIjUuGZcpwbqTp9ZFFV+exop2BTtqzXUaw3d4GDijRJNdrMSZ045YOQ7Oxcu+3VQJMmK9ncHrpmoxtZm/8kqye5o92o8SNFIvg2QIvRojmEHozFRUgRgAAAA=",
  "avif": "/demo/hero-9eda8650/480.avif 480w, /demo/hero-9eda8650/736.avif 736w",
  "webp": "/demo/hero-9eda8650/480.webp 480w, /demo/hero-9eda8650/736.webp 736w",
  "src": "/demo/hero-9eda8650/736.webp",
  "style": {
    "--ph-bright": "0.873",
    "--ph-warm": "0.033",
    "--ph-scrim": "0",
    "--ph-saturate": "0.97",
    "--ph-contrast": "1.019",
    "--ph-vignette": "0.078",
    "--ph-edge": "0.328",
    "--ph-depth": "0.051",
    "--ph-focus-x": "48.7%",
    "--ph-focus-y": "49%"
  }
};

export const STORY_D8B62E61: PhotoView = {
  "id": "demo-story-d8b62e61",
  "alt": "The couple lying together outdoors, from the series accompanying their story.",
  "caption": null,
  "width": 978,
  "height": 1236,
  "blurData": "data:image/webp;base64,UklGRq4AAABXRUJQVlA4IKIAAAAwBQCdASoUABkAPxF8s1QsJ6QjKAqpgCIJQBihUAA+qBNdpWeJ9cu1FKHI0rhvc+2sAADC78l7r/BM+0syVmaoT8+JYe7zQWBxmLSs778dSk6jIcvuJkzq/Ycf7vJrKPaq38Vj1513+SN5iuZERle77m1JEAFHbrtcVtm88gY2UxK2kcc5itoij6BOKXlTQC5Lt+5zLRPJAy6JJghxdyaAAAA=",
  "avif": "/demo/story-d8b62e61/480.avif 480w, /demo/story-d8b62e61/960.avif 960w, /demo/story-d8b62e61/978.avif 978w",
  "webp": "/demo/story-d8b62e61/480.webp 480w, /demo/story-d8b62e61/960.webp 960w, /demo/story-d8b62e61/978.webp 978w",
  "src": "/demo/story-d8b62e61/978.webp",
  "style": {
    "--ph-bright": "0.871",
    "--ph-warm": "0.033",
    "--ph-scrim": "0",
    "--ph-saturate": "0.957",
    "--ph-contrast": "1.011",
    "--ph-vignette": "0.079",
    "--ph-edge": "0.329",
    "--ph-depth": "0.052",
    "--ph-focus-x": "49.7%",
    "--ph-focus-y": "54.1%"
  }
};

/** Which photographs each template previews with. */
export const DEMO_BY_TEMPLATE: Record<string, { hero: PhotoView | null; story: PhotoView | null }> = {
  BLUSH_ROMANCE: { hero: HERO_9EDA8650, story: STORY_D8B62E61 },
  MODERN_SAGE: { hero: HERO_9EDA8650, story: STORY_D8B62E61 },
  CLASSIC_ELEGANCE: { hero: HERO_9EDA8650, story: STORY_D8B62E61 },
  MIDNIGHT_BLOOM: { hero: HERO_9EDA8650, story: STORY_D8B62E61 },
};
