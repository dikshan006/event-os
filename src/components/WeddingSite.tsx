import type { Wedding, Studio, Event, RegistryItem, CashFund, Faq, Guest, Rsvp } from "@prisma/client";
import { Countdown } from "./Countdown";
import { RsvpForm } from "./RsvpForm";
import { SitePhoto } from "./SitePhoto";
import { InvitationHero } from "./InvitationHero";
import { SmoothScroll } from "./SmoothScroll";
import { Reveal } from "./Reveal";
import { Gallery } from "./Gallery";
import { EMPTY_PHOTOS, type PhotoSet } from "@/lib/photo-view";
import { fmtDate } from "@/lib/utils";
import { EventActions, ScheduleCalendarLink, VenueDirections } from "./EventActions";
import { hasPlace, resolvePlace } from "@/lib/maps";

/**
 * Template palettes.
 *
 * The `lace`, `heart` and `rule` flags are gone: repeating-dot borders, a ♥
 * glyph and a double rule are the visual signature of a 2010s wedding
 * template, and they were the loudest thing on the page. Distinction now comes
 * from typography, rhythm and how the photography is toned.
 */
const THEMES = {
  BLUSH_ROMANCE: { bg: "#F6EFEA", ink: "#211E1B", accent: "#9B5B63", deep: "#211E1B", names: "caps",
    photo: "linear-gradient(120deg,#4a4340,#7c655b 60%,#a3897a)" },
  // Sage was #87A07A on white: 2.86:1, which fails WCAG AA even for large
  // text, and it carried every link and the RSVP button. Darkened until both
  // the text-on-background and white-on-button directions pass.
  MODERN_SAGE: { bg: "#FFFFFF", ink: "#414B3C", accent: "#5E7052", deep: "#54654A", names: "caps",
    photo: "linear-gradient(120deg,#1f2a22,#3c5240 55%,#6e8264)" },
  CLASSIC_ELEGANCE: { bg: "#F7F2E4", ink: "#5a4038", accent: "#A93A42", deep: "#A93A42", names: "script",
    photo: "linear-gradient(120deg,#241f24,#57404a 55%,#8d6f72)" },
} as const;

type Props = {
  wedding: Wedding & { faqs: Faq[]; registry: RegistryItem[]; funds: CashFund[] };
  studio: Studio;
  events: Event[]; // already filtered: public site → isPublic only; portal → personalized
  guest?: (Guest & { rsvp: Rsvp | null }) | null;
  /** Table name keyed by event id, for the guest who is viewing. */
  tableByEvent?: Record<string, string>;
  photos?: PhotoSet;
  rsvpAction?: (code: string, input: { status: string; meal: string; dietary: string; notes: string }) => Promise<void>;
};

