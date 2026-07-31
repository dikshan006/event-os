import { requireStudio, ownWedding } from "@/server/services/context";
import { listEvents, addEvent, deleteEvent } from "@/server/services/events";
import { listGuests } from "@/server/services/guests";
import { PageHead } from "@/components/ui";
import { zEvent } from "@/lib/validators";
import { GROUPS } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);
  const [events, guests] = await Promise.all([listEvents(studioId, w.id), listGuests(studioId, w.id)]);
  const days = [...new Set(events.map(e => e.day))];

  async function add(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("weddingId"));
    const input = zEvent.parse({
      title: formData.get("title"),
      day: formData.get("day"),
      time: formData.get("time"),
      location: formData.get("location") ?? "",
      dressCode: formData.get("dressCode") ?? "",
      isPublic: formData.get("isPublic") === "on",
      audiences: formData.getAll("audiences").map(String),
    });
    await addEvent(studioId, weddingId, input);
    revalidatePath(`/studio/weddings/${weddingId}/schedule`);
  }
  async function remove(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    await deleteEvent(studioId, String(formData.get("eventId")));
    revalidatePath(`/studio/weddings/${String(formData.get("weddingId"))}/schedule`);
  }

  return (
    <>
      <PageHead eyebrow={`${w.partnerOne} & ${w.partnerTwo}`} title="Schedule Builder"
        sub="Create events once and choose the audience. Every guest automatically receives their own personalized schedule." />
      <div className="split">
        <div>
          {days.map(day => (
            <div key={day} style={{ marginBottom: 22 }}>
              <div className="serif" style={{ fontSize: 20, margin: "0 0 10px" }}>{day}</div>
              <div className="card">
                {events.filter(e => e.day === day).map(e => (
                  <div key={e.id} className="row" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", alignItems: "flex-start" }}>
                    <div style={{ width: 78, fontWeight: 600, fontSize: 13 }}>{e.time}</div>
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{e.title}</div>
                      <div className="meta">{e.location} · {e.dressCode}</div>
                      <div className="row wrap" style={{ marginTop: 8 }}>
                        {e.isPublic
                          ? <span className="chip" style={{ background: "var(--ink)", color: "#fff", borderColor: "transparent" }}>All Guests</span>
                          : e.audiences.map(a => <span key={a} className="chip rose">{a}</span>)}
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
          <div className="field"><label>Title</label><input className="inp" name="title" required placeholder="e.g. Welcome Dinner" /></div>
          <div className="frm two">
            <div className="field"><label>Day</label><input className="inp" name="day" required placeholder="Friday, September 24" /></div>
            <div className="field"><label>Time</label><input className="inp" name="time" required placeholder="7:00 PM" /></div>
            <div className="field"><label>Location</label><input className="inp" name="location" /></div>
            <div className="field"><label>Dress code</label><input className="inp" name="dressCode" /></div>
          </div>
          <label className="check"><input type="checkbox" name="isPublic" /> Visible to all guests</label>
          <div className="field"><label>Or pick an audience</label>
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
