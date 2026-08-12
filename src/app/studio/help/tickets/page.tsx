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
 * Each row is a plain block with an explicit **Open ticket →** button rather
 * than a card that happens to be wrapped in a link. A whole-card link looks
 * identical to a card that is not clickable, so the only way to find out is to
 * try it — and the preview text inside would be unselectable, which is
 * infuriating when the thing you want is to copy what you wrote. One obvious
 * target, and the rest of the row behaves like text because it is text.
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
          <p style={{ marginTop: 18 }}>
            <Link href="/studio/help/tickets/new" className="btn btn-primary">
              Contact EventOS Support
            </Link>
          </p>
        </div>
      ) : (
        <div className="tk-lists">
          {live.length > 0 && (
            <section>
              <div className="sec-head">
                <h2 className="sec-t">Open</h2>
                <span className="meta">{live.length} still going</span>
              </div>
              <TicketList tickets={live} />
            </section>
          )}
          {settled.length > 0 && (
            <section>
              <div className="sec-head">
                <h2 className="sec-t">Previous</h2>
                <span className="meta">{settled.length} resolved or closed</span>
              </div>
              <TicketList tickets={settled} />
            </section>
          )}
        </div>
      )}
    </>
  );
}

type Row = Awaited<ReturnType<typeof listMyTickets>>[number];

/** Trim to a preview without cutting a word in half. */
function preview(body: string, max = 150) {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : max)}…`;
}

function TicketList({ tickets }: { tickets: Row[] }) {
  return (
    <ul className="tk-list">
      {tickets.map(t => {
        const last = t.messages[0];
        return (
          <li key={t.id} className="card tk-row">
            <div className="tk-row-top">
              <h3 className="tk-row-subject">{t.subject}</h3>
              <TicketStatusChip status={t.status} />
            </div>

            <p className="tk-row-meta">
              <TicketRef id={t.id} />
              <span aria-hidden="true"> · </span>
              {CATEGORY_LABELS[t.category]}
              <span aria-hidden="true"> · </span>
              opened{" "}
              <time dateTime={t.createdAt.toISOString()}>
                {t.createdAt.toLocaleDateString("en-US", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </time>
              <span aria-hidden="true"> · </span>
              {t._count.messages} message{t._count.messages === 1 ? "" : "s"}
            </p>

            {last && (
              <p className="tk-row-preview">
                <b>{last.authorType === "ADMIN" ? "EventOS Support" : "You"}:</b>{" "}
                {preview(last.body)}
              </p>
            )}

            <div className="tk-row-foot">
              <span className="meta">
                Last updated{" "}
                <time dateTime={t.lastMessageAt.toISOString()}>
                  {t.lastMessageAt.toLocaleString("en-US", {
                    day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                  })}
                </time>
              </span>
              {/* Same weight as "Send reply" on the thread page: this is the
                  one action the row exists for. */}
              <Link href={`/studio/help/tickets/${t.id}`} className="btn btn-primary btn-lg">
                Open ticket <span aria-hidden="true">→</span>
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
