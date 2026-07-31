"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fade-and-rise on first entry into the viewport.
 *
 * One IntersectionObserver per element, disconnected the moment it fires — the
 * animation is one-way, so there is nothing to observe afterwards. No scroll
 * listener, no work on the main thread while scrolling, and nothing that could
 * interfere with Lenis' loop.
 *
 * Movement is 12px and opacity only; both are compositor-friendly properties.
 * Elements start visible in markup and are hidden by CSS only once JS confirms
 * it can un-hide them, so content is never trapped invisible if scripts fail.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger in ms. Keep small — this should read as one movement, not a sequence. */
  delay?: number;
  as?: "div" | "section" | "figure" | "header";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    // Honour the reduced-motion preference by never arming the animation.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    setArmed(true);

    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      // Fire a little before the element reaches the fold so the movement has
      // finished by the time it is properly in view.
      { rootMargin: "0px 0px -12% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`reveal${armed ? " armed" : ""}${shown ? " in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
