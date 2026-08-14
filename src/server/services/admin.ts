import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify, inviteCode } from "@/lib/utils";
import { emails } from "@/lib/email";
import { storage } from "@/lib/storage";
import { log } from "@/lib/logger";
import { logAudit } from "./audit";
import { issueResetToken, INVITE_TOKEN_TTL_MS, revokeSessionsOp } from "./passwordReset";

export async function createPlanner(input: { studioName: string; ownerName: string; email: string }) {
  const tempPassword = inviteCode().toLowerCase();
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const studio = await prisma.studio.create({
    data: {
      name: input.studioName,
      slug: `${slugify(input.studioName)}-${inviteCode().slice(0, 4).toLowerCase()}`,
      users: { create: { email: input.email.toLowerCase(), name: input.ownerName, role: "PLANNER", passwordHash } },
    },
  });
  await logAudit({ actorType: "ADMIN", actorName: "Platform Owner", studioId: studio.id, action: `Created planner \u201C${input.studioName}\u201D \u2014 studio generated, login invite emailed` });
  // The invitation carries a one-time link so the planner can set their own
  // password without ever typing the temporary one. Minted here rather than
  // asking them to go through "forgot password" for an account they have not
  // been told the address of yet.
  const owner = await prisma.user.findFirstOrThrow({ where: { email: input.email.toLowerCase() } });
  const resetToken = await issueResetToken(owner.id, INVITE_TOKEN_TTL_MS);
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  await emails.plannerInvite({
    to: input.email,
    ownerName: input.ownerName,
    studio: input.studioName,
    link: `${appUrl}/login`,
    resetLink: `${appUrl}/reset-password/${resetToken}`,
    tempPassword,
    studioId: studio.id,
  });
  return { studio, tempPassword }; // shown once to the admin in the UI
}

/**
 * Issue a new password for a studio's owner.
 *
 * Stored passwords are bcrypt hashes, so an existing password can never be
 * read back — not by an admin, not by us. The remedy for "the planner lost
 * their login" is therefore to mint a new credential and show it to the admin
 * exactly once, which is what this does. `custom` lets the admin choose the
 * value during a hand-held onboarding call; omitted, one is generated.
 */
