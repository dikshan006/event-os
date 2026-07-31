import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";

export default async function AdminActivity() {
  await requireAdmin();
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <>
      <PageHead eyebrow="Activity" title="Activity Log" sub="Every important action across the platform, newest first." />
      <div className="card" style={{ overflow: "hidden" }}>
        <table className="tbl">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th></tr></thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td className="meta" style={{ whiteSpace: "nowrap" }}>{l.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                <td style={{ fontWeight: 500 }}>{l.actorName ?? l.actorType}</td>
                <td className="meta">{l.action}</td>
              </tr>
            ))}
            {!logs.length && <tr><td colSpan={3}><div className="empty">No activity yet.</div></td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
