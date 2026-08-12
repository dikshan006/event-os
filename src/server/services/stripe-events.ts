import "server-only";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { log } from "@/lib/logger";
import { logAudit } from "./audit";
import { completePublishFromStripe } from "./billing";
import { toSubscriptionStatus } from "./subscriptions";
import { emails } from "@/lib/email";
import { money } from "@/lib/utils";

/**
 * What we do when Stripe tells us something happened.
 *
 * Two properties matter more than anything this file computes.
 *
 * **The signature is verified before any of this runs**, in the route. Nothing
 * here treats the payload as trustworthy on its own; by the time a handler sees
 * an event, `constructEvent` has already proved it came from Stripe and was not
 * replayed with a modified body.
 *
 * **Every handler is safe to run twice.** Stripe redelivers on any non-2xx and
 * will replay days later, so "it already happened" is a normal condition rather
 * than an error. `handleStripeEvent` claims the event id first and lets the
 * unique index reject replays, and the individual handlers are written to be
 * idempotent anyway — belt and braces, because the claim is released if a
 * handler throws.
 */

/** Events we act on. Anything else is acknowledged and ignored. */
const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (!HANDLED.has(event.type)) return;

  /**
   * Claim the event before doing the work.
   *
   * A read-then-write would leave a window exactly wide enough for two
   * concurrent deliveries of the same event — which Stripe does produce — to
   * both pass the check. Inserting first makes Postgres the arbiter: the loser
   * gets P2002 and stops.
   */
  try {
    await prisma.processedWebhookEvent.create({
      data: { stripeEventId: event.id, type: event.type },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") {
      log.info("stripe.event_replayed", { type: event.type });
      return;
    }
    throw err;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChanged(event.data.object as Stripe.Subscription);
        break;
      case "invoice.paid":
        await onInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await onInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
    }
  } catch (err) {
    /**
     * Release the claim so Stripe's retry can actually retry.
     *
     * Without this, a transient database blip during the handler would mark the
     * event permanently processed and every redelivery would return early — the
     * subscription would never be recorded and nothing would ever say why.
     */
    await prisma.processedWebhookEvent
      .delete({ where: { stripeEventId: event.id } })
      .catch(() => {});
    throw err;
  }
}

/**
 * A one-time publish payment, or the first payment of a subscription.
 *
 * Subscription checkouts also emit this, but the subscription itself is
 * recorded from `customer.subscription.*`, which carries the status and period
 * that this event does not. Handling it here too would mean writing the same
 * row from two places with different amounts of information.
 */
async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;
  await completePublishFromStripe(
    session.id,
    typeof session.payment_intent === "string" ? session.payment_intent : null,
  );
}

/**
 * Mirror a subscription's state.
 *
 * `studioId` and `pricePlanId` come from the metadata set at checkout, so the
 * price a studio was sold on is recorded from the sale rather than re-derived
 * later — by which point an admin may have changed the default, and re-deriving
 * would quietly rewrite what they agreed to.
 *
 * A subscription whose metadata is missing is not guessed at. That means
 * something created it outside this application, and picking a studio for it
 * would be inventing a customer relationship.
 */
async function onSubscriptionChanged(sub: Stripe.Subscription) {
  const studioId = sub.metadata?.studioId;
  let pricePlanId = sub.metadata?.pricePlanId;

  if (!studioId) {
    log.warn("stripe.subscription_without_studio", { subscription: sub.id });
    return;
  }

  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (!studio) {
    log.warn("stripe.subscription_unknown_studio", { subscription: sub.id });
    return;
  }

  /**
   * Fall back to the Stripe Price only if metadata is absent — an older
   * subscription, or one created in the Dashboard. `stripePriceId` is unique on
   * PricePlan, so this resolves to exactly one row or none.
   */
  if (!pricePlanId) {
    const priceId = sub.items.data[0]?.price?.id;
    const plan = priceId
      ? await prisma.pricePlan.findUnique({ where: { stripePriceId: priceId } })
      : null;
    if (!plan) {
      log.warn("stripe.subscription_unknown_price", { subscription: sub.id });
      return;
    }
    pricePlanId = plan.id;
  }

  const status = toSubscriptionStatus(sub.status);
  const periodEnd = subscriptionPeriodEnd(sub);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  const previous = await prisma.subscription.findUnique({ where: { studioId } });

  await prisma.subscription.upsert({
    where: { studioId },
    create: {
      studioId,
      pricePlanId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
    /**
     * `pricePlanId` is not updated here on purpose. The plan a subscription was
     * sold on is a fact about the sale, and a status change is not a repricing
     * — rewriting it on every webhook is exactly how "changing the default must
     * not change existing subscriptions" would quietly stop being true.
     */
    update: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    },
  });

  // Only when it actually moved — a status webhook that changes nothing is
  // common, and an audit log full of "still active" hides the entries that matter.
  if (previous?.status !== status) {
    await logAudit({
      actorType: "SYSTEM",
      studioId,
      action: `Subscription ${previous ? `${previous.status} → ${status}` : `created — ${status}`}`,
      targetId: sub.id,
    });
  }
}

