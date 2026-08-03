import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { logAudit } from "@/server/services/audit";
import { revalidatePath } from "next/cache";

export default async function AdminSettings() {
  await requireAdmin();
  const settings = await getSettings();

  async function save(formData: FormData) {
    "use server";
    await requireAdmin();
    const price = Math.max(0, Math.round(Number(formData.get("price")) * 100));
    const firstFree = formData.get("firstFree") === "on";
    await prisma.platformSetting.update({ where: { id: 1 }, data: { pricePerWeddingCents: price, firstWeddingFree: firstFree } });
    await logAudit({ actorType: "ADMIN", actorName: "Platform Owner", action: `Updated pricing — $${(price / 100).toFixed(2)}${firstFree ? " · first wedding free" : ""}` });
    revalidatePath("/admin/settings");
  }

  return (
    <>
      <PageHead back="/admin" eyebrow="Settings" title="Platform Settings" sub="Pricing applies instantly to every planner's next publish." />
      <form action={save} className="card pad frm" style={{ maxWidth: 520 }}>
        <div className="field"><label>Price per published wedding ($)</label>
          <input className="inp" name="price" type="number" step="1" min="0" defaultValue={settings.pricePerWeddingCents / 100} /></div>
        <label className="check"><input type="checkbox" name="firstFree" defaultChecked={settings.firstWeddingFree} /> First published wedding is free</label>
        <div className="note">Subscription plans (monthly studio pricing) ship in a later phase — the billing model already supports them.</div>
        <div><button className="btn btn-primary" type="submit">Save settings</button></div>
      </form>
    </>
  );
}
