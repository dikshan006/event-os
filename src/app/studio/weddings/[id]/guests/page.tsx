import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudio, ownWedding } from "@/server/services/context";
import { listGuests, addGuest, updateGuest, importGuests, deleteGuest, sendInvitations, resendInvitation } from "@/server/services/guests";
import { PageHead, StatusChip } from "@/components/ui";
import { zGuest } from "@/lib/validators";
import { GROUPS, initials, fmtDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export default async function GuestsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; group?: string; edit?: string; imported?: string; skipped?: string; sent?: string; failed?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const guests = await listGuests(studioId, w.id, { q: sp.q, group: sp.group });
  const editing = sp.edit ? await prisma.guest.findFirst({ where: { id: sp.edit, studioId, weddingId: w.id } }) : null;
  const base = `/studio/weddings/${w.id}/guests`;

  async function save(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const guestId = String(formData.get("guestId") ?? "");
    const input = zGuest.parse({
      name: formData.get("name"),
      email: formData.get("email") ?? "",
      phone: formData.get("phone") ?? "",
      groups: formData.getAll("groups").map(String),
    });
    if (guestId) await updateGuest(studioId, guestId, input);
    else await addGuest(studioId, weddingId, input);
    redirect(`/studio/weddings/${weddingId}/guests`);
  }
  async function doImport(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const { imported, skipped } = await importGuests(studioId, weddingId, user.name, String(formData.get("csv") ?? ""));
    redirect(`/studio/weddings/${weddingId}/guests?imported=${imported}&skipped=${skipped}`);
  }
  async function remove(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await deleteGuest(studioId, String(formData.get("guestId")));
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/guests`);
  }
  async function invite(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const { sent, failed } = await sendInvitations(studioId, weddingId, user.name);
    redirect(`/studio/weddings/${weddingId}/guests?sent=${sent}&failed=${failed}`);
  }
  async function resend(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    await resendInvitation(studioId, String(formData.get("guestId")), user.name);
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/guests`);
  }

  return (
    <>
      <PageHead eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="Guest Management"
        sub="Assign guests to groups — their personalized schedules and invitation links follow automatically."
        actions={
          <>
            <a className="btn btn-outline" href={`${base}/export`} download>Export CSV</a>
            <form action={invite}>
              <input type="hidden" name="weddingId" value={w.id} />
              <button className="btn btn-primary" type="submit">Send invitations</button>
            </form>
          </>
        } />

      {sp.sent !== undefined && (
        <div className="note" style={{ marginBottom: 18 }}>
          Invitations: {sp.sent} handed to the email provider{Number(sp.failed) > 0 ? `, ${sp.failed} failed — the failed guests stay un-invited so the next send retries them; details are in the email log.` : "."}
        </div>
      )}
      {sp.imported !== undefined && (
        <div className="note" style={{ marginBottom: 18 }}>
          Import complete: {sp.imported} guests added{Number(sp.skipped) > 0 ? `, ${sp.skipped} lines skipped (missing name or malformed email).` : "."}
        </div>
      )}

      <form method="GET" className="row wrap" style={{ marginBottom: 18 }}>
        <input className="inp" name="q" defaultValue={sp.q ?? ""} placeholder="Search name or email…" style={{ maxWidth: 280 }} />
        <select className="inp" name="group" defaultValue={sp.group ?? ""} style={{ maxWidth: 190 }}>
          <option value="">All groups</option>
          {GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <button className="btn btn-outline" type="submit">Filter</button>
        {(sp.q || sp.group) && <Link className="btn btn-ghost" href={base}>Clear</Link>}
        <span className="meta" style={{ marginLeft: "auto" }}>{guests.length} guest{guests.length === 1 ? "" : "s"}</span>
      </form>

      {/* Full-width table — forms live below so the roster owns the screen. */}
      <div className="card" style={{ overflowX: "auto", marginBottom: 26 }}>
        <table className="tbl">
          <thead><tr><th>Guest</th><th>Groups</th><th>Invitation</th><th>RSVP</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
          <tbody>
            {guests.map(g => (
              <tr key={g.id}>
                <td>
                  <div className="row"><div className="ava" style={{ width: 32, height: 32, fontSize: 11 }}>{initials(g.name)}</div>
                    <div><div style={{ fontWeight: 500 }}>{g.name}</div><div className="meta">{g.email ?? "no email"}</div></div></div>
                </td>
                <td><div className="row wrap">{g.groups.map(gr => <span key={gr} className="chip rose">{gr}</span>)}</div></td>
                <td>
                  <div className="meta"><code>/invite/{g.inviteCode}</code></div>
                  <div className="meta">{g.invitedAt ? `Sent ${fmtDate(g.invitedAt)}` : "Not sent"}</div>
                </td>
                <td><StatusChip s={g.rsvp?.status ?? "AWAITING"} /></td>
                <td>
                  <div className="row wrap" style={{ justifyContent: "flex-end" }}>
                    <a className="btn btn-outline btn-sm" href={`/invite/${g.inviteCode}`} target="_blank">Portal ↗</a>
                    {g.email && (
                      <form action={resend}>
                        <input type="hidden" name="guestId" value={g.id} />
                        <input type="hidden" name="weddingId" value={w.id} />
                        <button className="btn btn-outline btn-sm" type="submit">{g.invitedAt ? "Resend" : "Send"}</button>
                      </form>
                    )}
                    <Link className="btn btn-ghost btn-sm" href={`${base}?edit=${g.id}#guest-form`}>Edit</Link>
                    <form action={remove}>
                      <input type="hidden" name="guestId" value={g.id} />
                      <input type="hidden" name="weddingId" value={w.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">Remove</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
            {!guests.length && <tr><td colSpan={5}><div className="empty">{sp.q || sp.group ? "No guests match this filter." : "No guests yet — add your first below."}</div></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="split" id="guest-form">
        <form action={save} className="card pad frm">
          <div className="row between">
            <h2 className="section-t" style={{ margin: 0 }}>{editing ? `Edit ${editing.name}` : "Add guest"}</h2>
            {editing && <Link className="btn btn-ghost btn-sm" href={base}>Cancel edit</Link>}
          </div>
          <input type="hidden" name="weddingId" value={w.id} />
          {editing && <input type="hidden" name="guestId" value={editing.id} />}
          <div className="field"><label>Full name</label>
            <input className="inp" name="name" required defaultValue={editing?.name ?? ""} key={editing?.id ?? "new"} /></div>
          <div className="frm two">
            <div className="field"><label>Email</label><input className="inp" name="email" type="email" defaultValue={editing?.email ?? ""} /></div>
            <div className="field"><label>Phone</label><input className="inp" name="phone" defaultValue={editing?.phone ?? ""} /></div>
          </div>
          <div className="field"><label>Groups</label>
            <div className="row wrap">
              {GROUPS.map(gr => (
                <label key={gr} className="check">
                  <input type="checkbox" name="groups" value={gr} defaultChecked={editing?.groups.includes(gr) ?? false} /> {gr}
                </label>
              ))}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">{editing ? "Save changes" : "Add guest"}</button>
        </form>

        <form action={doImport} className="card pad frm">
          <h2 className="section-t">Import CSV</h2>
          <input type="hidden" name="weddingId" value={w.id} />
          <div className="field"><label>One per line: Name, email, Group|Group</label>
            <textarea className="inp" name="csv" placeholder={"Margaret Ellison, margaret@ellison.com, Family|VIP"} /></div>
          <span className="hint">Lines without a name or with a malformed email are skipped and reported — nothing bad enters your list.</span>
          <button className="btn btn-outline" type="submit">Import</button>
        </form>
      </div>
    </>
  );
}