/**
 * The current period's end date.
 *
 * On the subscription itself in the pinned SDK (stripe 17.7.0, where it is a
 * required `number`). Later API versions move it onto each subscription item,
 * because items can bill on different schedules — so the item is read as a
 * fallback for the day this SDK is upgraded, rather than left to become a
 * silent `undefined` that renders as a missing renewal date.
 *
 * Null rather than a guessed date when neither is present: the only thing this
 * drives is a line of text on the billing page, and a wrong date there is worse
 * than none.
 */
function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const current = (sub as { current_period_end?: number }).current_period_end;
  const perItem = (sub.items?.data?.[0] as { current_period_end?: number } | undefined)
    ?.current_period_end;
  const seconds = current ?? perItem;
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/**
 * A subscription invoice was paid.
 *
 * Recorded as a `Payment` so a studio's billing history is one list rather than
 * "publishes here, subscription charges over there". Keyed on
 * `stripeInvoiceId`, which is unique, so a redelivered event cannot produce a
 * second row even if the event-level claim were somehow bypassed.
 *
 * The first invoice of a subscription arrives before — or racing with — the
 * `customer.subscription.created` that creates the local row, so the studio is
 * resolved from the Stripe customer rather than from our subscription table.
 */
async function onInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.id) return;
  const studioId = await studioForInvoice(invoice);
  if (!studioId) return;

  const existing = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
  });
  if (existing) return;

  const sub = await prisma.subscription.findUnique({ where: { studioId } });

  await prisma.payment.create({
    data: {
      studioId,
      amountCents: invoice.amount_paid,
      currency: invoice.currency,
      status: "PAID",
      description: invoiceDescription(invoice),
      stripeInvoiceId: invoice.id,
      pricePlanId: sub?.pricePlanId ?? null,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    studioId,
    action: `Subscription payment received — ${money(invoice.amount_paid)}`,
    targetId: invoice.id,
  });

  const studio = await prisma.studio.findUnique({ where: { id: studioId } });
  if (studio?.contactEmail) {
    await emails.paymentReceipt({
      to: studio.contactEmail,
      studio: studio.name,
      desc: invoiceDescription(invoice),
      amount: money(invoice.amount_paid),
      studioId,
    });
  }
}

/**
 * A subscription payment failed.
 *
 * Recorded, and nothing more. Stripe retries on its own schedule and moves the
 * subscription to `past_due` and eventually `unpaid` or `canceled`; access
 * follows from that status, which `onSubscriptionChanged` already mirrors.
 * Cutting a studio off here as well would mean two independent things deciding
 * entitlement, which is how somebody ends up locked out while Stripe still
 * considers them a paying customer.
 */
async function onInvoiceFailed(invoice: Stripe.Invoice) {
  if (!invoice.id) return;
  const studioId = await studioForInvoice(invoice);
  if (!studioId) return;

  const existing = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
  });
  if (existing) {
    if (existing.status === "PENDING") {
      await prisma.payment.update({ where: { id: existing.id }, data: { status: "FAILED" } });
    }
    return;
  }

  await prisma.payment.create({
    data: {
      studioId,
      amountCents: invoice.amount_due,
      currency: invoice.currency,
      status: "FAILED",
      description: `${invoiceDescription(invoice)} — payment failed`,
      stripeInvoiceId: invoice.id,
    },
  });

  await logAudit({
    actorType: "SYSTEM",
    studioId,
    action: `Subscription payment failed — ${money(invoice.amount_due)}`,
    targetId: invoice.id,
  });
}

/**
 * Which studio an invoice belongs to.
 *
 * The Stripe customer id is the link, and it is unique on Studio. Falls back to
 * the customer's own metadata, which `ensureCustomer` sets, for the case where
 * the studio row was restored or the id was cleared.
 */
async function studioForInvoice(invoice: Stripe.Invoice): Promise<string | null> {
  const customerId =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;

  const studio = await prisma.studio.findUnique({ where: { stripeCustomerId: customerId } });
  if (studio) return studio.id;

  const customer = await stripe.customers.retrieve(customerId).catch(() => null);
  if (!customer || customer.deleted) return null;
  const fromMeta = customer.metadata?.studioId;
  if (!fromMeta) {
    log.warn("stripe.invoice_unknown_customer", { invoice: invoice.id });
    return null;
  }
  const exists = await prisma.studio.findUnique({ where: { id: fromMeta } });
  return exists ? exists.id : null;
}

function invoiceDescription(invoice: Stripe.Invoice): string {
  return invoice.lines?.data?.[0]?.description || "EventOS subscription";
}
