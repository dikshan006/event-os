import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { showcaseWeddings } from "@/server/services/showcase";
import { fmtDate } from "@/lib/utils";
import { InvitationSpecimen } from "@/components/marketing/Specimens";

export const metadata: Metadata = {
  title: "Weddings — EventOS",
  description:
    "A personal wedding website for every guest, generated automatically. One dashboard for the planner; one link each for the guests.",
  openGraph: {
    title: "Weddings — EventOS",
    description: "A personal wedding website for every guest, generated automatically.",
    type: "website",
  },
};

/**
 * The flagship product page.
 *
 * Rewritten around one idea rather than nine.
 *
 * The previous version was an inventory: a grid of nine drawn specimens, one
 * per feature, each with a caption. It was accurate and it was the wrong shape
 * — a planner reading it had to assemble the point themselves out of nine
 * parts, and the page ran to six thousand pixels of scroll with half-screen
 * gaps between rows. Everything on it was true and none of it said what the
 * product is *for*.
 *
 * What it is for is this: every guest gets their own wedding website, generated
 * automatically, showing only what applies to them. That is the sentence a
 * planner needs, and it is now the whole top of the page. The films that follow
 * are meant to carry the explanation; the copy exists to get someone to them.
 *
 * The copy is prose first and lists second, which is the opposite of where it
 * started. A tick list is only legible to someone who already knows what the
 * product is — it names things without saying what they are for, so a planner
 * seeing EventOS for the first time reads seven nouns and learns nothing. The
 * paragraphs now do the explaining in the plainest language available (the
 * problem, then what happens instead, then what changes when plans move), and
 * the lists sit underneath as a reference for someone checking a specific
 * thing is covered.
 *
 * One visual key from top to bottom — deep warm charcoal, the photograph as the
 * only thing that changes.
 */

/** What a planner does. Verbs, not features, and all of it once. */
const PLANNER = [
  "Create the wedding website",
  "Import and group the guest list",
  "Send personal invitations",
  "Collect RSVPs",
  "Build the schedule",
  "Arrange the seating",
  "Publish from one place",
];

/** What a guest gets. All of it on one link, none of it to be asked for. */
const GUEST = [
  "Their invitation, addressed to them",
  "Their RSVP",
  "Their own schedule",
  "Directions and travel",
  "Where they are sitting",
  "The gallery",
  "The registry",
];

