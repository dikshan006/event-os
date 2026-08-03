"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const KEY = "eventos:depth";

/**
 * One Back control for the whole dashboard.
 *
 * The browser's own back button is not enough: a planner opening a wedding
 * from a link, a bookmark, or a fresh tab has no history to go back to, and a
 * dead button is worse than none. So this tracks how deep the user is *within
 * EventOS* and chooses accordingly.
 *
 *  - Navigated here from another EventOS page → `router.back()`, which walks
 *    the real history stack, so pressing Back repeatedly retraces the exact
 *    route taken: Edit Table → Table → Seating → Wedding → Weddings.
 *  - Arrived directly → `router.push(fallback)`, the logical parent, so the
 *    control always does something sensible.
 *
 * Depth lives in sessionStorage rather than state because it has to survive
 * full page loads while staying scoped to this tab.
 */
export function BackLink({
  fallback,
  label = "Back",
}: {
  /** Logical parent, used when there is no in-app history to return to. */
  fallback: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    let depth = 0;
    try {
      depth = Number(sessionStorage.getItem(KEY) ?? "0");
      const last = sessionStorage.getItem(`${KEY}:path`);
      // Only count a genuine move to a different page.
      if (last !== pathname) {
        depth = last === null ? 0 : depth + 1;
        sessionStorage.setItem(KEY, String(depth));
        sessionStorage.setItem(`${KEY}:path`, pathname);
      }
    } catch {
      // Private browsing with storage disabled: fall back to the parent link.
    }
    setCanGoBack(depth > 0);
  }, [pathname]);

  function go() {
    if (canGoBack) {
      try { sessionStorage.setItem(KEY, String(Math.max(0, Number(sessionStorage.getItem(KEY) ?? "1") - 1))); } catch {}
      router.back();
    } else {
      router.push(fallback);
    }
  }

  return (
    <button type="button" className="backlink" onClick={go}>
      <span className="backlink-arrow" aria-hidden="true">←</span>
      {label}
    </button>
  );
}
