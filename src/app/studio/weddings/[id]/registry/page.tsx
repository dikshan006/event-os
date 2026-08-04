import { requireStudio, ownWedding } from "@/server/services/context";
import { listRegistry, listFunds, addRegistryItem, deleteRegistryItem, addFund, releaseGift, updateRegistryItem } from "@/server/services/registry";
import { PageHead } from "@/components/ui";
import { zRegistryItem } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { fmtDate } from "@/lib/utils";

export default async function RegistryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const [items, funds] = await Promise.all([listRegistry(studioId, w.id), listFunds(studioId, w.id)]);
  const purchased = items.filter(g => g.purchasedBy);
  const available = items.length - purchased.length;

  async function addItem(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const input = zRegistryItem.parse({
      title: formData.get("title"),
      url: formData.get("url"),
      imageUrl: formData.get("imageUrl") ?? "",
      price: formData.get("price") ?? "",
      retailer: formData.get("retailer") ?? "",
      featured: formData.get("featured") === "on",
    });
    await addRegistryItem(studioId, weddingId, input);
    revalidatePath(`/studio/weddings/${weddingId}/registry`);
    revalidatePath(`/w/${w.slug}/registry`);
  }

  async function editItem(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const input = zRegistryItem.parse({
      title: formData.get("title"),
      url: formData.get("url"),
      imageUrl: formData.get("imageUrl") ?? "",
      price: formData.get("price") ?? "",
      retailer: formData.get("retailer") ?? "",
      featured: formData.get("featured") === "on",
    });
    await updateRegistryItem(studioId, String(formData.get("itemId")), input);
    revalidatePath(`/studio/weddings/${weddingId}/registry`);
    revalidatePath(`/w/${w.slug}/registry`);
  }

  async function release(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    await releaseGift(studioId, String(formData.get("itemId")));
    revalidatePath(`/studio/weddings/${weddingId}/registry`);
    revalidatePath(`/w/${w.slug}/registry`);
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
        sub="Paste any product link. Guests browse the wishlist at /w/{slug}/registry, buy from the retailer, then mark the gift as purchased so nobody buys it twice." />
      <div className="split">
        <div style={{ display: "grid", gap: 20 }}>
          <div className="stats" style={{ marginBottom: 0 }}>
            <div className="card stat"><div className="v">{items.length}</div><div className="l">Gifts</div>
              <div className="d">on the wishlist</div></div>
            <div className="card stat"><div className="v">{available}</div><div className="l">Available</div>
              <div className="d">still showing to guests</div></div>
            <div className="card stat"><div className="v">{purchased.length}</div><div className="l">Purchased</div>
              <div className="d">hidden unless a guest asks to see them</div></div>
          </div>

          {/* One row per gift, expandable. The claim details sit inside the row
              they belong to rather than in a separate "purchases" screen — a
              planner asking "has anyone bought the mixer?" is looking at the
              mixer. */}
          <div className="card" style={{ overflow: "hidden" }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead><tr><th>Gift</th><th>Price</th><th>Retailer</th><th>Status</th><th className="actions">Actions</th></tr></thead>
                <tbody>
                  {items.map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 500 }}>
                        <a href={g.url} target="_blank" rel="noopener noreferrer">{g.title} ↗</a>
                        {g.featured && <span className="chip" style={{ marginLeft: 8 }}>Featured</span>}
                        {g.purchasedBy && (
                          <div className="meta" style={{ marginTop: 6, whiteSpace: "normal" }}>
                            {g.purchasedBy}
                            {g.purchasedAt && ` · ${fmtDate(g.purchasedAt)}`}
                            {g.purchaseNote && <div style={{ fontStyle: "italic", marginTop: 4 }}>&ldquo;{g.purchaseNote}&rdquo;</div>}
                          </div>
                        )}
                      </td>
                      <td className="meta">{g.price ?? "—"}</td>
                      <td className="meta">{g.retailer}</td>
                      <td>
                        {g.purchasedBy
                          ? <span className="chip sage">Purchased</span>
                          : <span className="chip">Available</span>}
                      </td>
                      <td className="actions">
                        <div className="row wrap" style={{ gap: 6, justifyContent: "flex-end" }}>
                          {g.purchasedBy && (
                            <form action={release}>
                              <input type="hidden" name="itemId" value={g.id} />
                              <input type="hidden" name="weddingId" value={w.id} />
                              <button className="btn btn-outline btn-sm" type="submit">Mark available</button>
                            </form>
                          )}
                          <details className="frm-more" style={{ border: 0, padding: 0 }}>
                            <summary>Edit</summary>
                            <form action={editItem} className="frm" style={{ marginTop: 10, minWidth: 260 }}>
                              <input type="hidden" name="itemId" value={g.id} />
                              <input type="hidden" name="weddingId" value={w.id} />
                              <div className="field"><label>Title</label><input className="inp" name="title" defaultValue={g.title} required /></div>
                              <div className="field"><label>Product URL</label><input className="inp" name="url" type="url" defaultValue={g.url} required /></div>
                              <div className="field"><label>Image URL</label><input className="inp" name="imageUrl" defaultValue={g.imageUrl ?? ""} placeholder="https://…" /></div>
                              <div className="frm two">
                                <div className="field"><label>Price</label><input className="inp" name="price" defaultValue={g.price ?? ""} /></div>
                                <div className="field"><label>Retailer</label><input className="inp" name="retailer" defaultValue={g.retailer ?? ""} /></div>
                              </div>
                              <label className="check"><input type="checkbox" name="featured" defaultChecked={g.featured} /> Feature on the invitation</label>
                              <button className="btn btn-primary btn-sm" type="submit">Save gift</button>
                            </form>
                          </details>
                          <form action={removeItem}>
                            <input type="hidden" name="itemId" value={g.id} />
                            <input type="hidden" name="weddingId" value={w.id} />
                            <button className="btn btn-ghost btn-sm" type="submit">Remove</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!items.length && <tr><td colSpan={5}><div className="empty">No gifts yet — add the first one.</div></td></tr>}
                </tbody>
              </table>
            </div>
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
            <div className="field"><label>Image URL</label>
              <input className="inp" name="imageUrl" placeholder="https://…" />
              <span className="hint">Optional. Copy the product photo&rsquo;s address from the retailer, or leave blank for a monogram tile.</span>
            </div>
            <div className="frm two">
              <div className="field"><label>Price</label><input className="inp" name="price" placeholder="$449.95" /></div>
              <div className="field"><label>Retailer</label><input className="inp" name="retailer" placeholder="auto from URL" /></div>
            </div>
            <label className="check"><input type="checkbox" name="featured" /> Feature on the invitation (three at most)</label>
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
