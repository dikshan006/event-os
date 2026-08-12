import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { handleStripeEvent } from "@/server/services/stripe-events";
import { log } from "@/lib/logger";

/**
 * The Stripe webhook.
 *
 * This route is the one place in the application that acts on input from
 * outside without a session, so the signature check below is the entire
 * authorization story: `constructEvent` recomputes the HMAC over the exact
 * bytes received using the endpoint secret, and throws if the body was altered
 * or the timestamp is outside its tolerance. Anyone can POST here; only Stripe
 * can produce a payload that gets past line 40.
 *
 * `await req.text()` rather than `req.json()` is load-bearing. The signature is
 * over the raw bytes, and parsing and re-serialising JSON changes them — key
 * order, number formatting, whitespace — so a handler that verified against a
 * re-serialised body would reject every genuine event.
 */
export async function POST(req: NextRequest) {
  if (!stripeEnabled) return NextResponse.json({ ok: true, dev: true });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    // Deliberately no detail: an attacker probing this endpoint learns only
    // that it was refused, not which part of the signature failed.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    await handleStripeEvent(event);
  } catch (err) {
    /**
     * 500, not 200.
     *
     * Acknowledging an event we failed to process would tell Stripe never to
     * send it again, and a subscription would silently never be recorded. A 500
     * puts the event back into Stripe's retry schedule, and the claim on it has
     * already been released so the retry can do real work.
     */
    log.error("stripe.webhook_failed", {
      type: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
