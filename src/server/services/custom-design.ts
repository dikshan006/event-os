import "server-only";
import { prisma } from "@/lib/db";
import { emails, PLATFORM_INBOX } from "@/lib/email";
import { logAudit } from "./audit";
import { rateLimit } from "@/lib/ratelimit";
import { captureException } from "@/lib/monitoring";
import { UserError } from "@/lib/errors";

/**
 * A planner asking for a wedding design that is not one of the six.
 *
 * Recorded as an audit entry rather than in a table of its own, and that is a
 * considered choice rather than a shortcut. What a custom-design request needs
 * is: it must not be lost, the platform owner must find out promptly, and it
 * must be attributable to a studio. `AuditLog` already does all three, already
 * has an admin screen rendering it in time order, and already carries actor,
 * studio, target and a metadata blob.
 *
 * A dedicated table would add a migration, a second admin view and a status
 * field — and a status field implies a workflow (open, quoted, accepted) that
 * nobody has designed yet. When these requests are frequent enough to need
 * triaging, that table is the right thing to build, and it should be built
 * around how they are actually handled rather than guessed at now.
 *
 * The email is what makes it timely; the audit row is what makes it durable.
 */
export async function requestCustomDesign(input: {
  studioId: string;
  studioName: string;
  actorName: string;
  /** Optional context the planner typed. Bounded by the caller's validator. */
  note?: string;
}) {
  // One studio cannot fill the platform owner's inbox. Generous, because a
  // planner running several weddings may legitimately ask more than once.
  if (!(await rateLimit(`custom-design:${input.studioId}`, 5, 24 * 60 * 60 * 1000))) {
    throw new UserError("You have already sent several requests today — we will be in touch shortly.");
  }

  await logAudit({
    actorType: "PLANNER",
    actorName: input.actorName,
    studioId: input.studioId,
    action: `Requested a custom wedding design`,
    metadata: input.note ? { note: input.note } : undefined,
  });

  /**
   * The notification must not decide whether the request succeeded.
   *
   * If Resend is down, the planner has still asked and the row is still
   * written; telling them it failed would make them ask again, and the second
   * request would be as invisible as the first. The audit row is the record of
   * truth, so a send failure is reported to monitoring and swallowed here.
   */
  if (!PLATFORM_INBOX) return; // recorded, but there is nowhere to send the nudge
  try {
    await emails.customDesignRequest({
      to: PLATFORM_INBOX,
      studio: input.studioName,
      studioId: input.studioId,
      actorName: input.actorName,
      note: input.note,
    });
  } catch (err) {
    captureException(err, {
      area: "email",
      userFacing: false,
      detail: { studioId: input.studioId, kind: "CUSTOM_DESIGN_REQUEST" },
    });
  }
}

/** Recent requests, for the admin activity view. */
export async function listCustomDesignRequests(take = 50) {
  return prisma.auditLog.findMany({
    where: { action: { startsWith: "Requested a custom wedding design" } },
    orderBy: { createdAt: "desc" },
    take,
  });
}
