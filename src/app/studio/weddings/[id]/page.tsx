import Link from "next/link";
import { requireStudio, ownWedding } from "@/server/services/context";
import { updateWedding } from "@/server/services/weddings";
import { PageHead, StatusChip } from "@/components/ui";
import { zWedding } from "@/lib/validators";
import { TEMPLATES, SECTIONS } from "@/lib/utils";
import { TimeZoneField } from "@/components/TimeZoneField";
import { revalidatePath } from "next/cache";

export default async function WeddingEditor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { studioId } = await requireStudio();
  const w = await ownWedding(studioId, id);

  async function save(formData: FormData) {
    "use server";
    const { studioId } = await requireStudio();
    const weddingId = String(formData.get("id"));
    const input = zWedding.parse({
      partnerOne: formData.get("partnerOne"),
      partnerTwo: formData.get("partnerTwo"),
      date: formData.get("date"),
      venue: formData.get("venue") ?? "",
      city: formData.get("city") ?? "",
      venueAddress: formData.get("venueAddress") ?? "",
      venueLat: formData.get("venueLat") ?? "",
      venueLng: formData.get("venueLng") ?? "",
      timeZone: formData.get("timeZone") ?? "UTC",
      story: formData.get("story") ?? "",
      venueNote: formData.get("venueNote") ?? "",
      accommodation: formData.get("accommodation") ?? "",
      travelNote: formData.get("travelNote") ?? "",
      template: formData.get("template"),
      sections: formData.getAll("sections").map(String),
    });
    await updateWedding(studioId, weddingId, input);
    revalidatePath(`/studio/weddings/${weddingId}`);
    revalidatePath(`/w`);
  }

  const dateValue = w.date.toISOString().slice(0, 10);
  const tabs = [
    [`/studio/weddings/${w.id}`, "Content"],
    [`/studio/weddings/${w.id}/photos`, "Photos"],
    [`/studio/weddings/${w.id}/guests`, "Guests"],
    [`/studio/weddings/${w.id}/seating`, "Seating"],
    [`/studio/weddings/${w.id}/schedule`, "Schedule"],
    [`/studio/weddings/${w.id}/registry`, "Registry"],
    [`/studio/weddings/${w.id}/rsvps`, "RSVPs"],
  ] as const;

  return (
    <>
      <PageHead back="/studio/weddings" eyebrow={TEMPLATES[w.template].name}
        title={`${w.partnerOne} & ${w.partnerTwo}`}
        sub={w.venue ? `${w.venue} · ${w.city ?? ""}` : undefined}
        actions={
          <>
            <StatusChip s={w.status} />
            {/* Preview always points at the draft route, which renders the real
                site from whatever is currently saved. It used to point at
                `/w/[slug]`, which filters on PUBLISHED and so 404s on every
                draft — meaning the first time a planner saw their own work was
                after publishing it. The live link is offered as well, but only
                once there is something live to link to. */}
            <Link className="btn btn-outline" href={`/studio/weddings/${w.id}/preview`}>
              Preview website
            </Link>
            {w.status === "PUBLISHED" && (
              <a className="btn btn-outline" href={`/w/${w.slug}`} target="_blank" rel="noreferrer">
                View live ↗
              </a>
            )}
          </>
        } />
      <div className="row wrap" style={{ marginBottom: 24 }}>
        {tabs.map(([href, label], i) => (
          <Link key={href} href={href} className={`btn btn-sm ${i === 0 ? "btn-accent" : "btn-outline"}`}>{label}</Link>
        ))}
      </div>

      <form action={save} className="card pad frm" style={{ maxWidth: 720 }}>
        <input type="hidden" name="id" value={w.id} />
        <div className="frm two">
          <div className="field"><label>Partner one</label><input className="inp" name="partnerOne" defaultValue={w.partnerOne} required /></div>
          <div className="field"><label>Partner two</label><input className="inp" name="partnerTwo" defaultValue={w.partnerTwo} required /></div>
          <div className="field"><label>Date</label><input className="inp" type="date" name="date" defaultValue={dateValue} required /></div>
          <div className="field"><label>City</label><input className="inp" name="city" defaultValue={w.city ?? ""} /></div>
        </div>
        <div className="field"><label htmlFor="w-venue">Venue</label>
          <input id="w-venue" className="inp" name="venue" defaultValue={w.venue ?? ""} placeholder="e.g. Villa Aurelia" /></div>

        {/* Everything a guest needs to navigate comes from these three fields.
            No map key, no place picker, no lookup — the planner types the venue
            the way they would write it on a card. */}
        <div className="field"><label htmlFor="w-address">Venue address</label>
          <input id="w-address" className="inp" name="venueAddress" defaultValue={w.venueAddress ?? ""}
            placeholder="Via Angelo Masina 5, 00153 Roma" />
          <span className="hint">Powers one-tap directions on every guest&rsquo;s invitation. Every event inherits it unless it sets its own.</span>
        </div>

        <TimeZoneField value={w.timeZone} />

        <details className="frm-more">
          <summary>Venue coordinates</summary>
          <div className="frm two" style={{ marginTop: 12 }}>
            <div className="field"><label htmlFor="w-lat">Latitude</label>
              <input id="w-lat" className="inp" name="venueLat" inputMode="decimal"
                defaultValue={w.venueLat ?? ""} placeholder="41.8902" /></div>
            <div className="field"><label htmlFor="w-lng">Longitude</label>
              <input id="w-lng" className="inp" name="venueLng" inputMode="decimal"
                defaultValue={w.venueLng ?? ""} placeholder="12.4922" /></div>
          </div>
          <p className="hint" style={{ marginTop: 10 }}>
            Optional. The address alone opens the right place for anywhere with a postal
            address; coordinates help for a field, a private estate, or a venue that
            shares its name with somewhere else.
          </p>
        </details>
        <div className="field"><label>Story</label><textarea className="inp" name="story" defaultValue={w.story ?? ""} /></div>

        <fieldset style={{ border: 0, display: "grid", gap: 16 }}>
          <legend className="eyebrow" style={{ marginBottom: 4 }}>Travel</legend>
          <p className="hint" style={{ marginTop: -8 }}>
            Guests only see what you write here. Leave all three blank and the Travel
            section is hidden from the website entirely.
          </p>
          <div className="field">
            <label>About the venue</label>
            <textarea className="inp" name="venueNote" defaultValue={w.venueNote ?? ""}
              placeholder="Parking, arrival instructions, anything guests should know on the day." />
          </div>
          <div className="field">
            <label>Where to stay</label>
            <textarea className="inp" name="accommodation" defaultValue={w.accommodation ?? ""}
              placeholder="Hotels, room blocks and booking codes." />
          </div>
          <div className="field">
            <label>Getting here</label>
            <textarea className="inp" name="travelNote" defaultValue={w.travelNote ?? ""}
              placeholder="Nearest airports, transfers, taxis." />
          </div>
        </fieldset>
        <div className="field"><label>Template</label>
          <select className="inp" name="template" defaultValue={w.template}>
            {Object.entries(TEMPLATES).map(([k, T]) => <option key={k} value={k}>{T.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Website sections</label>
          <div className="row wrap">
            {SECTIONS.map(([value, label]) => (
              <label key={value} className="check">
                <input type="checkbox" name="sections" value={value} defaultChecked={w.sections.includes(value)} /> {label}
              </label>
            ))}
          </div>
        </div>
        <div><button className="btn btn-primary" type="submit">Save changes</button></div>
      </form>
    </>
  );
}
