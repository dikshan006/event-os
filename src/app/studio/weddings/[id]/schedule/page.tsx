import { requireStudio, ownWedding } from "@/server/services/context";
import { listEvents, addEvent, deleteEvent } from "@/server/services/events";
import { listGuests } from "@/server/services/guests";
import { PageHead } from "@/components/ui";
import { zEvent } from "@/lib/validators";
import { GROUPS } from "@/lib/utils";
import { utcToZonedInputs } from "@/lib/timezone";
import { revalidatePath } from "next/cache";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const [events, guests] = await Promise.all([listEvents(studioId, w.id), listGuests(studioId, w.id)]);
  const days = [...new Set(events.map(e => e.day))];

  // Events with no real start cannot appear in a guest's calendar. Surfaced as
  // a prompt rather than left silent: the guest-side button simply does not
  // render, and the planner would otherwise have no way to know why.
  const undated = events.filter(e => !e.startsAt);

  // Defaults to the wedding's own date — the right answer for most events, and
  // one less thing to type.
  const defaultDate = utcToZonedInputs(w.date, w.timeZone).date;

  async function add(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const input = zEvent.parse({
      title: formData.get("title"),
      date: formData.get("date"),
      startTime: formData.get("startTime") ?? "",
      endTime: formData.get("endTime") ?? "",
      dayLabel: formData.get("dayLabel") ?? "",
      timeLabel: formData.get("timeLabel") ?? "",
      description: formData.get("description") ?? "",
      location: formData.get("location") ?? "",
      address: formData.get("address") ?? "",
      lat: formData.get("lat") ?? "",
      lng: formData.get("lng") ?? "",
      dressCode: formData.get("dressCode") ?? "",
      isPublic: formData.get("isPublic") === "on",
      audiences: formData.getAll("audiences").map(String),
    });
    await addEvent(studioId, weddingId, input);
    revalidatePath(`/studio/weddings/${weddingId}/schedule`);
    // Each guest's invitation shows their own schedule and links to their own
    // calendar file, so both have to re-render.
    revalidatePath("/invite/[code]", "page");
  }

  async function remove(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await deleteEvent(studioId, String(formData.get("eventId")));
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/schedule`);
    revalidatePath("/invite/[code]", "page");
  }

  return (
    <>
      <PageHead back={`/studio/weddings/${w.id}`} eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="Schedule Builder"
        sub="Create events once and choose the audience. Every guest receives their own personalized schedule — and can add it to their calendar in one tap." />

      {undated.length > 0 && (
        <div className="note" style={{ marginBottom: 20, borderStyle: "solid" }}>
          {undated.length === 1 ? "One event has" : `${undated.length} events have`} no start time, so
          guests are not offered an &ldquo;Add to calendar&rdquo; button for{" "}
          {undated.length === 1 ? "it" : "them"}: <b>{undated.map(e => e.title).join(", ")}</b>.
        </div>
      )}

      <div className="split">
        <div>
          {days.map(day => (
            <div key={day} style={{ marginBottom: 22 }}>
              <div className="serif" style={{ fontSize: 20, margin: "0 0 10px" }}>{day}</div>
              <div className="card">
                {events.filter(e => e.day === day).map(e => (
                  <div key={e.id} className="row" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
                    <div style={{ width: 78, fontWeight: 600, fontSize: 13 }}>{e.time || "—"}</div>
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{e.title}</div>
                      <div className="meta">{[e.location, e.dressCode].filter(Boolean).join(" · ")}</div>
                      <div className="row wrap" style={{ marginTop: 8 }}>
                        {e.isPublic
                          ? <span className="chip" style={{ background: "var(--ink)", color: "#fff", borderColor: "transparent" }}>All Guests</span>
                          : e.audiences.map(a => <span key={a} className="chip rose">{a}</span>)}
                        {e.startsAt
                          ? <span className="chip sage">In calendars</span>
                          : <span className="chip wine">No time set</span>}
                      </div>
                    </div>
                    <form action={remove}>
                      <input type="hidden" name="eventId" value={e.id} />
                      <input type="hidden" name="weddingId" value={w.id} />
                      <button className="btn btn-ghost btn-sm" type="submit">Remove</button>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!events.length && <div className="card empty">No events yet — add the first one and the schedule builds itself.</div>}
          {guests.length > 0 && (
            <div className="note">
              Personalization check: {guests[0].name} ({guests[0].groups.join(", ") || "no groups"}) currently sees{" "}
              {events.filter(e => e.isPublic || e.audiences.some(a => guests[0].groups.includes(a))).length} of {events.length} events.
            </div>
          )}
        </div>

        <form action={add} className="card pad frm" style={{ position: "sticky", top: 24 }}>
          <h2 className="section-t">Add event</h2>
          <input type="hidden" name="weddingId" value={w.id} />

          <div className="field">
            <label htmlFor="ev-title">Title</label>
            <input id="ev-title" className="inp" name="title" required placeholder="e.g. Welcome Dinner" />
          </div>

          <div className="field">
            <label htmlFor="ev-date">Date</label>
            <input id="ev-date" className="inp" name="date" type="date" required defaultValue={defaultDate} />
            <span className="hint">Times are read as {w.timeZone.replace(/_/g, " ")}. Change that on the Content tab.</span>
          </div>

          <div className="frm two">
            <div className="field">
              <label htmlFor="ev-start">Start time</label>
              <input id="ev-start" className="inp" name="startTime" type="time" />
            </div>
            <div className="field">
              <label htmlFor="ev-end">End time</label>
              <input id="ev-end" className="inp" name="endTime" type="time" />
            </div>
          </div>

          <div className="frm two">
            <div className="field">
              <label htmlFor="ev-loc">Location</label>
              <input id="ev-loc" className="inp" name="location" placeholder="Blank uses the venue" />
            </div>
            <div className="field">
              <label htmlFor="ev-dress">Dress code</label>
              <input id="ev-dress" className="inp" name="dressCode" />
            </div>
          </div>

          <div className="field">
            <label htmlFor="ev-addr">Address</label>
            <input id="ev-addr" className="inp" name="address" placeholder="Only if it differs from the venue" />
            <span className="hint">Guests tap this for directions. Blank inherits the wedding&rsquo;s address.</span>
          </div>

          <div className="field">
            <label htmlFor="ev-desc">Description</label>
            <textarea id="ev-desc" className="inp" name="description" rows={2} />
          </div>

          {/* Folded away: most planners never need a display override or a
              coordinate, and putting either on the surface would turn a simple
              form into a configuration screen. */}
          <details className="frm-more">
            <summary>Advanced</summary>
            <div className="frm two" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="ev-daylabel">Day label</label>
                <input id="ev-daylabel" className="inp" name="dayLabel" placeholder="From the date" />
              </div>
              <div className="field">
                <label htmlFor="ev-timelabel">Time label</label>
                <input id="ev-timelabel" className="inp" name="timeLabel" placeholder="e.g. Late" />
              </div>
              <div className="field">
                <label htmlFor="ev-lat">Latitude</label>
                <input id="ev-lat" className="inp" name="lat" inputMode="decimal" placeholder="41.8902" />
              </div>
              <div className="field">
                <label htmlFor="ev-lng">Longitude</label>
                <input id="ev-lng" className="inp" name="lng" inputMode="decimal" placeholder="12.4922" />
              </div>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              Labels are generated from the date and time unless you write your own.
              Coordinates only make the map pin exact — the address alone works.
            </p>
          </details>

          <label className="check"><input type="checkbox" name="isPublic" /> Visible to all guests</label>
          <div className="field">
            <label>Or pick an audience</label>
            <div className="row wrap">
              {GROUPS.map(gr => <label key={gr} className="check"><input type="checkbox" name="audiences" value={gr} /> {gr}</label>)}
            </div>
          </div>
          <button className="btn btn-primary" type="submit">Add event</button>
        </form>
      </div>
    </>
  );
}
