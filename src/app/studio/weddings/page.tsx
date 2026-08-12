import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudio } from "@/server/services/context";
import { listWeddings, deleteWedding, duplicateWedding, unpublishWedding } from "@/server/services/weddings";
import { startPublish } from "@/server/services/billing";
import { UserError } from "@/lib/errors";
import { PageHead, StatusChip } from "@/components/ui";
import { fmtDate, TEMPLATES } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function WeddingsPage({ searchParams }: { searchParams: Promise<{ published?: string; canceled?: string; busy?: string }> }) {
  const { studioId } = await requireStudio();
  const weddings = await listWeddings(studioId);
  const sp = await searchParams;

  async function publishAction(formData: FormData) {
    "use server";
    // Actor and tenant both come from this action's own session check rather
    // than from the render's closure: a server action is a separate request,
    // and everything it authorises on should be re-derived inside it.
    const { studioId, user } = await requireStudio();

    /**
     * Handled with `.catch` rather than try/catch so that no `redirect()` call
     * below ever sits inside a catch block. `redirect` works by throwing
     * NEXT_REDIRECT, and a `catch` wrapped around it would swallow the
     * navigation unless it remembered to rethrow — a trap that is invisible
     * until the day someone adds a second catch clause.
     *
     * The only expected failure is a second press arriving while the first is
     * still opening a Checkout session: `startPublish` refuses to open a second
     * one, which is what stops a double-click becoming a double charge. There
     * is no error boundary in this tree, so letting that bubble would replace
     * the page with Next's default error screen — a banner is the proportionate
     * answer to "you pressed it twice". Anything that is not a UserError is a
     * real fault and still propagates.
     */
    const outcome = await startPublish(studioId, String(formData.get("id")), user.name)
      .catch((err: unknown) => {
        if (err instanceof UserError) return { busy: true as const };
        throw err;
      });

    if ("busy" in outcome) redirect("/studio/weddings?busy=1");
    if (!outcome.ok) redirect(outcome.checkoutUrl);
    revalidatePath("/studio/weddings");
  }
  async function unpublishAction(formData: FormData) {
    "use server";
    // Unpublish takes no actor — see the note in weddings.ts about it being the
    // one state change on this page that is not attributed.
    const { studioId } = await requireStudio();
    await unpublishWedding(studioId, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }
  async function duplicateAction(formData: FormData) {
    "use server";
    // Actor and tenant both come from this action's own session check rather
    // than from the render's closure: a server action is a separate request,
    // and everything it authorises on should be re-derived inside it.
    const { studioId, user } = await requireStudio();
    await duplicateWedding(studioId, user.name, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }
  async function deleteAction(formData: FormData) {
    "use server";
    // Actor and tenant both come from this action's own session check rather
    // than from the render's closure: a server action is a separate request,
    // and everything it authorises on should be re-derived inside it.
    const { studioId, user } = await requireStudio();
    await deleteWedding(studioId, user.name, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }

  return (
    <>
      <PageHead back="/studio" eyebrow="Weddings" title="All Weddings"
        sub="Create, edit, publish, duplicate — everything about each wedding lives here."
        actions={<Link className="btn btn-primary" href="/studio/weddings/new">New Wedding</Link>} />
      {sp.published && <div className="note" style={{ marginBottom: 20 }}>Payment confirmed — your wedding is being published. Refresh in a moment if it still shows as draft.</div>}
      {sp.canceled && <div className="note" style={{ marginBottom: 20 }}>Checkout canceled — the wedding stays in draft.</div>}
      {sp.busy && <div className="note" style={{ marginBottom: 20 }}>That publish is already being set up — give it a moment and press Publish again.</div>}
      <div className="grid">
        {weddings.map(w => {
          const T = TEMPLATES[w.template];
          return (
            <div key={w.id} className="card" style={{ overflow: "hidden" }}>
              <div style={{ height: 8, background: T.color }} />
              <div className="pad" style={{ display: "grid", gap: 12 }}>
                <div className="row between">
                  <div className="serif" style={{ fontSize: 24 }}>{w.partnerOne} &amp; {w.partnerTwo}</div>
                  <StatusChip s={w.status} />
                </div>
                <div className="meta">{T.name} · {fmtDate(w.date)} · {w._count.guests} guests</div>
                <div className="row">
                  <Link className="btn btn-outline btn-sm grow" href={`/studio/weddings/${w.id}`}>Edit content</Link>
                  <Link className="btn btn-outline btn-sm grow" href={`/studio/weddings/${w.id}/preview`}>Preview</Link>
                </div>
                <div className="row">
                  {w.status === "DRAFT" ? (
                    <form action={publishAction} className="grow">
                      <input type="hidden" name="id" value={w.id} />
                      <button className="btn btn-accent btn-sm" style={{ width: "100%" }} type="submit">Publish</button>
                    </form>
                  ) : (
                    <form action={unpublishAction} className="grow">
                      <input type="hidden" name="id" value={w.id} />
                      <button className="btn btn-ghost btn-sm" style={{ width: "100%" }} type="submit">Unpublish</button>
                    </form>
                  )}
                  <form action={duplicateAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn btn-ghost btn-sm" type="submit">Duplicate</button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="id" value={w.id} />
                    <button className="btn btn-danger btn-sm" type="submit">Delete</button>
                  </form>
                </div>
              </div>
            </div>
          );
        })}
        {!weddings.length && <div className="card empty" style={{ gridColumn: "1/-1" }}>No weddings yet.</div>}
      </div>
    </>
  );
}
