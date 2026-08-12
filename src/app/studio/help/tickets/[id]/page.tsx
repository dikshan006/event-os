import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { TicketStatusChip, TicketMessageBubble } from "@/components/help/Ticket";
import { getMyTicket, replyAsPlanner, CATEGORY_LABELS, ticketRef } from "@/server/services/support";
import { zTicketReply } from "@/lib/validators";
import { UserError } from "@/lib/errors";

export const metadata: Metadata = {
  title: "Support ticket — EventOS",
  robots: { index: false, follow: false },
};

/**
 * One of the planner's own tickets, and the reply box.
 *
 * The ticket id is in the URL and is therefore attacker-controlled, which makes
 * this the page where tenant isolation actually matters. It is enforced in one
 * place and in one way: `getMyTicket(studioId, id)` queries on both columns, so
 * another studio's ticket does not resolve. There is no second check to forget,
 * and no branch where the row has been loaded and something else decides
 * whether to show it.
 *
 * `notFound()` rather than a 403 — the same reasoning as `ownWedding`. A ticket
 * that is not yours and a ticket that does not exist must be indistinguishable,
 * or the response becomes an oracle for which ids are real.
 */
export default async function TicketThread({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ opened?: string; error?: string }>;
}) {
  const { studioId, user } = await requireStudio();
  const { id } = await params;
  const { opened, error } = await searchParams;

  const ticket = await getMyTicket(studioId, id);
  if (!ticket) notFound();

  /**
   * Replying.
   *
   * Defined inside the component so it closes over the id from the URL, but it
   * re-derives the studio from the session rather than closing over the one
   * above — a server action is independently reachable and must not trust
   * anything captured at render time.
   */
  async function reply(formData: FormData) {
    "use server";
    const { studioId: sid, user: u } = await requireStudio();

    const parsed = zTicketReply.safeParse({ body: formData.get("body") });
    if (!parsed.success) {
      redirect(`/studio/help/tickets/${id}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
    }

    try {
      await replyAsPlanner(sid, id, u.name, parsed.data.body);
    } catch (err) {
      if (err instanceof UserError) {
        redirect(`/studio/help/tickets/${id}?error=${encodeURIComponent(err.message)}`);
      }
      throw err;
    }
    revalidatePath(`/studio/help/tickets/${id}`);
  }

  const settled = ticket.status === "RESOLVED" || ticket.status === "CLOSED";

  return (
    <div className="tk-thread">
      <PageHead
        eyebrow={`Ticket ${ticketRef(ticket.id)}`}
        title={ticket.subject}
        sub={`${CATEGORY_LABELS[ticket.category]} · opened ${ticket.createdAt.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })}`}
        back="/studio/help/tickets"
        actions={<TicketStatusChip status={ticket.status} />}
      />

      {opened && (
        <div className="card pad tk-ok" role="status">
          <b>Sent.</b> We have your ticket and will reply by email with a link
          back to this page.
        </div>
      )}
      {error && <div className="card pad tk-error" role="alert">{error}</div>}

      <ol className="tk-stream">
        {ticket.messages.map(m => (
          <li key={m.id}>
            <TicketMessageBubble
              authorType={m.authorType}
              authorName={m.authorName}
              body={m.body}
              createdAt={m.createdAt}
              viewerIs="PLANNER"
            />
          </li>
        ))}
      </ol>

      <form action={reply} className="card pad tk-reply">
        <div className="field">
          <label htmlFor="body">
            {settled ? "Reply and reopen" : "Reply"}
          </label>
          <textarea
            id="body"
            name="body"
            rows={5}
            required
            maxLength={5000}
            placeholder={
              settled
                ? "This ticket is closed. Replying will reopen it."
                : "Add anything that might help…"
            }
          />
          {settled && (
            <span className="meta">
              This ticket is marked {ticket.status === "RESOLVED" ? "resolved" : "closed"}.
              Replying reopens it and we will pick it up again.
            </span>
          )}
        </div>
        <div className="row between">
          <Link href="/studio/help" className="btn btn-ghost">Back to help</Link>
          <button type="submit" className="btn btn-primary">Send reply</button>
        </div>
      </form>

      <p className="meta tk-signed">
        Signed in as {user.name}. Only your studio can see this ticket.
      </p>
    </div>
  );
}