export async function resetPlannerPassword(studioId: string, custom?: string) {
  const studio = await prisma.studio.findUnique({
    where: { id: studioId },
    include: { users: { where: { role: "PLANNER" }, take: 1 } },
  });
  const owner = studio?.users[0];
  if (!studio || !owner) throw new Error("Not found");

  const password = custom?.trim() || inviteCode().toLowerCase();
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");

  await prisma.$transaction([
    prisma.user.update({
      where: { id: owner.id },
      data: { passwordHash: await bcrypt.hash(password, 12) },
    }),
    // Any reset link already in the planner's inbox must stop working, or the
    // old link could silently overwrite the credential just handed out.
    prisma.passwordResetToken.updateMany({
      where: { userId: owner.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    /**
     * And every session opened with the old password.
     *
     * This is the path an admin takes when a planner reports their account is
     * compromised. Handing out a new password while the intruder's session
     * stayed live would answer the wrong half of the problem.
     */
    revokeSessionsOp(owner.id),
  ]);

  await logAudit({
    actorType: "ADMIN", actorName: "Platform Owner", studioId,
    action: `Reset the password for ${owner.email} (${studio.name})${custom ? " — set manually" : " — generated"}`,
  });
  return { email: owner.email, password };
}

export async function setPlannerStatus(studioId: string, status: "ACTIVE" | "SUSPENDED") {
  const studio = await prisma.studio.update({ where: { id: studioId }, data: { status } });

  /**
   * Suspension ends the studio's sessions rather than waiting for them to expire.
   *
   * `requireStudio()` already re-reads the studio on every request and turns
   * away a suspended one, so this is not what makes suspension effective \u2014 it is
   * what makes it *clean*. Without it a suspended planner keeps a valid token and
   * sits on a redirect loop; with it, the session is gone and they are simply
   * signed out. It also closes the gap for any future surface that trusts the
   * token's claims without re-reading the studio behind them.
   */
  if (status === "SUSPENDED") {
    const users = await prisma.user.findMany({ where: { studioId }, select: { id: true } });
    await prisma.user.updateMany({
      where: { id: { in: users.map(u => u.id) } },
      data: { sessionsValidFrom: new Date(Date.now() + 1000) },
    });
  }

  await logAudit({ actorType: "ADMIN", actorName: "Platform Owner", studioId, action: `${status === "SUSPENDED" ? "Suspended" : "Reactivated"} planner \u201C${studio.name}\u201D` });
}

/**
 * Everything belonging to one studio lives under this prefix.
 *
 * Photos are written to `studios/<id>/weddings/<id>/<uuid>` and logos to
 * `studios/<id>/brand/<uuid>`, so one prefix covers both. The trailing slash is
 * not cosmetic: without it `studios/abc` would also match `studios/abcdef`, and
 * a delete that reaches into a second studio's files is the worst possible
 * failure of a function whose entire job is deleting things.
 */
const studioBlobPrefix = (studioId: string) => `studios/${studioId}/`;

/**
 * Delete a studio and everything that belongs to it.
 *
 * Three kinds of data, three different treatments.
 *
 * The relational rows go with a cascade, which the schema already handles for
 * users, weddings, guests, photos and payments.
 *
 * `EmailLog`, `AuditLog` and `IdempotencyKey` carry `studioId` as a plain
 * column with no foreign key \u2014 deliberately, so a log entry outlives the thing
 * it describes \u2014 which means the cascade does not touch them. That is right for
 * a wedding and wrong for a deleted account: `EmailLog.toEmail` holds guest
 * addresses, and keeping those after \u201Cdelete all of its data\u201D makes the
 * sentence untrue. They are removed explicitly, each scoped to this studio.
 *
 * The uploaded files are what nothing was cleaning up. Blobs are stored with
 * public access and stable URLs, so a photograph from somebody's wedding stayed
 * fetchable indefinitely after the account that owned it was erased.
 *
 * Order matters: database first, blobs after. A storage outage must not be able
 * to block an account deletion \u2014 that would leave a person unable to remove
 * their data because a third party is down \u2014 so the blob pass is best-effort
 * and reports what it could not do rather than throwing. The audit entry then
 * states which of the two actually happened, because an entry that claims more
 * than took place is worse than no entry at all.
 */
export async function deletePlanner(studioId: string) {
  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!studio) return { blobsDeleted: true };

  const prefix = studioBlobPrefix(studioId);

  await prisma.$transaction([
    prisma.emailLog.deleteMany({ where: { studioId } }),
    prisma.idempotencyKey.deleteMany({ where: { studioId } }),
    prisma.auditLog.deleteMany({ where: { studioId } }),
    prisma.studio.delete({ where: { id: studioId } }), // cascades users, weddings, guests, payments…
  ]);

  let blobsDeleted = true;
  try {
    await storage().deletePrefix(prefix);
  } catch (err) {
    blobsDeleted = false;
    log.error("studio.blob_cleanup_failed", {
      studioId,
      prefix,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  /**
   * Written after the deletion and deliberately without `studioId`, so it is
   * not swept up by the `auditLog.deleteMany` above and survives as the record
   * that this happened at all.
   */
  await logAudit({
    actorType: "ADMIN",
    actorName: "Platform Owner",
    action: blobsDeleted
      ? `Deleted planner \u201C${studio.name}\u201D \u2014 database records and uploaded files removed`
      : `Deleted planner \u201C${studio.name}\u201D \u2014 database records removed; uploaded files could NOT be deleted and need manual cleanup of ${prefix}`,
  });

  return { blobsDeleted };
}
