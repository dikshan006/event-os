import "server-only";
import type { PricePlan, PricePlanKind } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * What a studio is charged, and who is allowed to decide that.
 *
 * Two rules drive the whole module. Prices are **resolved on the server from
 * the studio in the session** — no caller anywhere passes an amount or a Stripe
 * price id, so there is no client-supplied number for anyone to tamper with.
 * And prices are **versioned rather than edited**: changing the platform
 * default inserts a new row and archives the old one, which is what makes an
 * existing subscription immune to it. The subscription holds a `pricePlanId`;
 * archiving the row it points at does not move it.
 *
 * This module is the **read** half, and it deliberately imports nothing from
 * the session layer. Writing a price is admin-only and lives in
 * `pricing-admin.ts`; keeping the two apart means the publish path — planner
 * pages, and the Stripe webhook, which has no session at all — does not drag
 * the whole authentication stack in behind it just because some other function
 * in the same file needed `requireAdmin`.
 */

/** Stands in for "no studio" in an `activeKey`. Cuids never collide with it. */
export const GLOBAL = "GLOBAL";

/**
 * A price nobody typed by accident.
 *
 * The form sends dollars and a fat finger turns $149 into $14900. There is no
 * clever way to catch that, but there is a boundary beyond which a number is
 * certainly a mistake rather than a decision, and refusing past it costs a
 * legitimate admin nothing.
 */
export const MAX_AMOUNT_CENTS = 10_000_00;

/**
 * The scope a plan is current for, or null once it is archived.
 *
 * This string is the whole uniqueness mechanism: it is `@unique`, so two rows
 * cannot both be live for the same kind and studio, and Postgres treats the
 * NULLs of archived rows as distinct so history piles up freely underneath.
 */
export function activeKeyFor(kind: PricePlanKind, studioId?: string | null) {
  return `${kind}:${studioId || GLOBAL}`;
}

/**
 * What this studio pays for this kind, right now.
 *
 * Override first, platform default second. One query rather than two so the
 * fallback cannot observe a price change happening between them.
 *
 * Throws rather than defaulting when neither exists. A missing plan means the
 * seed did not run, and inventing a number here would charge somebody an amount
 * no admin ever chose — much worse than an error that says so.
 */
export async function resolvePrice(
  studioId: string,
  kind: PricePlanKind,
): Promise<PricePlan> {
  if (!studioId) throw new Error("resolvePrice: studioId is required");

  const own = activeKeyFor(kind, studioId);
  const fallback = activeKeyFor(kind, null);
  const plans = await prisma.pricePlan.findMany({
    where: { activeKey: { in: [own, fallback] } },
  });

  const plan =
    plans.find(p => p.activeKey === own) ?? plans.find(p => p.activeKey === fallback);
  if (!plan) {
    throw new Error(
      `No active ${kind} price is configured. The platform default is missing — ` +
        "check that the price-plan migration ran.",
    );
  }
  return plan;
}

/** All three current prices for one studio, for pages that show a comparison. */
export async function resolveAllPrices(studioId: string) {
  const [perWedding, monthly, yearly] = await Promise.all([
    resolvePrice(studioId, "PER_WEDDING"),
    resolvePrice(studioId, "MONTHLY"),
    resolvePrice(studioId, "YEARLY"),
  ]);
  return { perWedding, monthly, yearly };
}

/** The current platform defaults, for the admin pricing screen. */
export async function globalPrices() {
  const plans = await prisma.pricePlan.findMany({
    where: {
      activeKey: {
        in: [activeKeyFor("PER_WEDDING"), activeKeyFor("MONTHLY"), activeKeyFor("YEARLY")],
      },
    },
  });
  const by = (k: PricePlanKind) => plans.find(p => p.kind === k) ?? null;
  return { perWedding: by("PER_WEDDING"), monthly: by("MONTHLY"), yearly: by("YEARLY") };
}

/** A studio's overrides — only the kinds it actually has one for. */
export async function studioOverrides(studioId: string) {
  return prisma.pricePlan.findMany({
    where: { studioId, activeKey: { not: null } },
    orderBy: { kind: "asc" },
  });
}
