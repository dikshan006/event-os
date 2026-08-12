import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { money, fmtDate } from "@/lib/utils";
import { getSettings } from "@/server/services/settings";
import { globalPrices } from "@/server/services/pricing";

export default async function AdminDashboard() {
  await requireAdmin();
  const [revenue, studios, activeStudios, weddings, published, guests, rsvps, payments, settings, prices, subscribers] = await Promise.all([
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amountCents: true } }),
    prisma.studio.count(),
    prisma.studio.count({ where: { status: "ACTIVE" } }),
    prisma.wedding.count(),
    prisma.wedding.count({ where: { status: "PUBLISHED" } }),
    prisma.guest.count(),
    prisma.rsvp.count(),
    prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { studio: true } }),
    getSettings(),
    globalPrices(),
    prisma.subscription.count({ where: { status: { in: ["ACTIVE", "TRIALING"] } } }),
  ]);

  return (
    <>
      <PageHead eyebrow="Platform Admin" title="Platform Overview" sub="Health of the entire platform at a glance." />
      <div className="stats">
        <div className="card stat"><div className="v">{money(revenue._sum.amountCents ?? 0)}</div><div className="l">Total revenue</div>
          {/* The current default, read from the live PricePlan rather than the
              superseded settings column. Studios on a custom price or an older
              subscription are not paying this, which is why it says "default". */}
          <div className="d">{settings.firstWeddingFree ? "First wedding free · " : ""}{prices.perWedding ? `${money(prices.perWedding.amountCents)} per publish` : "no price set"} by default</div></div>
        <div className="card stat"><div className="v">{studios}</div><div className="l">Planner studios</div><div className="d">{activeStudios} active · {subscribers} subscribed</div></div>
        <div className="card stat"><div className="v">{weddings}</div><div className="l">Total weddings</div><div className="d">{published} published</div></div>
        <div className="card stat"><div className="v">{guests}</div><div className="l">Guests</div><div className="d">{rsvps} RSVPs received</div></div>
      </div>
      <h2 className="section-t">Recent payments</h2>
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
            {!payments.length && <tr><td colSpan={5}><div className="empty">No payments yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
