import "server-only";
import type { PricePlan, Studio, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { resolvePrice } from "./pricing";
import { logAudit } from "./audit";
import { money } from "@/lib/utils";

/**
 * Recurring plans.
 *
 * The planner-facing entry point is `startSubscription(studioId, kind)` — a
 * studio id from the session and one of two words. Deliberately nothing else:
 * no amount, no plan id, no Stripe price id. What the studio pays is looked up
 * server-side by `resolvePrice`, so there is no client-supplied number anywhere
 * in the flow to tamper with, and a planner cannot select a cheaper plan by
 * editing a form.
 *
 * Everything about a live subscription's state is written by the webhook, never
 * here. This module opens Checkout and Portal sessions; Stripe decides what
 * actually happened and tells us afterwards.
 */

export const SUBSCRIPTION_KINDS = ["MONTHLY", "YEARLY"] as const;
export type SubscriptionKind = (typeof SUBSCRIPTION_KINDS)[number];

export function isSubscriptionKind(v: unknown): v is SubscriptionKind {
  return v === "MONTHLY" || v === "YEARLY";
}

/** Statuses that mean the studio is currently entitled to the product. */
const ENTITLED = ["ACTIVE", "TRIALING"] as const;

/**
 * Is this studio covered by a live subscription?
 *
 * `PAST_DUE` deliberately does not count. Stripe keeps retrying a past-due
 * subscription for weeks, and treating that as paid would let a studio publish
 * indefinitely on a card that is not working. They keep what they already
 * published and are asked to fix the card before publishing more.
 */
export async function activeSubscription(studioId: string) {
  const sub = await prisma.subscription.findUnique({
    where: { studioId },
    include: { pricePlan: true },
  });
  if (!sub) return null;
  return (ENTITLED as readonly string[]).includes(sub.status) ? sub : null;
}

/** The row regardless of status, for showing "past due" on the billing page. */
export async function studioSubscription(studioId: string) {
  return prisma.subscription.findUnique({
    where: { studioId },
    include: { pricePlan: true },
  });
}

/**
 * The Stripe customer for a studio, created once and remembered.
 *
 * `stripeCustomerId` has existed on Studio since the first migration and has
 * never been written; this is the only place that writes it. The conditional
 * `updateMany` is the same compare-and-swap the free-wedding claim uses — two
 * simultaneous first-time checkouts would otherwise each create a customer and
 * the second would overwrite the first, orphaning a customer record that now
 * holds a payment method.
 */
async function ensureCustomer(studio: Studio): Promise<string> {
  if (studio.stripeCustomerId) return studio.stripeCustomerId;

  const customer = await stripe.customers.create({
    name: studio.name,
    email: studio.contactEmail ?? undefined,
    metadata: { studioId: studio.id },
  });

  const claimed = await prisma.studio.updateMany({
    where: { id: studio.id, stripeCustomerId: null },
    data: { stripeCustomerId: customer.id },
  });

  if (claimed.count === 1) return customer.id;

  // Lost the race. Somebody else's customer is the real one; ours is unused
  // and must not be left behind holding this studio's name and email.
  await stripe.customers.del(customer.id).catch(() => {});
  const fresh = await prisma.studio.findUniqueOrThrow({ where: { id: studio.id } });
  if (!fresh.stripeCustomerId) throw new Error("Could not establish a Stripe customer");
  return fresh.stripeCustomerId;
}

/**
 * The Stripe Price for a plan, created on first use and written back.
 *
 * Subscriptions cannot use the inline `price_data` that the per-wedding charge
 * uses: an inline price is archived the moment it is created and can be neither
 * updated nor reused, so a subscription bound to one is invisible in the
 * Dashboard and impossible to migrate later. Recurring plans get a real Price
 * object.
 *
 * Created lazily rather than in the migration because the migration runs during
 * `next build`, where there is no reason to expect Stripe credentials to exist
 * — and a build that fails because a payment provider is unreachable is a
 * deployment outage caused by an optional feature.
 *
 * The write-back is conditional for the same reason as the customer above: if
 * two requests race, one Price wins and the loser is archived rather than left
 * live and unreferenced.
 */
async function ensureStripePrice(plan: PricePlan): Promise<string> {
  if (plan.stripePriceId) return plan.stripePriceId;

  const interval = plan.kind === "YEARLY" ? "year" : "month";
  const price = await stripe.prices.create({
    currency: plan.currency,
    unit_amount: plan.amountCents,
    recurring: { interval },
    product_data: {
      name: plan.kind === "YEARLY" ? "EventOS — yearly plan" : "EventOS — monthly plan",
    },
    metadata: { pricePlanId: plan.id, studioId: plan.studioId ?? "GLOBAL" },
  });

  const claimed = await prisma.pricePlan.updateMany({
    where: { id: plan.id, stripePriceId: null },
    data: { stripePriceId: price.id },
  });

  if (claimed.count === 1) return price.id;

  await stripe.prices.update(price.id, { active: false }).catch(() => {});
  const fresh = await prisma.pricePlan.findUniqueOrThrow({ where: { id: plan.id } });
  if (!fresh.stripePriceId) throw new Error("Could not establish a Stripe price");
  return fresh.stripePriceId;
}

export type StartSubscriptionResult =
  | { ok: true; already: true }
  | { ok: false; checkoutUrl: string }
  | { ok: false; unavailable: true };

/**
 * Open Checkout for a recurring plan.
 *
 * `kind` is the only thing the caller chooses, and `resolvePrice` turns it into
 * money using the studio from the session. A planner who tampers with the form
 * can pick the other interval — which is a thing the UI offers them anyway —
 * and nothing else.
 *
 * `pricePlanId` rides along in the subscription metadata so the webhook can
 * record which version of the price this was sold on without having to re-derive
 * it later, by which time the default may have moved.
 */
export async function startSubscription(
  studioId: string,
  kind: SubscriptionKind,
  actorName: string,
): Promise<StartSubscriptionResult> {
  const existing = await activeSubscription(studioId);
  if (existing) return { ok: true, already: true };

  if (!stripeEnabled) return { ok: false, unavailable: true };

  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } });
  const plan = await resolvePrice(studioId, kind);
  const [customerId, priceId] = await Promise.all([
    ensureCustomer(studio),
    ensureStripePrice(plan),
  ]);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // On both the session and the subscription: session metadata does not
    // propagate, and `customer.subscription.*` events carry the subscription
    // only.
    metadata: { studioId, pricePlanId: plan.id },
    subscription_data: { metadata: { studioId, pricePlanId: plan.id } },
    success_url: `${process.env.APP_URL}/studio/billing?subscribed=1`,
    cancel_url: `${process.env.APP_URL}/studio/billing?canceled=1`,
  });

  await logAudit({
    actorType: "PLANNER",
    actorName,
    studioId,
    action: `Started ${kind === "YEARLY" ? "yearly" : "monthly"} subscription checkout — ${money(plan.amountCents)}`,
  });

  return { ok: false, checkoutUrl: session.url! };
}

