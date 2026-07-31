"use client";

import { useRef, useState, useTransition } from "react";

type RsvpInput = { status: string; meal: string; dietary: string; notes: string };

const CHOICES = [
  ["ACCEPTED", "Joyfully accept"],
  ["DECLINED", "Regretfully decline"],
  ["MAYBE", "Not yet certain"],
] as const;

const MEALS = ["Beef", "Salmon", "Vegetarian", "Vegan", "Kids meal"] as const;

/**
 * The only thing a guest interacts with, so it carries the whole impression of
 * the site working properly.
 *
 * Notable behaviours:
 *  - A real <form>: Enter submits, and the browser's own validation applies.
 *  - The reply choice is a genuine radio group inside a fieldset, so screen
 *    readers announce it as one question with three options and arrow keys move
 *    between them. It was previously three unrelated <button> elements, which
 *    are announced as three separate controls with no sense of a choice.
 *  - Failures keep every entered value and say what happened. Previously a
 *    rejected action left the button re-enabled with no message and no
 *    explanation — the guest could not tell whether their reply had been sent.
 *  - Submission is guarded by a ref as well as the pending flag, so a double
 *    tap on a slow connection cannot fire the action twice before React has
 *    re-rendered.
 */
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
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const inFlight = useRef(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const set = <K extends keyof RsvpInput>(k: K, v: RsvpInput[K]) => setR(prev => ({ ...prev, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (inFlight.current || !r.status) return;
    inFlight.current = true;
    setError(null);

    start(async () => {
      try {
        await action(code, r);
        setDone(true);
        // Move focus to the confirmation so a screen-reader user is told the
        // reply landed rather than being left on a button that vanished.
        requestAnimationFrame(() => confirmRef.current?.focus());
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Your reply could not be sent just now. Please try again in a moment.",
        );
      } finally {
        inFlight.current = false;
      }
    });
  }

  if (done) {
    return (
      <div className="s-rsvp-done" ref={confirmRef} tabIndex={-1} role="status">
        <p className="s-rsvp-thanks">Thank you, {firstName}</p>
        <p className="s-rsvp-note">
          {r.status === "ACCEPTED"
            ? "Your reply is recorded and we cannot wait to celebrate with you."
            : "Your reply is recorded, and you will be missed."}
          {" "}A confirmation is on its way to your inbox.
        </p>
        <button type="button" className="s-rsvp-change" onClick={() => setDone(false)}>
          Change my reply
        </button>
      </div>
    );
  }

  return (
    <form className="s-form" onSubmit={submit} noValidate>
      <fieldset className="s-choice">
        <legend>Will you be joining us?</legend>
        <div className="s-opts">
          {CHOICES.map(([value, label]) => (
            <label key={value} className={`s-opt${r.status === value ? " on" : ""}`}>
              <input type="radio" name="rsvp-status" value={value}
                checked={r.status === value}
                onChange={() => set("status", value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Meal details are only meaningful for someone who is coming. */}
      {r.status === "ACCEPTED" && (
        <>
          <div className="s-field">
            <label htmlFor="rsvp-meal">Meal preference</label>
            <select id="rsvp-meal" className="s-inp" value={r.meal} onChange={e => set("meal", e.target.value)}>
              <option value="">Select a meal…</option>
              {MEALS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div className="s-field">
            <label htmlFor="rsvp-diet">Dietary requirements</label>
            <input id="rsvp-diet" className="s-inp" value={r.dietary}
              placeholder="Allergies, intolerances…"
              onChange={e => set("dietary", e.target.value)} />
          </div>
        </>
      )}

      <div className="s-field">
        <label htmlFor="rsvp-note">A note for the couple</label>
        <textarea id="rsvp-note" className="s-inp" rows={3} value={r.notes}
          onChange={e => set("notes", e.target.value)} />
      </div>

      {/* Announced when it appears; the form keeps every entered value. */}
      {error && <p className="s-rsvp-error" role="alert">{error}</p>}

      <button className="s-btn" type="submit" disabled={!r.status || pending}
        aria-busy={pending || undefined}>
        {pending ? "Sending…" : initial?.status ? "Update my reply" : "Send RSVP"}
      </button>

      {!r.status && <p className="s-rsvp-hint">Choose a reply above to continue.</p>}
    </form>
  );
}
