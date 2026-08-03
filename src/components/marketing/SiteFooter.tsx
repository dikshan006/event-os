import Link from "next/link";

/**
 * Quiet by design. A footer's job on a site like this is to end the document,
 * not to present a second navigation — so it carries only the routes that
 * exist and one line of fine print.
 *
 * No newsletter capture, no social row, no "made with" badge: every one of
 * those would be a claim the product cannot currently back, and the site's
 * credibility rests on not overstating anything.
 */
export function SiteFooter() {
  return (
    <footer className="m-ink">
      <div className="m-wrap m-foot">
        <div className="m-foot-top">
          <div style={{ display: "grid", gap: "0.75rem", alignContent: "start" }}>
            <Link href="/" className="m-mark">
              Event<span>OS</span>
            </Link>
            <p className="m-small" style={{ maxWidth: "26ch" }}>
              The operating system for professional wedding planners.
            </p>
          </div>

          <div className="m-foot-cols">
            <div className="m-foot-col">
              <span className="m-eyebrow">Product</span>
              <Link href="/weddings">Weddings</Link>
              <Link href="/#invitation">Guest invitations</Link>
              <Link href="/#studio">Your studio</Link>
            </div>
            <div className="m-foot-col">
              <span className="m-eyebrow">Access</span>
              <Link href="/request-access">Request access</Link>
              <Link href="/login">Sign in</Link>
            </div>
          </div>
        </div>

        <div className="m-foot-bottom">
          <span>© {new Date().getFullYear()} EventOS</span>
          <span>Built for planners who are trusted with one day.</span>
        </div>
      </div>
    </footer>
  );
}
