import Link from "next/link";

/**
 * The one bar that sits above a preview.
 *
 * Shared by the template preview and the draft preview so the two feel like
 * one feature rather than two screens that happen to look similar.
 *
 * Three zones and nothing else: a way back on the left, what you are looking at
 * in the middle, and how you are looking at it on the right. The previous
 * version had the back link, the template name, a mode toggle and a status note
 * all competing in a single row, which read as a toolbar — the impression a
 * preview of something beautiful can least afford.
 *
 * No JavaScript. The mode toggle is two links and the guest menu is a native
 * `<details>`, so the bar works before hydration and on a failed bundle.
 */

type Mode = "photos" | "none";

export function PreviewBar({
  back,
  title,
  badge,
  modes,
  children,
}: {
  back: { href: string; label: string };
  title: string;
  /** Planner-only marker, e.g. Draft. Never rendered on a guest's page. */
  badge?: string;
  /** Omit on previews of real weddings, where there is nothing to toggle. */
  modes?: { on: Mode; photos: string; none: string };
  /** An extra control for the right-hand zone — the guest menu, in practice. */
  children?: React.ReactNode;
}) {
  return (
    <header className="pv-bar">
      <Link className="pv-back" href={back.href}>
        <svg viewBox="0 0 16 16" aria-hidden="true" width="14" height="14">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {back.label}
      </Link>

      <div className="pv-id">
        <span className="pv-title">{title}</span>
        {badge && <span className="pv-badge">{badge}</span>}
      </div>

      <div className="pv-tools">
        {children}
        {modes && (
          <div className="pv-seg" role="group" aria-label="Preview mode">
            <span className="pv-seg-label" aria-hidden="true">Preview</span>
            <PreviewMode href={modes.none} on={modes.on === "none"}>No photos</PreviewMode>
            <PreviewMode href={modes.photos} on={modes.on === "photos"}>Demo photos</PreviewMode>
          </div>
        )}
      </div>
    </header>
  );
}

/** One option. The dot is drawn rather than a character, so it cannot be
 *  affected by whichever font happens to load. */
function PreviewMode({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link className={`pv-opt${on ? " is-on" : ""}`} href={href} aria-current={on ? "true" : undefined}>
      <span className="pv-dot" aria-hidden="true" />
      {children}
    </Link>
  );
}
