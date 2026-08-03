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

/**
 * Both helpers live at module scope, not inside the component.
 *
 * A server action handed to a Client Component has its captured scope
 * serialized, and every captured function must itself be a server action. A
 * plain closure declared in the component body therefore crashes the render
 * with "Functions cannot be passed directly to Client Components" — which is
 * exactly what took this page down once already.
 */
async function flash(message: string, tone: "ok" | "err") {
  (await cookies()).set(FLASH, `${tone}:${message}`, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 15,
  });
}

function refresh(weddingId: string) {
  revalidatePath(`/studio/weddings/${weddingId}/seating`);
  // The invitation shows each guest their table, so it has to re-render too.
  revalidatePath("/invite/[code]", "page");
}

export default async function SeatingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const events = await seatingPlan(studioId, w.id);

  const jar = await cookies();
  const raw = jar.get(FLASH)?.value;
  const notice = raw ? { tone: raw.slice(0, raw.indexOf(":")), message: raw.slice(raw.indexOf(":") + 1) } : null;

  async function addTable(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    try {
      await createTable(studioId, String(formData.get("eventId")),
        String(formData.get("name") ?? ""), Number(formData.get("capacity") ?? 8), user.name);
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
        String(formData.get("name") ?? ""), Number(formData.get("capacity") ?? 8));
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
    await unassignGuest(studioId, String(formData.get("seatId")));
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

  const seatedEvents = events.filter(e => e.tables.length > 0);

  return (
    <>
      <PageHead
        eyebrow={`${w.partnerOne} & ${w.partnerTwo}`}
        title="Seating"
        sub="Each event keeps its own plan. A ceremony needs no tables; a dinner and a brunch can seat the same guests differently."
        actions={<Link className="btn btn-outline" href={`/studio/weddings/${w.id}/schedule`}>Manage events →</Link>}
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

      {events.length === 0 ? (
        <div className="card empty">
          Seating is arranged per event, so add an event on the Schedule tab first —
          a reception dinner, for instance — then come back to build its tables.
        </div>
      ) : (
        <>
          {seatedEvents.length > 0 && (
            <p className="meta" style={{ marginBottom: 20 }}>
              {seatedEvents.length} of {events.length} event{events.length === 1 ? "" : "s"} has seating.
              Events without tables simply do not show one to guests.
            </p>
          )}

          <div style={{ display: "grid", gap: 34 }}>
            {events.map(ev => {
              const pickable = ev.unassigned.map(g => ({ id: g.id, name: g.name, groups: g.groups }));
              return (
                <section key={ev.id} className="seat-event">
                  <header className="seat-event-head">
                    <div>
                      <h2 className="section-t" style={{ margin: 0 }}>{ev.title}</h2>
                      <p className="meta">
                        {[ev.day, ev.time, ev.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="row wrap" style={{ gap: 8 }}>
                      {ev.tables.length > 0 && (
                        <>
                          <span className="chip">{ev.tables.length} table{ev.tables.length === 1 ? "" : "s"}</span>
                          <span className={`chip ${ev.totals.unseated ? "wine" : "sage"}`}>
                            {ev.totals.seated} / {ev.totals.guests} seated
                          </span>
                        </>
                      )}
                    </div>
                  </header>

                  <div className="work">
                    <div>
                      {ev.tables.length === 0 ? (
                        <div className="card empty" style={{ padding: 32 }}>
                          No tables for {ev.title}. If this event does not need seating, leave it as it is.
                        </div>
                      ) : (
                        <div className="seat-grid">
                          {ev.tables.map(t => {
                            const seated = t.seats.length;
                            const remaining = t.capacity - seated;
                            return (
                              <section className="card pad seat-table" key={t.id}>
                                <div className="row between wrap" style={{ gap: 10 }}>
                                  <h3 className="section-t" style={{ margin: 0 }}>{t.name}</h3>
                                  <span className={`chip ${remaining === 0 ? "sage" : ""}`}>{seated} / {t.capacity}</span>
                                </div>

                                <div className="bar" style={{ margin: "12px 0 16px" }}>
                                  <i style={{ width: `${Math.min(100, (seated / t.capacity) * 100)}%` }} />
                                </div>

                                {seated === 0 ? (
                                  <p className="hint" style={{ marginBottom: 16 }}>No guests seated here yet.</p>
                                ) : (
                                  <ul className="seat-list">
                                    {t.seats.map(s => (
                                      <li key={s.id}>
                                        <span className="seat-name">
                                          {s.guest.name}
                                          {s.guest.rsvp?.status === "DECLINED" && <span className="seat-flag">declined</span>}
                                          {!s.guest.rsvp && <span className="seat-flag quiet">awaiting reply</span>}
                                        </span>
                                        <form action={unseat}>
                                          <input type="hidden" name="seatId" value={s.id} />
                                          <input type="hidden" name="weddingId" value={w.id} />
                                          <button className="btn btn-ghost btn-sm" type="submit"
                                            aria-label={`Remove ${s.guest.name} from ${t.name}`}>Remove</button>
                                        </form>
                                      </li>
                                    ))}
                                  </ul>
                                )}

                                <div className="row wrap" style={{ marginTop: 16, gap: 6 }}>
                                  <AddGuestDialog action={seat} weddingId={w.id} tableId={t.id}
                                    tableName={t.name} eventTitle={ev.title}
                                    remaining={remaining} guests={pickable} />
                                  <EditTableDialog action={editTable} weddingId={w.id} tableId={t.id}
                                    name={t.name} capacity={t.capacity} seated={seated} />
                                  <DeleteTableDialog action={removeTable} weddingId={w.id} tableId={t.id}
                                    name={t.name} eventTitle={ev.title} seated={seated} />
                                </div>
                              </section>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="work-panel" style={{ display: "grid", gap: 20 }}>
                      <form action={addTable} className="card pad frm">
                        <h3 className="section-t">New table</h3>
                        <p className="hint" style={{ marginTop: -8 }}>for {ev.title}</p>
                        <input type="hidden" name="weddingId" value={w.id} />
                        <input type="hidden" name="eventId" value={ev.id} />
                        <div className="field">
                          <label htmlFor={`n-${ev.id}`}>Name</label>
                          <input id={`n-${ev.id}`} className="inp" name="name"
                            placeholder={`Table ${ev.tables.length + 1}`} maxLength={60} />
                        </div>
                        <div className="field">
                          <label htmlFor={`c-${ev.id}`}>Capacity</label>
                          <input id={`c-${ev.id}`} className="inp" name="capacity" type="number"
                            min={1} max={30} defaultValue={8} />
                        </div>
                        <button className="btn btn-primary" type="submit">Create table</button>
                      </form>

                      {ev.tables.length > 0 && (
                        <div className="card pad">
                          <div className="row between" style={{ marginBottom: 12 }}>
                            <h3 className="section-t" style={{ margin: 0 }}>Unassigned</h3>
                            <span className={`chip ${ev.unassigned.length ? "wine" : "sage"}`}>{ev.unassigned.length}</span>
                          </div>
                          {ev.unassigned.length === 0 ? (
                            <p className="hint">Every guest has a seat at {ev.title}.</p>
                          ) : (
                            <ul className="seat-unassigned">
                              {ev.unassigned.map(g => (
                                <li key={g.id}>
                                  <span>{g.name}</span>
                                  {g.groups.length > 0 && <span className="meta">{g.groups.join(" · ")}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
