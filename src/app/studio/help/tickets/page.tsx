import Link from "next/link";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { TicketStatusChip, TicketRef } from "@/components/help/Ticket";
import { listMyTickets, CATEGORY_LABELS, LIVE_STATUSES } from "@/server/services/support";

export const metadata: Metadata = {
  title: "My support tickets — EventOS",
  robots: { index: false, follow: false },
};

/**
 * The planner's own tickets.
 *
 * `listMyTickets` takes `studioId` from `requireStudio()` and filters on it, so
 * this page has no way to show another studio's ticket — there is no id in the
 * URL and no parameter to tamper with. The security property is a consequence
 * of the query, not of anything this file does.
 *
 * Split into open and settled rather than paginated by status: a planner has a
 * handful of tickets, and the only question they arrive with is "what is still
 * going on", which a tab would hide behind a click.
 */
export default async function MyTickets() {
  const { studioId } = await requireStudio();
  const tickets = await listMyTickets(studioId);

  const live = tickets.filter(t => LIVE_STATUSES.includes(t.status));
  const settled = tickets.filter(t => !LIVE_STATUSES.includes(t.status));

  return (
    <>
      <PageHead
        eyebrow="Help"
        title="My support tickets"
        sub="Everything you have asked us, and everything we have said back."
        back="/studio/help"
        actions={
          <Link href="/studio/help/tickets/new" className="btn btn-primary">
            New ticket
          </Link>
        }
      />

      {tickets.length === 0 ? (
        <div className="card empty">
          <p>You have not opened any support tickets.</p>
          <p className="meta" style={{ marginTop: 8 }}>
            If something is not working or you cannot find an answer in the{" "}
            <Link href="/studio/help">Help Center</Link>, open one and we will help.
          </p>
        </div>
      ) : (
        <div className="tk-lists">
          {live.length > 0 && (
            <section>
              <h2 className="section-t">Open</h2>
              <TicketList tickets={live} />
            </section>
          )}
          {settled.length > 0 && (
            <section>
              <h2 className="section-t">Previous</h2>
              <TicketList tickets={settled} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

type Row = Awaited<ReturnType<typeof listMyTickets>>[number];

function TicketList({ tickets }: { tickets: Row[] }) {
  return (
    <ul className="tk-list">
      {tickets.map(t => (
        <li key={t.id}>
          <Link href={`/studio/help/tickets/${t.id}`}>
            <span className="tk-list-main">
              <b>{t.subject}</b>
              <em>
                <TicketRef id={t.id} /> · {CATEGORY_LABELS[t.category]} ·{" "}
                {t._count.messages} message{t._count.messages === 1 ? "" : "s"}
              </em>
            </span>
            <span className="tk-list-side">
              <TicketStatusChip status={t.status} />
              <time className="meta" dateTime={t.lastMessageAt.toISOString()}>
                {t.lastMessageAt.toLocaleDateString("en-US", { day: "numeric", month: "short" })}
              </time>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
