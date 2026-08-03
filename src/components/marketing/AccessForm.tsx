"use client";

import { useActionState } from "react";
import type { AccessRequestResult } from "@/server/services/access-requests";

export type AccessFormState = AccessRequestResult | null;

/**
 * The access request form.
 *
 * Progressive by construction: it is a plain <form> posting to a server action,
 * so it submits and validates correctly before any JavaScript has run. The
 * client hook adds three things on top — a pending state, inline field errors,
 * and a success view that does not lose the page.
 *
 * Every field carries a real <label>. Placeholder-as-label disappears the
 * moment someone starts typing, which is precisely when they most need to know
 * what they are answering, and it is invisible to a screen reader.
 */
export function AccessForm({
  action,
}: {
  action: (state: AccessFormState, formData: FormData) => Promise<AccessFormState>;
}) {
  const [state, formAction, pending] = useActionState<AccessFormState, FormData>(action, null);

  if (state?.ok) {
    return (
      <div className="m-form" aria-live="polite">
        <span className="m-eyebrow">Received</span>
        <h2 className="m-head">Thank you — that reached a person, not a queue.</h2>
        <p className="m-body">
          We read every request ourselves and set up each studio by hand, so it
          may take a couple of days. You will hear back from us either way. A
          confirmation is on its way to the address you gave.
        </p>
      </div>
    );
  }

  const err = (k: string) => (state?.ok === false ? state.fields?.[k] : undefined);

  return (
    <form action={formAction} className="m-form" noValidate>
      {state?.ok === false && !state.fields && (
        <p className="m-err" role="alert">
          {state.message}
        </p>
      )}

      <Field name="name" label="Your name" error={err("name")} autoComplete="name" required />
      <Field
        name="email"
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        error={err("email")}
        required
      />
      <Field
        name="company"
        label="Studio or company"
        hint="Optional — leave it blank if you work under your own name."
        autoComplete="organization"
        error={err("company")}
      />
      <Field
        name="website"
        label="Website or Instagram"
        hint="Optional. The fastest way for us to understand your work."
        autoComplete="url"
        error={err("website")}
      />
      <Field
        name="volume"
        label="Weddings a year"
        hint="Optional. A rough number is fine."
        error={err("volume")}
      />

      <div className="m-field" data-invalid={err("message") ? "true" : undefined}>
        <label htmlFor="ar-message">Anything else</label>
        <span className="m-hint" id="ar-message-hint">
          Optional. What you use today, and what you wish it did.
        </span>
        <textarea
          id="ar-message"
          name="message"
          className="m-input"
          rows={4}
          maxLength={2000}
          aria-describedby="ar-message-hint"
        />
        {err("message") && <span className="m-err">{err("message")}</span>}
      </div>

      {/*
        Honeypot. Hidden from sight and from assistive technology, and excluded
        from the tab order, so no person can reach it — which is what makes a
        value in it a reliable signal rather than a guess.
      */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
        <label htmlFor="ar-role">Do not fill this in</label>
        <input id="ar-role" name="role" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", paddingTop: "0.5rem" }}>
        <button className="m-btn m-btn-solid m-btn-lg" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
          {!pending && <span className="m-arrow" aria-hidden="true">→</span>}
        </button>
        <span className="m-small" aria-live="polite">
          {pending ? "One moment." : "We reply to every request."}
        </span>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  type = "text",
  required,
  ...rest
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  required?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `ar-${name}`;
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;

  return (
    <div className="m-field" data-invalid={error ? "true" : undefined}>
      <label htmlFor={id}>
        {label}
        {!required && <span className="sr-only"> (optional)</span>}
      </label>
      {hint && (
        <span className="m-hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <input
        id={id}
        name={name}
        type={type}
        className="m-input"
        required={required}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
      {error && (
        <span className="m-err" id={`${id}-err`}>
          {error}
        </span>
      )}
    </div>
  );
}
