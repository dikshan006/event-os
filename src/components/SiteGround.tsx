import type { PhotoView } from "@/lib/photo-view";

/**
 * The couple's photograph, held behind the whole page.
 *
 * The site used to show the hero once and then run on flat colour, so the
 * photography stopped at the top of the page. This keeps it underneath
 * everything — story, schedule, travel, gallery, FAQ, RSVP — so scrolling
 * reads as one continuous surface rather than a sequence of panels.
 *
 * ── Why a fixed element and not `background-attachment: fixed` ────────────
 * They look identical and cost very different amounts. `background-attachment:
 * fixed` makes the browser repaint the background against a moving scroll
 * offset on the main thread every frame; measured on this codebase last week
 * it took one template from 16.7ms per frame to 25.1ms median and 47.3ms at
 * the 95th percentile — 40fps with visible drops. A `position: fixed` element
 * promoted to its own compositor layer is simply pinned by the compositor and
 * costs nothing per frame. Same effect, none of the bill.
 *
 * The photograph is a real `<picture>` rather than a CSS background, so the
 * AVIF/WebP ladder and the blur placeholder that every other image on the site
 * gets apply here too, and the browser picks the rendition that fits the
 * viewport instead of always fetching the largest.
 *
 * Deliberately quiet. It sits behind body copy, a schedule and an RSVP form,
 * and legibility is not negotiable against atmosphere: the scrim above it is
 * tuned per template in CSS and the whole page's contrast is measured against
 * what actually renders. The framed hero further down is still where the
 * photograph is properly *shown*.
 *
 * `aria-hidden`, and no alt text: the same photograph is already presented and
 * described in the hero. Announcing it twice would be noise.
 */
export function SiteGround({ photo }: { photo: PhotoView }) {
  return (
    <div className="s-ground" aria-hidden="true">
      <picture>
        <source type="image/avif" srcSet={photo.avif} sizes="100vw" />
        <source type="image/webp" srcSet={photo.webp} sizes="100vw" />
        <img
          src={photo.src}
          alt=""
          width={photo.width}
          height={photo.height}
          // Above the fold by definition, so it is fetched with the hero
          // rather than lazily — but at low priority, because the hero is the
          // one a guest is actually looking at.
          decoding="async"
          fetchPriority="low"
          style={{ backgroundImage: `url("${photo.blurData}")` }}
        />
      </picture>
      <div className="s-ground-scrim" />
    </div>
  );
}