export function WeddingSite({ wedding, studio, events, guest, photos = EMPTY_PHOTOS, tableByEvent = {}, rsvpAction }: Props) {
  const theme = THEMES[wedding.template];
  const has = (s: string) => wedding.sections.includes(s);
  const days = [...new Set(events.map(e => e.day))];
  const first = guest?.name.split(" ")[0];
  const vars = { "--sb": theme.bg, "--si": theme.ink, "--sa": theme.accent, "--sd": theme.deep } as React.CSSProperties;

  /**
   * The token the calendar endpoint is addressed by: a guest's invite code on
   * the invitation, the wedding slug on the public site. Both resolve through
   * the same visibility rules the page itself used, so the .ics can never
   * contain an event that is not already on this page.
   */
  const calToken = guest?.inviteCode ?? wedding.slug;
  const venuePlace = resolvePlace({ location: null, address: null, lat: null, lng: null }, wedding);
  const venueMappable = hasPlace(venuePlace);
  const venueAddressLine = venuePlace.address;
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");

  /**
   * Exactly two photographs on the homepage.
   *
   * Previously this rendered the hero plus every couple photo (up to six) plus
   * every story photo (up to four) plus the gallery — as many as eleven images
   * before a guest reached the RSVP, which reads as a photo album rather than
   * an invitation. The hero and one editorial portrait stay; everything else
   * moves into the Gallery section, where photographs are the point.
   */
  const portrait = photos.couple[0] ?? photos.story[0] ?? null;
  const galleryPhotos = [
    ...photos.gallery,
    ...photos.couple,
    ...photos.story,
  ].filter((p, i, all) => p.id !== portrait?.id && all.findIndex(q => q.id === p.id) === i);

  // Travel: heading/body pairs for whatever the planner filled in. An empty
  // list hides the section entirely rather than showing invented detail.
  const travelEntries = ([
    [wedding.venue || "The venue", wedding.venueNote],
    ["Where to stay", wedding.accommodation],
    ["Getting here", wedding.travelNote],
  ] as const).filter((e): e is readonly [string, string] => Boolean(e[1]?.trim()));

  const dateLine = fmtDate(wedding.date);
  const placeLine = [wedding.venue, wedding.city].filter(Boolean).join(" · ");

  const navLinks = [
    ["#home", "Home"],
    ["#events", "Events"],
    ...(has("TRAVEL") ? [["#travel", "Travel"] as const] : []),
    ...(has("FAQ") && wedding.faqs.length ? [["#faq", "FAQ"] as const] : []),
  ] as const;

  // The couple's names are the page's h1 — previously three unlabelled divs,
  // which left the document with no heading outline at all for screen readers.
  const nameInk = wedding.template === "MODERN_SAGE" ? theme.deep : theme.ink;
  const Names = (
    <h1 className="s-names" aria-label={`${wedding.partnerOne} and ${wedding.partnerTwo}`}>
      {theme.names === "script" ? (
        <>
          <span className="s-name script">{wedding.partnerOne}</span>
          <span className="s-and" aria-hidden="true">and</span>
          <span className="s-name script">{wedding.partnerTwo}</span>
        </>
      ) : (
        <>
          <span className="s-name" style={{ color: nameInk }}>{wedding.partnerOne.toUpperCase()}</span>
          <span className="s-and" aria-hidden="true">and</span>
          <span className="s-name" style={{ color: nameInk }}>{wedding.partnerTwo.toUpperCase()}</span>
        </>
      )}
    </h1>
  );

  return (
    <div className="site" style={vars}>
      {/* Guest pages only — the studio and admin dashboards keep native scroll. */}
      <SmoothScroll />
      <a className="skip" href="#main">Skip to content</a>
      {/* Navigation leads the page rather than sitting between the names and
          the hero image, which split the masthead in two. */}
      <nav className="s-nav" aria-label="Sections">
        {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        <a className="s-nav-cta" href="#rsvp">RSVP</a>
      </nav>

      <div className="s-wrap">
        <main id="main">
          {/* --- Masthead: type first, generous air, no ornament. --------- */}
          <header className="s-masthead" id="home">
            <Reveal>
              <p className="s-kicker">The wedding of</p>
              {Names}
              <p className="s-meta">
                <time dateTime={wedding.date.toISOString().slice(0, 10)}>{dateLine}</time>
                {placeLine && <><span className="s-dot" aria-hidden="true">·</span>{placeLine}</>}
              </p>
            </Reveal>
          </header>

          {/* --- Hero plate: one photograph, inset, toned into the palette.
              Eager and high-priority because it is the only above-the-fold
              image; everything below it is lazy. Falls back to the template
              gradient until a photograph is uploaded. -------------------- */}
          <Reveal as="figure" className="s-plate" delay={80}>
            {photos.hero ? (
              <SitePhoto photo={photos.hero} ratio={16 / 9} priority
                sizes="(max-width: 1120px) 100vw, 1080px" />
            ) : (
              <div className="s-plate-fallback" style={{ background: theme.photo }} />
            )}
          </Reveal>

          <Reveal className="s-invite">
            <InvitationHero guestName={guest?.name} groups={guest?.groups} date={wedding.date} />
          </Reveal>

          {/* --- Story: the second and final homepage photograph, set beside
              the text as an editorial spread rather than a grid of thumbs. */}
          {(wedding.story || portrait) && (
            <section className="s-story">
              {portrait && (
                <Reveal as="figure" className="s-portrait">
                  <SitePhoto photo={portrait} ratio={4 / 5}
                    sizes="(max-width: 760px) 78vw, 380px" />
                </Reveal>
              )}
              {wedding.story && (
                <Reveal className="s-story-text">
                  <h2 className="s-h">Our Story</h2>
                  {wedding.story.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}
                </Reveal>
              )}
            </section>
          )}

        {has("COUNTDOWN") && (
          <section className="s-sec">
            <h2 className="s-h sr-only">Countdown</h2>
            <div className="s-hs">counting down the days</div>
            <Countdown target={wedding.date.toISOString()} />
          </section>
        )}

        {/* --- The programme.
            Set like a printed wedding programme: time, then event, then place,
            then dress. No rules, no connectors, no icons — hierarchy and space
            do the work. Each entry stands on its own. ------------------- */}
        <section className="s-sec" id="events">
          <h2 className="s-h">Events</h2>
          <div className="s-hs">{guest ? `your personal schedule, ${first}` : "the celebration weekend"}</div>

          {days.map(day => (
            <div className="s-prog-day" key={day}>
              <p className="s-prog-date">{day}</p>
              {events.filter(e => e.day === day).map(e => (
                <Reveal key={e.id} className="s-prog-item">
                  <p className="s-prog-time">{e.time}</p>
                  <h3 className="s-prog-title">{e.title}</h3>
                  {e.location && <p className="s-prog-where">{e.location}</p>}
                  {e.dressCode && <p className="s-prog-dress">{e.dressCode}</p>}
                  {e.description && <p className="s-prog-note">{e.description}</p>}
                  {/* Seating belongs to the event, so it is shown here rather
                      than as a detached section further down the page. */}
                  {tableByEvent[e.id] && (
                    <div className="s-seat">
                      <p className="s-seat-label">Your table</p>
                      <p className="s-seat-table">{tableByEvent[e.id]}</p>
                    </div>
                  )}
                  <EventActions
                    event={e}
                    wedding={wedding}
                    studioName={studio.name}
                    token={calToken}
                    appUrl={appUrl}
                  />
                </Reveal>
              ))}
            </div>
          ))}
          {!events.length && <p className="s-empty">The schedule will appear here soon.</p>}
          {events.length > 0 && (
            <Reveal>
              <ScheduleCalendarLink events={events} token={calToken} appUrl={appUrl} />
            </Reveal>
          )}
        </section>

        {/* --- The gallery is a separate experience, reached deliberately.
            One quiet line on the page; the photographs live behind it. --- */}
        {has("GALLERY") && galleryPhotos.length > 0 && (
          <section className="s-sec s-sec-quiet" id="gallery">
            <Reveal>
              <Gallery photos={galleryPhotos} />
            </Reveal>
          </section>
        )}

        {/* Only what the planner actually wrote. The previous version shipped
            invented copy — valet parking, a room block — to real guests.

            Directions are the exception: they are derived from the venue the
            planner already entered, so the section now also earns its place
            when there is a venue but no travel notes yet. A guest should never
            have to copy an address out of a page. */}
        {has("TRAVEL") && (travelEntries.length > 0 || venueMappable) && (
          <section className="s-sec" id="travel">
            <h2 className="s-h">Travel</h2>
            <div className="s-hs">getting here &amp; staying nearby</div>
            <div className="s-notes">
              {travelEntries.map(([heading, body]) => (
                <Reveal key={heading} className="s-note">
                  <h3>{heading}</h3>
                  <p>{body}</p>
                </Reveal>
              ))}
              {venueMappable && (
                <Reveal className="s-note">
                  <h3>{wedding.venue || "Directions"}</h3>
                  {venueAddressLine && <p>{venueAddressLine}</p>}
                  <VenueDirections wedding={wedding} />
                </Reveal>
              )}
            </div>
          </section>
        )}

        {/* FAQ as a question-and-answer column. Native <details> gives keyboard
            operation, in-page find, and works with JavaScript disabled. */}
        {has("FAQ") && wedding.faqs.length > 0 && (
          <section className="s-sec" id="faq">
            <h2 className="s-h">Questions</h2>
            <div className="s-hs">good things to know</div>
            <div className="s-qa">
              {wedding.faqs.map(f => (
                <details className="s-q" key={f.id}>
                  <summary><span>{f.question}</span></summary>
                  <p>{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Registry as a gift list, set like a printed page: title, then the
            quiet detail line, then a restrained link. No boxes. */}
        {has("REGISTRY") && wedding.registry.length > 0 && (
          <section className="s-sec" id="registry">
            <h2 className="s-h">Registry</h2>
            <div className="s-hs">gifts we would love</div>
            <ul className="s-list">
              {wedding.registry.map(g => (
                <li className="s-list-item" key={g.id}>
                  <h3>{g.title}</h3>
                  {[g.price, g.retailer].filter(Boolean).length > 0 && (
                    <p className="s-list-detail">{[g.price, g.retailer].filter(Boolean).join(" · ")}</p>
                  )}
                  <a className="s-quiet-link" href={g.url} target="_blank" rel="noopener noreferrer">
                    View gift<span aria-hidden="true"> ↗</span>
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {has("CASH") && wedding.funds.length > 0 && (
          <section className="s-sec" id="funds">
            <h2 className="s-h">Cash Gifts</h2>
            <div className="s-hs">or contribute to our next chapter</div>
            <ul className="s-list">
              {wedding.funds.map(f => (
                <li className="s-list-item" key={f.id}>
                  <h3>{f.name}</h3>
                  {f.blurb && <p className="s-list-detail">{f.blurb}</p>}
                  <p className="s-pay">
                    {f.stripeUrl && <a className="s-quiet-link" href={f.stripeUrl} target="_blank" rel="noopener noreferrer">Card</a>}
                    {f.venmoUrl && <a className="s-quiet-link" href={f.venmoUrl} target="_blank" rel="noopener noreferrer">Venmo</a>}
                    {f.paypalUrl && <a className="s-quiet-link" href={f.paypalUrl} target="_blank" rel="noopener noreferrer">PayPal</a>}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="s-sec" id="rsvp">
          <h2 className="s-h">RSVP</h2>
          <div className="s-hs">kindly reply</div>
          {guest && rsvpAction ? (
            <RsvpForm
              code={guest.inviteCode}
              firstName={first!}
              initial={guest.rsvp ? { status: guest.rsvp.status, meal: guest.rsvp.meal ?? "", dietary: guest.rsvp.dietary ?? "", notes: guest.rsvp.notes ?? "" } : undefined}
              action={rsvpAction}
            />
          ) : (
            <p className="s-empty">
              RSVP is available through your personal invitation link. Check your email for a link made just for you.
            </p>
          )}
        </section>

        </main>

        {/* Understated: names in the page's own display face rather than a
            script flourish, and the studio credit kept quiet. */}
        <footer className="s-foot">
          <p className="s-foot-names">{wedding.partnerOne} &amp; {wedding.partnerTwo}</p>
          <p className="s-foot-date">{dateLine}</p>
          <p className="by">Designed by {studio.name}</p>
        </footer>
      </div>
    </div>
  );
}
