import { redirect } from "next/navigation";
import { requireStudio } from "@/server/services/context";
import { PageHead, StatusChip } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { resolveAllPrices } from "@/server/services/pricing";
import {
  studioSubscription, startSubscription, billingPortalUrl, isSubscriptionKind,
} from "@/server/services/subscriptions";
import { money, fmtDate } from "@/lib/utils";

/**
 * What this studio pays, and what it has paid.
 *
 * Every number on this page is resolved server-side from the studio in the
 * session — `resolveAllPrices` prefers a custom price the admin has set for
 * this studio and falls back to the platform default. There is no price in any
 * form, link or hidden field, so there is nothing here for a planner to edit
 * into a cheaper number: the only thing they choose is *which* plan, and the
 * cost of that plan is looked up again on the server before checkout opens.
 *
 * Card details, cancellation and invoice PDFs all live in Stripe's Billing
 * Portal rather than in pages here, which keeps card data on Stripe's side of
 * the boundary entirely.
 */
export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ subscribed?: string; canceled?: string }>;
}) {
  const { studioId, studio, user } = await requireStudio();
  const sp = await searchParams;

  const [payments, settings, prices, subscription] = await Promise.all([
    prisma.payment.findMany({
      where: { studioId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getSettings(),
    resolveAllPrices(studioId),
    studioSubscription(studioId),
  ]);

  const entitled = subscription?.status === "ACTIVE" || subscription?.status === "TRIALING";
  const customPrices = [prices.perWedding, prices.monthly, prices.yearly].some(
    p => p.studioId === studioId,
  );

  /**
   * Subscribe.
   *
   * The form sends a plan *kind*, never an amount and never a Stripe price id.
   * `startSubscription` looks the price up from the studio in its own session
   * check, so a tampered form can at most pick the other interval — which the
   * page already offers.
   */
  async function subscribeAction(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const kind = formData.get("kind");
    if (!isSubscriptionKind(kind)) redirect("/studio/billing");

    const result = await startSubscription(studioId, kind, user.name);
    if ("unavailable" in result) redirect("/studio/billing?canceled=1");
    if (!result.ok) redirect(result.checkoutUrl);
    redirect("/studio/billing?subscribed=1");
  }

  /** Open the Stripe portal. Customer id comes from the studio row, not input. */
  async function portalAction() {
    "use server";
    const { studioId } = await requireStudio();
    const url = await billingPortalUrl(studioId);
    redirect(url ?? "/studio/billing");
  }

  return (
    <>
      <PageHead
        back="/studio"
        eyebrow="Billing"
        title="Plan & Payments"
        sub={
          entitled
            ? "Your subscription covers every wedding you publish."
            : `${settings.firstWeddingFree ? "First published wedding free, then " : ""}${money(prices.perWedding.amountCents)} per published wedding.`
        }
      />

      {sp.subscribed && (
        <div className="note" style={{ marginBottom: 20 }}>
          Thanks — your subscription is being set up. Refresh in a moment if it still shows as inactive.
        </div>
      )}
      {sp.canceled && (
        <div className="note" style={{ marginBottom: 20 }}>
          Checkout canceled — nothing has changed on your account.
        </div>
      )}
      {customPrices && (
        <div className="note" style={{ marginBottom: 20 }}>
          Your studio is on custom pricing agreed with EventOS.
        </div>
      )}

      {/* ───────────────────────────────────────────────── current plan ── */}
      <section className="card pad" style={{ marginBottom: 24 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 className="sec-t">Your plan</h2>
          {subscription && <StatusChip s={subscription.status} />}
        </div>

        {entitled && subscription ? (
          <>
            <p style={{ fontSize: 20, fontWeight: 500 }}>
              {subscription.pricePlan.kind === "YEARLY" ? "Yearly" : "Monthly"} —{" "}
              {money(subscription.pricePlan.amountCents)}
              <span className="meta">
                {subscription.pricePlan.kind === "YEARLY" ? " / year" : " / month"}
              </span>
            </p>
            <p className="meta" style={{ marginTop: 6 }}>
              {subscription.cancelAtPeriodEnd
                ? `Cancels on ${subscription.currentPeriodEnd ? fmtDate(subscription.currentPeriodEnd) : "the end of the period"}.`
                : subscription.currentPeriodEnd
                  ? `Renews on ${fmtDate(subscription.currentPeriodEnd)}.`
                  : "Active."}
            </p>
            {/* The price they were sold on never moves, even if the platform
                default does. Saying so is the difference between a plan and a
                number that might change without warning. */}
            <p className="meta" style={{ marginTop: 6 }}>
              This price is locked for as long as the subscription stays active.
            </p>
            <form action={portalAction} style={{ marginTop: 18 }}>
              <button className="btn btn-primary" type="submit">Manage billing</button>
            </form>
          </>
        ) : (
          <>
            {subscription && (
              <p className="note" style={{ marginBottom: 16 }}>
                {subscription.status === "PAST_DUE" || subscription.status === "UNPAID"
                  ? "We could not take your last payment. Update your card to keep publishing."
                  : "Your subscription is not currently active."}
              </p>
            )}
            <p style={{ marginBottom: 4 }}>
              <b>Pay per wedding</b> — {money(prices.perWedding.amountCents)} each time you publish.
            </p>
            <p className="meta" style={{ marginBottom: 18 }}>
              No subscription needed. Switch to a plan below if you publish often.
            </p>

            <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
              <form action={subscribeAction}>
                <input type="hidden" name="kind" value="MONTHLY" />
                <button className="btn btn-outline" type="submit">
                  Monthly — {money(prices.monthly.amountCents)}/mo
                </button>
              </form>
              <form action={subscribeAction}>
                <input type="hidden" name="kind" value="YEARLY" />
                <button className="btn btn-primary" type="submit">
                  Yearly — {money(prices.yearly.amountCents)}/yr
                </button>
              </form>
              {subscription && (
                <form action={portalAction}>
                  <button className="btn btn-outline" type="submit">Manage billing</button>
                </form>
              )}
            </div>
            <p className="meta" style={{ marginTop: 14 }}>
              Both plans include unlimited published weddings.
            </p>
          </>
        )}
      </section>

      {!studio.freeWeddingUsed && settings.firstWeddingFree && !entitled && (
        <div className="note" style={{ marginBottom: 20 }}>Your first published wedding is on us.</div>
      )}

      {/* ──────────────────────────────────────────────────── history ── */}
      <h2 className="sec-t" style={{ marginBottom: 12 }}>Payment history</h2>
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td className="meta">{fmtDate(p.createdAt)}</td>
                <td style={{ fontWeight: 500 }}>{p.description}</td>
                <td>{money(p.amountCents)}</td>
                <td><StatusChip s={p.status} /></td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={4}><div className="empty">No payments yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
      <p className="meta" style={{ marginTop: 10 }}>
        Signed in as {user.email}. Questions about a charge? Open a ticket from the Help Center.
      </p>
    </>
  );
}
