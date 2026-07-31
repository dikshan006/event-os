import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { money, fmtDate } from "@/lib/utils";

export default async function AdminPayments() {
  await requireAdmin();
  const payments = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, include: { studio: true } });
  return (
    <>
      <PageHead eyebrow="Payments" title="Payments" sub="Every charge on the platform. Refunds are issued via Stripe and reconciled by webhook." />
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Planner</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            {payments.map(p => (
              <tr key={p.id}>
                <td className="meta">{fmtDate(p.createdAt)}</td>
                <td style={{ fontWeight: 500 }}>{p.studio.name}</td>
                <td className="meta">{p.description}</td>
                <td>{money(p.amountCents)}</td>
                <td><StatusChip s={p.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
