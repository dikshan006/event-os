import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Not found — EventOS",
  robots: { index: false, follow: false },
};

/**
 * What `notFound()` renders.
 *
 * Reached two ways, and the wording has to serve both without distinguishing
 * them. Sometimes the address is genuinely wrong — a mistyped URL, a link from
 * an old email. Sometimes it is a deliberate refusal: `ownWedding`, the support
 * ticket lookup and the Help Center all answer a resource belonging to somebody
 * else with a 404 rather than a 403, so that the existence of another studio's
 * data never leaks through the difference between "forbidden" and "missing".
 *
 * So this page must not speculate. "You do not have access to this" would undo
 * the whole point of answering 404 in the first place, by confirming to a
 * stranger that the thing they guessed at is real.
 */
export default function NotFound() {
  return (
    <main className="card empty" style={{ maxWidth: 560, margin: "12vh auto", padding: 32 }}>
      <h1 className="sec-t" style={{ marginBottom: 10 }}>We couldn&rsquo;t find that page</h1>

      <p style={{ marginBottom: 14 }}>
        The link may be out of date, or the address may have a typo in it.
      </p>

      <p className="meta" style={{ marginBottom: 22 }}>
        If you followed a link from an email, it may point at something that has
        since been moved or removed.
      </p>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <Link className="btn btn-primary" href="/dashboard">
          Back to my dashboard
        </Link>
        <Link className="btn btn-outline" href="/">
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
