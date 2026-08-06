import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { logAudit } from "./audit";

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/**
 * Sign a user out of everywhere, immediately.
 *
 * Sessions are JWTs and cannot be recalled from the browser holding them, so
 * "sign out everywhere" is expressed as a cutoff: every token issued before this
 * instant stops being accepted. The auth callback does the comparison.
 *
 * One second into the future, not `now`. A token's `iat` is whole seconds, so a
 * token minted in the same second as the reset would have `iat * 1000` equal to
 * or just below `Date.now()` and could survive the comparison. The skew is
 * imperceptible to a person and closes a window that is small but genuinely
 * reachable — the reset and the attacker's next request can easily land in the
 * same second.
 *
 * Returns the operation rather than awaiting it, so callers can include it in
 * the same transaction as the credential change. A password that changed while
 * the sessions holding the old one stayed valid is the exact failure this
 * exists to prevent, and two separate writes can half-succeed.
 */
export function revokeSessionsOp(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { sessionsValidFrom: new Date(Date.now() + 1000) },
  });
}

/** The same thing, for callers with nothing to batch it with. */
export async function revokeSessions(userId: string) {
  await revokeSessionsOp(userId);
}

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

  const passwordHash = await bcrypt.hash(newPassword, 12);

  /**
   * One transaction, and the token is consumed by a *conditional* update rather
   * than by id alone.
   *
   * `updateMany({ where: { id, usedAt: null } })` is a compare-and-swap: two
   * requests arriving with the same token race for one row, and exactly one sees
   * a non-zero count. Updating by id would let both succeed, which matters
   * because the two requests can carry different passwords — the loser would
   * silently overwrite the winner's, and the person who reset their password
   * would end up with one they never chose.
   */
  const [claimed] = await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash } }),
    // Invalidate any other outstanding tokens for this user.
    prisma.passwordResetToken.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: new Date() } }),
    // Every session opened with the old password stops here. Without this, a
    // reset performed *because* someone else had the account left them signed in.
    revokeSessionsOp(row.userId),
  ]);

  if (!claimed.count) return false; // lost the race; the other request won

  await logAudit({ actorType: "SYSTEM", action: `Password reset completed for ${row.user.email}` });
  return true;
}
