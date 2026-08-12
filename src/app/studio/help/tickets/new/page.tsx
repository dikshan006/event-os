import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireStudio } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { zTicket } from "@/lib/validators";
import { createTicket, CATEGORY_LABELS } from "@/server/services/support";
import { UserError } from "@/lib/errors";
import { articleBySlug } from "@/lib/help";

export const metadata: Metadata = {
  title: "Contact EventOS Support — EventOS",
  robots: { index: false, follow: false },
};

/**
 * Open a ticket.
 *
 * The action re-derives the studio and the user from the session rather than
 * reading anything about identity from the form. That is the whole security
 * story on this page: `createTicket` has no parameter through which a client
 * could name a different studio, so there is nothing to validate away.
 *
 * A server action is independently reachable — it does not inherit the layout's
 * checks — so `requireStudio()` is called inside the action as well as in the
 * page.
 */
async function open(formData: FormData) {
  "use server";
  const { studioId, user } = await requireStudio();

  const parsed = zTicket.safeParse({
    subject: formData.get("subject"),
    category: formData.get("category"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Please check the form.";
    redirect(`/studio/help/tickets/new?error=${encodeURIComponent(first)}`);
  }

  let ticketId: string;
  try {
    const ticket = await createTicket(studioId, user.id, user.name, parsed.data);
    ticketId = ticket.id;
  } catch (err) {
    if (err instanceof UserError) {
      redirect(`/studio/help/tickets/new?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
  redirect(`/studio/help/tickets/${ticketId}?opened=1`);
}

export default async function NewTicket({
  searchParams,
}: {
  searchParams: Promise<{ about?: string; error?: string }>;
}) {
  await requireStudio();
  const { about, error } = await searchParams;

  /**
   * If they came from an article, name it in the subject.
   *
   * Resolved through the help registry rather than echoed from the query
   * string: the value lands in an input's `defaultValue`, and reflecting
   * arbitrary text from a URL into the page is a habit worth not having even
   * where React escapes it. An unknown slug simply yields nothing.
   */
  const article = about ? articleBySlug(about) : undefined;

  return (
    <>
      <PageHead
        eyebrow="Help"
        title="Contact EventOS Support"
        sub="Tell us what you were trying to do. The more specific, the faster we can help."
        back="/studio/help"
      />

      {error && (
        <div className="card pad tk-error" role="alert">
          {error}
        </div>
      )}

      <div className="split">
        <form action={open} className="card pad tk-form">
          <div className="field">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              name="subject"
              required
              maxLength={140}
              defaultValue={article ? `Question about “${article.title}”` : ""}
              placeholder="A short summary — “Guests are not receiving invitations”"
            />
          </div>

          <div className="field">
            <label htmlFor="category">Category</label>
            <select id="category" name="category" defaultValue={article?.category ? mapCategory(article.category) : "OTHER"}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="body">What is happening?</label>
            <textarea
              id="body"
              name="body"
              required
              rows={9}
              maxLength={5000}
              placeholder={
                "What you were trying to do, what happened instead, and which wedding it is about.\n\nIf you saw an error message, paste it here."
              }
            />
            <span className="meta">
              Please do not include passwords or card details. We never need them.
            </span>
          </div>

          {/*
            Attachments are not wired up. The field is deliberately absent
            rather than present and broken — see SUPPORT.md for exactly what
            remains. Object storage is not configured on this deployment, so
            there is nowhere for a file to go.
          */}
          <div className="tk-attach" aria-hidden="true">
            <b>Screenshots</b>
            <span>
              Not available yet. If a picture would help, describe what you can
              see and we will ask for it.
            </span>
          </div>

          <div className="row between" style={{ marginTop: 4 }}>
            <Link href="/studio/help/tickets" className="btn btn-ghost">
              Cancel
            </Link>
            <button type="submit" className="btn btn-primary">
              Send to support
            </button>
          </div>
        </form>

        <aside className="card pad tk-aside">
          <b>Before you send</b>
          <p className="meta">
            Most questions are already answered in the{" "}
            <Link href="/studio/help">Help Center</Link> — it is fifteen short
            guides covering everything from creating a wedding to publishing it.
          </p>
          <hr />
          <b>What happens next</b>
          <p className="meta">
            Your ticket appears in <Link href="/studio/help/tickets">My support
            tickets</Link> straight away. When we reply you will get an email
            with a link back to the thread, and the whole conversation stays in
            one place.
          </p>
        </aside>
      </div>
    </>
  );
}

/** Help category → ticket category, so arriving from an article pre-selects sensibly. */
function mapCategory(helpCategory: string) {
  switch (helpCategory) {
    case "getting-started": return "GETTING_STARTED";
    case "guests": return "GUESTS_AND_RSVPS";
    case "the-day": return "SCHEDULE_AND_SEATING";
    case "website": return "WEBSITE_AND_DESIGN";
    case "replies": return "GUESTS_AND_RSVPS";
    case "going-live": return "WEBSITE_AND_DESIGN";
    default: return "OTHER";
  }
}
