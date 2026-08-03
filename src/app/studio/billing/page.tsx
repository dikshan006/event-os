import { requireStudio } from "@/server/services/context";
import { PageHead, StatusChip } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSettings } from "@/server/services/settings";
import { money, fmtDate } from "@/lib/utils";

export default async function BillingPage() {
  const { studioId, studio } = await requireStudio();
  const [payments, settings] = await Promise.all([
    prisma.payment.findMany({ where: { studioId }, orderBy: { createdAt: "desc" } }),
    getSettings(),
  ]);

  return (
    <>
      <PageHead back="/studio" eyebrow="Billing" title="Payments & Receipts"
        sub={`Pricing: ${settings.firstWeddingFree ? "first published wedding free, then " : ""}${money(settings.pricePerWeddingCents)} per published wedding.`} />
      {!studio.freeWeddingUsed && settings.firstWeddingFree && (
        <div className="note" style={{ marginBottom: 20 }}>Your first published wedding is on us.</div>
      )}
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
    </>
  );
}
