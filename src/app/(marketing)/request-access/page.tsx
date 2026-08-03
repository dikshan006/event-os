import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { Reveal } from "@/components/Reveal";
import { AccessForm, type AccessFormState } from "@/components/marketing/AccessForm";
import { submitAccessRequest } from "@/server/services/access-requests";

export const metadata: Metadata = {
  title: "Request access — EventOS",
  description:
    "EventOS is set up for one studio at a time. Tell us about your work and we will come back to you.",
  // Nothing here should be indexed as a landing page in its own right.
  robots: { index: true, follow: true },
};

/**
 * The only page on the public site that writes anything.
 *
 * The action is defined at module scope rather than inside the component, so
 * nothing from the render closure is captured. A server action passed to a
 * Client Component has its captured scope serialized, and a plain closure in
 * that scope crashes the render — a mistake that has taken this codebase down
 * before, so it is worth being explicit about.
 */
async function submit(_state: AccessFormState, formData: FormData): Promise<AccessFormState> {
  "use server";

  // Forwarded-For is set by Vercel's proxy; the leftmost entry is the client.
  // Only ever used as a rate-limit key, never stored for analytics.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;

  return submitAccessRequest(
    {
      name: formData.get("name"),
      email: formData.get("email"),
      company: formData.get("company"),
      website: formData.get("website"),
      volume: formData.get("volume"),
      message: formData.get("message"),
      role: formData.get("role"),
    },
    ip,
  );
}

export default function RequestAccessPage() {
  return (
    <div className="m-plate m-ink" data-hero-tone="dark">
      <div className="m-plate-field" aria-hidden="true" />
      <section>
      <div className="m-wrap m-chapter" style={{ paddingTop: "calc(var(--m-nav-h, 4.25rem) + var(--m-chapter))" }}>
        <div className="m-two-wide m-two" style={{ alignItems: "start" }}>
          <Reveal className="m-col">
            <span className="m-eyebrow">Request access</span>
            <h1 className="m-title">We set up each studio ourselves.</h1>
            <p className="m-lead">
              There is no free trial and no credit card form, because there is no
              self-serve signup. Someone reads this, and if EventOS is right for
              how you work, we build your studio and walk you through the first
              wedding.
            </p>

            <div className="m-rows" style={{ marginTop: "var(--m-block)" }}>
              {[
                ["What happens next", "We read it, usually within a couple of days, and reply either way."],
                ["If it is a fit", "We create your studio, send you a sign-in, and set up your first wedding with you."],
                ["What it costs", "$99 to publish a wedding website. The first one is free. Nothing monthly."],
              ].map(([t, b]) => (
                <div className="m-row" key={t}>
                  <span />
                  <h3>{t}</h3>
                  <p>{b}</p>
                </div>
              ))}
            </div>

            <p className="m-small" style={{ paddingTop: "1.5rem" }}>
              Already have a studio? <Link href="/login" className="m-link">Sign in</Link>
            </p>
          </Reveal>

          <Reveal delay={80}>
            <AccessForm action={submit} />
            <p className="m-note" style={{ marginTop: "var(--m-block)" }}>
              We use what you send here to decide whether to offer you a studio and
              to reply to you. Nothing is shared with anyone else, and there is no
              mailing list to be added to.
            </p>
          </Reveal>
        </div>
      </div>
      </section>
    </div>
  );
}
