"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { HELP_ARTICLES, categoryBySlug, searchHelp } from "@/lib/help";

/**
 * Search across the help centre.
 *
 * Client-side over the whole list, which is the right shape at fifteen
 * articles: the entire index is a couple of kilobytes, so shipping it and
 * filtering in the browser gives results as fast as typing, with no request per
 * keystroke and nothing to debounce. If this ever grows past a few dozen
 * articles it should move to the server — but building that now would be
 * slower, for the user, than not building it.
 *
 * `/` focuses the box from anywhere on the page, the way every documentation
 * site a planner has used already behaves. Escape clears and blurs.
 */
export function HelpSearch() {
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchHelp(q), [q]);
  const open = q.trim().length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
      if (e.key === "Escape" && typing) {
        setQ("");
        input.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="help-search">
      <div className="help-search-box">
        <span className="help-search-icon" aria-hidden="true">⌕</span>
        <input
          ref={input}
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search help — try “seating”, “groups”, “publish”"
          aria-label="Search the help centre"
          autoComplete="off"
        />
        {!open && <kbd aria-hidden="true">/</kbd>}
      </div>

      {open && (
        <div className="help-results" role="region" aria-live="polite">
          {results.length === 0 ? (
            <p className="help-noresult">
              Nothing matches “{q.trim()}”. Try a simpler word — “guests”,
              “photos”, “RSVP” — or browse the list below.
            </p>
          ) : (
            <>
              <p className="help-resultcount">
                {results.length} of {HELP_ARTICLES.length} articles
              </p>
              <ul>
                {results.map(a => (
                  <li key={a.slug}>
                    <Link href={`/studio/help/${a.slug}`}>
                      <b>{a.title}</b>
                      <em>{categoryBySlug(a.category)?.title}</em>
                      <span>{a.blurb}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
