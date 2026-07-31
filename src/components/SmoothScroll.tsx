"use client";

import { useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";
// Lenis' own stylesheet, shipped with the package. It is inert until Lenis puts
// the `.lenis` class on <html>, so importing it costs nothing when the instance
// is not mounted. `autoToggle` below explicitly requires it.
import "lenis/dist/lenis.css";

/**
 * Smooth scrolling for the guest-facing wedding pages only.
 *
 * Mounted from `WeddingSite`, which renders `/w/[slug]` and `/invite/[code]`
 * and nothing else — the planner studio and platform admin keep native
 * scrolling, where predictable, instant scrolling matters more than feel.
 *
 * Options, and why each one:
 *
 *  - `anchors: true` — Lenis intercepts in-page links and animates to them.
 *    No offset is passed: Lenis reads the target's computed `scroll-margin`
 *    (see `.site [id]` in globals.css), so the clearance for the sticky nav is
 *    defined once in CSS and honoured by both native and smooth scrolling.
 *  - `autoRaf: true` — Lenis drives its own requestAnimationFrame loop; there
 *    is no other animation loop on these pages to synchronise with.
 *  - `autoToggle: true` — starts and stops the instance from the wrapper's
 *    overflow, so a modal or a scroll lock behaves correctly without manual
 *    `stop()`/`start()` calls.
 *  - `naiveDimensions: true` — uses window dimensions instead of measuring
 *    content on every resize. These pages are ordinary document flow, so the
 *    measurement is redundant work.
 *  - `stopInertiaOnNavigate: true` — kills residual inertia across navigation
 *    rather than carrying momentum into a fresh page.
 *  - `lerp: 0.12` — deliberately tighter than the library default of a 1.2s
 *    eased duration, which reads as a noticeable glide. This is close enough
 *    to native that the motion registers as smoothness rather than as an
 *    effect, which is the intent.
 *
 * Deliberately NOT enabled:
 *
 *  - `allowNestedScroll` — Lenis' own documentation notes it walks the DOM on
 *    every scroll event and recommends `data-lenis-prevent` instead if that
 *    costs performance. These pages have no nested scroll containers, so it
 *    would be pure overhead. If one is ever added, mark it with
 *    `data-lenis-prevent` rather than turning this on globally.
 *  - `syncTouch` — left at its default of `false`, so touch scrolling stays
 *    native. iOS momentum is better than anything a JS loop reproduces, and
 *    hijacking it is the usual reason smooth-scroll libraries feel worse on a
 *    phone than without them.
 */
export function SmoothScroll() {
  // Lenis has no built-in reduced-motion handling — verified against the
  // source, which never queries the media feature. Gating the mount is
  // therefore our responsibility, not a nicety.
  //
  // Resolved in an effect rather than during render so the server and the first
  // client render agree; Lenis attaches one frame later, on native scroll until
  // then.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setEnabled(!mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (!enabled) return null;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.12,
        anchors: true,
        autoRaf: true,
        autoToggle: true,
        naiveDimensions: true,
        stopInertiaOnNavigate: true,
      }}
    />
  );
}
