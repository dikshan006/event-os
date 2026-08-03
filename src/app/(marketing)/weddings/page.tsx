import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { showcaseWeddings } from "@/server/services/showcase";
import { fmtDate } from "@/lib/utils";
import {
  GuestListSpecimen,
  ScheduleSpecimen,
  SeatingSpecimen,
  InvitationSpecimen,
  RsvpSpecimen,
  GallerySpecimen,
  DashboardSpecimen,
  RegistrySpecimen,
  EmailSpecimen,
} from "@/components/marketing/Specimens";

export const metadata: Metadata = {
  title: "Weddings — EventOS",
  description:
    "Websites, guest invitations, RSVPs, schedule and seating. Everything a wedding planner runs, in one place.",
  openGraph: {
    title: "Weddings — EventOS",
    description: "Everything a wedding planner runs, in one place.",
    type: "website",
  },
};

/**
 * The flagship product page.
 *
 * One visual key from top to bottom — deep warm charcoal, the photograph as the
 * only thing that changes. The earlier draft alternated ivory and near-black,
 * and scrolling it felt like moving between two different products.
 *
 * Copy is deliberately short. Each block makes one point and then shows the
 * thing rather than describing it; the drawn specimens carry the detail that
 * paragraphs used to.
 */

const TOUR: { title: string; line: string; figure: React.ReactNode }[] = [
  {
    title: "Invitation website",
    line: "A finished design, with the couple's photographs and your studio's name.",
    figure: <InvitationSpecimen />,
  },
  {
    title: "Guest management",
    line: "Import the list. Tag people into groups. Everything else follows from that.",
    figure: <GuestListSpecimen />,
  },
  {
    title: "RSVP",
    line: "Replies land on the wedding, with dietary and access notes attached.",
    figure: <RsvpSpecimen />,
  },
  {
    title: "Schedule",
    line: "Build the day once. Each guest sees only their part of it.",
    figure: <ScheduleSpecimen />,
  },
  {
    title: "Seating",
    line: "A plan per event. Decline a seat and it frees itself.",
    figure: <SeatingSpecimen />,
  },
  {
    title: "Gallery",
    line: "Photographs optimised on upload and toned to sit under the type.",
    figure: <GallerySpecimen />,
  },
  {
    title: "Planner dashboard",
    line: "Every wedding in your studio, and where each one stands.",
    figure: <DashboardSpecimen />,
  },
  {
    title: "Registry",
    line: "Gifts and cash funds, on the couple's own website.",
    figure: <RegistrySpecimen />,
  },
  {
    title: "Email invitations",
    line: "One personal link per guest, sent from your studio.",
    figure: <EmailSpecimen />,
  },
];

export default async function WeddingsPage() {
  const examples = await showcaseWeddings(3);

  return (
    <div className="m-wed">
      {/* ======================================================= cinematic */}
      <section className="m-cine" data-hero-tone="warm">
        <div className="m-cine-media" aria-hidden="true">
          {/*
            Structured so a film can replace the still without touching the
            layout: drop a <video autoPlay muted loop playsInline poster> in
            here and the scrim, sizing and type all still apply.
          */}
          <picture>
            <source srcSet="/marketing/weddings-hero.avif" type="image/avif" />
            <source srcSet="/marketing/weddings-hero.webp" type="image/webp" />
            <img
              src="/marketing/weddings-hero.webp"
              alt=""
              width={1600}
              height={3466}
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
              Everything a wedding needs. <em>In one place.</em>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="m-lead m-cine-sub">
              The website, the invitations, the guest list, the seating. Built
              for planners who are trusted with one day.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "2rem" }}>
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <a href="#tour" className="m-btn m-btn-line m-btn-lg">
                See the product
              </a>
            </div>
          </Reveal>
        </div>

        <div className="m-cue" aria-hidden="true">
          <i />
        </div>
      </section>

      {/* ============================================================ tour */}
      <section id="tour">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter)" }}>
          <Reveal>
            <span className="m-eyebrow">The product</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "18ch", marginBlock: "1.25rem 1rem" }}>
              Nine things, one record.
            </h2>
            <p className="m-lead">
              Change a guest&rsquo;s group and the invitation, the schedule and
              the seating all change with them.
            </p>
          </Reveal>

          <div className="m-tour" style={{ marginTop: "var(--m-block)" }}>
            {TOUR.map((t, i) => (
              <Reveal key={t.title} className="m-tour-item" delay={(i % 3) * 50}>
                {t.figure}
                <h3>{t.title}</h3>
                <p>{t.line}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================== video */}
      <section id="demo" className="m-wed-raise">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter)" }}>
          <Reveal>
            <span className="m-eyebrow">Demo</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "16ch", marginBlock: "1.25rem var(--m-block)" }}>
              Watch a wedding come together.
            </h2>
          </Reveal>

          <Reveal delay={60}>
            <div className="m-video">
              <div className="m-video-body">
                <span className="m-play" aria-hidden="true" />
                <span className="m-eyebrow">Film coming soon</span>
                <p className="m-small" style={{ maxWidth: "34ch" }}>
                  A short walkthrough, from the first guest import to the
                  invitation landing in someone&rsquo;s inbox.
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <div className="m-slots" style={{ marginTop: "var(--m-block)" }}>
              <span className="m-slot">Studio still</span>
              <span className="m-slot">Invitation on a phone</span>
              <span className="m-slot">Seating plan</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ========================================================= example */}
      <section id="example">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter)" }}>
          <Reveal>
            <span className="m-eyebrow">Live example</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "18ch", marginBlock: "1.25rem 1rem" }}>
              View an example wedding.
            </h2>
            <p className="m-lead">
              A real wedding website running on EventOS right now. Not a mockup.
            </p>
          </Reveal>

          <div style={{ marginTop: "var(--m-block)" }}>
            {examples.length > 0 ? (
              <div className="m-examples">
                {examples.map((w, i) => (
                  <Reveal key={w.slug} delay={i * 50}>
                    {/* A published guest site, opened in its own tab so the
                        visitor does not lose their place here. */}
                    <a
                      className="m-example"
                      href={`/w/${w.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <em>{fmtDate(w.date)}</em>
                      <b>{w.couple}</b>
                      <span>{[w.venue, w.city].filter(Boolean).join(" · ") || " "}</span>
                      <span className="m-example-foot">
                        View website <span className="m-arrow" aria-hidden="true">↗</span>
                      </span>
                    </a>
                  </Reveal>
                ))}
              </div>
            ) : (
              /* Nothing published yet. Say so plainly rather than linking to a
                 404 or inventing a wedding that does not exist. */
              <Reveal>
                <p className="m-note">
                  No wedding websites are published yet. As soon as one is, it
                  appears here automatically.
                </p>
              </Reveal>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================= cta */}
      <section className="m-wed-raise">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter)" }}>
          <Reveal className="m-quote">
            <h2 className="m-serif" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", maxWidth: "14ch", marginInline: "auto" }}>
              Run your next wedding on it.
            </h2>
            <p className="m-lead" style={{ marginInline: "auto", marginTop: "1.25rem" }}>
              We set up each studio ourselves, so the first one goes properly.
            </p>
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap", marginTop: "var(--m-block)" }}>
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/login" className="m-btn m-btn-line m-btn-lg">
                Sign in
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
