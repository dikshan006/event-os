import type { Wedding, Studio, Event, RegistryItem, CashFund, Faq, Guest, Rsvp } from "@prisma/client";
import { Countdown } from "./Countdown";
import { RsvpForm } from "./RsvpForm";
import { SitePhoto } from "./SitePhoto";
import { InvitationHero } from "./InvitationHero";
import { SmoothScroll } from "./SmoothScroll";
import { Reveal } from "./Reveal";
import { Gallery } from "./Gallery";
import { Botanical, BotanicalDefs } from "./Botanical";
import { SiteGround } from "./SiteGround";
import { EMPTY_PHOTOS, type PhotoSet } from "@/lib/photo-view";
import { fmtDate } from "@/lib/utils";
import { themeFor, themeVars } from "@/lib/themes";
import { EventActions, ScheduleCalendarLink, VenueDirections } from "./EventActions";
import { hasPlace, resolvePlace } from "@/lib/maps";


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
  const theme = themeFor(wedding.template);
  const has = (s: string) => wedding.sections.includes(s);
  // Decoration is a property of the palette, so the page asks the theme
  // rather than checking which template is active.
  const ornament = theme.ornament === "botanical";
  const days = [...new Set(events.map(e => e.day))];
  const first = guest?.name.split(" ")[0];
  const baseVars = themeVars(theme);

  /**
   * On a photographic ground the accent takes its adjusted value.
   *
   * Swapped here rather than in a stylesheet rule because `themeVars` writes
   * `--sa` as an inline style, and no selector outranks that — a
   * `.site[data-ground="1"]{--sa:…}` rule looks right, cascades correctly on
   * paper, and does nothing at all.
   *
   * Applied at the root rather than to the handful of rules that set small
   * text in the accent, so a rule added later cannot miss it. On borders and
   * display sizes the shift is imperceptible; on the event times, the table
   * number and the registry lines it is the difference between 3.7:1 and 5:1
   * over the photograph.
   */
  const vars = {
    ...baseVars,
    ...(photos.hero
      ? { "--sa": baseVars["--s-accent-ground"], "--sd": baseVars["--s-deep-ground"] }
      : null),
  } as React.CSSProperties;

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

  // The teaser shows three. Whatever the planner marked as featured, topped up
  // from the front of the list so the section is never half-empty.
  const featuredGifts = [
    ...wedding.registry.filter(g => g.featured),
    ...wedding.registry.filter(g => !g.featured),
  ].slice(0, 3);
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
  // Which ink the names take is a property of the palette, not a special case
  // for one template — it now travels with the theme as `--s-name-ink`.
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
          <span className="s-name">{wedding.partnerOne.toUpperCase()}</span>
          <span className="s-and" aria-hidden="true">and</span>
          <span className="s-name">{wedding.partnerTwo.toUpperCase()}</span>
        </>
      )}
    </h1>
  );

  return (
    // `data-template` is the hook a template uses to change layout and rhythm
    // without any component knowing which template is active. Everything a
    // template overrides lives in one block of the stylesheet, keyed off this.
    <div
      className="site"
      data-template={wedding.template}
      data-surface={theme.surface}
      data-navmark={theme.navMark ? "1" : undefined}
      // Whether the page is sitting on the couple's photograph. Everything that
      // has to change for that — the translucent section panels, the frosted
      // navigation, the darkened accent — hangs off this one flag, so a wedding
      // with no hero photo renders exactly as it always did rather than as a
      // version of the photographic design with the photograph missing.
      data-ground={photos.hero ? "1" : undefined}
      data-art={theme.art === "none" ? undefined : theme.art}
      style={vars}
    >
      {/*
        A CSS background is discovered only after the stylesheet is parsed and
        the element is laid out, so the masthead painted flat and the artwork
        arrived a beat later — the one template that visibly assembled itself
        while every other one simply appeared. Preloading moves the fetch to the
        head, alongside the fonts.

        Both formats are declared with their type; a browser skips the one it
        cannot decode, so exactly one is fetched. React hoists these into the
        document head wherever they are rendered.
      */}
      {theme.art === "floral" && (
        <>
          <link rel="preload" as="image" type="image/avif" href="/art/dark-floral.avif" />
          <link rel="preload" as="image" type="image/webp" href="/art/dark-floral.webp" />
        </>
      )}
      {/* The couple's photograph, held behind the entire page. Only when there
          is one: a site without photography keeps the flat ground it was
          designed to have, rather than a grey rectangle pinned to the
          viewport. */}
      {photos.hero && <SiteGround photo={photos.hero} />}

      {/* Guest pages only — the studio and admin dashboards keep native scroll. */}
      <SmoothScroll />
      <a className="skip" href="#main">Skip to content</a>
      {/* Navigation leads the page rather than sitting between the names and
          the hero image, which split the masthead in two. */}
      <nav className="s-nav" aria-label="Sections">
        {/* Some templates set the couple's names above the links, which changes
            the proportion of the entire first screen. Rendered only where the
            theme asks for it, and marked decorative: the names are already the
            page's h1 further down, and a screen reader gains nothing from
            hearing them twice before the navigation. */}
        {theme.navMark && (
          <p className="s-nav-mark" aria-hidden="true">
            {wedding.partnerOne} <span className="amp">&amp;</span> {wedding.partnerTwo}
          </p>
        )}
        <span className="s-nav-links">
          {navLinks.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          <a className="s-nav-cta" href="#rsvp">RSVP</a>
        </span>
      </nav>

      <div className="s-wrap s-above">
        <main id="main">
          {/* --- Masthead: type first, generous air, no ornament. --------- */}
          <header className="s-masthead" id="home">
            {ornament && <><BotanicalDefs /><Botanical corners={["tl", "br"]} /></>}
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
              image; everything below it is lazy.

              No photograph, no plate. There used to be a gradient rectangle
              here standing in for the missing hero, and it was the single
              thing that made a site without photography look broken rather
              than considered — a 16:9 grey-brown box under the names reads as
              an image that failed to load. The masthead simply meets the
              invitation instead, and the extra air is the better composition
              anyway. ----------------------------------------------------- */}
          {photos.hero && (
            <Reveal as="figure" className="s-plate" delay={80}>
              <SitePhoto photo={photos.hero} ratio={16 / 9} priority
                sizes="(max-width: 1120px) 100vw, 1080px" />
            </Reveal>
          )}

          <Reveal className="s-invite">
            <InvitationHero guestName={guest?.name} groups={guest?.groups} date={wedding.date} />
          </Reveal>

          {/* --- Story: the second and final homepage photograph, set beside
              the text as an editorial spread rather than a grid of thumbs. */}
          {(wedding.story || portrait) && (
            // Without a portrait the spread has one column, not an empty one.
            // The grid previously kept its 380px photo track whether or not
            // anything filled it, which pushed the prose into a narrow gutter
            // beside a hole.
            <section className={`s-story${portrait ? "" : " s-story-solo"}`}>
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
              <ScheduleCalendarLink events={events} token={calToken} appUrl={appUrl}
                weddingName={`${wedding.partnerOne} & ${wedding.partnerTwo}`} />
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
        {/* The invitation stays short. Three gifts as a taste, one line of
            copy, and a link — the wishlist itself is a page of its own, which
            is where twenty gifts belong. */}
        {has("REGISTRY") && wedding.registry.length > 0 && (
          <section className="s-sec" id="registry">
            <h2 className="s-h">Registry</h2>
            <div className="s-hs">with love and thanks</div>

            <Reveal>
              <p className="s-reg-note">
                Your presence is the greatest gift of all. For those who have
                asked, we have put together a wishlist of things we would love
                as we begin this new chapter together.
              </p>
            </Reveal>

            {featuredGifts.length > 0 && (
              <Reveal>
                <ul className="s-gifts s-reg-preview">
                  {featuredGifts.map(g => (
                    <li className="s-gift" key={g.id}>
                      <p className="s-gift-title">{g.title}</p>
                      {[g.retailer, g.price].filter(Boolean).length > 0 && (
                        <p className="s-gift-detail">{[g.retailer, g.price].filter(Boolean).join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </Reveal>
            )}

            <Reveal>
              <div style={{ textAlign: "center", marginTop: "var(--sp-7)" }}>
                <a className="s-quiet-link" href={`/w/${wedding.slug}/registry`}>
                  View wishlist<span aria-hidden="true"> →</span>
                </a>
              </div>
            </Reveal>
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
          {ornament && <Botanical corners={["bl", "br"]} />}
          <p className="s-foot-names">{wedding.partnerOne} &amp; {wedding.partnerTwo}</p>
          <p className="s-foot-date">{dateLine}</p>
          <p className="by">Designed by {studio.name}</p>
        </footer>
      </div>
    </div>
  );
}
