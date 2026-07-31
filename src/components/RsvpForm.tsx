"use client";
import { useState, useTransition } from "react";

type RsvpInput = { status: string; meal: string; dietary: string; notes: string };

export function RsvpForm({ code, firstName, initial, action }: {
  code: string;
  firstName: string;
  initial?: Partial<RsvpInput>;
  action: (code: string, input: RsvpInput) => Promise<void>;
}) {
  const [r, setR] = useState<RsvpInput>({
    status: initial?.status ?? "", meal: initial?.meal ?? "",
    dietary: initial?.dietary ?? "", notes: initial?.notes ?? "",
  });
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div style={{ maxWidth: 460, margin: "0 auto" }}>
        <div className="s-hs">thank you, {firstName}</div>
        <p style={{ fontFamily: "'Inter',sans-serif", fontSize: 14, opacity: 0.8 }}>
          Your response has been recorded{r.status === "ACCEPTED" ? " — we can't wait to celebrate with you." : "."} A confirmation email is on its way.
        </p>
      </div>
    );
  }

  return (
    <div className="s-form">
      <div>
        <label>Will you be joining us?</label>
        <div className="s-opts" style={{ marginTop: 6 }}>
          {[["ACCEPTED", "Joyfully accept"], ["DECLINED", "Regretfully decline"], ["MAYBE", "Maybe"]].map(([v, label]) => (
            <button key={v} type="button" className={`s-opt ${r.status === v ? "on" : ""}`} onClick={() => setR({ ...r, status: v })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label>Meal preference</label>
        <select className="s-inp" value={r.meal} onChange={e => setR({ ...r, meal: e.target.value })}>
          <option value="">Select a meal…</option>
          {["Beef", "Salmon", "Vegetarian", "Vegan", "Kids meal"].map(m => <option key={m}>{m}</option>)}
        </select>
      </div>
      <div><label>Dietary restrictions</label>
        <input className="s-inp" placeholder="Allergies, intolerances…" value={r.dietary} onChange={e => setR({ ...r, dietary: e.target.value })} /></div>
      <div><label>A note for the couple</label>
        <textarea className="s-inp" rows={3} value={r.notes} onChange={e => setR({ ...r, notes: e.target.value })} /></div>
      <button className="s-btn" disabled={!r.status || pending} style={{ opacity: r.status && !pending ? 1 : 0.5 }}
        onClick={() => start(async () => { await action(code, r); setDone(true); })}>
        {pending ? "Sending…" : "Send RSVP"}
      </button>
    </div>
  );
}
