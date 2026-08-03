import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import {
  GuestListSpecimen,
  ScheduleSpecimen,
  SeatingSpecimen,
  InvitationSpecimen,
} from "@/components/marketing/Specimens";

export const metadata: Metadata = {
  title: "Weddings — EventOS",
  description:
    "From the first enquiry to the morning after: how a wedding is planned, built and run on EventOS.",
  openGraph: {
    title: "Weddings — EventOS",
    description: "How a wedding is planned, built and run on EventOS.",
    type: "website",
  },
};

/**
 * The weddings page sells by narration rather than by enumeration.
 *
 * A feature grid tells a planner what the software has. It does not tell them
 * what their next twelve months look like, which is the only question they are
 * actually asking. So the page follows one wedding from the enquiry to the
 * morning after, and each chapter of that story happens to be the part of the
 * product that does it. Same information, told in the order it is lived.
 *
 * The photograph is treated as atmosphere, not as subject: lifted into a high
 * key and blurred past any detail before it is ever served, so type sits on it
 * at better than 5.7:1 without needing a scrim laid over the top. It is the one
 * image on the page.
 */

const STEPS: {
  when: string;
  title: React.ReactNode;
  body: string[];
  meta: string[];
  figure?: React.ReactNode;
}[] = [
  {
    when: "Twelve months out",
    title: <>The enquiry becomes a record.</>,
    body: [
      "A couple books you. You open one wedding in EventOS: their names, the date, the venue. That record is the only thing you will ever have to keep current, because from here everything else hangs off it.",
      "Nothing is published yet. The website, the invitations and the schedule all exist from this moment — empty, private, waiting.",
    ],
    meta: ["One record", "Private until you publish"],
  },
  {
    when: "Nine months",
    title: <>The list, and what it really is.</>,
    body: [
      "Import the guest list the couple already keeps in a spreadsheet. Then tag people into groups: family, university, work, evening only.",
      "Those groups are the spine of the wedding. They decide which events a guest is shown, which invitation they are sent, and which table they can sit at. Change someone's group and the schedule, the invitation and the seating all change with them.",
    ],
    meta: ["CSV import", "Groups drive everything downstream"],
    figure: <GuestListSpecimen />,
  },
  {
    when: "Six months",
    title: <>A website that looks like it cost more than it did.</>,
    body: [
      "Choose one of three templates — each a finished design rather than a colour scheme — and add the couple's photographs. Uploads are stripped of location data, re-encoded at four sizes in modern formats, and toned individually so the type stays readable over each one.",
      "Then it carries your studio's name, not ours. Guests never learn EventOS exists.",
    ],
    meta: ["Three templates", "White-labelled", "$99 to publish · first free"],
  },
  {
    when: "Four months",
    title: <>Every guest opens a different page.</>,
    body: [
      "Each guest is emailed one link. It shows their name, only the events their groups include them in, their table when there is one, and a reply form. No account, no password, no app — the link is the credential.",
      "The evening guests never see the ceremony time. The family see the rehearsal dinner nobody else is told about. You write one invitation instead of four.",
    ],
    meta: ["One link per guest", "No guest accounts"],
    figure: <InvitationSpecimen />,
  },
  {
    when: "Two months",
    title: <>Replies arrive somewhere useful.</>,
    body: [
      "Every response lands back on the wedding record the instant it is made — with dietary notes, plus-ones and messages attached to the right person, not scattered through an inbox.",
      "You always know the number. So does the seating plan.",
    ],
    meta: ["Live count", "Dietary and access notes captured"],
    figure: <SeatingSpecimen />,
  },
  {
    when: "Six weeks",
    title: <>The plan builds itself from what you already know.</>,
    body: [
      "The schedule is built once and marked for who each part is for. Seating is kept per event, because a dinner and a brunch do not seat the same people the same way.",
      "A guest who declines stops occupying a chair. Everyone else is quietly told their table on the invitation they already have.",
    ],
    meta: ["Per-event seating", "Audience-aware schedule"],
    figure: <ScheduleSpecimen />,
  },
];

