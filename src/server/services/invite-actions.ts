import "server-only";
import { sendInvitations, resendInvitation } from "./guests";
import { reportError } from "@/lib/errors";

/**
 * Sending invitations, expressed as an outcome instead of an exception.
 *
 * The bug this exists to fix: the guests page called `resendInvitation`
 * directly from a server action with nothing around it. That function throws a
 * `UserError` when the per-guest hourly limit is reached — an ordinary answer
 * to an ordinary action — and an uncaught throw in a server action replaces the
 * whole page with the error boundary. A planner nudging a guest for the fourth
 * time in an hour got "Something went wrong. This one is on us", which is both
 * alarming and false: nothing went wrong, and it was not on us.
 *
 * It also ignored the return value. `resendInvitation` answers `false` when the
 * provider refused the address, so a bounced send looked identical to a
 * delivered one.
 *
 * Nothing about the rules changes here. The rate limit, the tenant scoping and
 * the authorization all live in `guests.ts` exactly as they did; this only
 * decides what the interface is told afterwards. Everything a planner is shown
 * is either a `UserError` message — written for them in the first place — or a
 * fixed sentence with a reference id. Provider text, stack traces and internal
 * state never cross this boundary.
 */

export type InviteOutcome = {
  ok: boolean;
  message: string;
  /** Drives the transient "Sent ✓" state; absent on failure. */
  sent?: number;
  failed?: number;
};

const RESEND_FAILED = "We couldn't resend the invitation. Please try again.";
const SEND_ALL_FAILED = "We couldn't send the invitations. Please try again.";

/**
 * `studioId` and `actorName` come from the caller's own session check, never
 * from the form. The guest id does come from the form, and is safe to: the
 * lookup inside `resendInvitation` is `{ id, studioId }`, so an id belonging to
 * another studio resolves to nothing and is refused.
 */
export async function resendInvitationOutcome(
  studioId: string,
  guestId: string,
  actorName: string,
): Promise<InviteOutcome> {
  try {
    const delivered = await resendInvitation(studioId, guestId, actorName);
    return delivered
      ? { ok: true, message: "Sent", sent: 1, failed: 0 }
      : { ok: false, message: RESEND_FAILED, sent: 0, failed: 1 };
  } catch (err) {
    /**
     * `reportError` already draws the distinction this needs, so drawing it
     * again here would be a second copy to keep in step. A `UserError` is
     * logged at warn and its own wording is returned — the rate limit says how
     * long to wait, which beats a generic apology. Anything else is logged with
     * its stack and reduced to one sentence plus a reference id.
     *
     * Both are logged. A planner saying "it won't let me resend" is a support
     * conversation, and it should be answerable from the logs whether the cause
     * was a limit or a fault.
     */
    return { ok: false, message: reportError("guest-resend", err, RESEND_FAILED) };
  }
}

/**
 * The bulk send.
 *
 * Partial success is preserved by `sendInvitations` itself rather than by
 * anything here: it marks `invitedAt` only for guests the provider accepted, so
 * a failed one stays un-invited and the *same button* retries exactly those on
 * the next press. That is why the failure message says to press Send again
 * rather than offering a separate retry — there is nothing else to build, and a
 * second control would be a second way to get the batch wrong.
 *
 * A single failing address cannot take down the run: `sendInvitations` loops
 * per guest and records failures as counts.
 */
export async function sendInvitationsOutcome(
  studioId: string,
  weddingId: string,
  actorName: string,
): Promise<InviteOutcome> {
  try {
    const { sent, failed } = await sendInvitations(studioId, weddingId, actorName);

    if (sent === 0 && failed === 0) {
      return { ok: true, message: "Everyone with an email has already been invited", sent, failed };
    }
    if (failed === 0) {
      return { ok: true, message: `${sent} invitation${sent === 1 ? "" : "s"} sent`, sent, failed };
    }
    return {
      ok: false,
      message: `${sent} sent, ${failed} failed. Press Send invitations again to retry the failed ones.`,
      sent,
      failed,
    };
  } catch (err) {
    // Same reasoning as the single resend above.
    return { ok: false, message: reportError("guest-send-all", err, SEND_ALL_FAILED) };
  }
}
