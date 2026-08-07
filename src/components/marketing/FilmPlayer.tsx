"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * A film card that expands into a centred player.
 *
 * The card keeps the exact markup of the placeholders beside it — same frame,
 * same play affordance, same number — so nothing about the page's layout or
 * typography changes. Only the behaviour is added.
 *
 * ── HOW THE EXPANSION WORKS ────────────────────────────────────────────────
 *
 * Not a fade. On open the card's bounding box is measured, the dialog is
 * positioned at its final centred size, and then transformed BACK onto the
 * card's rectangle for a single frame. Releasing that transform on the next
 * frame lets the dialog travel from the card to the centre of the screen.
 *
 * This is a FLIP, and it is the difference between "a lightbox appeared" and
 * "the thing I clicked became the player". Every scale and translate is on the
 * compositor, so it holds 60fps regardless of the page behind it.
 *
 * ── PLAYBACK POSITION ──────────────────────────────────────────────────────
 *
 * Held in a module-scoped variable rather than state, so it survives the
 * dialog unmounting and persists for as long as the tab is open — close at
 * 0:40, reopen, and the film is still at 0:40.
 */

/** Survives unmount. Reset only by a full page load. */
let rememberedTime = 0;
let hasPrefetched = false;

type Props = {
  /** "01" — matches the placeholder cards. */
  n: string;
  title: string;
  line: string;
  src: string;
  poster: string;
  /** Optional, for the `<track>`-less accessible name of the dialog. */
  label?: string;
};

export function FilmPlayer({ n, title, line, src, poster, label }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [playing, setPlaying] = useState(false);

  const cardRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const closingRef = useRef(false);

  useEffect(() => setMounted(true), []);

  /* ── warm the cache before it is needed ────────────────────────────────
     A 25MB file that starts downloading on click feels slow no matter how
     good the animation is. Hovering the card is a strong enough signal of
     intent to spend the bandwidth, and it costs nothing for anyone who
     scrolls past. */
  const prefetch = useCallback(() => {
    if (hasPrefetched) return;
    hasPrefetched = true;
    const link = document.createElement("link");
    link.rel = "prefetch";
    link.as = "video";
    link.href = src;
    document.head.appendChild(link);
  }, [src]);

  /* ── scroll lock ───────────────────────────────────────────────────────
     Padding compensates for the scrollbar's width so the page beneath does
     not shift sideways as it locks. */
  useEffect(() => {
    if (!open) return;
    const { body, documentElement } = document;
    const gap = window.innerWidth - documentElement.clientWidth;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [open]);

  /* ── the FLIP ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const card = cardRef.current;
    if (!dialog || !card) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setEntered(true);
      return;
    }

    const from = card.getBoundingClientRect();
    const to = dialog.getBoundingClientRect();
    const scale = from.width / to.width;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    dialog.style.transition = "none";
    dialog.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    dialog.style.opacity = "0.6";

    const raf = requestAnimationFrame(() => {
      dialog.style.transition = "";
      dialog.style.transform = "";
      dialog.style.opacity = "";
      setEntered(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  /* ── restore position, and remember it ──────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const video = videoRef.current;
    if (!video) return;
    if (rememberedTime > 0) video.currentTime = rememberedTime;
    const remember = () => {
      rememberedTime = video.currentTime;
    };
    video.addEventListener("timeupdate", remember);
    return () => {
      remember();
      video.removeEventListener("timeupdate", remember);
    };
  }, [open]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;

    const video = videoRef.current;
    if (video) {
      rememberedTime = video.currentTime;
      video.pause();
    }

    const dialog = dialogRef.current;
    const card = cardRef.current;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const finish = () => {
      setOpen(false);
      setEntered(false);
      setPlaying(false);
      closingRef.current = false;
      cardRef.current?.focus({ preventScroll: true });
    };

    if (!dialog || !card || reduced) return finish();

    // Travel back to the card it came from.
    const to = card.getBoundingClientRect();
    const from = dialog.getBoundingClientRect();
    const scale = to.width / from.width;
    const dx = to.left + to.width / 2 - (from.left + from.width / 2);
    const dy = to.top + to.height / 2 - (from.top + from.height / 2);

    dialog.style.transform = `translate(${dx}px, ${dy}px) scale(${scale})`;
    dialog.style.opacity = "0";
    setEntered(false);
    window.setTimeout(finish, 320);
  }, []);

  /* ── escape ─────────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  const openPlayer = () => {
    prefetch();
    setOpen(true);
    // Autoplay on open: the click was the intent, so asking for a second one
    // would be a tax. Muted is not required because the gesture is genuine.
    window.setTimeout(() => {
      videoRef.current?.play().then(
        () => setPlaying(true),
        () => setPlaying(false),
      );
    }, 60);
  };

  /* Controls are present on hover, and whenever the film is not playing —
     removing them mid-playback would leave no way to pause. */
  const showControls = hovering || !playing;

  return (
    <>
      <button
        ref={cardRef}
        type="button"
        className="m-film-open"
        onClick={openPlayer}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        aria-label={`Play the film: ${title}`}
      >
        <span className="m-film-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={poster} alt="" loading="lazy" decoding="async" />
          <span className="m-play" aria-hidden="true" />
          <span className="m-film-n" aria-hidden="true">
            {n}
          </span>
        </span>
      </button>
      <h3>{title}</h3>
      <p>{line}</p>

      {mounted && open
        ? createPortal(
            <div
              className={`m-lightbox${entered ? " is-in" : ""}`}
              onMouseDown={(e) => {
                // Only a press that both starts and ends on the backdrop closes,
                // so dragging the scrubber out of the dialog does not dismiss it.
                if (e.target === e.currentTarget) close();
              }}
            >
              <div
                ref={dialogRef}
                className="m-lightbox-dialog"
                role="dialog"
                aria-modal="true"
                aria-label={label ?? title}
                onMouseEnter={() => setHovering(true)}
                onMouseLeave={() => setHovering(false)}
              >
                <video
                  ref={videoRef}
                  className="m-lightbox-video"
                  src={src}
                  poster={poster}
                  controls={showControls}
                  controlsList="nodownload"
                  playsInline
                  preload="auto"
                  onPlaying={() => {
                    setPlaying(true);
                    setLoading(false);
                  }}
                  onPause={() => setPlaying(false)}
                  onWaiting={() => setLoading(true)}
                  onCanPlay={() => setLoading(false)}
                  onEnded={() => {
                    rememberedTime = 0;
                    setPlaying(false);
                  }}
                />

                <div className={`m-lightbox-loading${loading ? " is-on" : ""}`} aria-hidden="true">
                  <span />
                </div>

                <button
                  type="button"
                  className="m-lightbox-close"
                  onClick={close}
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
