import Link from "next/link";
import type { Metadata } from "next";
import type { TicketStatus } from "@prisma/client";
import { requireAdmin } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { TicketStatusChip, TicketPriorityChip, TicketRef } from "@/components/help/Ticket";
import {
  listAllTickets, ticketCounts, CATEGORY_LABELS, STATUS_LABELS, LIVE_STATUSES,
} from "@/server/services/support";

export const metadata: Metadata = {
  title: "Support — EventOS Admin",
  robots: { index: false, follow: false },
};

const ALL_STATUSES: TicketStatus[] = [
  "OPEN", "IN_PROGRESS", "WAITING_FOR_PLANNER", "RESOLVED", "CLOSED",
];

/**
 * The support queue.
 *
 * Reachable only under `/admin`, which the layout gates with `requireAdmin()`.
 * That is also called here rather than relied upon: a page is not a route
 * handler, but the habit of re-checking at the point of use is what stops the
 * one page that gets moved out of the tree from becoming public.
 *
 * Sorted so anything still live sits above anything settled, oldest activity
 * first within that — a queue answers "what needs me next", which is a
 * different question from "what happened most recently".
 */
export default async function AdminSupport({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;

  const filter = ALL_STATUSES.includes(status as TicketStatus)
    ? (status as TicketStatus)
    : undefined;

  const [tickets, counts] = await Promise.all([
    listAllTickets({ status: filter, q: q?.trim() || undefined }),
    ticketCounts(),
  ]);

  const countFor = (s: TicketStatus) =>
    counts.find(c => c.status === s)?._count._all ?? 0;
  const liveTotal = LIVE_STATUSES.reduce((n, s) => n + countFor(s), 0);

  return (
    <>
      <PageHead
        eyebrow="Support"
        title="Support tickets"
        sub={
          liveTotal === 0
            ? "Nothing waiting."
            : `${liveTotal} ticket${liveTotal === 1 ? "" : "s"} still open across all planners.`
        }
      />

      <div className="tk-filters">
        <Link
          href="/admin/support"
          className={`btn btn-sm ${!filter ? "btn-primary" : "btn-outline"}`}
        >
          All
        </Link>
        {ALL_STATUSES.map(s => (
          <Link
            key={s}
            href={`/admin/support?status=${s}`}
            className={`btn btn-sm ${filter === s ? "btn-primary" : "btn-outline"}`}
          >
            {STATUS_LABELS[s]}
            <span className="tk-count">{countFor(s)}</span>
          </Link>
        ))}
      </div>

      <form className="tk-search" action="/admin/support">
        {filter && <input type="hidden" name="status" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search subject, studio or email…"
          aria-label="Search tickets"
        />
        <button type="submit" className="btn btn-outline btn-sm">Search</button>
      </form>

      {tickets.length === 0 ? (
        <div className="card empty">
          {q || filter ? "No tickets match that." : "No tickets yet."}
        </div>
      ) : (
        <div className="card tk-table-wrap">
          <table className="tk-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Planner</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Opened</th>
                <th>Status</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/admin/support/${t.id}`} className="tk-idlink">
                      <TicketRef id={t.id} />
                    </Link>
                  </td>
                  <td>
                    <b>{t.studio.name}</b>
                    <span className="meta tk-email">{t.user.email}</span>
                  </td>
                  <td>
                    <Link href={`/admin/support/${t.id}`}>{t.subject}</Link>
                    <span className="meta">
                      {t._count.messages} message{t._count.messages === 1 ? "" : "s"}
                    </span>
                  </td>
                  <td className="meta">{CATEGORY_LABELS[t.category]}</td>
                  <td className="meta">
                    <time dateTime={t.createdAt.toISOString()}>
                      {t.createdAt.toLocaleDateString("en-US", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </time>
                  </td>
                  <td><TicketStatusChip status={t.status} /></td>
                  <td><TicketPriorityChip priority={t.priority} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
