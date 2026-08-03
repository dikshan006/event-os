import Link from "next/link";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { requireStudio, ownWedding } from "@/server/services/context";
import {
  seatingPlan, createTable, updateTable, deleteTable, assignGuest, unassignGuest,
} from "@/server/services/seating";
import { AddGuestDialog, EditTableDialog, DeleteTableDialog } from "@/components/seating";
import { reportError } from "@/lib/errors";
import { PageHead } from "@/components/ui";

const FLASH = "seating_flash";

async function flash(message: string, tone: "ok" | "err") {
  (await cookies()).set(FLASH, `${tone}:${message}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 15,
  });
}

export default async function SeatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const plan = await seatingPlan(studioId, w.id);

  const jar = await cookies();
  const raw = jar.get(FLASH)?.value;
  const notice = raw ? { tone: raw.slice(0, raw.indexOf(":")), message: raw.slice(raw.indexOf(":") + 1) } : null;

  const refresh = (weddingId: string) => revalidatePath(`/studio/weddings/${weddingId}/seating`);

  async function addTable(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    try {
      await createTable(studioId, weddingId, String(formData.get("name") ?? ""),
        Number(formData.get("seats") ?? 8), user.name);
    } catch (err) {
      await flash(reportError("seating-create", err, "That table could not be added."), "err");
    }
    refresh(weddingId);
  }

  async function editTable(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    try {
      await updateTable(studioId, String(formData.get("tableId")),
        String(formData.get("name") ?? ""), Number(formData.get("seats") ?? 8));
    } catch (err) {
      await flash(reportError("seating-update", err, "That table could not be updated."), "err");
    }
    refresh(weddingId);
  }

  async function removeTable(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    try {
      await deleteTable(studioId, String(formData.get("tableId")), user.name);
    } catch (err) {
      await flash(reportError("seating-delete", err, "That table could not be deleted."), "err");
    }
    refresh(weddingId);
  }

  async function seat(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    try {
      await assignGuest(studioId, String(formData.get("guestId")), String(formData.get("tableId")));
    } catch (err) {
      await flash(reportError("seating-assign", err, "That guest could not be seated."), "err");
    }
    refresh(weddingId);
  }

  async function unseat(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    await unassignGuest(studioId, String(formData.get("guestId")));
    refresh(weddingId);
  }

  const tabs = [
    [`/studio/weddings/${w.id}`, "Content"],
    [`/studio/weddings/${w.id}/photos`, "Photos"],
    [`/studio/weddings/${w.id}/guests`, "Guests"],
    [`/studio/weddings/${w.id}/seating`, "Seating"],
    [`/studio/weddings/${w.id}/schedule`, "Schedule"],
    [`/studio/weddings/${w.id}/registry`, "Registry"],
    [`/studio/weddings/${w.id}/rsvps`, "RSVPs"],
  ] as const;

  const { tables, unassigned, totals } = plan;
  // Bound the payload: the picker ships guest names to the browser once and
  // every table's dialog reads the same array.
  const pickable = unassigned.map(g => ({ id: g.id, name: g.name, groups: g.groups }));

  return (
    <>
      <PageHead
        eyebrow={`${w.partnerOne} & ${w.partnerTwo}`}
        title="Seating"
        sub="Build the reception plan. A guest can only be seated at one table, so anyone still in the unassigned list needs a home."
        actions={<Link className="btn btn-outline" href={`/studio/weddings/${w.id}/guests`}>Manage guests →</Link>}
      />

      <div className="row wrap" style={{ marginBottom: 24 }}>
        {tabs.map(([href, label]) => (
          <Link key={href} href={href} className={`btn btn-sm ${label === "Seating" ? "btn-accent" : "btn-outline"}`}>{label}</Link>
        ))}
      </div>

      {notice && (
        <div className="note" style={{ marginBottom: 20, borderStyle: "solid", ...(notice.tone === "err" ? { color: "var(--wine)" } : {}) }}>
          {notice.message}
        </div>
      )}

      <div className="stats" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
        <div className="card stat"><div className="v">{tables.length}</div><div className="l">Tables</div></div>
        <div className="card stat"><div className="v">{totals.seats}</div><div className="l">Seats created</div></div>
        <div className="card stat"><div className="v">{totals.seated}</div><div className="l">Guests seated</div></div>
        <div className="card stat">
          <div className="v" style={totals.unseated ? { color: "var(--wine)" } : undefined}>{totals.unseated}</div>
          <div className="l">Still to seat</div>
        </div>
      </div>

      <div className="work">
        <div>
          {tables.length === 0 ? (
            <div className="card empty">No tables yet. Create the first one to start seating guests.</div>
          ) : (
            <div className="seat-grid">
              {tables.map(t => {
                const seated = t.guests.length;
                const remaining = t.seats - seated;
                return (
                  <section className="card pad seat-table" key={t.id}>
                    <div className="row between wrap" style={{ gap: 10 }}>
                      <h2 className="section-t" style={{ margin: 0 }}>{t.name}</h2>
                      <span className={`chip ${remaining === 0 ? "sage" : ""}`}>{seated} / {t.seats}</span>
                    </div>

                    <div className="bar" style={{ margin: "12px 0 16px" }}>
                      <i style={{ width: `${Math.min(100, (seated / t.seats) * 100)}%` }} />
                    </div>

                    {seated === 0 ? (
                      <p className="hint" style={{ marginBottom: 16 }}>No guests seated here yet.</p>
                    ) : (
                      <ul className="seat-list">
                        {t.guests.map(g => (
                          <li key={g.id}>
                            <span className="seat-name">
                              {g.name}
                              {g.rsvp?.status === "DECLINED" && <span className="seat-flag">declined</span>}
                              {!g.rsvp && <span className="seat-flag quiet">awaiting reply</span>}
                            </span>
                            <form action={unseat}>
                              <input type="hidden" name="guestId" value={g.id} />
                              <input type="hidden" name="weddingId" value={w.id} />
                              <button className="btn btn-ghost btn-sm" type="submit"
                                aria-label={`Remove ${g.name} from ${t.name}`}>Remove</button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="row wrap" style={{ marginTop: 16, gap: 6 }}>
                      <AddGuestDialogWrapper
                        action={seat} weddingId={w.id} tableId={t.id} tableName={t.name}
                        remaining={remaining} guests={pickable}
                      />
                      <EditTableDialogWrapper
                        action={editTable} weddingId={w.id} tableId={t.id}
                        name={t.name} seats={t.seats} seated={seated}
                      />
                      <DeleteTableDialogWrapper
                        action={removeTable} weddingId={w.id} tableId={t.id}
                        name={t.name} seated={seated}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="work-panel" style={{ display: "grid", gap: 20 }}>
          <form action={addTable} className="card pad frm">
            <h2 className="section-t">New table</h2>
            <input type="hidden" name="weddingId" value={w.id} />
            <div className="field">
              <label htmlFor="t-name">Name</label>
              <input id="t-name" className="inp" name="name" placeholder={`Table ${tables.length + 1}`} maxLength={60} />
            </div>
            <div className="field">
              <label htmlFor="t-seats">Seats</label>
              <input id="t-seats" className="inp" name="seats" type="number" min={1} max={30} defaultValue={8} />
            </div>
            <button className="btn btn-primary" type="submit">Create table</button>
          </form>

          {/* The list a planner actually works from: who still needs a seat. */}
          <div className="card pad">
            <div className="row between" style={{ marginBottom: 12 }}>
              <h2 className="section-t" style={{ margin: 0 }}>Unassigned</h2>
              <span className={`chip ${unassigned.length ? "wine" : "sage"}`}>{unassigned.length}</span>
            </div>
            {unassigned.length === 0 ? (
              <p className="hint">Every guest has a seat.</p>
            ) : (
              <ul className="seat-unassigned">
                {unassigned.map(g => (
                  <li key={g.id}>
                    <span>{g.name}</span>
                    {g.groups.length > 0 && <span className="meta">{g.groups.join(" · ")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* Thin server wrappers so each dialog gets the weddingId in its form data
   without the client components needing to know about routing. */

function AddGuestDialogWrapper(props: {
  action: (fd: FormData) => Promise<void>; weddingId: string; tableId: string;
  tableName: string; remaining: number; guests: { id: string; name: string; groups: string[] }[];
}) {
  const bound = async (fd: FormData) => {
    "use server";
    fd.set("weddingId", props.weddingId);
    await props.action(fd);
  };
  return <AddGuestDialog action={bound} tableId={props.tableId} tableName={props.tableName}
    remaining={props.remaining} guests={props.guests} />;
}

function EditTableDialogWrapper(props: {
  action: (fd: FormData) => Promise<void>; weddingId: string; tableId: string;
  name: string; seats: number; seated: number;
}) {
  const bound = async (fd: FormData) => {
    "use server";
    fd.set("weddingId", props.weddingId);
    await props.action(fd);
  };
  return <EditTableDialog action={bound} tableId={props.tableId} name={props.name}
    seats={props.seats} seated={props.seated} />;
}

function DeleteTableDialogWrapper(props: {
  action: (fd: FormData) => Promise<void>; weddingId: string; tableId: string;
  name: string; seated: number;
}) {
  const bound = async (fd: FormData) => {
    "use server";
    fd.set("weddingId", props.weddingId);
    await props.action(fd);
  };
  return <DeleteTableDialog action={bound} tableId={props.tableId} name={props.name} seated={props.seated} />;
}
