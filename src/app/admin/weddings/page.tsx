import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead, StatusChip } from "@/components/ui";
import { fmtDate, TEMPLATES } from "@/lib/utils";

export default async function AdminWeddings() {
  await requireAdmin();
  const weddings = await prisma.wedding.findMany({ orderBy: { createdAt: "desc" }, include: { studio: true } });
  return (
    <>
      <PageHead back="/admin" eyebrow="Weddings" title="All Weddings" sub="Every wedding across every planner studio." />
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>Couple</th><th>Planner</th><th>Template</th><th>Date</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {weddings.map(w => (
              <tr key={w.id}>
                <td style={{ fontWeight: 500 }}>{w.partnerOne} &amp; {w.partnerTwo}</td>
                <td className="meta">{w.studio.name}</td>
                <td className="meta">{TEMPLATES[w.template].name}</td>
                <td className="meta">{fmtDate(w.date)}</td>
                <td><StatusChip s={w.status} /></td>
                <td style={{ textAlign: "right" }}><a className="btn btn-outline btn-sm" href={`/w/${w.slug}`} target="_blank">View site ↗</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
