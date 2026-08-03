import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { money, fmtDate, TEMPLATES } from "@/lib/utils";

export default async function PlannerDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const studio = await prisma.studio.findUnique({
    where: { id },
    include: {
      users: true,
      weddings: { orderBy: { createdAt: "desc" }, include: { _count: { select: { guests: true } } } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!studio) notFound();
  const [guestCount, activity, emailStats] = await Promise.all([
    prisma.guest.count({ where: { studioId: id } }),
    prisma.auditLog.findMany({ where: { studioId: id }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.emailLog.groupBy({ by: ["status"], where: { studioId: id }, _count: true }),
  ]);
  const owner = studio.users.find(u => u.role === "PLANNER");
  const revenue = studio.payments.filter(p => p.status === "PAID").reduce((a, p) => a + p.amountCents, 0);
  const emailOf = (s: string) => emailStats.find(e => e.status === s)?._count ?? 0;

  return (
    <>
      <Link className="btn btn-ghost btn-sm" href="/admin/planners" style={{ marginBottom: 10 }}>← All planners</Link>
      <PageHead back="/admin/planners" eyebrow="Planner profile" title={studio.name}
        sub={`${studio.website ?? ""}${studio.instagram ? ` · ${studio.instagram}` : ""}`}
        actions={<StatusChip s={studio.status} />} />
      <div className="stats">
        <div className="card stat"><div className="v">{studio.weddings.length}</div><div className="l">Weddings</div>
          <div className="d">{studio.weddings.filter(w => w.status === "PUBLISHED").length} published</div></div>
        <div className="card stat"><div className="v">{guestCount}</div><div className="l">Guests</div></div>
        <div className="card stat"><div className="v">{money(revenue)}</div><div className="l">Revenue</div>
          <div className="d">{studio.freeWeddingUsed ? "Free wedding used" : "Free wedding available"}</div></div>
        <div className="card stat"><div className="v">{emailOf("SENT")}</div><div className="l">Emails delivered</div>
          <div className="d">{emailOf("FAILED")} failed · {emailOf("SKIPPED")} skipped</div></div>
      </div>

      <div className="split">
        <div style={{ display: "grid", gap: 22 }}>
          <div>
            <h2 className="section-t">Weddings</h2>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th>Couple</th><th>Template</th><th>Date</th><th>Guests</th><th>Status</th></tr></thead>
                <tbody>
                  {studio.weddings.map(w => (
                    <tr key={w.id}>
                      <td style={{ fontWeight: 500 }}>{w.partnerOne} &amp; {w.partnerTwo}</td>
                      <td className="meta">{TEMPLATES[w.template].name}</td>
                      <td className="meta">{fmtDate(w.date)}</td>
                      <td className="meta">{w._count.guests}</td>
                      <td><StatusChip s={w.status} /></td>
                    </tr>
                  ))}
                  {!studio.weddings.length && <tr><td colSpan={5}><div className="empty">No weddings yet.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h2 className="section-t">Billing history</h2>
            <div className="card" style={{ overflow: "hidden" }}>
              <table className="tbl">
                <thead><tr><th>Date</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {studio.payments.map(p => (
                    <tr key={p.id}>
                      <td className="meta">{fmtDate(p.createdAt)}</td>
                      <td>{p.description}</td>
                      <td>{money(p.amountCents)}</td>
                      <td><StatusChip s={p.status} /></td>
                    </tr>
                  ))}
                  {!studio.payments.length && <tr><td colSpan={4}><div className="empty">No payments.</div></td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 22 }}>
          <div className="card pad">
            <h2 className="section-t" style={{ fontSize: 20 }}>Account</h2>
            <div className="frm" style={{ gap: 8 }}>
              <div className="row between"><span className="meta">Owner</span><span>{owner?.name ?? "—"}</span></div>
              <div className="row between"><span className="meta">Email</span><span>{owner?.email ?? "—"}</span></div>
              <div className="row between"><span className="meta">Created</span><span>{fmtDate(studio.createdAt)}</span></div>
              <div className="row between"><span className="meta">Last login</span>
                <span>{owner?.lastLoginAt ? fmtDate(owner.lastLoginAt) : "Never"}</span></div>
              <div className="row between"><span className="meta">Brand color</span>
                <span className="row"><i style={{ width: 14, height: 14, borderRadius: 99, background: studio.brandColor, display: "inline-block" }} />{studio.brandColor}</span></div>
              <div className="row between"><span className="meta">Contact</span><span>{studio.contactEmail ?? "—"}</span></div>
            </div>
          </div>
          <div className="card pad">
            <h2 className="section-t" style={{ fontSize: 20 }}>Recent activity</h2>
            <div style={{ display: "grid", gap: 10 }}>
              {activity.map(a => (
                <div key={a.id}>
                  <div style={{ fontSize: 13 }}>{a.action}</div>
                  <div className="meta">{a.actorName ?? a.actorType} · {a.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </div>
              ))}
              {!activity.length && <span className="meta">No activity yet.</span>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
