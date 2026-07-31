import type { Wedding, Studio, Event, RegistryItem, CashFund, Faq, Guest, Rsvp } from "@prisma/client";
import { Countdown } from "./Countdown";
import { RsvpForm } from "./RsvpForm";
import { SitePhoto } from "./SitePhoto";
import { InvitationHero } from "./InvitationHero";
import { SmoothScroll } from "./SmoothScroll";
import { EMPTY_PHOTOS, type PhotoSet } from "@/lib/photo-view";

const THEMES = {
  BLUSH_ROMANCE: { bg: "#F6EFEA", ink: "#211E1B", accent: "#9D5C64", deep: "#211E1B", names: "caps", lace: true, heart: false, rule: false,
    photo: "linear-gradient(120deg,#4a4340,#7c655b 60%,#a3897a)" },
  MODERN_SAGE: { bg: "#FFFFFF", ink: "#4a5544", accent: "#87A07A", deep: "#75906A", names: "caps", lace: false, heart: true, rule: true,
    photo: "linear-gradient(120deg,#1f2a22,#3c5240 55%,#6e8264)" },
  CLASSIC_ELEGANCE: { bg: "#F7F2E4", ink: "#5a4038", accent: "#A93A42", deep: "#A93A42", names: "script", lace: false, heart: true, rule: false,
    photo: "linear-gradient(120deg,#241f24,#57404a 55%,#8d6f72)" },
} as const;

type Props = {
  wedding: Wedding & { faqs: Faq[]; registry: RegistryItem[]; funds: CashFund[] };
  studio: Studio;
  events: Event[]; // already filtered: public site → isPublic only; portal → personalized
  guest?: (Guest & { rsvp: Rsvp | null }) | null;
  photos?: PhotoSet;
  rsvpAction?: (code: string, input: { status: string; meal: string; dietary: string; notes: string }) => Promise<void>;
};

