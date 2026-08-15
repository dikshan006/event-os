/**
 * The current legal document versions, and the metadata that goes with them.
 *
 * In code, not in the database and not in an environment variable. Three
 * reasons, in order of how much they matter:
 *
 *   The version and the text have to change together. A constant sitting beside
 *   the page that renders the document means one commit moves both, and code
 *   review sees the wording and the bump in the same diff. A row in a table or
 *   a value in a dashboard can drift from the text it claims to describe, and
 *   nothing would notice.
 *
 *   These are published documents. There is nothing secret about a privacy
 *   policy — it is meant to be read by anyone — so an environment variable is
 *   the wrong container entirely.
 *
 *   Bumping either constant re-gates every planner automatically, because the
 *   check is equality against the current version. That is the whole of the
 *   re-acceptance mechanism; there is no second switch to remember.
 *
 * Dates as versions rather than v1/v2: the question anyone asks about a legal
 * document is *when* it changed, and a date answers it without a lookup table.
 *
 * ── changing a document ──────────────────────────────────────────────────────
 * A material change means a new version. Bump the constant here, update the
 * page, and every planner is asked again on their next request. A typo fix is
 * not a material change and should not be — re-consent has a cost in trust, and
 * asking for it over a corrected comma teaches people to click through without
 * reading.
 */

export const TERMS_VERSION = "2026-08-14";
export const PRIVACY_VERSION = "2026-08-14";

/** Shown on both documents and on the acceptance screen. */
export const LEGAL_DOCUMENTS = {
  TERMS: {
    version: TERMS_VERSION,
    title: "Terms of Service",
    href: "/terms",
    effective: "14 August 2026",
  },
  PRIVACY: {
    version: PRIVACY_VERSION,
    title: "Privacy Policy",
    href: "/privacy",
    effective: "14 August 2026",
  },
} as const;

/**
 * The banner both documents carry.
 *
 * These were drafted from what the software actually does — the data it holds,
 * the sub-processors it sends data to, what deletion removes. That makes them a
 * truthful description of the product. It does not make them legally
 * sufficient, and nobody involved in writing them is a lawyer. Saying so on the
 * document itself is more honest than a note in a README nobody reads.
 */
export const LEGAL_REVIEW_NOTICE =
  "Draft — pending review by a qualified attorney. This document describes how " +
  "EventOS actually works today and is published in good faith, but it has not " +
  "been reviewed by a lawyer and should not be relied on as legal advice.";
