import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sending invitations, and the crash this replaced.
 *
 * A planner pressed Resend and the whole page became "Something went wrong —
 * this one is on us". Nothing had gone wrong: `resendInvitation` throws a
 * `UserError` when a guest has already had three invitations in an hour, the
 * server action did not catch it, and an uncaught throw in a server action is
 * rendered by the error boundary.
 *
 * These tests hold the boundary that fixes it — expected failures come back as
 * outcomes, unexpected ones are logged and reduced to one sentence — without
 * touching the rate limit, the tenant scoping or the authorization, all of
 * which still live in `guests.ts` and are covered by `tenancy.test.ts`.
 */

const resendInvitation = vi.fn<(s: string, g: string, a: string) => Promise<boolean>>();
const sendInvitations =
  vi.fn<(s: string, w: string, a: string) => Promise<{ sent: number; failed: number }>>();

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/guests", () => ({
  resendInvitation: (s: string, g: string, a: string) => resendInvitation(s, g, a),
  sendInvitations: (s: string, w: string, a: string) => sendInvitations(s, w, a),
}));

const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
const error = vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
  vi.clearAllMocks();
  resendInvitation.mockResolvedValue(true);
  sendInvitations.mockResolvedValue({ sent: 0, failed: 0 });
});

/* ═══════════════════════════════════════════════════ resend ═══ */

describe("resending one invitation", () => {
  it("reports success", async () => {
    const { resendInvitationOutcome } = await import("@/server/services/invite-actions");
    const out = await resendInvitationOutcome("studio-a", "guest-1", "Planner A");

    expect(out.ok).toBe(true);
    expect(out.message).toBe("Sent");
  });

  it("returns the rate limit as an outcome instead of throwing — this is the bug", async () => {
    const { UserError } = await import("@/lib/errors");
    resendInvitation.mockRejectedValue(
      new UserError("This guest has been sent several invitations in the last hour. Please wait before sending another."),
    );
    const { resendInvitationOutcome } = await import("@/server/services/invite-actions");

    const out = await resendInvitationOutcome("studio-a", "guest-1", "Planner A");

    // The whole point: no throw, so the page survives.
    expect(out.ok).toBe(false);
    // And the planner is told the actual, useful thing — a generic apology
    // would hide that waiting an hour fixes it.
    expect(out.message).toMatch(/in the last hour/);
  });

  it("reports a refused address as a failure rather than a success", async () => {
    // `resendInvitation` answers false when the provider rejects the address.
    // That return value used to be discarded, so a bounce looked delivered.
    resendInvitation.mockResolvedValue(false);
    const { resendInvitationOutcome } = await import("@/server/services/invite-actions");

    const out = await resendInvitationOutcome("studio-a", "guest-1", "Planner A");
    expect(out.ok).toBe(false);
    expect(out.message).toBe("We couldn't resend the invitation. Please try again.");
  });

  it("never leaks an unexpected error to the planner, but does log it", async () => {
    resendInvitation.mockRejectedValue(
      new Error("connect ECONNREFUSED 10.0.0.5:5432 password=hunter2"),
    );
    const { resendInvitationOutcome } = await import("@/server/services/invite-actions");

    const out = await resendInvitationOutcome("studio-a", "guest-1", "Planner A");

    expect(out.ok).toBe(false);
    expect(out.message).toMatch(/We couldn't resend the invitation/);
    // Nothing about the host, the port, the credential or the stack.
    expect(out.message).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|hunter2|password/);
    // But it must be recoverable from the server logs, or the reference id in
    // the message is a promise we cannot keep.
    expect(error).toHaveBeenCalled();
  });

  it("passes the caller's studio through and takes none from the guest id", async () => {
    const { resendInvitationOutcome } = await import("@/server/services/invite-actions");
    await resendInvitationOutcome("studio-a", "guest-1", "Planner A");

    // The signature is (studioId, guestId, actorName) — the tenant is the
    // caller's, established by requireStudio() before this is reached.
    expect(resendInvitation).toHaveBeenCalledWith("studio-a", "guest-1", "Planner A");
    expect(resendInvitationOutcome.length).toBe(3);
  });
});

