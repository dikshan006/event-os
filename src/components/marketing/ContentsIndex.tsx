"use client";

import { useEffect, useState } from "react";

export type Chapter = { id: string; label: string };

/**
 * The numbered index from the reference, made functional.
 *
 * It is the page's table of contents *and* its navigation: clicking scrolls to
 * a chapter, and scrolling marks the chapter you are in. That is the whole
 * reason the homepage opens on a contents page rather than on a hero — it
 * tells the visitor the shape of the argument before they read it, and gives
 * them a way to skip to the part they care about. A landing page that hides
 * its structure makes people scroll to find out whether it is worth scrolling.
 *
 * The spy uses a single IntersectionObserver with a thin band near the top of
 * the viewport rather than a scroll listener: no work happens on the main
 * thread between crossings, and there is no measurement that could fight
 * Lenis' loop.
 */
export function ContentsIndex({ chapters }: { chapters: Chapter[] }) {
  const [here, setHere] = useState<string | null>(null);

  useEffect(() => {
    const targets = chapters
      .map(c => document.getElementById(c.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!targets.length) return;

    // The band sits between 22% and 28% of the viewport height. A chapter
    // becomes current when its box crosses that line, which is roughly where
    // the eye rests while reading. Because chapters are tall, at most one is
    // ever in the band; when none is (mid-transition), the previous stays
    // marked rather than flickering to nothing.
    const io = new IntersectionObserver(
      entries => {
        const hit = entries.find(e => e.isIntersecting);
        if (hit) setHere(hit.target.id);
      },
      { rootMargin: "-22% 0px -72% 0px", threshold: 0 },
    );

    targets.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, [chapters]);

  return (
    <nav className="m-contents" aria-label="Contents">
      {chapters.map((c, i) => (
        <a
          key={c.id}
          href={`#${c.id}`}
          className={here === c.id ? "is-here" : undefined}
          // Communicates the same state the colour does, for anyone who cannot
          // see it. `location` is the correct token for "the section of the
          // page currently being viewed".
          aria-current={here === c.id ? "location" : undefined}
        >
          <b>{String(i + 1).padStart(2, "0")}</b>
          <span>{c.label}</span>
        </a>
      ))}
    </nav>
  );
}
