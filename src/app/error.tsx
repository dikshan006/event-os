"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * The last line of defence for anything that throws while rendering.
 *
 * Without this file, an unhandled error replaces the entire page with Next's
 * default screen — a stark, unstyled apology that looks like the site has
 * fallen over. Several services throw on paths that are *designed* to be hit:
 * the fourth invitation resend inside an hour, the support-ticket limit, a
 * publish attempted while billing is unconfigured. Those are ordinary answers
 * to reasonable actions, and they should read like one.
 *
 * ── what is safe to show ─────────────────────────────────────────────────
 *
 * Nothing from the error object, and that is not caution — it is the only
 * option. A React error boundary is a client component, and in production Next
 * deliberately replaces the message of any server-side error with a generic
 * string before it crosses to the browser, leaving only `digest`: a hash that
 * correlates with the real message in the server logs. So `error.message` here
 * is either already sanitised by the framework or was thrown client-side; in
 * neither case is it something to render as an explanation.
 *
 * The consequence is that a `UserError`'s helpful wording cannot reach this
 * component either. That is why every server action that raises one catches it
 * at the call site and turns it into its own banner — see the publish action in
 * `studio/weddings/page.tsx`. This file is what catches everything nobody
 * predicted, and for those the honest thing to say is that something broke and
 * we have a record of it.
 *
 * `digest` is shown deliberately: it is the one string that lets somebody read
 * the actual error out of the logs, and it carries no information by itself.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console, for whoever is looking at a broken tab. The server
    // has already logged the real thing with its stack.
    console.error("Unhandled error", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="card empty" style={{ maxWidth: 560, margin: "12vh auto", padding: 32 }}>
      <h1 className="sec-t" style={{ marginBottom: 10 }}>Something went wrong</h1>

      <p style={{ marginBottom: 14 }}>
        This one is on us, not on you. The problem has been recorded and nothing
        you were working on has been lost.
      </p>

      <p className="meta" style={{ marginBottom: 22 }}>
        Trying again often works — it is frequently a momentary hiccup rather
        than a lasting fault.
      </p>

      <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
        <button className="btn btn-primary" type="button" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-outline" href="/dashboard">
          Back to my dashboard
        </Link>
      </div>

      {error.digest && (
        <p className="meta" style={{ marginTop: 22 }}>
          If you contact support, quote this reference: <code>{error.digest}</code>
        </p>
      )}
    </main>
  );
}
