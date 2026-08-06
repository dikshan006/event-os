import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { slugify, inviteCode } from "@/lib/utils";
import { emails } from "@/lib/email";
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

export async function deletePlanner(studioId: string) {
  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!studio) return;
  await prisma.studio.delete({ where: { id: studioId } }); // cascades users, weddings, guests, payments…
  await logAudit({ actorType: "ADMIN", actorName: "Platform Owner", action: `Deleted planner \u201C${studio.name}\u201D and all of its data` });
}
