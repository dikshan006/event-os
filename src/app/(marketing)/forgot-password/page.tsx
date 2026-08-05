import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requestPasswordReset } from "@/server/services/passwordReset";
import { rateLimit } from "@/lib/ratelimit";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Reset your password — EventOS",
  robots: { index: false, follow: false },
};

/**
 * In the same route group as sign-in, for the same reason: it is the next step
 * of one flow, and stepping out of the design language halfway through is
 * exactly what made the old experience feel like two products.
 *
 * The action is unchanged, including the part that matters most — the same
 * response whether or not the account exists, so this page cannot be used to
 * discover which addresses are registered.
 */
async function request(formData: FormData) {
  "use server";
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimit(`forgot:${ip}`, 5, 60_000)) {
    await requestPasswordReset(String(formData.get("email") ?? ""));
  }
  // Always the same outcome — never reveals whether the account exists.
  redirect("/forgot-password?sent=1");
}

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="m-plate m-ink" data-hero-tone="dark">
      <div className="m-plate-field" aria-hidden="true" />
      <section>
        <div
          className="m-wrap m-chapter"
          style={{ paddingTop: "calc(var(--m-nav-h, 4.25rem) + var(--m-chapter))" }}
        >
          <div className="m-two-wide m-two m-auth" style={{ alignItems: "start" }}>
            <Reveal className="m-col">
              <span className="m-eyebrow">Password</span>
              <h1 className="m-title">{sent ? "Check your email." : "Reset your password."}</h1>
              <p className="m-lead">
                {sent
                  ? "If an account exists for that address, a reset link is on its way. It is valid for sixty minutes."
                  : "Enter the address you sign in with and we will send you a link."}
              </p>
              <p className="m-small" style={{ paddingTop: "1.5rem" }}>
                <Link href="/login" className="m-link">Back to sign in</Link>
              </p>
            </Reveal>

            {!sent && (
              <Reveal delay={80}>
                <form action={request} className="m-form">
                  <div className="m-field">
                    <label htmlFor="forgot-email">Email</label>
                    <input
                      id="forgot-email"
                      className="m-input"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@studio.com"
                      required
                    />
                  </div>
                  <div className="m-actions">
                    <button className="m-btn m-btn-solid m-btn-lg" type="submit">
                      Send reset link
                      <span className="m-arrow" aria-hidden="true">→</span>
                    </button>
                  </div>
                </form>
              </Reveal>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
