import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { globalPrices } from "@/server/services/pricing";
import { setPrice } from "@/server/services/pricing-admin";
import { logAudit } from "@/server/services/audit";
import { money } from "@/lib/utils";
import { revalidatePath } from "next/cache";

/**
 * Platform defaults.
 *
 * Changing a price here inserts a new version and archives the old one, so it
 * applies to studios that have not been sold anything yet and to nobody else.
 * A studio already on a subscription keeps the price it subscribed at, because
 * the subscription points at the archived row rather than at "whatever the
 * default currently is" — which is the difference between a plan and a number
 * that can move under a customer without warning.
 *
 * Per-studio overrides live on the individual planner's page rather than here,
 * next to the studio they apply to.
 */
export default async function AdminSettings() {
  await requireAdmin();
  const [settings, prices] = await Promise.all([getSettings(), globalPrices()]);

  async function savePrices(formData: FormData) {
    "use server";
    // `setPrice` checks for an admin session itself; this is the outer gate.
    await requireAdmin();

    const dollars = (name: string) => Number(formData.get(name));
    const cents = (name: string) => Math.round(dollars(name) * 100);

    /**
     * Only write what actually moved.
     *
     * Every save would otherwise archive all three rows and insert three new
     * ones, so the price history would fill with versions nobody chose and the
     * audit log would claim three decisions were made when one was.
     */
    const changes: Array<[Parameters<typeof setPrice>[0]["kind"], number]> = [];
    if (Number.isFinite(dollars("perWedding")) && cents("perWedding") !== prices.perWedding?.amountCents) {
      changes.push(["PER_WEDDING", cents("perWedding")]);
    }
    if (Number.isFinite(dollars("monthly")) && cents("monthly") !== prices.monthly?.amountCents) {
      changes.push(["MONTHLY", cents("monthly")]);
    }
    if (Number.isFinite(dollars("yearly")) && cents("yearly") !== prices.yearly?.amountCents) {
      changes.push(["YEARLY", cents("yearly")]);
    }

    for (const [kind, amountCents] of changes) {
      await setPrice({ kind, amountCents });
    }

    revalidatePath("/admin/settings");
  }

  async function saveFirstFree(formData: FormData) {
    "use server";
    const { user } = await requireAdmin();
    const firstFree = formData.get("firstFree") === "on";
    await prisma.platformSetting.update({ where: { id: 1 }, data: { firstWeddingFree: firstFree } });
    await logAudit({
      actorType: "ADMIN",
      actorName: user.name,
      action: `First published wedding is now ${firstFree ? "free" : "chargeable"}`,
    });
    revalidatePath("/admin/settings");
  }

  return (
    <>
      <PageHead
        back="/admin"
        eyebrow="Settings"
        title="Platform Pricing"
        sub="Defaults for new customers. Existing subscriptions keep the price they signed up at."
      />

      <form action={savePrices} className="card pad frm" style={{ maxWidth: 560, marginBottom: 24 }}>
        <div className="field">
          <label>Per published wedding ($)</label>
          <input
            className="inp" name="perWedding" type="number" step="1" min="0"
            defaultValue={prices.perWedding ? prices.perWedding.amountCents / 100 : ""}
          />
        </div>
        <div className="field">
          <label>Monthly subscription ($ / month)</label>
          <input
            className="inp" name="monthly" type="number" step="1" min="0"
            defaultValue={prices.monthly ? prices.monthly.amountCents / 100 : ""}
          />
        </div>
        <div className="field">
          <label>Yearly subscription ($ / year)</label>
          <input
            className="inp" name="yearly" type="number" step="1" min="0"
            defaultValue={prices.yearly ? prices.yearly.amountCents / 100 : ""}
          />
        </div>

        <div className="note">
          Changing a price here affects <b>new</b> customers only. Studios already
          subscribed stay on {" "}
          {prices.monthly ? money(prices.monthly.amountCents) : "their current price"}
          {" "}or whatever they signed up at, until they cancel and resubscribe.
          To price one studio differently, open that planner and set a custom price there.
        </div>

        <div><button className="btn btn-primary" type="submit">Save pricing</button></div>
      </form>

      <form action={saveFirstFree} className="card pad frm" style={{ maxWidth: 560 }}>
        <label className="check">
          <input type="checkbox" name="firstFree" defaultChecked={settings.firstWeddingFree} />
          {" "}First published wedding is free
        </label>
        <div className="note">
          Applies to studios without a subscription. Subscribers publish freely
          anyway, so their free wedding stays unused.
        </div>
        <div><button className="btn btn-outline" type="submit">Save</button></div>
      </form>
    </>
  );
}
