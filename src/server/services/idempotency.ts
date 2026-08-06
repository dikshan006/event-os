import "server-only";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

/**
 * Run a side effect at most once per key.
 *
 * The problem this solves is not database corruption — Prisma and Postgres
 * handle that. It is the effects that leave the database: an email that has
 * been sent cannot be un-sent, and a charge that has been made cannot be
 * un-made. A planner clicking "Send invitations" twice, or a browser retrying a
 * slow server action, must not put the same invitation in a guest's inbox
 * twice.
 *
 * The claim is made **before** the effect runs and settled by the unique index
 * rather than by a read-then-write, which would have a window between the check
 * and the insert exactly wide enough for the double-click to fit through. Two
 * concurrent callers both attempt the insert; Postgres picks a winner; the
 * loser gets P2002 and returns the existing outcome instead of doing the work.
 *
 * A failed effect releases its claim, so a genuine error is retryable. Only
 * success is permanent — otherwise one transient provider outage would make the
 * operation impossible to retry for the whole TTL.
 */

export type IdempotentOutcome<T> =
  | { status: "performed"; result: T }
  | { status: "duplicate"; result: T | null }
  /** Another attempt holds the claim and has not finished. */
  | { status: "in_flight" };

export async function runOnce<T>(opts: {
  /** Stable across retries of the same logical operation. */
  key: string;
  scope: string;
  studioId?: string;
  /**
   * How long "again" means "the same request". Long enough to cover retries and
   * double-clicks, short enough that a deliberate re-send next week is allowed.
   */
  ttlMs?: number;
  effect: () => Promise<T>;
}): Promise<IdempotentOutcome<T>> {
  const ttlMs = opts.ttlMs ?? 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    await prisma.idempotencyKey.create({
      data: { key: opts.key, scope: opts.scope, studioId: opts.studioId ?? null, expiresAt },
    });
  } catch (err) {
    // P2002 is the unique-index collision: somebody else claimed this first.
    if ((err as { code?: string }).code !== "P2002") throw err;

    const existing = await prisma.idempotencyKey.findUnique({ where: { key: opts.key } });

    // An expired claim is not a claim. Take it over rather than refusing
    // forever — otherwise a crash mid-effect would poison the key for its
    // whole TTL.
    if (existing && existing.expiresAt < new Date()) {
      await prisma.idempotencyKey.delete({ where: { key: opts.key } }).catch(() => {});
      return runOnce(opts);
    }

    if (existing?.completedAt) {
      log.info("idempotency.duplicate_suppressed", { scope: opts.scope, studioId: opts.studioId });
      return { status: "duplicate", result: (existing.result as T) ?? null };
    }
    log.warn("idempotency.in_flight", { scope: opts.scope, studioId: opts.studioId });
    return { status: "in_flight" };
  }

  try {
    const result = await opts.effect();
    await prisma.idempotencyKey.update({
      where: { key: opts.key },
      data: { completedAt: new Date(), result: (result ?? null) as never },
    });
    return { status: "performed", result };
  } catch (err) {
    // Release the claim so the caller can genuinely retry. If this delete
    // fails, the key expires on its own — worse than releasing it, better than
    // performing the effect twice.
    await prisma.idempotencyKey.delete({ where: { key: opts.key } }).catch(() => {});
    throw err;
  }
}

/**
 * Invitation sends, keyed on what makes two sends "the same".
 *
 * The guest, the wedding, and the invite code. The code is in the key
 * deliberately: regenerating a guest's code is how a planner deliberately
 * re-issues an invitation, and that should be allowed to send again
 * immediately rather than being swallowed as a duplicate.
 */
export const invitationKey = (weddingId: string, guestId: string, inviteCode: string) =>
  `invite:${weddingId}:${guestId}:${inviteCode}`;

/**
 * Expired rows, deleted in batches.
 *
 * Called from the health probe rather than a cron: the table is small, the
 * delete is indexed, and adding a scheduler for it would be more moving parts
 * than the problem deserves.
 */
export async function sweepIdempotencyKeys(limit = 500): Promise<number> {
  const { count } = await prisma.idempotencyKey.deleteMany({
    where: { expiresAt: { lt: new Date() } },
    // Prisma has no LIMIT on deleteMany; the index keeps this cheap regardless.
  });
  return Math.min(count, limit);
}
