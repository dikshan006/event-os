import { requireStudio, ownWedding } from "@/server/services/context";
import { listRegistry, listFunds, addRegistryItem, deleteRegistryItem, addFund } from "@/server/services/registry";
import { PageHead } from "@/components/ui";
import { zRegistryItem } from "@/lib/validators";
import { revalidatePath } from "next/cache";

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const [items, funds] = await Promise.all([listRegistry(studioId, w.id), listFunds(studioId, w.id)]);

  async function addItem(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const input = zRegistryItem.parse({
      title: formData.get("title"),
      url: formData.get("url"),
      price: formData.get("price") ?? "",
      retailer: formData.get("retailer") ?? "",
    });
    await addRegistryItem(studioId, weddingId, input);
    revalidatePath(`/studio/weddings/${weddingId}/registry`);
  }
  async function removeItem(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await deleteRegistryItem(studioId, String(formData.get("itemId")));
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/registry`);
  }
  async function createFund(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    await addFund(studioId, weddingId, {
      name: String(formData.get("name")),
      blurb: String(formData.get("blurb") ?? ""),
      venmoUrl: String(formData.get("venmoUrl") ?? "") || undefined,
      paypalUrl: String(formData.get("paypalUrl") ?? "") || undefined,
      stripeUrl: String(formData.get("stripeUrl") ?? "") || undefined,
    });
    revalidatePath(`/studio/weddings/${weddingId}/registry`);
  }

  return (
    <>
      <PageHead back={`/studio/weddings/${w.id}`} eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="Registry & Cash Gifts"
        sub="Paste any product link — planners can edit everything before it goes live. Guests are redirected to the retailer." />
      <div className="split">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card" style={{ overflow: "hidden" }}>
            <table className="tbl">
              <thead><tr><th>Gift</th><th>Price</th><th>Retailer</th><th></th></tr></thead>
              <tbody>
                {items.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 500 }}><a href={g.url} target="_blank">{g.title} ↗</a></td>
                    <td className="meta">{g.price ?? "—"}</td>
                    <td className="meta">{g.retailer}</td>
                    <td style={{ textAlign: "right" }}>
                      <form action={removeItem}>
                        <input type="hidden" name="itemId" value={g.id} />
                        <input type="hidden" name="weddingId" value={w.id} />
                        <button className="btn btn-ghost btn-sm" type="submit">Remove</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={4}><div className="empty">No gifts yet — add the first one.</div></td></tr>}
              </tbody>
            </table>
          </div>
          <div className="grid">
            {funds.map(f => (
              <div key={f.id} className="card pad">
                <div className="serif" style={{ fontSize: 22 }}>{f.name}</div>
                <p className="meta" style={{ margin: "6px 0 12px" }}>{f.blurb}</p>
                <div className="row wrap">
                  {f.stripeUrl && <span className="chip">Stripe</span>}
                  {f.venmoUrl && <span className="chip">Venmo</span>}
                  {f.paypalUrl && <span className="chip">PayPal</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 20 }}>
          <form action={addItem} className="card pad frm">
            <h2 className="section-t">Add gift</h2>
            <input type="hidden" name="weddingId" value={w.id} />
            <div className="field"><label>Product URL</label><input className="inp" name="url" type="url" required placeholder="https://…" /></div>
            <div className="field"><label>Title</label><input className="inp" name="title" required /></div>
            <div className="frm two">
              <div className="field"><label>Price</label><input className="inp" name="price" placeholder="$449.95" /></div>
              <div className="field"><label>Retailer</label><input className="inp" name="retailer" placeholder="auto from URL" /></div>
            </div>
            <button className="btn btn-primary" type="submit">Add to registry</button>
          </form>

          <form action={createFund} className="card pad frm">
            <h2 className="section-t">New cash fund</h2>
            <input type="hidden" name="weddingId" value={w.id} />
            <div className="field"><label>Name</label><input className="inp" name="name" required placeholder="Honeymoon Fund" /></div>
            <div className="field"><label>Description</label><input className="inp" name="blurb" /></div>
            <div className="field"><label>Stripe Payment Link</label><input className="inp" name="stripeUrl" placeholder="https://buy.stripe.com/…" /></div>
            <div className="frm two">
              <div className="field"><label>Venmo link</label><input className="inp" name="venmoUrl" /></div>
              <div className="field"><label>PayPal link</label><input className="inp" name="paypalUrl" /></div>
            </div>
            <button className="btn btn-outline" type="submit">Create fund</button>
          </form>
        </div>
      </div>
    </>
  );
}
