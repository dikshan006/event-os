import Link from "next/link";
import { requireStudio } from "@/server/services/context";
import { listWeddings } from "@/server/services/weddings";
import { PageHead, StatusChip } from "@/components/ui";
import { fmtDate, TEMPLATES } from "@/lib/utils";
import { prisma } from "@/lib/db";

export default async function StudioDashboard() {
  const { user, studio, studioId } = await requireStudio();
  const [weddings, guestCount, pendingInvites, rsvpBreakdown, emailStats, activity] = await Promise.all([
    listWeddings(studioId),
    prisma.guest.count({ where: { studioId } }),
    prisma.guest.count({ where: { studioId, invitedAt: null } }),
    prisma.rsvp.groupBy({ by: ["status"], where: { guest: { studioId } }, _count: true }),
    prisma.emailLog.groupBy({ by: ["status"], where: { studioId }, _count: true }),
    prisma.auditLog.findMany({ where: { studioId }, orderBy: { createdAt: "desc" }, take: 6 }),
  ]);
  const rsvpOf = (s: string) => rsvpBreakdown.find(r => r.status === s)?._count ?? 0;
  const emailOf = (s: string) => emailStats.find(e => e.status === s)?._count ?? 0;
  const responded = rsvpBreakdown.reduce((a, r) => a + r._count, 0);
  const published = weddings.filter(w => w.status === "PUBLISHED").length;

  return (
    <>
      <PageHead
        eyebrow={studio.name}
        title={`Good morning, ${user.name.split(" ")[0]}`}
        sub="Here's what's happening across your weddings today."
        actions={<Link className="btn btn-primary" href="/studio/weddings/new">New Wedding</Link>}
      />
      <div className="stats">
        <div className="card stat"><div className="v">{weddings.length}</div><div className="l">Weddings</div>
          <div className="d">{published} published · {weddings.length - published} draft</div></div>
        <div className="card stat"><div className="v">{guestCount}</div><div className="l">Total guests</div>
          <div className="d">{pendingInvites} awaiting an invitation</div></div>
        <div className="card stat"><div className="v">{responded}</div><div className="l">RSVPs received</div>
          <div className="d">{rsvpOf("ACCEPTED")} accepted · {rsvpOf("DECLINED")} declined · {rsvpOf("MAYBE")} maybe</div></div>
        <div className="card stat"><div className="v">{emailOf("SENT")}</div><div className="l">Emails delivered</div>
          <div className="d">{emailOf("FAILED")} failed{emailOf("SKIPPED") ? ` · ${emailOf("SKIPPED")} skipped` : ""}</div></div>
      </div>

      <div className="split">
        <div>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h2 className="section-t" style={{ margin: 0 }}>Your weddings</h2>
            <Link className="btn btn-ghost btn-sm" href="/studio/weddings">Manage weddings →</Link>
          </div>
          <div className="grid">
            {weddings.map(w => {
              const T = TEMPLATES[w.template];
              const rsvps = w.guests.filter(g => g.rsvp).length;
              const pct = w._count.guests ? Math.round((rsvps / w._count.guests) * 100) : 0;
              return (
                <div key={w.id} className="card" style={{ overflow: "hidden" }}>
                  <div style={{ height: 8, background: T.color }} />
                  <div className="pad" style={{ display: "grid", gap: 12 }}>
                    <div className="row between">
                      <div className="serif" style={{ fontSize: 24 }}>{w.partnerOne} &amp; {w.partnerTwo}</div>
                      <StatusChip s={w.status} />
                    </div>
                    <div className="meta">{T.name} · {fmtDate(w.date)}</div>
                    <div>
                      <div className="row between" style={{ marginBottom: 6 }}>
                        <span className="meta">{w._count.guests} guests</span>
                        <span className="meta">{rsvps} RSVPs · {pct}%</span>
                      </div>
                      <div className="bar"><i style={{ width: `${pct}%`, background: T.color }} /></div>
                    </div>
                    <div className="row">
                      <Link className="btn btn-outline btn-sm grow" href={`/studio/weddings/${w.id}`}>Open wedding</Link>
                      <a className="btn btn-ghost btn-sm" href={`/w/${w.slug}`} target="_blank">Website ↗</a>
                    </div>
                  </div>
                </div>
              );
            })}
            {!weddings.length && <div className="card empty" style={{ gridColumn: "1/-1" }}>No weddings yet — create your first one.</div>}
          </div>
        </div>

        <div className="card pad" style={{ position: "sticky", top: 24 }}>
          <h2 className="section-t" style={{ fontSize: 20 }}>Recent activity</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {activity.map(a => (
              <div key={a.id}>
                <div style={{ fontSize: 13 }}>{a.action}</div>
                <div className="meta">{a.actorName ?? a.actorType} · {a.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
              </div>
            ))}
            {!activity.length && <span className="meta">Actions across your studio will appear here.</span>}
          </div>
        </div>
      </div>
    </>
  );
}
