import Link from "next/link";

/**
 * The pieces help articles are built from.
 *
 * The examples in these articles are not screenshots. They are the product's
 * own components and the product's own stylesheet, rendered in place — the same
 * `.card`, `.btn`, `.chip` and `.field` classes the studio pages use. A
 * screenshot of a button and the button itself look identical the day they are
 * taken and drift apart the first time the design changes; this cannot drift,
 * because there is only one definition of what a button looks like and both the
 * app and the help centre read it.
 *
 * Everything here is presentational and inert. No example submits anything, and
 * `Demo` marks its whole subtree `aria-hidden` with `inert` so a screen reader
 * does not read out a form that does nothing and a keyboard user cannot tab
 * into a dead control.
 */

/* ------------------------------------------------------------- structure -- */

export function Lede({ children }: { children: React.ReactNode }) {
  return <p className="help-lede">{children}</p>;
}

/** WHAT IS IT / WHY WOULD I USE IT / HOW DOES IT WORK / WHAT DOES THE GUEST SEE */
export function Q({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <section className="help-q">
      <h2>{q}</h2>
      {children}
    </section>
  );
}

/** Numbered steps. The one place in an article where order is load-bearing. */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="help-steps">{children}</ol>;
}

export function Step({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>;
}

/**
 * A live example of part of the interface.
 *
 * `label` says what the planner is looking at, because a fragment of a screen
 * without a frame around it reads as decoration.
 */
export function Demo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="help-demo">
      <figcaption>{label}</figcaption>
      {/* Inert: this is a picture of the interface, not the interface. */}
      <div className="help-demo-stage" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/**
 * A numbered marker pointing at the thing just described.
 *
 * Pairs with `<Callouts>` beneath the demo, so the arrow and its explanation
 * are connected by a number rather than by "the button on the right", which
 * stops being true on a narrow screen.
 */
export function Pin({ n }: { n: number }) {
  return <span className="help-pin">{n}</span>;
}

export function Callouts({ children }: { children: React.ReactNode }) {
  return <ol className="help-callouts">{children}</ol>;
}

/** A short aside. `tone="warn"` for the things that cannot be undone. */
export function Note({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <aside className={`help-note ${tone === "warn" ? "warn" : ""}`}>
      {title && <b>{title}</b>}
      <div>{children}</div>
    </aside>
  );
}

/** What the guest ends up looking at. Visually distinct from planner examples. */
export function GuestView({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="help-demo guest">
      <figcaption>{label}</figcaption>
      <div className="help-demo-stage" aria-hidden="true">
        {children}
      </div>
    </figure>
  );
}

/** An in-text pointer to another article. */
export function See({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link href={`/studio/help/${to}`} className="help-see">
      {children}
    </Link>
  );
}

/* ---------------------------------------------------- interface fragments -- */

/**
 * A field as it appears in the studio, using the real `.field` styles.
 *
 * `value` renders as static text inside an input-shaped box rather than as a
 * disabled `<input>`: a disabled input is greyed out by the browser, which
 * would make every example look broken rather than filled in.
 */
export function Field({
  label,
  value,
  hint,
  placeholder,
}: {
  label: string;
  value?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <div className={`help-input ${value ? "" : "ph"}`}>{value ?? placeholder ?? ""}</div>
      {hint && <span className="help-hint">{hint}</span>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return <div className="help-fieldrow">{children}</div>;
}

/** The studio's own button, at its own size. */
export function Btn({
  children,
  kind = "primary",
}: {
  children: React.ReactNode;
  kind?: "primary" | "outline" | "ghost" | "accent" | "danger";
}) {
  return <span className={`btn btn-${kind}`}>{children}</span>;
}

/** The real chip, including the colour tones the app maps statuses onto. */
export function Chip({ children, tone }: { children: React.ReactNode; tone?: "sage" | "wine" | "rose" }) {
  return (
    <span className={`chip ${tone ?? ""}`}>
      <i className="dot" />
      {children}
    </span>
  );
}

/** A card, as used throughout the studio. */
export function Card({ children, pad = true }: { children: React.ReactNode; pad?: boolean }) {
  return <div className={`card ${pad ? "pad" : ""}`}>{children}</div>;
}

/** A table, for the list views (guests, RSVPs, tickets). */
export function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="help-table">
      <table>
        <thead>
          <tr>{head.map(h => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A phone-shaped frame for guest-side examples.
 *
 * Guests open their invitation on a phone almost without exception, and showing
 * that view in a desktop-width box teaches the wrong thing about what fits.
 */
export function Phone({ children }: { children: React.ReactNode }) {
  return <div className="help-phone"><div className="help-phone-screen">{children}</div></div>;
}
