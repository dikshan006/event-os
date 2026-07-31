import { requireAdmin } from "@/server/services/context";
import { prisma } from "@/lib/db";
import { PageHead } from "@/components/ui";
import { TEMPLATES } from "@/lib/utils";

export default async function AdminTemplates() {
  await requireAdmin();
  const counts = await prisma.wedding.groupBy({ by: ["template"], _count: true });
  const usage = Object.fromEntries(counts.map(c => [c.template, c._count]));
  return (
    <>
      <PageHead eyebrow="Templates" title="Template Manager"
        sub="Three fixed, premium templates. Planners personalize content — the layouts never break." />
      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {Object.entries(TEMPLATES).map(([k, T]) => (
          <div key={k} className="card" style={{ overflow: "hidden" }}>
            <div style={{ height: 8, background: T.color }} />
            <div className="pad" style={{ display: "grid", gap: 8 }}>
              <div className="row between">
                <div className="serif" style={{ fontSize: 21 }}>{T.name}</div>
                <span className="chip sage"><i className="dot" />Live</span>
              </div>
              <span className="meta">{T.desc}</span>
              <span className="meta">{usage[k] ?? 0} wedding{(usage[k] ?? 0) === 1 ? "" : "s"} on this template</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
