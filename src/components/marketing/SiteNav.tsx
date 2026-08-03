"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The public site's only persistent chrome.
 *
 * Transparent over the hero so the first screen is uninterrupted, then a solid
 * bar with a hairline once the page moves. Solid rather than blurred:
 * `backdrop-filter` on a fixed element is a per-frame GPU cost on every scroll
 * — measurably so on mid-range phones — and heavy glass was explicitly out.
 *
 * The right-hand side is session-aware. A signed-in visitor is never shown
 * "Sign in"; they get a direct route to their own dashboard instead. The
 * session is resolved on the server and passed down as a plain string, so this
 * component stays a leaf with no data dependency of its own.
 */
export function SiteNav({
  signedIn,
  dashboardHref,
}: {
  signedIn: boolean;
  /** Already resolved by role on the server: /admin or /studio. */
  dashboardHref: string;
}) {
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  const [tone, setTone] = useState<"light" | "dark" | "warm">("light");

  // The bar is transparent over the hero, so it has to take the hero's tone or
  // it disappears into it. Rather than teach the nav which routes are dark —
  // which breaks the moment a page is restyled — each hero declares its own
  // tone and the nav reads it. One DOM query per navigation, no route coupling.
  useEffect(() => {
    const hero = document.querySelector<HTMLElement>("[data-hero-tone]");
    const t = hero?.dataset.heroTone;
    setTone(t === "dark" || t === "warm" ? t : "light");
  }, [pathname]);

  useEffect(() => {
    // A passive listener reading one property, throttled to a frame. No layout
    // is read here, so it cannot cause a synchronous reflow while scrolling.
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setStuck(window.scrollY > 24);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const on = (href: string) => (pathname === href ? "page" : undefined);

  return (
    <header className={`m-nav${stuck ? " is-stuck" : ""}${tone === "dark" ? " m-nav-dark" : tone === "warm" ? " m-nav-warm" : ""}`}>
      <nav className="m-nav-inner" aria-label="Primary">
        <Link href="/" className="m-mark" aria-label="EventOS — home">
          Event<span>OS</span>
        </Link>

        <div className="m-nav-links">
          <Link href="/weddings" aria-current={on("/weddings")}>
            Weddings
          </Link>

          {signedIn ? (
            <Link href={dashboardHref} className="m-btn m-btn-solid">
              Dashboard <span className="m-arrow" aria-hidden="true">→</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="m-nav-hide" aria-current={on("/login")}>
                Sign in
              </Link>
              <Link href="/request-access" className="m-btn m-btn-solid">
                Request access
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
