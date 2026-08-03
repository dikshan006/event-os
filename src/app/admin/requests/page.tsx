import Link from "next/link";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/server/services/context";
import { PageHead } from "@/components/ui";
import { listAccessRequests, setAccessRequestStatus } from "@/server/services/access-requests";
import { fmtDate } from "@/lib/utils";

/**
 * The inbox for the public site's only write path.
 *
 * Built as a work queue rather than a table: unread first, and the primary
 * action on each one is the thing you actually want to do — create the studio,
 * with everything the person already told us carried across so nothing is
 * retyped. Declining is deliberately the quieter control.
 *
 * Both actions live at module scope. A server action handed to a Client
 * Component serializes its captured scope, and a closure declared in the
 * component body crashes the render; the dialogs here are plain forms, but the
 * rule is cheap to keep and expensive to rediscover.
 */

async function invite(formData: FormData) {
  "use server";
  await requireAdmin();
  await setAccessRequestStatus(String(formData.get("id")), "INVITED");
  revalidatePath("/admin/requests");
}

async function decline(formData: FormData) {
  "use server";
  await requireAdmin();
  await setAccessRequestStatus(String(formData.get("id")), "DECLINED");
  revalidatePath("/admin/requests");
}

async function reopen(formData: FormData) {
  "use server";
  await requireAdmin();
  await setAccessRequestStatus(String(formData.get("id")), "NEW");
  revalidatePath("/admin/requests");
}

/** A studio name has to be *something*; their company, or their own name. */
function studioGuess(name: string, company: string | null) {
  return company?.trim() || name.trim();
}

export default async function RequestsPage() {
  await requireAdmin();
  const requests = await listAccessRequests();
  const waiting = requests.filter(r => r.status === "NEW");

  return (
    <>
      <PageHead
        back="/admin"
        eyebrow="Access"
        title="Requests"
        sub="Planners who asked for access from the public site. Approving one opens the New Planner form with their details already filled in."
        actions={
          <span className={`chip ${waiting.length ? "wine" : "sage"}`}>
            {waiting.length} waiting
          </span>
        }
      />

      {requests.length === 0 ? (
        <div className="card empty">
          No requests yet. They arrive here from the Request access form on the
          public site, and you are emailed when one does.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {requests.map(r => {
            const prefill = new URLSearchParams({
              name: r.name,
              email: r.email,
              studio: studioGuess(r.name, r.company),
            });
            return (
              <article
                key={r.id}
                className="card pad"
                style={{ display: "grid", gap: 14, opacity: r.status === "DECLINED" ? 0.62 : 1 }}
              >
                <div className="row between wrap" style={{ gap: 12 }}>
                  <div>
                    <h2 className="section-t" style={{ margin: 0 }}>
                      {r.name}
                      {r.company && <span className="meta"> · {r.company}</span>}
                    </h2>
                    <p className="meta">
                      <a href={`mailto:${r.email}`}>{r.email}</a>
                      {" · "}
                      {fmtDate(r.createdAt)}
                      {r.volume && ` · ${r.volume} weddings a year`}
                    </p>
                  </div>
                  <span className={`chip ${r.status === "NEW" ? "wine" : r.status === "INVITED" ? "sage" : ""}`}>
                    {r.status === "NEW" ? "Waiting" : r.status === "INVITED" ? "Invited" : "Declined"}
                  </span>
                </div>

                {r.website && (
                  <p className="meta">
                    {/* Requester-supplied and therefore untrusted: opened in a new
                        context with the referrer and opener withheld. */}
                    <a href={sanitiseUrl(r.website)} target="_blank" rel="noopener noreferrer nofollow">
                      {r.website} ↗
                    </a>
                  </p>
                )}

                {r.message && (
                  <p style={{ whiteSpace: "pre-wrap", maxWidth: "62ch" }}>{r.message}</p>
                )}

                <div className="row wrap" style={{ gap: 8 }}>
                  {r.status === "NEW" ? (
                    <>
                      <Link className="btn btn-primary btn-sm" href={`/admin/planners?${prefill}`}>
                        Create their studio →
                      </Link>
                      <form action={invite}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn-outline btn-sm" type="submit">
                          Mark invited
                        </button>
                      </form>
                      <form action={decline}>
                        <input type="hidden" name="id" value={r.id} />
                        <button className="btn btn-ghost btn-sm" type="submit">
                          Decline
                        </button>
                      </form>
                    </>
                  ) : (
                    <form action={reopen}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">
                        Move back to waiting
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

/**
 * People type "atelierblanc.com" far more often than they type a scheme, and a
 * bare string in href resolves as a relative admin path. Anything that is not
 * plainly http(s) is given one rather than rendered as a link into our own app
 * — which also disposes of `javascript:` without needing to reason about it.
 */
function sanitiseUrl(raw: string) {
  const v = raw.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
}