export function WeddingSite({ wedding, studio, events, guest, photos = EMPTY_PHOTOS, rsvpAction }: Props) {
  const theme = THEMES[wedding.template];
  const has = (s: string) => wedding.sections.includes(s);
  const days = [...new Set(events.map(e => e.day))];
  const first = guest?.name.split(" ")[0];
  const vars = { "--sb": theme.bg, "--si": theme.ink, "--sa": theme.accent, "--sd": theme.deep } as React.CSSProperties;

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
      <div className="s-wrap">
        {theme.rule && <div className="s-rule" />}
        <div className="s-hero">
          {theme.lace && <div className="lace" />}
          <div className="s-hero-mid">{Names}</div>
          {theme.lace && <div className="lace" />}
        </div>
        <nav className="s-nav">
          <a href="#home">Home</a>
          <a href="#rsvp">RSVP</a>
          <a href="#events">Events</a>
          {has("GALLERY") && photos.gallery.length > 0 && <a href="#gallery">Gallery</a>}
          <a href="#faq">FAQ</a>
        </nav>
        <main id="main">
        {/* The hero is the only above-the-fold image, so it loads eagerly at
            high priority; everything below it is lazy. Falls back to the
            template's gradient until the planner uploads a photograph. */}
        {photos.hero ? (
          <div id="home" className="s-hero-photo">
            <SitePhoto photo={photos.hero} ratio={16 / 9} priority sizes="(max-width: 920px) 100vw, 872px" />
          </div>
        ) : (
          <div id="home" className="s-photo" style={{ background: theme.photo }} />
        )}

        <div className="s-invite">
          <InvitationHero guestName={guest?.name} groups={guest?.groups} date={wedding.date} />
        </div>

        {photos.couple.length > 0 && (
          <div className="s-couple">
            {photos.couple.map(p => (
              <SitePhoto key={p.id} photo={p} ratio={4 / 5}
                sizes="(max-width: 520px) 100vw, (max-width: 920px) 50vw, 260px" />
            ))}
          </div>
        )}

        {theme.heart && <div className="s-heart">♥</div>}

        {(wedding.story || photos.story.length > 0) && (
          <div className="s-story-wrap">
            {photos.story.length > 0 && (
              <div className="s-story-photos">
                {photos.story.map(p => (
                  <SitePhoto key={p.id} photo={p} ratio={3 / 2}
                    sizes="(max-width: 520px) 100vw, (max-width: 920px) 50vw, 260px" />
                ))}
              </div>
            )}
            {wedding.story && <div className="s-band">{wedding.story}</div>}
          </div>
        )}

        {has("COUNTDOWN") && (
          <section className="s-sec">
            <h2 className="s-h sr-only">Countdown</h2>
            <div className="s-hs">counting down the days</div>
            <Countdown target={wedding.date.toISOString()} />
          </section>
        )}

        <section className="s-sec" id="events">
          <h2 className="s-h">Events</h2>
          <div className="s-hs">{guest ? `your personal schedule, ${first}` : "the celebration weekend"}</div>
          {days.map(day => (
            <div key={day}>
              <div className="s-day">{day.split(",")[0]}</div>
              {events.filter(e => e.day === day).map(e => (
                <div className="s-ev" key={e.id}>
                  <div className="t">{e.time} — {e.title}</div>
                  <div className="d">{[e.location, e.dressCode].filter(Boolean).join(" · ")}</div>
                </div>
              ))}
            </div>
          ))}
          {!events.length && <p className="s-empty">The schedule will appear here soon.</p>}
        </section>

        {has("GALLERY") && photos.gallery.length > 0 && (
          <section className="s-sec" id="gallery">
            <h2 className="s-h">Gallery</h2>
            <div className="s-hs">moments we love</div>
            <div className="s-gallery">
              {photos.gallery.map(p => (
                <SitePhoto key={p.id} photo={p} ratio={1}
                  sizes="(max-width: 520px) 100vw, (max-width: 920px) 50vw, 264px" />
              ))}
            </div>
          </section>
        )}

        {has("TRAVEL") && (
          <section className="s-sec">
            <h2 className="s-h">Travel</h2>
            <div className="s-hs">getting here &amp; staying nearby</div>
            <div className="s-cards">
              <div className="s-card"><b>{wedding.venue ?? "The Venue"}</b>
                <p>{wedding.city ?? ""}. Valet parking available; ride shares drop at the main gate.</p></div>
              <div className="s-card"><b>Where to stay</b>
                <p>A room block is reserved under the couple's name — details in your invitation email.</p></div>
            </div>
          </section>
        )}

        {has("FAQ") && wedding.faqs.length > 0 && (
          <section className="s-sec" id="faq">
            <h2 className="s-h">FAQ</h2>
            <div className="s-hs">good things to know</div>
            <div className="s-cards" style={{ gridTemplateColumns: "1fr" }}>
              {wedding.faqs.map(f => <div className="s-card" key={f.id}><h3>{f.question}</h3><p>{f.answer}</p></div>)}
            </div>
          </section>
        )}

        {has("REGISTRY") && wedding.registry.length > 0 && (
          <section className="s-sec">
            <h2 className="s-h">Registry</h2>
            <div className="s-hs">gifts we&apos;d love</div>
            <div className="s-cards">
              {wedding.registry.map(g => (
                <div className="s-card" key={g.id}>
                  <b>{g.title}</b><p>{[g.price, g.retailer].filter(Boolean).join(" · ")}</p>
                  <a className="s-btn ghost" style={{ marginTop: 12 }} href={g.url} target="_blank" rel="noopener noreferrer">Buy Gift ↗</a>
                </div>
              ))}
            </div>
          </section>
        )}

        {has("CASH") && wedding.funds.length > 0 && (
          <section className="s-sec">
            <h2 className="s-h">Cash Gifts</h2>
            <div className="s-hs">or contribute to our next chapter</div>
            <div className="s-cards">
              {wedding.funds.map(f => (
                <div className="s-card" key={f.id}>
                  <b>{f.name}</b><p>{f.blurb}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {f.stripeUrl && <a className="s-btn ghost" href={f.stripeUrl} target="_blank" rel="noopener noreferrer">Card</a>}
                    {f.venmoUrl && <a className="s-btn ghost" href={f.venmoUrl} target="_blank" rel="noopener noreferrer">Venmo</a>}
                    {f.paypalUrl && <a className="s-btn ghost" href={f.paypalUrl} target="_blank" rel="noopener noreferrer">PayPal</a>}
                  </div>
                </div>
              ))}
            </div>
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

        <footer className="s-foot">
          <div className="script" style={{ fontSize: 30, color: theme.accent }}>{wedding.partnerOne} &amp; {wedding.partnerTwo}</div>
          <div className="by">Designed by {studio.name}</div>
        </footer>
      </div>
    </div>
  );
}