/** The three films. Ordered as someone learns the product, not as we built it. */
const FILMS = [
  {
    n: "01",
    title: "What EventOS is",
    line: "The idea in a couple of minutes, and how the pieces fit together.",
  },
  {
    n: "02",
    title: "How a planner runs a wedding",
    line: "From an empty studio to a published website and invitations sent.",
  },
  {
    n: "03",
    title: "What a guest sees",
    line: "One link, from the invitation arriving to the morning of the day.",
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
              A wedding website for <em>every guest.</em>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="m-lead m-cine-sub">
              Not one site everybody shares. One each, generated automatically,
              showing only what applies to them.
            </p>
          </Reveal>
          <Reveal delay={200}>
            <div className="m-actions m-actions-center">
              <Link href="/request-access" className="m-btn m-btn-solid m-btn-lg">
                Request access <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <a href="#films" className="m-btn m-btn-line m-btn-lg">
                Watch the films
              </a>
            </div>
          </Reveal>
        </div>

        <div className="m-cue" aria-hidden="true">
          <i />
        </div>
      </section>

      {/* ========================================================= the idea */}
      <section id="what">
        <div className="m-wrap m-chapter">
          <div className="m-two-wide m-two" style={{ alignItems: "center" }}>
            <Reveal className="m-col">
              <span className="m-eyebrow">What it is</span>
              <h2 className="m-title m-serif" style={{ marginBlock: "1.25rem 1rem" }}>
                One website each, not one for everyone.
              </h2>
              <p className="m-lead">
                A normal wedding website is a single page that everybody shares.
                Every guest sees every event, every address and every
                instruction, and has to work out which parts are theirs.
              </p>
              <p className="m-body" style={{ marginTop: "1.25rem" }}>
                EventOS makes a separate one for each guest. You build the
                wedding once. Everyone gets their own link.
              </p>
              <p className="m-body" style={{ marginTop: "1.25rem" }}>
                When they open it they see their invitation with their name on
                it, only the events they are actually invited to, how to get
                there, and where they are sitting. Nothing that isn&rsquo;t
                theirs, and nothing to scroll past.
              </p>
            </Reveal>

            <Reveal delay={80}>
              <InvitationSpecimen />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ====================================================== the payoff */}
      <section id="minutes" className="m-wed-raise">
        <div className="m-wrap m-chapter">
          <Reveal className="m-col-prose">
            <span className="m-eyebrow">Why it saves you the afternoon</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "20ch", marginBlock: "1.25rem 1rem" }}>
              Built once. Personal for everyone.
            </h2>
            <p className="m-lead">
              Import the guest list, mark who is invited to what, and publish.
              That is the whole job. Two hundred personal websites take about as
              long as one.
            </p>
            <p className="m-body" style={{ marginTop: "1.25rem" }}>
              Then things change, because they always do. The ceremony moves an
              hour. A family is now evening-only. The seating plan is redone the
              week before. You change it in one place and every guest&rsquo;s
              website updates at the same moment.
            </p>
            <p className="m-body" style={{ marginTop: "1.25rem" }}>
              There is nothing to re-send and no second version to keep track
              of, because nothing was ever sent as a copy. The link a guest was
              given in March is still correct in September.
            </p>
          </Reveal>

          {/* The lists stay, but as a reference under the explanation rather
              than as the explanation itself. Someone who has read the
              paragraphs already knows what this is; they are here for the
              person who wants to check a specific thing is covered. */}
          <div className="m-two" style={{ marginTop: "var(--m-block)" }}>
            <Reveal className="m-col">
              <span className="m-eyebrow">You do this once</span>
              <ul className="m-ticks" style={{ marginTop: "1rem" }}>
                {PLANNER.map(x => <li key={x}>{x}</li>)}
              </ul>
            </Reveal>

            <Reveal className="m-col" delay={80}>
              <span className="m-eyebrow">Every guest gets this</span>
              <ul className="m-ticks" style={{ marginTop: "1rem" }}>
                {GUEST.map(x => <li key={x}>{x}</li>)}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* =========================================================== films */}
      <section id="films">
        <div className="m-wrap m-chapter">
          <Reveal>
            <span className="m-eyebrow">Watch</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "18ch", marginBlock: "1.25rem 1rem" }}>
              Three films, start to finish.
            </h2>
            <p className="m-lead">
              Shorter than reading about it, and closer to the truth.
            </p>
          </Reveal>

          {/*
            Placeholders with the final proportions and the final copy. Each
            card is a 16:9 frame; dropping a <video> or an embed inside
            `.m-film-frame` needs no other change to the layout.
          */}
          <div className="m-films" style={{ marginTop: "var(--m-block)" }}>
            {FILMS.map((f, i) => (
              <Reveal key={f.n} className="m-film" delay={i * 60}>
                <div className="m-film-frame">
                  <span className="m-play" aria-hidden="true" />
                  <span className="m-film-n" aria-hidden="true">{f.n}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.line}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ========================================================= example */}
      <section id="example" className="m-wed-raise">
        <div className="m-wrap m-chapter">
          <Reveal>
            <span className="m-eyebrow">Live example</span>
            <h2 className="m-title m-serif" style={{ maxWidth: "18ch", marginBlock: "1.25rem 1rem" }}>
              A real one, running now.
            </h2>
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
                      <span>{[w.venue, w.city].filter(Boolean).join(" · ") || " "}</span>
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
      <section>
        <div className="m-wrap m-chapter">
          <Reveal className="m-quote">
            <h2 className="m-serif" style={{ fontSize: "clamp(2rem, 5vw, 3.5rem)", maxWidth: "14ch", marginInline: "auto" }}>
              Run your next wedding on it.
            </h2>
            <p className="m-lead" style={{ marginInline: "auto", marginTop: "1.25rem" }}>
              We set up each studio ourselves, so the first one goes properly.
            </p>
            <div className="m-actions m-actions-center" style={{ marginTop: "var(--m-block)" }}>
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