/**
 * A Stripe-hosted Billing Portal session.
 *
 * Card changes, cancellation and invoice history all happen inside Stripe
 * rather than in pages here. That is partly less code, but mostly that it keeps
 * card details on Stripe's side of the boundary entirely — this application
 * never sees a card number, and a portal link is the only thing it has to
 * issue.
 *
 * The customer id comes from the studio row, so a planner cannot open somebody
 * else's portal by changing a parameter: there is no parameter.
 */
export async function billingPortalUrl(studioId: string): Promise<string | null> {
  if (!stripeEnabled) return null;
  const studio = await prisma.studio.findUniqueOrThrow({ where: { id: studioId } });
  if (!studio.stripeCustomerId) return null;

  const session = await stripe.billingPortal.sessions.create({
    customer: studio.stripeCustomerId,
    return_url: `${process.env.APP_URL}/studio/billing`,
  });
  return session.url;
}

/**
 * Stripe's status strings onto our enum.
 *
 * Exhaustive by construction, and loud about anything it does not recognise.
 * Quietly defaulting an unknown status to CANCELED would revoke a paying
 * studio's access on the day Stripe adds a state; defaulting it to ACTIVE would
 * hand out the product for free. Neither is a guess worth making silently — an
 * error reaches the webhook's catch, Stripe retries, and somebody looks.
 */
const STRIPE_STATUS: Record<string, SubscriptionStatus> = {
  incomplete: "INCOMPLETE",
  incomplete_expired: "INCOMPLETE_EXPIRED",
  trialing: "TRIALING",
  active: "ACTIVE",
  past_due: "PAST_DUE",
  canceled: "CANCELED",
  unpaid: "UNPAID",
  paused: "PAUSED",
};

export function toSubscriptionStatus(s: string): SubscriptionStatus {
  const mapped = STRIPE_STATUS[s];
  if (!mapped) throw new Error(`Unrecognised Stripe subscription status: ${s}`);
  return mapped;
}
