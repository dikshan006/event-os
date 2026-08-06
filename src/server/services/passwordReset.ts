import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { logAudit } from "./audit";

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/**
 * Mint a reset token for a user and return the raw value.
 *
 * The raw token is returned rather than stored: only its hash goes to the
 * database, so a database read yields nothing usable. This is the one moment
 * the plaintext exists, and it goes straight into an email.
 *
 * `ttlMs` differs by purpose. A forgot-password link is an hour — the person is
 * at their keyboard right now. An invitation is days, because a planner may be
 * told their studio exists on a Friday and not sit down with it until Monday,
 * and a link that has quietly expired by then is a support conversation rather
 * than an onboarding.
 */
export async function issueResetToken(userId: string, ttlMs = 60 * 60 * 1000) {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** How long an invitation's "set your password" link stays good. */
export const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Never reveals whether the account exists. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return; // same response either way

  const token = await issueResetToken(user.id);
  await emails.passwordReset({ to: user.email, name: user.name, link: `${process.env.APP_URL}/reset-password/${token}` });
}

export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return false;

  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await bcrypt.hash(newPassword, 12) } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await logAudit({ actorType: "SYSTEM", action: `Password reset completed for ${row.user.email}` });
  return true;
}
