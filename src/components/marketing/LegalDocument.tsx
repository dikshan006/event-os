import Link from "next/link";
import { LEGAL_REVIEW_NOTICE } from "@/lib/legal";

/**
 * The shell both legal documents are set in.
 *
 * Shared so the two cannot drift apart, and so the review notice is impossible
 * to publish a document without — it belongs to the wrapper rather than to each
 * page remembering to include it.
 *
 * This deliberately does **not** use the marketing site's `.m-plate` layout.
 * That component paints `--ink` because it exists to sit behind a photograph,
 * and setting a long legal document on it produced near-black text on a
 * near-black panel. The rest of the site is an argument, with layered plates
 * and text that arrives as you scroll; a legal document is not. Somebody is
 * here to read one specific clause, usually because they are about to agree to
 * it. So the page is white, the measure is narrow, and nothing moves.
 *
 * Styles live in `src/app/(marketing)/marketing.css` under `.legal`.
 */
export function LegalDocument({
  title,
  version,
  effective,
  children,
}: {
  title: string;
  version: string;
  effective: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal">
      <article className="legal-wrap">
        <p className="legal-brand">EventOS</p>

        <p className="legal-kicker">Legal</p>
        <h1>{title}</h1>

        {/* Findable when someone goes looking for it, quiet until then. */}
        <p className="legal-meta">
          Version {version} · Effective {effective}
        </p>

        {/*
          Stated on the document rather than in a README. These were written
          from what the software actually does, which makes them truthful; it
          does not make them sufficient, and the person relying on them is the
          one who needs to know that.
        */}
        <div className="legal-notice">{LEGAL_REVIEW_NOTICE}</div>

        <div className="legal-prose">{children}</div>

        <footer className="legal-footer">
          <p>
            Questions about this document? Write to us from the Help Center inside
            your EventOS account, or reply to any email we have sent you.
          </p>
          <p>
            <Link href="/terms">Terms of Service</Link>
            {" · "}
            <Link href="/privacy">Privacy Policy</Link>
          </p>
        </footer>
      </article>
    </div>
  );
}