/* ═════════════════════════════════════════════════ send all ═══ */

describe("sending all invitations", () => {
  it("counts a clean run", async () => {
    sendInvitations.mockResolvedValue({ sent: 12, failed: 0 });
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");

    const out = await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(out.ok).toBe(true);
    expect(out.message).toBe("12 invitations sent");
  });

  it("says one invitation, not 1 invitations", async () => {
    sendInvitations.mockResolvedValue({ sent: 1, failed: 0 });
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");
    expect((await sendInvitationsOutcome("studio-a", "w1", "Planner A")).message).toBe("1 invitation sent");
  });

  it("keeps partial success partial — the ten that sent still sent", async () => {
    sendInvitations.mockResolvedValue({ sent: 10, failed: 2 });
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");

    const out = await sendInvitationsOutcome("studio-a", "w1", "Planner A");

    // Not "failed": ten guests have their invitation. Reporting the batch as a
    // failure would invite a re-send to all twelve.
    expect(out.message).toMatch(/^10 sent, 2 failed/);
    expect(out.sent).toBe(10);
    expect(out.failed).toBe(2);
    // Retrying is the same button again, because `sendInvitations` only marks
    // the ones that succeeded and re-runs the rest.
    expect(out.message).toMatch(/again to retry/i);
  });

  it("says something useful when there is nothing to send", async () => {
    sendInvitations.mockResolvedValue({ sent: 0, failed: 0 });
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");

    const out = await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(out.ok).toBe(true);
    expect(out.message).toMatch(/already been invited/);
  });

  it("does not let one broken send take the page down", async () => {
    sendInvitations.mockRejectedValue(new Error("SMTP exploded"));
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");

    const out = await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(out.ok).toBe(false);
    expect(out.message).not.toMatch(/SMTP exploded/);
  });

  it("is scoped to the caller's studio and wedding", async () => {
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");
    await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(sendInvitations).toHaveBeenCalledWith("studio-a", "w1", "Planner A");
  });

  it("issues exactly one send per invocation, so a double-click cannot double-send", async () => {
    sendInvitations.mockResolvedValue({ sent: 3, failed: 0 });
    const { sendInvitationsOutcome } = await import("@/server/services/invite-actions");

    await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(sendInvitations).toHaveBeenCalledTimes(1);

    /**
     * The button's `disabled` while pending is the first line of defence, and
     * it is only a UI one. The real protection is underneath and unchanged:
     * `sendInvitations` selects on `invitedAt: null`, and each guest goes
     * through `runOnce`, so a second run that slips past the disabled state
     * finds nothing left to send rather than sending twice.
     */
    await sendInvitationsOutcome("studio-a", "w1", "Planner A");
    expect(sendInvitations).toHaveBeenCalledTimes(2);
  });
});

/* ═════════════════════════════════════════ message hygiene ═══ */

describe("what a planner is allowed to see", () => {
  it("shows no provider text, host, or stack in any failure path", async () => {
    const { UserError } = await import("@/lib/errors");
    const { resendInvitationOutcome, sendInvitationsOutcome } =
      await import("@/server/services/invite-actions");

    const leaky = new Error("Resend API 422: domain kenzenlab.com is not verified (req_abc123)");
    resendInvitation.mockRejectedValue(leaky);
    sendInvitations.mockRejectedValue(leaky);

    for (const out of [
      await resendInvitationOutcome("studio-a", "g1", "P"),
      await sendInvitationsOutcome("studio-a", "w1", "P"),
    ]) {
      expect(out.message).not.toMatch(/Resend API|422|kenzenlab|req_abc123/);
    }

    // A UserError is the deliberate exception: its text was written to be read.
    resendInvitation.mockRejectedValue(new UserError("Please wait before sending another."));
    expect((await resendInvitationOutcome("studio-a", "g1", "P")).message).toBe(
      "Please wait before sending another.",
    );
    expect(warn).toHaveBeenCalled();
  });
});
