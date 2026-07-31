"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SitePhoto } from "./SitePhoto";
import type { PhotoView } from "@/lib/photo-view";

/**
 * The gallery as a separate experience, not another section of the invitation.
 *
 * The homepage shows a single quiet link; the photographs live behind it. That
 * keeps the invitation typography-first and means a guest only meets the images
 * if they choose to.
 *
 * Presentation is a scrolling editorial column rather than a thumbnail grid
 * with next/previous controls: at full width each photograph gets its own
 * space, scrolling is the only interaction to learn, and it behaves identically
 * on a phone and a desktop. A grid of small crops would be the photo-album
 * feeling we are deliberately avoiding.
 *
 * Built on <dialog> so focus trapping, Escape-to-close and the top layer come
 * from the platform. Because the panel scrolls inside the page, it carries
 * `data-lenis-prevent` — Lenis' documented way to hand a nested scroll
 * container back to the browser instead of smoothing it.
 */
export function Gallery({ photos, label = "View gallery" }: { photos: PhotoView[]; label?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    ref.current?.close();
  }, []);

  // Keep React state in step with the platform's own close paths (Escape, the
  // backdrop) so the images can be unmounted when the dialog is not showing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onClose = () => setOpen(false);
    el.addEventListener("close", onClose);
    return () => el.removeEventListener("close", onClose);
  }, []);

  if (!photos.length) return null;

  return (
    <>
      <button type="button" className="s-gallery-link" onClick={() => { ref.current?.showModal(); setOpen(true); }}>
        {label}
        <span className="s-gallery-count">{photos.length}</span>
      </button>

      <dialog ref={ref} className="gal" aria-label="Photo gallery"
        onClick={e => { if (e.target === ref.current) close(); }}>
        <div className="gal-bar">
          <p className="gal-title">Gallery</p>
          <button type="button" className="gal-close" onClick={close} aria-label="Close gallery">Close</button>
        </div>

        {/* Nested scroller: Lenis leaves this to the browser. */}
        <div className="gal-scroll" data-lenis-prevent>
          {/* Mounted only while open, so none of these images are fetched
              until a guest asks for them. */}
          {open && photos.map(p => (
            <figure className="gal-item" key={p.id}>
              <SitePhoto photo={p} tone={false} rounded={false}
                sizes="(max-width: 900px) 92vw, 860px" />
              {p.caption && <figcaption>{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      </dialog>
    </>
  );
}
