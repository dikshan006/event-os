import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStudio, ownWedding } from "@/server/services/context";
import { listGuests, addGuest, updateGuest, importGuests, deleteGuest } from "@/server/services/guests";
import { resendInvitationOutcome, sendInvitationsOutcome, type InviteOutcome } from "@/server/services/invite-actions";
import { InviteOneButton, SendAllButton } from "@/components/InviteButtons";
import { PageHead, StatusChip } from "@/components/ui";
import { zGuest } from "@/lib/validators";
import { GROUPS, initials, fmtDate } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export default async function GuestsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; group?: string; edit?: string; imported?: string; skipped?: string }>;
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
  /**
   * Both invitation actions return an outcome rather than throwing or
   * redirecting.
   *
   * Throwing was the bug: `resendInvitation` raises a `UserError` when the
   * per-guest hourly limit is reached, and an uncaught throw in a server action
   * replaces the page with the error boundary — so a planner nudging a guest a
   * fourth time was told "Something went wrong. This one is on us."
   *
   * Redirecting was the smaller half. `?sent=&failed=` in the URL survived
   * reloads, could be typed by hand, and said nothing while the send was still
   * running. The result now belongs to the button that started it.
   *
   * Tenant and actor still come from `requireStudio()` inside each action, and
   * every rule about who may send what is unchanged in `guests.ts`.
   */
  async function invite(_prev: InviteOutcome | null, formData: FormData): Promise<InviteOutcome> {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const outcome = await sendInvitationsOutcome(studioId, weddingId, user.name);
    revalidatePath(`/studio/weddings/${weddingId}/guests`);
    return outcome;
  }
  async function resend(_prev: InviteOutcome | null, formData: FormData): Promise<InviteOutcome> {
    "use server";
    const { studioId, user } = await requireStudio();
    const outcome = await resendInvitationOutcome(studioId, String(formData.get("guestId")), user.name);
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/guests`);
    return outcome;
  }

  return (
    <>
      <PageHead back={`/studio/weddings/${w.id}`} eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="Guest Management"
        sub="Assign guests to groups — their personalized schedules and invitation links follow automatically."
        actions={
          <>
            <a className="btn btn-outline" href={`${base}/export`} download>Export CSV</a>
            <SendAllButton action={invite} weddingId={w.id} />
          </>
        } />

      {/*
        The send result used to live here, put in the URL by a redirect. It now
        appears beside the button that caused it — closer to the action, gone on
        the next press, and impossible to arrive at by typing a query string.
        The import banner below still redirects, so it stays as it was.
      */}
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
                      <InviteOneButton
                        action={resend}
                        guestId={g.id}
                        weddingId={w.id}
                        alreadySent={!!g.invitedAt}
                      />
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
