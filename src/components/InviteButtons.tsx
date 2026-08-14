"use client";

import { useActionState, useEffect, useState } from "react";
import type { InviteOutcome } from "@/server/services/invite-actions";

/**
 * The invitation buttons.
 *
 * Same shape as the wishlist claim button: a server action passed in, driven by
 * `useActionState`, with the pending flag doing the work. Nothing new invented.
 *
 * `pending` is what makes the double-click protection real rather than
 * cosmetic. Sending an invitation takes a second or two — long enough that a
 * planner who sees no response presses again, and on the individual button that
 * second press spends one of the three hourly re-sends for that guest on a
 * message nobody asked for. Disabling while in flight is the fix; the server
 * limits stay exactly as they are and remain the thing that actually bounds it.
 */

type Action = (prev: InviteOutcome | null, formData: FormData) => Promise<InviteOutcome>;

/**
 * Success fades, failure does not.
 *
 * "Sent ✓" is an acknowledgement — once it has been read it is noise, and on a
 * list of eighty guests a column of stale ticks is worse than no feedback. A
 * failure is unfinished business and stays until the next attempt replaces it.
 */
function useTransientSuccess(outcome: InviteOutcome | null, ms = 4000) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!outcome?.ok) return;
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [outcome, ms]);
  return visible;
}

export function InviteOneButton({
  action,
  guestId,
  weddingId,
  alreadySent,
}: {
  action: Action;
  guestId: string;
  weddingId: string;
  alreadySent: boolean;
}) {
  const [outcome, formAction, pending] = useActionState<InviteOutcome | null, FormData>(action, null);
  const showResult = useTransientSuccess(outcome);

  const label = pending
    ? "Sending…"
    : outcome?.ok && showResult
      ? "Sent ✓"
      : alreadySent
        ? "Resend"
        : "Send";

  return (
    <form action={formAction} style={{ display: "grid", gap: 4, justifyItems: "end" }}>
      <input type="hidden" name="guestId" value={guestId} />
      <input type="hidden" name="weddingId" value={weddingId} />
      <button
        className={`btn btn-sm ${outcome?.ok && showResult ? "btn-primary" : "btn-outline"}`}
        type="submit"
        disabled={pending}
        aria-busy={pending}
      >
        {label}
      </button>

      {/*
        `role="status"` rather than a plain span: the button's own label changes
        too, and a planner using a screen reader would otherwise hear only
        "Send" again with no indication of what happened.
      */}
      {outcome && !outcome.ok && showResult && (
        <span role="status" className="meta" style={{ maxWidth: 220, textAlign: "right" }}>
          {outcome.message}
        </span>
      )}
    </form>
  );
}

export function SendAllButton({ action, weddingId }: { action: Action; weddingId: string }) {
  const [outcome, formAction, pending] = useActionState<InviteOutcome | null, FormData>(action, null);
  const showResult = useTransientSuccess(outcome, 8000);

  return (
    <form action={formAction} style={{ display: "grid", gap: 6, justifyItems: "start" }}>
      <input type="hidden" name="weddingId" value={weddingId} />
      <button className="btn btn-primary" type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send invitations"}
      </button>

      {outcome && showResult && (
        <span
          role="status"
          className="meta"
          style={{ color: outcome.ok ? undefined : "var(--wine, inherit)" }}
        >
          {outcome.message}
        </span>
      )}
    </form>
  );
}
