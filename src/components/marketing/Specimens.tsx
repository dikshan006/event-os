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

export function RsvpSpecimen() {
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>RSVP</span>
        <span>96 of 124 replied</span>
      </div>
      <div className="m-spec-tally">
        {([["Attending", 78, "on"], ["Declined", 18, ""], ["Awaiting", 28, ""]] as const).map(([l, n, s]) => (
          <div key={l} className={`m-spec-tally-row${s ? " is-on" : ""}`}>
            <span>{l}</span>
            <b>{n}</b>
            <i style={{ inlineSize: `${(n / 124) * 100}%` }} />
          </div>
        ))}
      </div>
      <p className="m-spec-quiet">Dietary and access notes captured with every reply</p>
    </div>
  );
}

export function GallerySpecimen() {
  // A mosaic rather than photographs: inventing images of a wedding that never
  // happened would be the wrong kind of lie, and the point being made is the
  // arrangement, not the pictures.
  const tall = new Set([0, 4]);
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Gallery</span>
        <span>32 photographs</span>
      </div>
      <div className="m-spec-tiles">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} {...(tall.has(i) ? { "data-tall": "" } : {})} />
        ))}
      </div>
    </div>
  );
}

export function DashboardSpecimen() {
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Your studio</span>
        <span>4 weddings</span>
      </div>
      <ul className="m-spec-rows">
        {([["Amelia & Theodore", "12 Sep", "Published"], ["Rosa & Ines", "4 Oct", "Draft"], ["Nour & Adam", "22 Nov", "Published"]] as const).map(
          ([n, d, s]) => (
            <li key={n}>
              <span className="m-spec-name">{n}</span>
              <span className="m-spec-tags">
                <i>{d}</i>
              </span>
              <span className={`m-spec-status${s === "Draft" ? " is-off" : ""}`}>{s}</span>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export function RegistrySpecimen() {
  return (
    <div className="m-spec" aria-hidden="true">
      <div className="m-spec-bar">
        <span>Registry</span>
        <span>Gifts and funds</span>
      </div>
      <ul className="m-spec-rows">
        {([["Honeymoon fund", "£2,400 of £3,000"], ["Copper pans", "Reserved"], ["Garden table", "Available"]] as const).map(([n, s]) => (
          <li key={n}>
            <span className="m-spec-name">{n}</span>
            <span className="m-spec-status">{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EmailSpecimen() {
  return (
    <div className="m-spec m-spec-mail" aria-hidden="true">
      <div className="m-spec-bar">
        <span>To Priya Raghunathan</span>
        <span>Sent</span>
      </div>
      <p className="m-spec-subject">You&rsquo;re invited — Amelia &amp; Theodore</p>
      <p className="m-spec-line">
        Dear Priya, you are warmly invited to the wedding of Amelia &amp; Theodore.
      </p>
      <span className="m-spec-fauxlink">Open your invitation</span>
      <p className="m-spec-quiet">Sent from your studio, not from EventOS</p>
    </div>
  );
}
