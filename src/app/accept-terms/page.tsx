import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireStudioSession } from "@/server/services/context";
import { acceptCurrentLegal, hasAcceptedCurrentLegal, outstandingLegal } from "@/server/services/legal";
import { AcceptLegalForm, type AcceptState } from "@/components/AcceptLegalForm";
import { LEGAL_DOCUMENTS, TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms and Privacy — EventOS",
  robots: { index: false, follow: false },
};

/**
 * The gate.
 *
 * The only planner page that calls `requireStudioSession()` rather than
 * `requireStudio()`, because `requireStudio()` redirects here when the
 * agreement is missing — and a page that gated itself the same way it gates
 * everything else would be an infinite redirect.
 *
 * There is no sidebar and no navigation. Not for effect: this page exists
 * because the planner has no access yet, and offering them links into an
 * application they cannot enter would produce a row of dead ends. The only ways
 * out are agreeing, reading a document, or signing out.
 */
export default async function AcceptTermsPage() {
  const { user } = await requireStudioSession();

  // Already agreed — usually a back-button or a stale tab. Send them on rather
  // than asking twice for something already recorded.
  if (await hasAcceptedCurrentLegal(user.id)) redirect("/studio");

  const outstanding = await outstandingLegal(user.id);
  const returning = !outstanding.terms || !outstanding.privacy;

  async function accept(_prev: AcceptState, formData: FormData): Promise<AcceptState> {
    "use server";

    /**
     * The session is re-derived here rather than taken from the render above.
     * A Server Action is a separate request, and the identity it records
     * consent for has to come from that request's own session — not from a
     * closure that was created when some page was rendered.
     */
    const { user } = await requireStudioSession();

    /**
     * The refusal that matters.
     *
     * The checkbox and the disabled button are UI. This is the check that
     * decides: without an affirmative `accept=yes` in the submitted form, no
     * row is written and nothing changes. A crafted POST that omits it is
     * treated exactly like a planner who did not tick the box.
     */
    if (formData.get("accept") !== "yes") {
      return { error: "Please tick the box to confirm you agree before continuing." };
    }

    await acceptCurrentLegal(user.id, user.name);
    redirect("/studio");
  }

  return (
    <main className="card pad" style={{ maxWidth: 620, margin: "8vh auto" }}>
      <span className="meta" style={{ textTransform: "uppercase", letterSpacing: ".08em" }}>
        EventOS
      </span>

      <h1 className="sec-t" style={{ margin: ".4em 0 .3em" }}>
        {returning ? "We've updated our terms" : "Before you get started"}
      </h1>

      <p style={{ marginBottom: 14 }}>
        {returning
          ? "We have published a new version of the documents below. Please read the " +
            "changes and confirm you agree before continuing to your dashboard."
          : "Please read our Terms of Service and Privacy Policy, then confirm you " +
            "agree. This is a one-time step for your account."}
      </p>

      <ul className="meta" style={{ marginBottom: 22, lineHeight: 1.9 }}>
        <li>
          <Link href={LEGAL_DOCUMENTS.TERMS.href} target="_blank" rel="noopener">
            Read the Terms of Service
          </Link>{" "}
          — version {TERMS_VERSION}
          {!outstanding.terms && " (already accepted)"}
        </li>
        <li>
          <Link href={LEGAL_DOCUMENTS.PRIVACY.href} target="_blank" rel="noopener">
            Read the Privacy Policy
          </Link>{" "}
          — version {PRIVACY_VERSION}
          {!outstanding.privacy && " (already accepted)"}
        </li>
      </ul>

      <AcceptLegalForm
        action={accept}
        termsVersion={TERMS_VERSION}
        privacyVersion={PRIVACY_VERSION}
      />

      <p className="meta" style={{ marginTop: 24 }}>
        You cannot use your EventOS account until you accept. If you would rather not,{" "}
        <Link href="/api/auth/signout">sign out</Link> — nothing is deleted and you can
        come back at any time.
      </p>
    </main>
  );
}
