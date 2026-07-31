import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudio } from "@/server/services/context";
import { listWeddings, deleteWedding, duplicateWedding, unpublishWedding } from "@/server/services/weddings";
import { startPublish } from "@/server/services/billing";
import { PageHead, StatusChip } from "@/components/ui";
import { fmtDate, TEMPLATES } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function WeddingsPage({ searchParams }: { searchParams: Promise<{ published?: string; canceled?: string }> }) {
  const { studioId, user } = await requireStudio();
  const weddings = await listWeddings(studioId);
  const sp = await searchParams;

  async function publishAction(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const result = await startPublish(studioId, String(formData.get("id")), user.name);
    if (!result.ok) redirect(result.checkoutUrl);
    revalidatePath("/studio/weddings");
  }
  async function unpublishAction(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await unpublishWedding(studioId, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }
  async function duplicateAction(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    await duplicateWedding(studioId, user.name, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }
  async function deleteAction(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    await deleteWedding(studioId, user.name, String(formData.get("id")));
    revalidatePath("/studio/weddings");
  }

  return (
    <>
      <PageHead eyebrow="Weddings" title="All Weddings"
        sub="Create, edit, publish, duplicate — everything about each wedding lives here."
        actions={<Link className="btn btn-primary" href="/studio/weddings/new">New Wedding</Link>} />
      {sp.published && <div className="note" style={{ marginBottom: 20 }}>Payment confirmed — your wedding is being published. Refresh in a moment if it still shows as draft.</div>}
      {sp.canceled && <div className="note" style={{ marginBottom: 20 }}>Checkout canceled — the wedding stays in draft.</div>}
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
                  <a className="btn btn-outline btn-sm grow" href={`/w/${w.slug}`} target="_blank">Website ↗</a>
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
