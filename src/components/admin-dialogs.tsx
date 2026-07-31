"use client";

import { useRef, useState } from "react";

/**
 * Admin confirmation dialogs, built on the native <dialog> element.
 *
 * `showModal()` promotes the dialog into the browser's top layer, so it is
 * never clipped by an ancestor's `overflow` or stacking context — the reason
 * this is a real dialog rather than an absolutely-positioned div. It also
 * brings focus trapping, Escape-to-close, and `::backdrop` for free.
 */

function useDialog() {
  const ref = useRef<HTMLDialogElement>(null);
  return {
    ref,
    open: () => ref.current?.showModal(),
    close: () => ref.current?.close(),
    /** Click on the backdrop (the dialog element itself) dismisses. */
    onBackdrop: (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === ref.current) ref.current?.close();
    },
  };
}

/** Generic confirm-then-submit. `children` is the server-rendered form. */
export function ActionDialog({
  trigger, triggerClass = "btn btn-outline btn-sm", title, description, children,
}: {
  trigger: string;
  triggerClass?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  const d = useDialog();
  return (
    <>
      <button type="button" className={triggerClass} onClick={d.open}>{trigger}</button>
      <dialog ref={d.ref} className="dlg" onClick={d.onBackdrop}>
        {/* Submitting closes the dialog; the server action continues in the background. */}
        <div className="dlg-body" onSubmit={d.close}>
          <h3 className="dlg-title">{title}</h3>
          {description && <p className="dlg-desc">{description}</p>}
          {children}
          <button type="button" className="btn btn-ghost btn-sm dlg-cancel" onClick={d.close}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}

/**
 * Deleting a studio cascades to its weddings, guests, RSVPs and payment
 * history, so this asks the admin to type the studio name — the standard
 * guard against a misplaced click on an irreversible action.
 */
export function DeleteStudioDialog({
  action, studioId, studioName, weddings,
}: {
  action: (formData: FormData) => Promise<void>;
  studioId: string;
  studioName: string;
  weddings: number;
}) {
  const d = useDialog();
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === studioName;

  return (
    <>
      <button type="button" className="btn btn-danger btn-sm" onClick={d.open}>Delete</button>
      <dialog ref={d.ref} className="dlg" onClick={d.onBackdrop}>
        <div className="dlg-body" onSubmit={d.close}>
          <h3 className="dlg-title">Delete {studioName}?</h3>
          <p className="dlg-desc">
            This permanently removes the studio, its owner login,{" "}
            {weddings === 1 ? "1 wedding" : `${weddings} weddings`} and every guest, RSVP and
            payment record attached to them. It cannot be undone.
          </p>
          <form action={action} className="frm">
            <input type="hidden" name="studioId" value={studioId} />
            <div className="field">
              <label>Type <b>{studioName}</b> to confirm</label>
              <input
                className="inp"
                value={typed}
                onChange={e => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label={`Type ${studioName} to confirm deletion`}
              />
            </div>
            <button className="btn btn-danger" type="submit" disabled={!matches}>
              Delete permanently
            </button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm dlg-cancel" onClick={d.close}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}

/**
 * Password management. Existing passwords are bcrypt hashes and cannot be
 * displayed, so the two honest options are to generate a new credential or to
 * set a specific one; either way it is shown to the admin exactly once.
 */
export function PasswordDialog({
  action, studioId, studioName, email,
}: {
  action: (formData: FormData) => Promise<void>;
  studioId: string;
  studioName: string;
  email: string;
}) {
  const d = useDialog();
  const [mode, setMode] = useState<"generate" | "custom">("generate");

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm" onClick={d.open}>Password</button>
      <dialog ref={d.ref} className="dlg" onClick={d.onBackdrop}>
        <div className="dlg-body" onSubmit={d.close}>
          <h3 className="dlg-title">Password for {studioName}</h3>
          <p className="dlg-desc">
            Signing in as <b>{email}</b>. Stored passwords are hashed, so the current one
            can&apos;t be shown — issue a new one below and it appears once, for 90 seconds.
          </p>

          <form action={action} className="frm">
            <input type="hidden" name="studioId" value={studioId} />

            <div className="dlg-choice">
              <label className="check">
                <input type="radio" name="mode" value="generate" checked={mode === "generate"}
                  onChange={() => setMode("generate")} />
                Generate a temporary password
              </label>
              <label className="check">
                <input type="radio" name="mode" value="custom" checked={mode === "custom"}
                  onChange={() => setMode("custom")} />
                Set a specific password
              </label>
            </div>

            {mode === "custom" && (
              <div className="field">
                <label>New password</label>
                <input className="inp" name="password" type="text" minLength={8} required
                  autoComplete="off" placeholder="At least 8 characters" />
                <span className="hint">Shown in plain text so you can read it out; ask the planner to change it after signing in.</span>
              </div>
            )}

            <div className="note">
              Any password-reset link already sitting in their inbox stops working immediately.
            </div>

            <button className="btn btn-primary" type="submit">
              {mode === "generate" ? "Generate password" : "Set password"}
            </button>
          </form>

          <button type="button" className="btn btn-ghost btn-sm dlg-cancel" onClick={d.close}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}
