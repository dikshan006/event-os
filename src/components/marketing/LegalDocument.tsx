import Link from "next/link";
import { LEGAL_REVIEW_NOTICE } from "@/lib/legal";

/**
 * The shell both legal documents are set in.
 *
 * Shared so the two cannot drift apart in presentation, and so the review
 * notice is impossible to publish a document without — it is part of the
 * wrapper rather than something each page remembers to include.
 *
 * A plain prose column rather than the marketing site's layered plates. These
 * are documents; someone reading one is reading it, not being sold to, and the
 * only jobs the page has are legibility and a stated version.
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
    <div className="m-plate" data-hero-tone="light">
      <section>
        <div
          className="m-wrap m-chapter"
          style={{ paddingTop: "calc(var(--m-nav-h, 4.25rem) + var(--m-chapter))" }}
        >
          <div style={{ maxWidth: "44rem", margin: "0 auto" }}>
            <span className="m-eyebrow">Legal</span>
            <h1 className="m-display" style={{ marginBottom: ".4em" }}>{title}</h1>

            <p className="meta" style={{ marginBottom: "1.6rem" }}>
              Version {version} · Effective {effective}
            </p>

            {/*
              Stated on the document itself rather than in a README. These were
              written from what the software actually does, which makes them
              truthful; it does not make them sufficient, and the person relying
              on them is the one who needs to know that.
            */}
            <div className="note" style={{ marginBottom: "2.2rem" }}>
              <b>{LEGAL_REVIEW_NOTICE}</b>
            </div>

            <div className="legal-prose">{children}</div>

            <p className="meta" style={{ marginTop: "3rem" }}>
              Questions about this document? Write to us from the Help Center inside
              your EventOS account, or reply to any email we have sent you.
            </p>

            <p style={{ marginTop: "2rem" }}>
              <Link href="/terms">Terms of Service</Link>
              {" · "}
              <Link href="/privacy">Privacy Policy</Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
