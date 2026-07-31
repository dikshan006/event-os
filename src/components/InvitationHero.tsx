import { fmtDate } from "@/lib/utils";

/**
 * The invitation panel — the emotional centre of the guest portal.
 *
 * Structured as a single centred column of siblings in reading order:
 *
 *   PREPARED ESPECIALLY FOR   ← eyebrow, letterspaced small caps
 *   Broski                    ← the guest's name, script, the focal point
 *   Family • Close Friends     ← their groups, quiet and small
 *   ──────── ✦ ────────        ← ornamental divider, separates the two voices
 *   please join us for our…    ← the invitation line, script
 *   AUGUST 20, 2026            ← the date, letterspaced display
 *
 * Nothing is absolutely positioned and nothing is an inline-flex pill, which is
 * what caused the name and the group list to sit on top of each other before.
 * All type is fluid via clamp(), so the same markup reads correctly from a
 * 320px phone to a wide desktop without a single breakpoint override.
 */

export function InvitationHero({
  guestName,
  groups,
  date,
}: {
  guestName?: string;
  groups?: string[];
  date: Date;
}) {
  // "BROSKI" and "broski" both become "Broski" — planners import guest lists
  // from spreadsheets and casing is never consistent.
  const displayName = guestName
    ?.trim()
    .toLowerCase()
    .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());

  return (
    <section className="inv" aria-label="Invitation">
      {displayName && (
        <header className="inv-personal">
          <p className="inv-eyebrow">Prepared especially for</p>
          <h1 className="inv-guest">{displayName}</h1>
          {groups && groups.length > 0 && (
            <p className="inv-groups">{groups.join(" • ")}</p>
          )}
        </header>
      )}

      {displayName && (
        <div className="inv-divider" role="presentation">
          <span className="inv-divider-line" />
          <span className="inv-divider-mark">&#10022;</span>
          <span className="inv-divider-line" />
        </div>
      )}

      <p className="inv-line">please join us for our wedding celebration on</p>
      <p className="inv-date">
        <time dateTime={date.toISOString().slice(0, 10)}>{fmtDate(date).toUpperCase()}</time>
      </p>
    </section>
  );
}
