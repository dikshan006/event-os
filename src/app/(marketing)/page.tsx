import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { ContentsIndex, type Chapter } from "@/components/marketing/ContentsIndex";
import {
  GuestListSpecimen,
  ScheduleSpecimen,
  SeatingSpecimen,
  InvitationSpecimen,
} from "@/components/marketing/Specimens";

export const metadata: Metadata = {
  title: "EventOS — the system behind the day",
  description:
    "One place per wedding, and an invitation of their own for every guest. EventOS is the operating system professional wedding planners run their weddings on.",
  openGraph: {
    title: "EventOS — the system behind the day",
    description:
      "One place per wedding, and an invitation of their own for every guest.",
    type: "website",
  },
};

/**
 * The homepage is built as an editorial document rather than as a landing page.
 *
 * It opens on its own table of contents — the device taken from the reference —
 * because that is the single most useful thing a considered B2B site can do:
 * show the shape of the argument before making it, and let someone skip to the
 * part they actually came for. Everything below is a numbered chapter, and the
 * index marks whichever one you are reading.
 *
 * The chapters alternate paper and ink. That alternation, and the one blue
 * field in the hero, are the entire visual budget for the page; there are no
 * cards, no icon grids and no second accent colour anywhere on it.
 */

const CHAPTERS: Chapter[] = [
  { id: "today", label: "How weddings get run today" },
  { id: "record", label: "One place per wedding" },
  { id: "invitation", label: "An invitation for every guest" },
  { id: "plan", label: "The plan, kept current" },
  { id: "studio", label: "Your studio, not ours" },
  { id: "access", label: "Getting access" },
];

