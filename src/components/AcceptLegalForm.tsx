"use client";

import Link from "next/link";
import { useActionState } from "react";

export type AcceptState = { error: string } | null;

/**
 * The consent control.
 *
 * The checkbox starts unchecked and has no `defaultChecked`, because consent
 * that arrives pre-ticked is not consent — the person has to do something
 * affirmative, and a box already ticked when the page loads records only that
 * they failed to untick it.
 *
 * The submit button is disabled until it is ticked, which is courtesy rather
 * than enforcement: the real refusal is on the server, which ignores this form
 * entirely if the box did not come back ticked. A disabled button is a hint,
 * and hints are editable by anyone with developer tools open.
 */
export function AcceptLegalForm({
  action,
  termsVersion,
  privacyVersion,
}: {
  action: (prev: AcceptState, formData: FormData) => Promise<AcceptState>;
  termsVersion: string;
  privacyVersion: string;
}) {
  const [state, formAction, pending] = useActionState<AcceptState, FormData>(action, null);

  return (
    <form action={formAction} style={{ display: "grid", gap: 20 }}>
      <label className="check" style={{ alignItems: "flex-start", gap: 10 }}>
        <input type="checkbox" name="accept" value="yes" style={{ marginTop: 4 }} />
        <span>
          I have read and agree to the{" "}
          <Link href="/terms" target="_blank" rel="noopener">
            Terms of Service
          </Link>{" "}
          (version {termsVersion}) and the{" "}
          <Link href="/privacy" target="_blank" rel="noopener">
            Privacy Policy
          </Link>{" "}
          (version {privacyVersion}).
        </span>
      </label>

      {state?.error && (
        <p role="alert" className="note" style={{ margin: 0 }}>
          {state.error}
        </p>
      )}

      <div>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Agree and continue"}
        </button>
      </div>
    </form>
  );
}
