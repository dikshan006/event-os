import "server-only";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { emails } from "@/lib/email";
import { logAudit } from "./audit";

const hash = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

/** Never reveals whether the account exists. */
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (!user) return; // same response either way

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
  });
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