function ChapterHead({
  n,
  eyebrow,
  title,
  lead,
}: {
  n: number;
  eyebrow: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
}) {
  return (
    <Reveal as="header" className="m-ch-head">
      <div className="m-ch-num">{String(n).padStart(2, "0")}</div>
      <div style={{ display: "grid", gap: "0.75rem" }}>
        <span className="m-eyebrow">{eyebrow}</span>
        <h2 className="m-title">{title}</h2>
      </div>
      {lead ? <p className="m-lead">{lead}</p> : <div />}
    </Reveal>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ============================================================ hero */}
      <section className="m-hero m-ink" data-hero-tone="dark">
        <div className="m-bloom" aria-hidden="true" />
        <div className="m-wrap m-hero-grid">
          <Reveal>
            <span className="m-eyebrow">EventOS — for professional wedding planners</span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="m-display m-hero-word">The system behind the day.</h1>
          </Reveal>

          <Reveal delay={120} className="m-two">
            <p className="m-lead">
              Planners run weddings across a spreadsheet, a group chat and eleven
              browser tabs. EventOS replaces all of it with one record per wedding
              — and gives every guest an invitation of their own.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", flexWrap: "wrap" }}>
              <Link href="/weddings" className="m-btn m-btn-solid m-btn-lg">
                See it for a wedding <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/request-access" className="m-btn m-btn-line m-btn-lg">
                Request access
              </Link>
            </div>
          </Reveal>

          <Reveal delay={180}>
            <ContentsIndex chapters={CHAPTERS} />
          </Reveal>
        </div>
      </section>

      {/* ==================================================== 01 — today */}
      <section id="today" className="m-paper">
        <div className="m-wrap m-chapter">
          <ChapterHead
            n={1}
            eyebrow="How weddings get run today"
            title="Nobody plans a wedding in one tool."
            lead="Not because planners are disorganised. Because no single tool has ever covered the whole job, so everyone assembles their own from four that nearly do."
          />

          <div className="m-rows">
            {[
              ["The spreadsheet", "Guests, groups, dietary notes, plus-ones. Authoritative right up until two people edit it on the same evening."],
              ["The group chat", "Where the couple actually make decisions. None of which are written down anywhere the spreadsheet can see."],
              ["The inbox", "Every reply arrives here, one at a time, in no order, from addresses that don't match the guest list."],
              ["The seating chart", "Redrawn by hand after every change, because it was never connected to the replies in the first place."],
            ].map(([title, body], i) => (
              <Reveal key={title} className="m-row" delay={i * 40}>
                <span className="m-ch-num">{String(i + 1).padStart(2, "0")}</span>
                <h3>{title}</h3>
                <p>{body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={80}>
            <p className="m-head" style={{ maxWidth: "26ch", marginTop: "var(--m-block)" }}>
              None of it is wrong. All of it is separate.
            </p>
            <p className="m-body" style={{ marginTop: "1rem" }}>
              The cost is not the hours. It is the quiet risk that the version
              someone is working from is no longer the true one — and that the
              first person to notice is a guest, on the day.
            </p>
          </Reveal>
        </div>
      </section>

      {/* =================================================== 02 — record */}
      <section id="record" className="m-ink">
        <div className="m-wrap m-chapter">
          <ChapterHead
            n={2}
            eyebrow="One place per wedding"
            title="A wedding is a record, not a folder."
            lead="Create it once. Every guest, event, table, photograph, reply and payment belongs to it — so there is only ever one version, and it is always the current one."
          />

          <div className="m-two-wide m-two">
            <Reveal>
              <GuestListSpecimen />
            </Reveal>
            <Reveal delay={60} className="m-step-copy">
              <p className="m-body">
                Guests are imported from the spreadsheet you already have, then
                tagged into groups — family, university, evening only. Those
                groups are not labels. They decide which events a guest is shown,
                which invitation they receive, and which table they can be seated
                at.
              </p>
              <p className="m-body">
                Change a group and everything downstream changes with it. That is
                the entire idea of the product, and everything else in it is a
                consequence.
              </p>
            </Reveal>
          </div>

          {/*
            A row of oversized numerals was the first draft here. "Three
            templates" is not a statistic, and setting a weak number in 3rem of
            display type only draws attention to how little it says. One
            sentence, doing the same job honestly.
          */}
          <Reveal delay={40}>
            <div style={{ marginTop: "var(--m-block)", paddingTop: "var(--m-block)", borderTop: "1px solid var(--rule)" }}>
              <span className="m-eyebrow">What belongs to a wedding</span>
              <p className="m-head" style={{ maxWidth: "24ch", marginTop: "1.25rem" }}>
                Guests, events, tables, photographs, replies and the payment.
              </p>
              <p className="m-body" style={{ marginTop: "1.25rem" }}>
                Six things that used to live in six places, none of which could see
                the others. Here they are one row in one database, which is why the
                seating plan can know that somebody declined.
              </p>
            </div>
          </Reveal>

        </div>
      </section>

      {/* =============================================== 03 — invitation */}
      <section id="invitation" className="m-paper">
        <div className="m-wrap m-chapter">
          <ChapterHead
            n={3}
            eyebrow="An invitation for every guest"
            title={<>Every guest gets a different invitation.</>}
            lead="Not a personalised greeting on a shared page. A different page — showing only what that guest was actually invited to."
          />

          <div className="m-two" style={{ alignItems: "center" }}>
            <Reveal className="m-step-copy">
              <p className="m-body">
                Each guest receives one link. It opens their name, the events
                their groups include them in, their table when there is one, and
                a reply form. Nothing to download, no password to forget, no
                account to create — the link is the credential.
              </p>
              <p className="m-body">
                An evening guest never sees the ceremony time. A family member
                sees the rehearsal dinner nobody else is told about. You stop
                writing four versions of the same email, and no guest ever has to
                work out which parts of a page apply to them.
              </p>
              <p className="m-small" style={{ paddingTop: "0.5rem" }}>
                Replies land back on the wedding record the moment they are made.
              </p>
            </Reveal>
            <Reveal delay={60}>
              <InvitationSpecimen />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ===================================================== 04 — plan */}
      <section id="plan" className="m-ink">
        <div className="m-wrap m-chapter">
          <ChapterHead
            n={4}
            eyebrow="The plan, kept current"
            title="The schedule and the seating already know who is coming."
            lead="Because they read from the same guest list the invitations were built from — there is nothing to reconcile, and no export step between them."
          />

          <div className="m-two">
            <Reveal className="m-step-copy">
              <ScheduleSpecimen />
              <h3 className="m-head" style={{ fontSize: "var(--m-body)", fontWeight: 500, paddingTop: "0.5rem" }}>
                Schedule
              </h3>
              <p className="m-body">
                Build the day once and mark who each part is for. Guests are shown
                their own version of it, set like a printed programme rather than
                a timeline of circles and arrows.
              </p>
            </Reveal>

            <Reveal delay={60} className="m-step-copy">
              <SeatingSpecimen />
              <h3 className="m-head" style={{ fontSize: "var(--m-body)", fontWeight: 500, paddingTop: "0.5rem" }}>
                Seating
              </h3>
              <p className="m-body">
                Every event keeps its own plan, because a dinner and a brunch do
                not seat the same people the same way. A guest who declines stops
                occupying a chair, and each guest is told their table on their own
                invitation.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =================================================== 05 — studio */}
      <section id="studio" className="m-paper">
        <div className="m-wrap m-chapter">
          <ChapterHead
            n={5}
            eyebrow="Your studio, not ours"
            title="Guests never find out this exists."
            lead="The website carries the couple's names. The emails carry yours. EventOS is the thing you run the wedding on, not a brand your clients are asked to adopt."
          />

          <div className="m-rows">
            {[
              ["White-labelled throughout", "Your studio name and colour on the wedding site and on every email a guest receives. Ours appears nowhere a client will look."],
              ["One studio, many weddings", "Each wedding is sealed off from the others. A planner sees their studio's work and nothing else, enforced on the server rather than hidden in the interface."],
              ["Photographs, handled properly", "Uploads are stripped of location data, re-encoded into modern formats at four sizes, and toned so type stays readable over them."],
              ["Priced per wedding", "$99 to publish a wedding site. The first one is free. No seats, no monthly minimum, nothing to cancel between seasons."],
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

      {/* =================================================== 06 — access */}
      <section id="access" className="m-ink">
        <div className="m-wrap m-chapter">
          <Reveal className="m-quote">
            <span className="m-eyebrow">06 — Getting access</span>
            <h2 className="m-title" style={{ marginTop: "1.25rem", maxWidth: "18ch", marginInline: "auto" }}>
              EventOS is invite-only, for now.
            </h2>
            <p className="m-lead" style={{ marginInline: "auto", marginTop: "1.25rem" }}>
              We set up each studio ourselves, one at a time, so that the first
              wedding you run on it goes properly. Tell us about your work and we
              will come back to you.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--m-block)" }}>
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/weddings" className="m-btn m-btn-line m-btn-lg">
                See a wedding first
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
