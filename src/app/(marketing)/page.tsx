import Link from "next/link";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "EventOS — the operating system for modern events",
  description:
    "One platform for professional event planners. Weddings is available today. More products are coming.",
  openGraph: {
    title: "EventOS — the operating system for modern events",
    description: "One platform for professional event planners. Weddings available today.",
    type: "website",
  },
};

/**
 * The company homepage. Not a product page.
 *
 * Its whole job is to answer "what is this?" in about twenty seconds and send
 * the right person to /weddings. Everything about how weddings actually work
 * lives there; repeating any of it here would only delay the click.
 *
 * The blue field runs unbroken from the masthead to the footer — fixed to the
 * viewport, so the page reads as one continuous surface rather than as a
 * sequence of sections. There are no light bands and no second accent.
 */

const PRODUCTS: {
  name: string;
  line: string;
  href?: string;
  state: string;
}[] = [
  {
    name: "Weddings",
    line: "Websites, guest invitations, RSVPs, schedule and seating.",
    href: "/weddings",
    state: "Available",
  },
  { name: "Corporate Events", line: "Offsites, launches and client events.", state: "Coming soon" },
  { name: "Conferences", line: "Multi-day programmes, tracks and attendees.", state: "Coming soon" },
  { name: "Birthdays", line: "Private celebrations, start to finish.", state: "Coming soon" },
  { name: "Galas", line: "Fundraisers, tables and seating at scale.", state: "Coming soon" },
];

export default function HomePage() {
  return (
    <div className="m-plate m-ink" data-hero-tone="dark">
      <div className="m-plate-field" aria-hidden="true" />

      {/* ============================================================ hero */}
      <section className="m-hero">
        <div className="m-wrap m-hero-grid">
          <Reveal>
            <span className="m-eyebrow">EventOS</span>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="m-display m-hero-word">
              The operating system for modern events.
            </h1>
          </Reveal>

          <Reveal delay={120}>
            <p className="m-lead" style={{ maxWidth: "34ch" }}>
              One platform for professional planners. Weddings is available
              today. More is coming.
            </p>
          </Reveal>

          <Reveal delay={180}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link href="/weddings" className="m-btn m-btn-solid m-btn-lg">
                Explore Weddings <span className="m-arrow" aria-hidden="true">→</span>
              </Link>
              <Link href="/request-access" className="m-btn m-btn-line m-btn-lg">
                Request access
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================================================== products */}
      <section id="products">
        <div className="m-wrap" style={{ paddingBlock: "var(--m-chapter)" }}>
          <Reveal>
            <span className="m-eyebrow">Products</span>
            <h2 className="m-title" style={{ maxWidth: "16ch", marginBlock: "1.25rem var(--m-block)" }}>
              One platform. Every kind of event.
            </h2>
          </Reveal>

          <div className="m-products">
            {PRODUCTS.map((p, i) =>
              p.href ? (
                <Reveal key={p.name} delay={i * 40}>
                  <Link href={p.href} className="m-product">
                    <h3>
                      {p.name} <span className="m-arrow" aria-hidden="true">→</span>
                    </h3>
                    <span className="m-product-state">
                      <i className="m-product-dot" aria-hidden="true" />
                      {p.state}
                    </span>
                    <p>{p.line}</p>
                  </Link>
                </Reveal>
              ) : (
                /* Not a link. Nothing to open yet, and a control that looks
                   live but goes nowhere costs more trust than it buys. */
                <Reveal key={p.name} delay={i * 40}>
                  <div className="m-product m-product-soon">
                    <h3>{p.name}</h3>
                    <span className="m-product-state">{p.state}</span>
                    <p>{p.line}</p>
                  </div>
                </Reveal>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ========================================================== claims */}
      <section>
        <div className="m-wrap" style={{ paddingBlock: "0 var(--m-chapter)" }}>
          <Reveal>
            <span className="m-eyebrow">Built for planners</span>
            <div className="m-claims" style={{ marginTop: "var(--m-block)" }}>
              {[
                ["One place per event", "Guests, schedule, seating and replies in a single record."],
                ["Your brand, not ours", "Every website and email carries your studio's name."],
                ["Nothing for guests to install", "One link. No account, no password, no app."],
              ].map(([b, s]) => (
                <div className="m-claim" key={b}>
                  <b>{b}</b>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============================================================= cta */}
      <section>
        <div className="m-wrap" style={{ paddingBlock: "0 var(--m-chapter)" }}>
          <Reveal className="m-quote">
            <h2 className="m-title" style={{ maxWidth: "16ch", marginInline: "auto" }}>
              Run your events on EventOS.
            </h2>
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
