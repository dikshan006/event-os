"use client";

import { useMemo, useRef, useState } from "react";

type GuestOption = { id: string; name: string; groups: string[] };

/**
 * Seat a guest at a table.
 *
 * A searchable list rather than a `<select>`: a wedding runs to a few hundred
 * guests, and a planner filling a table works from a name they already have in
 * mind. Typing two or three letters is faster than scrolling, and the list
 * shows each guest's groups so "which David" is answerable without leaving the
 * dialog.
 *
 * Only unassigned guests are offered, so the one-table rule is visible in the
 * interface rather than only enforced on the server.
 */
export function AddGuestDialog({
  action, weddingId, tableId, tableName, remaining, guests,
}: {
  action: (formData: FormData) => Promise<void>;
  weddingId: string;
  tableId: string;
  tableName: string;
  remaining: number;
  guests: GuestOption[];
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState("");

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const pool = needle
      ? guests.filter(g =>
          g.name.toLowerCase().includes(needle) ||
          g.groups.some(gr => gr.toLowerCase().includes(needle)))
      : guests;
    return pool.slice(0, 40);
  }, [q, guests]);

  const full = remaining <= 0;

  return (
    <>
      <button type="button" className="btn btn-outline btn-sm"
        disabled={full || guests.length === 0}
        onClick={() => { setQ(""); ref.current?.showModal(); }}>
        {full ? "Table full" : "Add guest"}
      </button>

      <dialog ref={ref} className="dlg"
        onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="dlg-body" onSubmit={() => ref.current?.close()}>
          <h3 className="dlg-title">Seat a guest at {tableName}</h3>
          <p className="dlg-desc">
            {remaining} seat{remaining === 1 ? "" : "s"} free. Only guests who have not been
            seated yet are listed.
          </p>

          <input className="inp" autoFocus placeholder="Search by name or group…"
            value={q} onChange={e => setQ(e.target.value)} aria-label="Search guests" />

          <div className="seat-picker" data-lenis-prevent>
            {matches.map(g => (
              <form action={action} key={g.id}>
                <input type="hidden" name="weddingId" value={weddingId} />
                <input type="hidden" name="tableId" value={tableId} />
                <input type="hidden" name="guestId" value={g.id} />
                <button type="submit" className="seat-pick">
                  <span className="seat-pick-name">{g.name}</span>
                  {g.groups.length > 0 && <span className="seat-pick-groups">{g.groups.join(" · ")}</span>}
                </button>
              </form>
            ))}
            {matches.length === 0 && (
              <p className="hint" style={{ padding: "12px 2px" }}>
                {guests.length === 0 ? "Everyone has a seat." : "No guest matches that search."}
              </p>
            )}
          </div>

          <button type="button" className="btn btn-ghost btn-sm dlg-cancel"
            onClick={() => ref.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}

/** Rename a table or change its capacity. */
export function EditTableDialog({
  action, weddingId, tableId, name, seats, seated,
}: {
  action: (formData: FormData) => Promise<void>;
  weddingId: string;
  tableId: string;
  name: string;
  seats: number;
  seated: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.showModal()}>Edit</button>
      <dialog ref={ref} className="dlg"
        onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="dlg-body" onSubmit={() => ref.current?.close()}>
          <h3 className="dlg-title">Edit {name}</h3>
          <form action={action} className="frm">
            <input type="hidden" name="weddingId" value={weddingId} />
            <input type="hidden" name="tableId" value={tableId} />
            <div className="field">
              <label htmlFor={`n-${tableId}`}>Table name</label>
              <input id={`n-${tableId}`} className="inp" name="name" defaultValue={name} maxLength={60} required />
            </div>
            <div className="field">
              <label htmlFor={`s-${tableId}`}>Seats</label>
              <input id={`s-${tableId}`} className="inp" name="seats" type="number"
                min={Math.max(1, seated)} max={30} defaultValue={seats} required />
              <span className="hint">
                {seated > 0
                  ? `${seated} guest${seated === 1 ? " is" : "s are"} seated here, so this cannot go below ${seated}.`
                  : "Up to 30."}
              </span>
            </div>
            <button className="btn btn-primary" type="submit">Save table</button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm dlg-cancel"
            onClick={() => ref.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}

/** Deleting a table returns its guests to the unassigned list. */
export function DeleteTableDialog({
  action, weddingId, tableId, name, seated,
}: {
  action: (formData: FormData) => Promise<void>;
  weddingId: string;
  tableId: string;
  name: string;
  seated: number;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => ref.current?.showModal()}>Delete</button>
      <dialog ref={ref} className="dlg"
        onClick={e => { if (e.target === ref.current) ref.current?.close(); }}>
        <div className="dlg-body" onSubmit={() => ref.current?.close()}>
          <h3 className="dlg-title">Delete {name}?</h3>
          <p className="dlg-desc">
            {seated > 0
              ? `${seated} guest${seated === 1 ? "" : "s"} will return to the unassigned list. No guest is deleted.`
              : "This table has no guests seated at it."}
          </p>
          <form action={action}>
            <input type="hidden" name="weddingId" value={weddingId} />
            <input type="hidden" name="tableId" value={tableId} />
            <button className="btn btn-danger" type="submit">Delete table</button>
          </form>
          <button type="button" className="btn btn-ghost btn-sm dlg-cancel"
            onClick={() => ref.current?.close()}>Cancel</button>
        </div>
      </dialog>
    </>
  );
}
