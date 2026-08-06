import { redirect } from "next/navigation";
import { requireStudio } from "@/server/services/context";
import { createWedding } from "@/server/services/weddings";
import { importGuests } from "@/server/services/guests";
import { PageHead } from "@/components/ui";
import { zWedding } from "@/lib/validators";
import { TimeZoneField } from "@/components/TimeZoneField";
import { CustomDesignCard } from "@/components/CustomDesignCard";
import { requestCustomTemplate } from "./actions";
import { TEMPLATES, SECTIONS } from "@/lib/utils";

export default async function NewWedding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireStudio();
  const { error } = await searchParams;

  async function create(formData: FormData) {
    "use server";
    const { studioId, user } = await requireStudio();

    /**
     * `safeParse`, not `parse`.
     *
     * A throw here is an unhandled exception inside a server action, which
     * Next renders as "Application error: a server-side exception has occurred"
     * with a digest and nothing else — no field, no value, no hint. That is
     * what a planner saw for three of the six templates. A validation failure
     * is an expected outcome of a form submission, not a crash, and it should
     * read like one.
     */
    const parsed = zWedding.safeParse({
      partnerOne: formData.get("partnerOne"),
      partnerTwo: formData.get("partnerTwo"),
      date: formData.get("date"),
      venue: formData.get("venue"),
      venueAddress: formData.get("venueAddress") ?? "",
      timeZone: String(formData.get("timeZone") || "UTC"),
      city: formData.get("city") ?? "",
      story: formData.get("story") ?? "",
      template: formData.get("template"),
      sections: formData.getAll("sections").map(String),
    });

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path.join(".") || "form";
      redirect(`/studio/weddings/new?error=${encodeURIComponent(`${field}: ${issue?.message ?? "invalid value"}`)}`);
    }

    const wedding = await createWedding(studioId, user.name, parsed.data);
    const csv = String(formData.get("guests") ?? "").trim();
    if (csv) await importGuests(studioId, wedding.id, user.name, csv);
    redirect(`/studio/weddings/${wedding.id}`);
  }

  return (
    <>
      <PageHead back="/studio/weddings" eyebrow="New wedding" title="Create New Wedding"
        sub="Choose a template, add the couple, personalize the content. The layout can never break." />
      {error && (
        <p className="note" role="alert" style={{ maxWidth: 760, marginBottom: 16, borderColor: "var(--wine)", color: "var(--wine)" }}>
          {error}
        </p>
      )}
      <form action={create} className="frm" style={{ maxWidth: 760 }}>
        <div className="card pad frm">
          <h2 className="section-t">Choose your template</h2>
          <p className="hint" style={{ marginTop: -8, marginBottom: 4 }}>
            Every template shows the same sample wedding, so you are comparing the design
            rather than the words. Previews open in a new tab and save nothing.
          </p>
          <div className="tpl-grid">
            {Object.entries(TEMPLATES).map(([key, T], i) => (
              <div key={key} className="tpl-card" style={{ borderTop: `4px solid ${T.color}` }}>
                <label className="tpl-choice">
                  <input type="radio" name="template" value={key} defaultChecked={i === 0} required />
                  <span>
                    <b className="serif">{T.name}</b>
                    <span className="meta">{T.desc}</span>
                  </span>
                </label>
                {/* A new tab, so the details already typed into this form survive. */}
                <a className="btn btn-outline btn-sm tpl-preview"
                  href={`/studio/templates/${key.toLowerCase()}`}
                  target="_blank" rel="noopener noreferrer">
                  Preview template <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            ))}
            {/*
              Last in the grid, after all six. It is an ask rather than a
              choice, so it deliberately has no radio — see CustomDesignCard.
            */}
            <CustomDesignCard action={requestCustomTemplate} />
          </div>
        </div>

        <div className="card pad frm">
          <h2 className="section-t">Couple Details</h2>
          <div className="frm two">
            <div className="field"><label>Partner one</label><input className="inp" name="partnerOne" required placeholder="e.g. Sarah" /></div>
            <div className="field"><label>Partner two</label><input className="inp" name="partnerTwo" required placeholder="e.g. James" /></div>
            <div className="field"><label>Wedding date</label><input className="inp" name="date" type="date" required /></div>
            <div className="field"><label>City</label><input className="inp" name="city" placeholder="e.g. Charleston, SC" /></div>
          </div>
          <div className="field"><label>Venue</label><input className="inp" name="venue" placeholder="e.g. The Magnolia Estate" /></div>
          <div className="field"><label>Venue address</label>
            <input className="inp" name="venueAddress" placeholder="Street, city, postcode" />
            <span className="hint">Gives guests one-tap directions. You can add it later.</span>
          </div>
          <TimeZoneField />
          <div className="field"><label>Your story</label>
            <textarea className="inp" name="story" placeholder="Our journey began with a chance meeting…" /></div>
          <div className="field"><label>Website sections</label>
            <div className="row wrap">
              {SECTIONS.map(([value, label]) => (
                <label key={value} className="check">
                  <input type="checkbox" name="sections" value={value} defaultChecked /> {label}
                </label>
              ))}
            </div>
            <span className="hint">Hero, story, timeline and RSVP are always included.</span>
          </div>
        </div>

        <div className="card pad frm">
          <h2 className="section-t">Guests (optional)</h2>
          <div className="field">
            <label>Paste guests — one per line: Name, email, Group|Group</label>
            <textarea className="inp" name="guests" placeholder={"Margaret Ellison, margaret@ellison.com, Family|VIP\nJohn Peterson, john@gmail.com, Friends"} />
          </div>
          <div className="note">Every guest receives a unique invitation link with a schedule built automatically from their groups.</div>
        </div>

        <div><button className="btn btn-accent" type="submit">Create Wedding</button></div>
      </form>
    </>
  );
}
