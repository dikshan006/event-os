import "server-only";
import { prisma } from "@/lib/db";
import { stripe, stripeEnabled, billingUnavailableInProduction } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { getSettings } from "./settings";
import { logAudit } from "./audit";
import { resolvePrice } from "./pricing";
import { activeSubscription } from "./subscriptions";
import { runOnce } from "./idempotency";
import { emails } from "@/lib/email";
import { UserError } from "@/lib/errors";
import { money } from "@/lib/utils";

/**
 * Publish flow (ARCHITECTURE.md §8), in the order the checks are made:
 *  - a studio with a live subscription publishes free; that is what it bought
 *  - otherwise the first published wedding per studio is free when the platform
 *    setting allows it
 *  - otherwise a Stripe Checkout session gates publishing, and the webhook
 *    flips the wedding live
 *  - with no Stripe key configured (local dev), we record a dev payment and
 *    publish directly
 */
export async function startPublish(studioId: string, weddingId: string, actorName: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  if (wedding.status === "PUBLISHED") return { ok: true as const };

  const [settings, studio, subscription] = await Promise.all([
    getSettings(),
    prisma.studio.findUniqueOrThrow({ where: { id: studioId } }),
    activeSubscription(studioId),
  ]);
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;

  /**
   * A subscription covers publishing, and is checked before the free wedding.
   *
   * Order matters here in a way that is easy to get backwards. If the free
   * wedding were claimed first, a studio that subscribed on day one would burn
   * its one free publish on a wedding the subscription already covered, and
   * then find nothing left if it later cancelled. Checking the subscription
   * first leaves `freeWeddingUsed` untouched for as long as they are paying.
   *
   * The zero-amount Payment row is not bookkeeping noise: without it the
   * billing history simply omits published weddings for subscribers, and the
   * first question anyone asks is whether the publish was recorded at all.
   */
  if (subscription) {
    await prisma.$transaction([
      prisma.wedding.update({
        where: { id: wedding.id },
        data: { status: "PUBLISHED", publishedAt: new Date() },
      }),
      prisma.payment.create({
        data: {
          studioId, weddingId: wedding.id, amountCents: 0, status: "PAID",
          pricePlanId: subscription.pricePlanId,
          description: `Publish — ${couple} (included in ${subscription.pricePlan.kind === "YEARLY" ? "yearly" : "monthly"} plan)`,
        },
      }),
    ]);
    await logAudit({
      actorType: "PLANNER", actorName, studioId,
      action: `Published “${couple}” — included in subscription`,
      targetId: wedding.id,
    });
    return { ok: true as const };
  }

  /**
   * Claiming the free wedding is a compare-and-swap, not a read then a write.
   *
   * `freeWeddingUsed` was read above and would have been written below, and
   * between those two statements a second publish request can read the same
   * `false`. Two tabs, or one impatient double-click, and a studio publishes two
   * weddings for the price of none \u2014 a paid feature given away by a race that
   * costs nothing to trigger and leaves two perfectly ordinary-looking audit
   * rows behind.
   *
   * `updateMany` with the expected value in the WHERE clause makes the database
   * the arbiter: the row is locked for the update, and exactly one caller sees
   * `count: 1`. The loser falls through to the paid path, which is the correct
   * outcome \u2014 it is genuinely their second wedding.
   */
  if (settings.firstWeddingFree && !studio.freeWeddingUsed) {
    const claimed = await prisma.studio.updateMany({
      where: { id: studioId, freeWeddingUsed: false },
      data: { freeWeddingUsed: true },
    });

    if (claimed.count === 1) {
      await prisma.$transaction([
        prisma.wedding.update({ where: { id: wedding.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
        prisma.payment.create({
          data: { studioId, weddingId: wedding.id, amountCents: 0, status: "PAID", description: `Publish \u2014 ${couple} (first wedding free)` },
        }),
      ]);
      await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Published \u201C${couple}\u201D \u2014 first wedding free`, targetId: wedding.id });
      return { ok: true as const };
    }
    // Lost the race: someone else took the free slot. Fall through and charge.
  }

  /**
   * The price is looked up from the studio, never passed in.
   *
   * `resolvePrice` prefers this studio's override and falls back to the
   * platform default, and it reads a `PricePlan` row rather than the old
   * mutable settings integer \u2014 so the amount charged is a specific version of a
   * price that can still be identified months later from the `pricePlanId` on
   * the receipt.
   */
  const plan = await resolvePrice(studioId, "PER_WEDDING");
  const amountCents = plan.amountCents;

  /**
   * A price of zero is not a payment, so it does not need a payment processor.
   *
   * This is the shape of the launch while charging is paused: the platform
   * per-wedding price is set to $0, and publishing works without Stripe being
   * configured at all. It is also simply correct — routing a $0 charge through
   * Checkout would ask a planner to confirm paying nothing, and would fail for
   * want of credentials that cannot affect the outcome either way.
   *
   * The `PAID` row is honest here in a way it is not below: nothing was owed
   * and nothing is outstanding, which is the same reasoning that lets the free
   * first wedding record a zero-amount payment. `freeWeddingUsed` is
   * deliberately left alone — a publish that cost nothing should not consume
   * the one free wedding a studio gets when prices come back.
   */
  if (amountCents === 0) {
    await prisma.$transaction([
      prisma.wedding.update({ where: { id: wedding.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      prisma.payment.create({
        data: {
          studioId, weddingId: wedding.id, amountCents: 0, status: "PAID",
          pricePlanId: plan.id, description: `Publish \u2014 ${couple} (no charge)`,
        },
      }),
    ]);
    await logAudit({
      actorType: "PLANNER", actorName, studioId,
      action: `Published \u201C${couple}\u201D \u2014 no charge`, targetId: wedding.id,
    });
    return { ok: true as const };
  }

  /**
   * With no Stripe key, publishing is free \u2014 which is a convenience locally and
   * a giveaway in front of customers.
   *
   * The branch below publishes the wedding and writes a `PAID` payment for the
   * full amount without any money moving. On a laptop that is exactly what is
   * wanted; on the live deployment it hands over the product and then records
   * in the billing history that it was paid for, which is worse than simply
   * failing because it destroys the evidence that anything went wrong.
   *
   * So the live deployment refuses instead. `billingUnavailableInProduction()`
   * is fail-closed: an absent or unrecognised `VERCEL_ENV` counts as live, so a
   * variable that goes missing costs a publish rather than a payment.
   */
  if (billingUnavailableInProduction()) {
    log.error("billing.not_configured", { studioId, weddingId: wedding.id });
    await logAudit({
      actorType: "SYSTEM", studioId,
      action: `Publish refused \u2014 Stripe is not configured on this deployment`,
      targetId: wedding.id,
    });
    throw new UserError(
      "Publishing is temporarily unavailable while billing is being set up. " +
        "Your wedding is safe as a draft \u2014 please contact EventOS support.",
      "BILLING_UNAVAILABLE",
    );
  }

  if (!stripeEnabled) {
    await prisma.$transaction([
      prisma.wedding.update({ where: { id: wedding.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      prisma.studio.update({ where: { id: studioId }, data: { freeWeddingUsed: true } }),
      prisma.payment.create({
        data: { studioId, weddingId: wedding.id, amountCents, status: "PAID", pricePlanId: plan.id, description: `Publish \u2014 ${couple} (dev mode, Stripe not configured)` },
      }),
    ]);
    await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Published \u201C${couple}\u201D \u2014 ${money(amountCents)} (dev mode)`, targetId: wedding.id });
    return { ok: true as const };
  }

  /**
   * One Checkout session per wedding, however many times the button is pressed.
   *
   * Without this, two clicks create two sessions and two PENDING payments for
   * one wedding. `stripeSessionId` being unique does not help \u2014 they are
   * genuinely different sessions \u2014 and neither does the PUBLISHED check at the
   * top, because neither session has been paid yet when the second one opens.
   * The wedding still publishes once, but if both get paid the studio is
   * charged twice for it, and the only trace is two payment rows that each look
   * perfectly ordinary.
   *
   * `runOnce` settles it on the same unique index that protects invitation
   * sends: the second caller loses the insert and is handed the first caller's
   * checkout URL instead of opening a second one. Keyed on the wedding and the
   * amount, so a genuine re-attempt after the price changes is a new operation
   * rather than a duplicate.
   *
   * The TTL is an hour \u2014 comfortably longer than a Checkout session stays
   * useful, short enough that a planner who abandons payment and comes back
   * tomorrow gets a fresh session rather than an expired link.
   */
  const outcome = await runOnce<{ url: string }>({
    key: `publish:${wedding.id}:${amountCents}`,
    scope: "publish",
    studioId,
    ttlMs: 60 * 60 * 1000,
    effect: async () => {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{
          quantity: 1,
          price_data: {
            currency: plan.currency,
            unit_amount: amountCents,
            product_data: { name: `Publish wedding \u2014 ${couple}`, description: "One-time publishing fee" },
          },
        }],
        metadata: { weddingId: wedding.id, studioId, pricePlanId: plan.id },
        success_url: `${process.env.APP_URL}/studio/weddings?published=1`,
        cancel_url: `${process.env.APP_URL}/studio/weddings?canceled=1`,
      });

      await prisma.payment.create({
        data: {
          studioId, weddingId: wedding.id, amountCents, status: "PENDING",
          pricePlanId: plan.id,
          description: `Publish \u2014 ${couple}`, stripeSessionId: session.id,
        },
      });
      return { url: session.url! };
    },
  });

  if (outcome.status === "in_flight") {
    // Another request holds the claim and has not finished creating the
    // session. Nothing to send them to yet; asking again in a moment is right.
    throw new UserError(
      "That publish is already being set up \u2014 give it a second and try again.",
      "PUBLISH_IN_FLIGHT",
    );
  }
  if (!outcome.result?.url) {
    throw new Error("Checkout session was claimed but produced no URL");
  }
  return { ok: false as const, checkoutUrl: outcome.result.url };
}

/** Called by the Stripe webhook once payment succeeds. Idempotent. */
export async function completePublishFromStripe(sessionId: string, paymentIntentId: string | null) {
  const payment = await prisma.payment.findUnique({ where: { stripeSessionId: sessionId } });
  if (!payment || payment.status === "PAID") return;

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: "PAID", stripePaymentIntentId: paymentIntentId ?? undefined },
    }),
    prisma.wedding.update({ where: { id: payment.weddingId! }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
    prisma.studio.update({ where: { id: payment.studioId }, data: { freeWeddingUsed: true } }),
  ]);
  await logAudit({ actorType: "SYSTEM", studioId: payment.studioId, action: `Stripe payment confirmed \u2014 ${payment.description}`, targetId: payment.weddingId ?? undefined });

  const studio = await prisma.studio.findUnique({ where: { id: payment.studioId } });
  if (studio?.contactEmail) {
    await emails.paymentReceipt({ to: studio.contactEmail, studio: studio.name, desc: payment.description, amount: money(payment.amountCents), studioId: payment.studioId });
  }
}
