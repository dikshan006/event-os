"use client";

import { useActionState, useEffect, useRef, useState } from "react";

export type Gift = {
  id: string;
  title: string;
  imageUrl: string | null;
  price: string | null;
  retailer: string | null;
  url: string;
  purchasedBy: string | null;
};

export type ClaimResult = { ok: true; name: string } | { ok: false; message: string };

/**
 * The wishlist.
 *
 * Interaction is deliberately thin. A guest opens a retailer in a new tab, buys
 * something, comes back, and says so. Everything else — the toggle, the modal,
 * the reminder — exists to make that one confirmation likely, because a
 * registry nobody confirms is a registry that produces duplicate gifts.
 *
 * The nudge is the interesting part. Rather than nagging on arrival, the page
 * remembers which gift sent the guest away and only asks when they come back to
 * the tab. That is the moment the question makes sense, and it means a guest
 * who never left is never asked anything.
 */
export function Wishlist({
  gifts,
  claimed,
  claimAction,
}: {
  gifts: Gift[];
  claimed: Gift[];
  claimAction: (state: ClaimResult | null, formData: FormData) => Promise<ClaimResult | null>;
}) {
  const [showClaimed, setShowClaimed] = useState(false);
  const [openGift, setOpenGift] = useState<Gift | null>(null);
  // The gift whose retailer the guest most recently opened.
  const [pending, setPending] = useState<Gift | null>(null);
  const [thanked, setThanked] = useState<string | null>(null);

  // Survives a full reload, and is scoped to this tab — a guest browsing two
  // weddings at once should not see one wishlist's reminder on the other.
  const KEY = "eventos:gift-pending";

  useEffect(() => {
    try {
      const id = sessionStorage.getItem(KEY);
      if (id) setPending(gifts.find(g => g.id === id) ?? null);
    } catch {
      /* private mode: the reminder is a nicety, not a requirement */
    }
  }, [gifts]);

  // Ask only once they are back on this tab, which is when the question is
  // actually answerable.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "visible") return;
      try {
        const id = sessionStorage.getItem(KEY);
        if (id) setPending(gifts.find(g => g.id === id) ?? null);
      } catch { /* ignore */ }
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [gifts]);

  const remember = (g: Gift) => {
    try { sessionStorage.setItem(KEY, g.id); } catch { /* ignore */ }
    setPending(g);
  };
  const forget = () => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    setPending(null);
  };

  const onClaimed = (name: string) => {
    setThanked(name);
    forget();
    setOpenGift(null);
  };

  return (
    <>
      {/* The gentle reminder. Only ever shown to someone who actually left. */}
      {pending && !thanked && (
        <div className="s-recall" role="status">
          <p className="s-recall-title">Finished purchasing?</p>
          <p className="s-recall-body">
            Help us prevent duplicate gifts by confirming your purchase of{" "}
            <em>{pending.title}</em>.
          </p>
          <div className="s-recall-acts">
            <button type="button" className="s-gbtn" onClick={() => setOpenGift(pending)}>
              I purchased this gift
            </button>
            <button type="button" className="s-gbtn-quiet" onClick={forget}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {thanked && (
        <div className="s-recall" role="status">
          <p className="s-recall-title">Thank you, {thanked}.</p>
          <p className="s-recall-body">
            It is marked on the wishlist, so nobody buys it twice.
          </p>
        </div>
      )}

      <div className="s-wish-bar">
        <p className="s-wish-count">
          {gifts.length} {gifts.length === 1 ? "gift" : "gifts"} available
          {claimed.length > 0 && ` · ${claimed.length} already purchased`}
        </p>
        {claimed.length > 0 && (
          <label className="s-switch">
            <input
              type="checkbox"
              checked={showClaimed}
              onChange={e => setShowClaimed(e.target.checked)}
            />
            <span className="s-switch-track" aria-hidden="true"><span /></span>
            <span className="s-switch-label">Show purchased gifts</span>
          </label>
        )}
      </div>

      <ul className="s-gifts">
        {gifts.map(g => (
          <GiftCard key={g.id} gift={g} onOpen={() => remember(g)} onClaim={() => setOpenGift(g)} />
        ))}
        {showClaimed &&
          claimed.map(g => <GiftCard key={g.id} gift={g} claimed />)}
      </ul>

      {gifts.length === 0 && !showClaimed && (
        <p className="s-empty">
          Every gift on the wishlist has been purchased. Thank you — truly.
        </p>
      )}

      {openGift && (
        <ClaimDialog
          gift={openGift}
          action={claimAction}
          onClose={() => setOpenGift(null)}
          onDone={onClaimed}
        />
      )}
    </>
  );
}

function GiftCard({
  gift,
  claimed = false,
  onOpen,
  onClaim,
}: {
  gift: Gift;
  claimed?: boolean;
  onOpen?: () => void;
  onClaim?: () => void;
}) {
  return (
    <li className={`s-gift${claimed ? " is-claimed" : ""}`}>
      <span className="s-gift-frame">
        {gift.imageUrl ? (
          <img src={gift.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="s-gift-mono" aria-hidden="true">{gift.title.trim()[0] ?? "·"}</span>
        )}
      </span>

      <span className="s-gift-body">
        <span className="s-gift-title">{gift.title}</span>
        {gift.retailer && <span className="s-gift-store">{gift.retailer}</span>}
        {gift.price && <span className="s-gift-price">{gift.price}</span>}

        {claimed ? (
          <span className="s-gift-badge">Purchased by {gift.purchasedBy}</span>
        ) : (
          <span className="s-gift-acts">
            {/* The retailer opens in a new tab so the wishlist is still here
                when they come back — which is the whole point. */}
            <a
              className="s-gbtn"
              href={gift.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onOpen}
            >
              Buy gift<span aria-hidden="true"> ↗</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" className="s-gbtn-quiet" onClick={onClaim}>
              I purchased this gift
            </button>
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Native <dialog> with showModal(): focus trapping, Escape to close and the
 * top layer come from the platform rather than from a library.
 */
function ClaimDialog({
  gift,
  action,
  onClose,
  onDone,
}: {
  gift: Gift;
  action: (state: ClaimResult | null, formData: FormData) => Promise<ClaimResult | null>;
  onClose: () => void;
  onDone: (name: string) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, formAction, pending] = useActionState<ClaimResult | null, FormData>(action, null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    if (state?.ok) onDone(state.name);
  }, [state, onDone]);

  return (
    <dialog ref={ref} className="s-modal" onClose={onClose}>
      <form action={formAction} className="s-modal-body">
        <input type="hidden" name="itemId" value={gift.id} />

        <p className="s-modal-eyebrow">Confirm purchase</p>
        <h2 className="s-modal-title">{gift.title}</h2>
        <p className="s-modal-note">
          We will mark this as purchased so nobody buys it twice. Your name is
          shown to the couple, not to other guests.
        </p>

        <div className="s-field">
          <label htmlFor="claim-name">Your name</label>
          <input id="claim-name" name="name" className="s-input" required maxLength={80} autoComplete="name" autoFocus />
        </div>

        <div className="s-field">
          <label htmlFor="claim-note">A message, if you like</label>
          <textarea id="claim-note" name="note" className="s-input" rows={3} maxLength={600} />
        </div>

        {state?.ok === false && <p className="s-modal-err" role="alert">{state.message}</p>}

        <div className="s-modal-acts">
          <button type="button" className="s-gbtn-quiet" onClick={() => ref.current?.close()}>
            Cancel
          </button>
          <button type="submit" className="s-gbtn" disabled={pending}>
            {pending ? "Confirming…" : "Confirm purchase"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