export default function WeddingsPage() {
  return (
    <div className="m-wed">
      {/* ======================================================= cinematic */}
      <section className="m-cine" data-hero-tone="light">
        <div className="m-cine-media" aria-hidden="true">
          <picture>
            <source srcSet="/marketing/weddings-hero.avif" type="image/avif" />
            <source srcSet="/marketing/weddings-hero.webp" type="image/webp" />
            {/* Decorative: the page reads identically without it, so it takes an
                empty alt rather than a description of somebody's wedding. */}
            <img
              src="/marketing/weddings-hero.webp"
              alt=""
              width={1200}
              height={2600}
              fetchPriority="high"
              decoding="async"
            />
          </picture>
        </div>

        <div className="m-wrap m-cine-body">
          <Reveal>
            <span className="m-eyebrow">EventOS for weddings</span>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="m-cine-title" style={{ marginBlock: "1.25rem 1.5rem" }}>
              One day. <em>Twelve months</em> of getting it right.
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="m-lead m-cine-sub">
              This is what those twelve months look like when the guest list, the
              invitations, the schedule and the seating are finally the same
              thing.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2rem" }}>
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <a href="#story" className="m-btn m-btn-line m-btn-lg">
                Start at the beginning
              </a>
            </div>
          </Reveal>
        </div>

        <div className="m-cue" aria-hidden="true">
          <i />
        </div>
      </section>

      {/* =========================================================== story */}
      <section id="story">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter) 0" }}>
          <Reveal className="m-ch-head" as="header">
            <div className="m-ch-num">01</div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <span className="m-eyebrow">The year of a wedding</span>
              <h2 className="m-title m-serif" style={{ fontSize: "var(--m-title)" }}>
                Told in the order it actually happens.
              </h2>
            </div>
            <p className="m-lead">
              Six moments between the enquiry and the morning after. Each one is a
              part of the product, but you will meet them the way you would meet
              them on a real wedding.
            </p>
          </Reveal>

          {STEPS.map((s, i) => (
            <div key={s.when} className={`m-step${i % 2 === 1 ? " m-step-flip" : ""}`}>
              <Reveal className="m-step-copy">
                <span className="m-eyebrow">{s.when}</span>
                <h3>{s.title}</h3>
                {s.body.map(p => (
                  <p className="m-body" key={p.slice(0, 24)}>
                    {p}
                  </p>
                ))}
                <div className="m-step-meta">
                  {s.meta.map(m => (
                    <span key={m}>{m}</span>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={80}>
                {s.figure ?? (
                  <p className="m-serif" style={{ fontSize: "var(--m-head)", color: "var(--soft)", maxWidth: "18ch" }}>
                    <em>{String(i + 1).padStart(2, "0")}</em>
                  </p>
                )}
              </Reveal>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================== the day */}
      <section className="m-wed-dark">
        <div className="m-wrap m-chapter">
          <Reveal className="m-quote">
            <span className="m-eyebrow">The day</span>
            <p className="m-serif" style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)", marginBlock: "1.5rem" }}>
              Every guest already has the times, the address and their table,
              on the phone in their pocket.
            </p>
            <p className="m-small" style={{ maxWidth: "40ch", marginInline: "auto" }}>
              Nobody asks you what time the cars leave. That is the whole point of
              the twelve months before it.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ==================================================== the morning */}
      <section>
        <div className="m-wrap m-chapter">
          <Reveal className="m-ch-head" as="header">
            <div className="m-ch-num">02</div>
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <span className="m-eyebrow">The morning after</span>
              <h2 className="m-title m-serif" style={{ fontSize: "var(--m-title)" }}>
                What you keep.
              </h2>
            </div>
            <p className="m-lead">
              The wedding does not evaporate into an archive folder. It stays a
              record — which is what makes the next one faster.
            </p>
          </Reveal>

          <div className="m-rows">
            {[
              ["The whole guest list, as it ended up", "Final numbers, dietary notes, who came and who did not. The version you would have had to rebuild from the inbox."],
              ["The website, still standing", "Couples send it to family for months afterwards. It keeps working, and it keeps your studio's name on it."],
              ["A wedding you can duplicate", "The next couple with a similar shape of day starts from a copy rather than from an empty page."],
            ].map(([title, body], i) => (
              <Reveal key={title} className="m-row" delay={i * 40}>
                <span className="m-ch-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ cta */}
      <section className="m-wed-dark">
        <div className="m-wrap m-chapter">
          <Reveal className="m-quote">
            <h2 className="m-serif" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)" }}>
              Run your next wedding on it.
            </h2>
            <p className="m-lead" style={{ marginInline: "auto", marginTop: "1.25rem" }}>
              We set up each studio ourselves so the first one goes properly.
              Tell us about your work.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--m-block)" }}>
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/" className="m-btn m-btn-line m-btn-lg">
                How the system works
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
