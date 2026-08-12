import "server-only";
import type { PricePlan, PricePlanKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireAdmin } from "./context";
import { logAudit } from "./audit";
import { money } from "@/lib/utils";
import { activeKeyFor, MAX_AMOUNT_CENTS } from "./pricing";

/**
 * Changing a price. Admin only, always.
 *
 * Split from `pricing.ts` so that reading a price does not depend on the
 * session layer. The read path runs on planner pages and inside the Stripe
 * webhook, which has no session at all; if the two lived together, every one of
 * those call sites would import `requireAdmin` — and with it NextAuth — purely
 * as a side effect of module resolution.
 *
 * Nothing here is reachable without an admin session. `requireAdmin` is called
 * inside each function rather than only at the call site, so a planner cannot
 * reach one even if a future page imported it by mistake. That is the whole of
 * "planners cannot choose or modify their own price": there is no planner-facing
 * path into this file, and the file checks anyway.
 */

function assertAmount(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error("A price must be a whole number of cents, and not negative.");
  }
  if (amountCents > MAX_AMOUNT_CENTS) {
    throw new Error(`That price looks like a typo — the maximum is ${money(MAX_AMOUNT_CENTS)}.`);
  }
}

/**
 * Set a price: archive whatever was current for this scope, insert a new row.
 *
 * `studioId` null sets the platform default and affects only studios that have
 * no override and have not already been sold something. Passing a studio sets
 * that studio's override.
 *
 * Both statements run in one transaction, and in this order, because the
 * `activeKey` unique index will not tolerate the new row existing while the old
 * one still claims the scope. Two admins saving at the same instant is settled
 * by that index: one transaction commits, the other fails with a unique
 * violation and can be retried, which is the right outcome — silently letting
 * the second overwrite the first would lose a deliberate decision.
 *
 * Admin-only, checked here rather than only at the call site. `requireAdmin`
 * redirects a non-admin exactly as it does in `ownWedding`, so a planner cannot
 * reach this function even if some future page were to import it by mistake.
 */
export async function setPrice(opts: {
  kind: PricePlanKind;
  amountCents: number;
  /** Null or omitted sets the platform default. */
  studioId?: string | null;
  currency?: string;
}): Promise<PricePlan> {
  const { user } = await requireAdmin();
  assertAmount(opts.amountCents);

  const studioId = opts.studioId || null;
  const key = activeKeyFor(opts.kind, studioId);

  if (studioId) {
    // Fail loudly rather than creating an override that points at nothing.
    await prisma.studio.findUniqueOrThrow({ where: { id: studioId }, select: { id: true } });
  }

  const [, created] = await prisma.$transaction([
    prisma.pricePlan.updateMany({
      where: { activeKey: key },
      data: { activeKey: null, archivedAt: new Date() },
    }),
    prisma.pricePlan.create({
      data: {
        kind: opts.kind,
        amountCents: opts.amountCents,
        currency: opts.currency ?? "usd",
        studioId,
        activeKey: key,
        createdBy: user.name,
      },
    }),
  ]);

  await logAudit({
    actorType: "ADMIN",
    actorName: user.name,
    studioId: studioId ?? undefined,
    action: studioId
      ? `Set custom ${opts.kind} price — ${money(opts.amountCents)}`
      : `Changed default ${opts.kind} price — ${money(opts.amountCents)}`,
    targetId: created.id,
  });

  return created;
}

/**
 * Drop a studio's override so it falls back to the platform default.
 *
 * The row is archived, never deleted: a `Payment` or `Subscription` may point
 * at it, and the foreign key is RESTRICT precisely so a receipt can never end
 * up referencing a price that no longer exists.
 */
export async function clearStudioPrice(opts: {
  studioId: string;
  kind: PricePlanKind;
}): Promise<boolean> {
  const { user } = await requireAdmin();
  const key = activeKeyFor(opts.kind, opts.studioId);

  const { count } = await prisma.pricePlan.updateMany({
    where: { activeKey: key, studioId: opts.studioId },
    data: { activeKey: null, archivedAt: new Date() },
  });
  if (count === 0) return false;

  await logAudit({
    actorType: "ADMIN",
    actorName: user.name,
    studioId: opts.studioId,
    action: `Removed custom ${opts.kind} price — back to the platform default`,
  });
  return true;
}
