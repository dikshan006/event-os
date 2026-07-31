import "server-only";
import { prisma } from "@/lib/db";
import { stripe, stripeEnabled } from "@/lib/stripe";
import { getSettings } from "./settings";
import { logAudit } from "./audit";
import { emails } from "@/lib/email";
import { money } from "@/lib/utils";

/**
 * Publish flow (ARCHITECTURE.md §8):
 *  - first published wedding per studio is free when the platform setting allows it
 *  - otherwise a Stripe Checkout session gates publishing; the webhook flips the wedding live
 *  - with no Stripe key configured (local dev), we record a dev payment and publish directly
 */
export async function startPublish(studioId: string, weddingId: string, actorName: string) {
  const wedding = await prisma.wedding.findFirst({ where: { id: weddingId, studioId } });
  if (!wedding) throw new Error("Not found");
  if (wedding.status === "PUBLISHED") return { ok: true as const };

  const [settings, studio] = await Promise.all([
    getSettings(),
    prisma.studio.findUniqueOrThrow({ where: { id: studioId } }),
  ]);
  const couple = `${wedding.partnerOne} & ${wedding.partnerTwo}`;

  const free = settings.firstWeddingFree && !studio.freeWeddingUsed;
  if (free) {
    await prisma.$transaction([
      prisma.wedding.update({ where: { id: wedding.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      prisma.studio.update({ where: { id: studioId }, data: { freeWeddingUsed: true } }),
      prisma.payment.create({
        data: { studioId, weddingId: wedding.id, amountCents: 0, status: "PAID", description: `Publish \u2014 ${couple} (first wedding free)` },
      }),
    ]);
    await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Published \u201C${couple}\u201D \u2014 first wedding free`, targetId: wedding.id });
    return { ok: true as const };
  }

  const amountCents = settings.pricePerWeddingCents;

  if (!stripeEnabled) {
    await prisma.$transaction([
      prisma.wedding.update({ where: { id: wedding.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
      prisma.studio.update({ where: { id: studioId }, data: { freeWeddingUsed: true } }),
      prisma.payment.create({
        data: { studioId, weddingId: wedding.id, amountCents, status: "PAID", description: `Publish \u2014 ${couple} (dev mode, Stripe not configured)` },
      }),
    ]);
    await logAudit({ actorType: "PLANNER", actorName, studioId, action: `Published \u201C${couple}\u201D \u2014 ${money(amountCents)} (dev mode)`, targetId: wedding.id });
    return { ok: true as const };
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "usd",
        unit_amount: amountCents,
        product_data: { name: `Publish wedding \u2014 ${couple}`, description: "One-time publishing fee" },
      },
    }],
    metadata: { weddingId: wedding.id, studioId },
    success_url: `${process.env.APP_URL}/studio/weddings?published=1`,
    cancel_url: `${process.env.APP_URL}/studio/weddings?canceled=1`,
  });

  await prisma.payment.create({
    data: {
      studioId, weddingId: wedding.id, amountCents, status: "PENDING",
      description: `Publish \u2014 ${couple}`, stripeSessionId: session.id,
    },
  });
  return { ok: false as const, checkoutUrl: session.url! };
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
