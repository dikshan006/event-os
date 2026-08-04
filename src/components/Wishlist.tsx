"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export type Gift = {
  id: string;
  title: string;
  price: string | null;
  retailer: string | null;
  url: string;
  purchasedBy: string | null;
};

export type ClaimResult = { ok: true; name: string } | { ok: false; message: string };

/**
 * The wishlist, as an editorial list.
 *
 * No product images: the registry is link-based, so a frame per gift was a
 * large empty rectangle whose only job was to be the right shape. Twenty of
 * them made the page four times taller than the content warranted. What
 * remains is what a guest actually reads — name, store, price, one action —
 * set the way a hotel's recommendation list is set.
 *
 * Everything is shown, purchased included. Hiding claimed gifts leaves a guest
 * unable to tell a short list from a nearly-finished one, and seeing that most
 * of a registry is already spoken for is the closest thing this page has to
 * social proof.
 */
export function Wishlist({
  gifts,
  claimAction,
}: {
  gifts: Gift[];
  claimAction: (state: ClaimResult | null, formData: FormData) => Promise<ClaimResult | null>;
}) {
  const [availableOnly, setAvailableOnly] = useState(false);
  const [claiming, setClaiming] = useState<Gift | null>(null);
  const [pending, setPending] = useState<Gift | null>(null);
  const [done, setDone] = useState<{ name: string; gift: Gift } | null>(null);
  const router = useRouter();

  // Scoped to this tab and surviving a reload — a guest browsing two weddings
  // should not meet one wishlist's reminder on the other.
  const KEY = "eventos:gift-pending";

  const readPending = () => {
    try {
      const id = sessionStorage.getItem(KEY);
      setPending(id ? gifts.find(g => g.id === id) ?? null : null);
    } catch {
      /* private mode: the reminder is a nicety, not a requirement */
    }
  };

  useEffect(readPending, [gifts]);

  // Ask only once they are back on this tab, which is the moment the question
  // is answerable. A guest who never left is never asked anything.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible") readPending();
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

  /* ------------------------------------------------------ confirmed state -- */
  if (done) {
    return (
      <div className="s-thanks" role="status">
        <p className="s-thanks-eyebrow">Confirmed</p>
        <h2 className="s-thanks-title">Thank you, {done.name}.</h2>
        <p className="s-thanks-body">
          Your gift has been marked as purchased. The couple will know
          <em> {done.gift.title} </em>
          is reserved, which helps prevent anyone buying it twice.
        </p>
        {/* A typographic heart rather than an emoji: ❤️ renders in the
            operating system's colour emoji font, which next to Cormorant looks
            like something pasted in from another document. */}
        <p className="s-thanks-sign">
          <span className="s-thanks-heart" aria-hidden="true">♥</span>
          We so appreciate you celebrating with us.
        </p>
        <button
          type="button"
          className="s-gbtn"
          onClick={() => {
            setDone(null);
            // Pull the claim back down so the list shows it as purchased.
            router.refresh();
          }}
        >
          Back to the wishlist
        </button>
      </div>
    );
  }

  const shown = availableOnly ? gifts.filter(g => !g.purchasedBy) : gifts;
  const claimedCount = gifts.filter(g => g.purchasedBy).length;

  return (
    <>
      {/* The reminder. Page content, not a notification — no border, no tint,
          nothing that reads as a system message interrupting the page. */}
      {pending && (
        <div className="s-recall" role="status">
          <p className="s-recall-title">Finished purchasing?</p>
          <p className="s-recall-body">
            If you purchased <em>{pending.title}</em>, please confirm below so
            other guests know it has been reserved.
          </p>
          <div className="s-recall-acts">
            <button type="button" className="s-gbtn" onClick={() => setClaiming(pending)}>
              I purchased this gift
            </button>
            <button type="button" className="s-gbtn-quiet" onClick={forget}>
              Not yet
            </button>
          </div>
        </div>
      )}

      {claiming && (
        <ClaimPanel
          gift={claiming}
          action={claimAction}
          onCancel={() => setClaiming(null)}
          onDone={name => {
            setDone({ name, gift: claiming });
            forget();
            setClaiming(null);
          }}
        />
      )}

      {!claiming && (
        <>
          <div className="s-wish-bar">
            <p className="s-wish-count">
              {gifts.length} {gifts.length === 1 ? "gift" : "gifts"}
              {claimedCount > 0 && ` · ${claimedCount} already purchased`}
            </p>
            {claimedCount > 0 && (
              <label className="s-switch">
                <input
                  type="checkbox"
                  checked={availableOnly}
                  onChange={e => setAvailableOnly(e.target.checked)}
                />
                <span className="s-switch-track" aria-hidden="true"><span /></span>
                <span className="s-switch-label">Show available only</span>
              </label>
            )}
          </div>

          <ul className="s-gifts">
            {shown.map(g => (
              <GiftRow
                key={g.id}
                gift={g}
                onOpen={() => remember(g)}
                onClaim={() => setClaiming(g)}
              />
            ))}
          </ul>

          {shown.length === 0 && (
            <p className="s-empty">
              Every gift on the wishlist has been purchased. Thank you — truly.
            </p>
          )}
        </>
      )}
    </>
  );
}

