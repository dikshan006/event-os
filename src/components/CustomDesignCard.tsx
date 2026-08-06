"use client";

import { useState, useTransition } from "react";
import type { CustomDesignResult } from "@/app/studio/weddings/new/actions";

/**
 * The seventh card in a grid of six templates.
 *
 * It is not a template, so it carries no radio: choosing it would put the form
 * into a state `zWedding` cannot validate and the wedding could not be created.
 * It is an ask, and it reads as one.
 *
 * Three details are load-bearing:
 *
 * `type="button"` — this card lives *inside* the new-wedding <form>. A bare
 * <button> in a form is a submit button, so without this, asking about a custom
 * design would try to create a wedding from a half-filled form. For the same
 * reason there is no nested <form> here (invalid HTML, and React will not
 * render it); the action is called directly through a transition instead.
 *
 * The success state replaces the button rather than the card, so the sentence
 * appears where the planner was already looking, and the rest of the form —
 * including anything they had typed — is untouched.
 */
export function CustomDesignCard({
  action,
  accent = "#8A7E6E",
}: {
  action: () => Promise<CustomDesignResult>;
  accent?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CustomDesignResult | null>(null);

  const sent = result?.ok === true;

  return (
    <div className="tpl-card tpl-card-custom" style={{ borderTop: `4px solid ${accent}` }}>
      <div className="tpl-choice" style={{ cursor: "default" }}>
        <span>
          <span className="tpl-badge">Special Pricing</span>
          <b className="serif">Custom Design</b>
          <span className="meta">
            A wedding site designed from scratch for this couple — your art
            direction, not one of the six. Priced per project.
          </span>
        </span>
      </div>

      {sent ? (
        <p className="note tpl-thanks" role="status" aria-live="polite">
          Thank you. An admin will contact you shortly regarding your custom
          wedding design.
        </p>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-outline btn-sm tpl-preview"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setResult(await action());
              })
            }
          >
            {pending ? "Sending…" : "Request Custom Template"}
          </button>
          {result?.ok === false && (
            <p className="hint" role="alert" style={{ color: "var(--wine)", margin: 0 }}>
              {result.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
