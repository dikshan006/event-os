import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { completePublishFromStripe } from "@/server/services/billing";

export async function POST(req: NextRequest) {
  if (!stripeEnabled) return NextResponse.json({ ok: true, dev: true });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), sig, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await completePublishFromStripe(session.id, typeof session.payment_intent === "string" ? session.payment_intent : null);
  }
  return NextResponse.json({ received: true });
}