function GiftRow({
  gift,
  onOpen,
  onClaim,
}: {
  gift: Gift;
  onOpen: () => void;
  onClaim: () => void;
}) {
  const claimed = Boolean(gift.purchasedBy);
  const detail = [gift.retailer, gift.price].filter(Boolean).join(" · ");

  return (
    <li className={`s-gift${claimed ? " is-claimed" : ""}`}>
      <p className="s-gift-title">{gift.title}</p>
      {detail && <p className="s-gift-detail">{detail}</p>}

      {claimed ? (
        <p className="s-gift-badge">
          <span className="s-gift-tick" aria-hidden="true">✓</span>
          Purchased by {gift.purchasedBy}
        </p>
      ) : (
        <p className="s-gift-acts">
          {/* The retailer opens in a new tab so the wishlist is still here when
              they come back — which is the whole point of the reminder. */}
          <a
            className="s-gbtn"
            href={gift.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpen}
          >
            View gift<span aria-hidden="true"> →</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
          <button type="button" className="s-gbtn-quiet" onClick={onClaim}>
            I purchased this
          </button>
        </p>
      )}
    </li>
  );
}

/**
 * The confirmation form.
 *
 * Inline, in place of the list, rather than in a dialog. A modal over a wedding
 * page is a piece of application furniture — a backdrop, a panel, a close
 * affordance — and the request asked for page content. Taking over the section
 * also removes any doubt about what is being confirmed.
 */
function ClaimPanel({
  gift,
  action,
  onCancel,
  onDone,
}: {
  gift: Gift;
  action: (state: ClaimResult | null, formData: FormData) => Promise<ClaimResult | null>;
  onCancel: () => void;
  onDone: (name: string) => void;
}) {
  const [state, formAction, pending] = useActionState<ClaimResult | null, FormData>(action, null);

  useEffect(() => {
    if (state?.ok) onDone(state.name);
  }, [state, onDone]);

  return (
    <form action={formAction} className="s-claim">
      <input type="hidden" name="itemId" value={gift.id} />

      <p className="s-claim-eyebrow">Confirm purchase</p>
      <h2 className="s-claim-title">{gift.title}</h2>
      <p className="s-claim-note">
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

      {state?.ok === false && <p className="s-claim-err" role="alert">{state.message}</p>}

      <div className="s-claim-acts">
        <button type="submit" className="s-gbtn" disabled={pending}>
          {pending ? "Confirming…" : "Confirm purchase"}
        </button>
        <button type="button" className="s-gbtn-quiet" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
