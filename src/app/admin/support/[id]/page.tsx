import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import type { TicketStatus, TicketPriority } from "@prisma/client";
import { requireAdmin } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { TicketStatusChip, TicketMessageBubble } from "@/components/help/Ticket";
import {
  getTicketForAdmin, replyAsAdmin, setTicketStatus, setTicketPriority,
  CATEGORY_LABELS, STATUS_LABELS, PRIORITY_LABELS, ticketRef,
} from "@/server/services/support";
import { zTicketReply } from "@/lib/validators";

export const metadata: Metadata = {
  title: "Ticket — EventOS Admin",
  robots: { index: false, follow: false },
};

const STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "WAITING_FOR_PLANNER", "RESOLVED", "CLOSED"];
const PRIORITIES: TicketPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

/**
 * One ticket, from the platform side.
 *
 * Every action here re-runs `requireAdmin()` rather than trusting that the page
 * rendered. A server action is an endpoint: it is reachable directly with a
 * crafted POST, it does not run the layout, and it does not inherit whatever
 * check the component above it happened to perform. A planner who learns a
 * ticket id must not be able to drive these.
 */
export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const ticket = await getTicketForAdmin(id);
  if (!ticket) notFound();

  async function reply(formData: FormData) {
    "use server";
    const { user } = await requireAdmin();
    const parsed = zTicketReply.safeParse({ body: formData.get("body") });
    if (!parsed.success) redirect(`/admin/support/${id}`);
    await replyAsAdmin(id, user.name, parsed.data.body);
    revalidatePath(`/admin/support/${id}`);
  }

  async function changeStatus(formData: FormData) {
    "use server";
    const { user } = await requireAdmin();
    const next = String(formData.get("status") ?? "");
    // Validated against the enum rather than cast: this value arrives from a
    // form and a bad one would otherwise reach Prisma as-is.
    if (!STATUSES.includes(next as TicketStatus)) redirect(`/admin/support/${id}`);
    await setTicketStatus(id, next as TicketStatus, user.name);
    revalidatePath(`/admin/support/${id}`);
  }

  async function changePriority(formData: FormData) {
    "use server";
    const { user } = await requireAdmin();
    const next = String(formData.get("priority") ?? "");
    if (!PRIORITIES.includes(next as TicketPriority)) redirect(`/admin/support/${id}`);
    await setTicketPriority(id, next as TicketPriority, user.name);
    revalidatePath(`/admin/support/${id}`);
  }

  return (
    <div className="tk-thread">
      <PageHead
        eyebrow={`Ticket ${ticketRef(ticket.id)}`}
        title={ticket.subject}
        sub={`${ticket.studio.name} · ${ticket.user.name} · ${CATEGORY_LABELS[ticket.category]}`}
        back="/admin/support"
        actions={<TicketStatusChip status={ticket.status} />}
      />

      <div className="split">
        <div>
          <ol className="tk-stream">
            {ticket.messages.map(m => (
              <li key={m.id}>
                <TicketMessageBubble
                  authorType={m.authorType}
                  authorName={m.authorName}
                  body={m.body}
                  createdAt={m.createdAt}
                  viewerIs="ADMIN"
                />
              </li>
            ))}
          </ol>

          <form action={reply} className="card pad tk-reply">
            <div className="field">
              <label htmlFor="body">Reply to {ticket.user.name.split(" ")[0]}</label>
              <textarea
                id="body"
                name="body"
                rows={6}
                required
                maxLength={5000}
                placeholder="Answer in plain language. Link to a help article where one covers it."
              />
              <span className="meta">
                Sending moves this to “Waiting for you” and emails the planner a
                link — the reply itself stays in the product.
              </span>
            </div>
            <div className="row between">
              <Link href="/admin/support" className="btn btn-ghost">Back to queue</Link>
              <button type="submit" className="btn btn-primary">Send reply</button>
            </div>
          </form>
        </div>

        <aside className="card pad tk-aside">
          <b>Planner</b>
          <p className="meta">
            <Link href={`/admin/planners/${ticket.studio.id}`}>{ticket.studio.name}</Link>
            <br />
            {ticket.user.name}
            <br />
            <a href={`mailto:${ticket.user.email}`}>{ticket.user.email}</a>
            {ticket.studio.status === "SUSPENDED" && (
              <>
                <br />
                <span className="chip wine"><i className="dot" />Suspended</span>
              </>
            )}
          </p>

          <hr />

          <form action={changeStatus} className="field">
            <label htmlFor="status">Status</label>
            <div className="row">
              <select id="status" name="status" defaultValue={ticket.status}>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-outline btn-sm">Set</button>
            </div>
          </form>

          <form action={changePriority} className="field">
            <label htmlFor="priority">Priority</label>
            <div className="row">
              <select id="priority" name="priority" defaultValue={ticket.priority}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-outline btn-sm">Set</button>
            </div>
          </form>

          <hr />

          <b>Timeline</b>
          <p className="meta">
            Opened {ticket.createdAt.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric" })}
            <br />
            {ticket.firstReplyAt
              ? `First reply ${ticket.firstReplyAt.toLocaleString("en-US", { day: "numeric", month: "short" })}`
              : "Not yet answered"}
            <br />
            {ticket.resolvedAt
              ? `Settled ${ticket.resolvedAt.toLocaleString("en-US", { day: "numeric", month: "short" })}`
              : `Last activity ${ticket.lastMessageAt.toLocaleString("en-US", { day: "numeric", month: "short" })}`}
          </p>
        </aside>
      </div>
    </div>
  );
}
