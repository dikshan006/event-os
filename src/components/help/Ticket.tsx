import Link from "next/link";
import type { TicketStatus, TicketPriority, TicketAuthor } from "@prisma/client";
import { STATUS_LABELS, PRIORITY_LABELS, ticketRef } from "@/server/services/support";

/**
 * Shared support chrome, used by both the planner pages and the admin queue.
 *
 * One definition rather than two, because the alternative is a planner and an
 * admin looking at the same ticket and seeing two different words for its
 * state. `StatusChip` in `ui.tsx` maps its own vocabulary and does not know
 * these values, so this maps them onto the same three tones the rest of the
 * product already uses rather than introducing new colours.
 */

const STATUS_TONE: Record<TicketStatus, string> = {
  // Needs someone: no tone, which reads as "unresolved" everywhere else here.
  OPEN: "",
  IN_PROGRESS: "rose",
  // Waiting on the planner, not on us.
  WAITING_FOR_PLANNER: "rose",
  RESOLVED: "sage",
  CLOSED: "sage",
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  LOW: "",
  NORMAL: "",
  HIGH: "rose",
  URGENT: "wine",
};

export function TicketStatusChip({ status }: { status: TicketStatus }) {
  return (
    <span className={`chip ${STATUS_TONE[status]}`}>
      <i className="dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function TicketPriorityChip({ priority }: { priority: TicketPriority }) {
  // Normal is the default and saying so on every row is noise.
  if (priority === "NORMAL") return <span className="meta">—</span>;
  return (
    <span className={`chip ${PRIORITY_TONE[priority]}`}>
      <i className="dot" />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

export function TicketRef({ id }: { id: string }) {
  return <span className="ticket-ref">{ticketRef(id)}</span>;
}

/**
 * One message in a thread.
 *
 * Sided rather than avatared: the planner's own words sit right, ours sit
 * left, which is the arrangement every messaging app has taught people to read
 * without a legend. `viewerIs` is passed rather than inferred so the same
 * component reads correctly from both sides — an admin sees their own replies
 * on the right too.
 */
export function TicketMessageBubble({
  authorType,
  authorName,
  body,
  createdAt,
  viewerIs,
}: {
  authorType: TicketAuthor;
  authorName: string;
  body: string;
  createdAt: Date;
  viewerIs: TicketAuthor;
}) {
  const mine = authorType === viewerIs;
  return (
    <div className={`tk-msg ${mine ? "mine" : ""}`}>
      <div className="tk-msg-head">
        <b>{authorType === "ADMIN" ? "EventOS Support" : authorName}</b>
        <time dateTime={createdAt.toISOString()}>
          {createdAt.toLocaleString("en-US", {
            day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
          })}
        </time>
      </div>
      {/*
        `white-space: pre-wrap` in the stylesheet rather than splitting on
        newlines and rendering <br>: the text is interpolated by React and
        therefore escaped, and paragraph breaks a planner typed should survive
        without the component ever handling markup.
      */}
      <p>{body}</p>
    </div>
  );
}

/**
 * The block at the foot of every help article.
 *
 * Placed where someone arrives having just failed to find their answer, which
 * is the only moment the button is genuinely wanted. Carries the article's
 * title into the ticket form so the subject arrives half-written — the planner
 * is already frustrated and should not also have to summarise.
 */
export function StillNeedHelp({ from }: { from?: string }) {
  const href = from
    ? `/studio/help/tickets/new?about=${encodeURIComponent(from)}`
    : "/studio/help/tickets/new";
  return (
    <aside className="tk-cta">
      <div>
        <b>Still need help?</b>
        <p className="meta">
          If this did not answer your question, tell us what you were trying to
          do and we will help — usually within one working day.
        </p>
      </div>
      <div className="row">
        <Link href="/studio/help/tickets" className="btn btn-outline">
          My tickets
        </Link>
        <Link href={href} className="btn btn-primary">
          Contact EventOS Support
        </Link>
      </div>
    </aside>
  );
}
