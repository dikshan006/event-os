/**
 * Miniature renderings of the product, built as real markup.
 *
 * The obvious alternative was screenshots. Screenshots of a product this young
 * date the moment anything ships, they cannot respond to the layout, they are
 * unreadable on a phone at the size an editorial column allows, and they carry
 * a UI chrome that competes with the page's own typography.
 *
 * These are drawn instead: a few dozen bytes of markup, styled by the same
 * system as the page around them, sharp at any density, and legible at 320px.
 * They are illustrations of an idea rather than claims about a specific screen,
 * so each is marked aria-hidden and the surrounding prose carries the meaning
 * for anyone not looking at it.
 */

export function GuestListSpecimen() {
  const rows: [string, string[], string][] = [
    ["Eleanor Whitfield", ["Family", "Top table"], "Attending"],
    ["Marcus Whitfield", ["Family", "Top table"], "Attending"],
    ["Priya Raghunathan", ["University"], "Attending"],
    ["Tom Iversen", ["University"], "—"],
    ["Sofia Lindqvist", ["Work", "Evening only"], "Declined"],
  ];
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Guests</span>
        <span>124 invited · 96 replied</span>
      </div>
      <ul className="m-spec-rows">
        {rows.map(([name, groups, status]) => (
          <li key={name}>
            <span className="m-spec-name">{name}</span>
            <span className="m-spec-tags">
              {groups.map(g => (
                <i key={g}>{g}</i>
              ))}
            </span>
            <span className={`m-spec-status${status === "Declined" ? " is-off" : ""}`}>{status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ScheduleSpecimen() {
  const rows: [string, string, string][] = [
    ["2:00", "Ceremony", "All guests"],
    ["3:00", "Drinks on the lawn", "All guests"],
    ["5:30", "Dinner", "Day guests"],
    ["8:00", "Dancing", "All guests"],
  ];
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Saturday</span>
        <span>Villa Aurelia</span>
      </div>
      <ul className="m-spec-prog">
        {rows.map(([time, title, who]) => (
          <li key={title}>
            <b>{time}</b>
            <span>{title}</span>
            <i>{who}</i>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SeatingSpecimen() {
  const tables: [string, number, number][] = [
    ["Table 1", 8, 8],
    ["Table 2", 7, 8],
    ["Table 3", 8, 8],
    ["Table 4", 5, 8],
  ];
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Dinner · seating</span>
        <span>28 of 30 seated</span>
      </div>
      <div className="m-spec-tables">
        {tables.map(([name, seated, cap]) => (
          <div key={name} className="m-spec-table">
            <span>{name}</span>
            <b>
              {seated}/{cap}
            </b>
            <i style={{ inlineSize: `${(seated / cap) * 100}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function InvitationSpecimen() {
  return (
    <div className="m-spec m-spec-invite" aria-hidden="true">
      <span className="m-eyebrow">Together with their families</span>
      <p className="m-spec-names">Amelia &amp; Theodore</p>
      <div className="m-spec-hair" />
      <p className="m-spec-guest">
        <span>Dear</span> Priya
      </p>
      <p className="m-spec-line">You are invited to the ceremony, dinner and dancing.</p>
      <p className="m-spec-line m-spec-quiet">Table 3 · Saturday, 12 September</p>
    </div>
  );
}
