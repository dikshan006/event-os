import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { resetPassword } from "@/server/services/passwordReset";
import { rateLimit } from "@/lib/ratelimit";
import { isTrivialPassword } from "@/lib/validators";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Choose a new password — EventOS",
  robots: { index: false, follow: false },
};

/** Unchanged: same validation, same token handling, same redirects. */
async function doReset(formData: FormData) {
  "use server";
  const token = String(formData.get("token"));
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  /**
   * A ceiling on how fast tokens can be tried from one address.
   *
   * The token is 32 random bytes, so this is not what makes guessing infeasible
   * — 256 bits already does that, and no rate limit would rescue a weak token.
   * It is here because an unauthenticated endpoint that performs a bcrypt hash
   * at cost 12 is a cheap way to make our own CPU the target: a few hundred
   * concurrent posts of a junk token and every other request queues behind them.
   * The limit bounds the work a stranger can ask us to do.
   */
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!(await rateLimit(`reset:${ip}`, 10, 10 * 60_000))) {
    redirect(`/reset-password/${token}?error=rate`);
  }

  if (password.length < 8) redirect(`/reset-password/${token}?error=short`);
  if (password !== confirm) redirect(`/reset-password/${token}?error=match`);
  /**
   * A floor on password quality, and deliberately a low one.
   *
   * Composition rules (an uppercase, a digit, a symbol) reliably produce
   * `Password1!` and stop nothing; length plus a denylist of the passwords
   * actually used in credential stuffing is what the current NIST guidance
   * recommends instead. This rejects the handful that appear at the top of every
   * breach corpus without lecturing anyone about punctuation.
   */
  if (isTrivialPassword(password)) redirect(`/reset-password/${token}?error=weak`);

  const ok = await resetPassword(token, password);
  redirect(ok ? "/login?reset=1" : `/reset-password/${token}?error=invalid`);
}

export default async function ResetPassword({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const messages: Record<string, string> = {
    short: "Password must be at least 8 characters.",
    match: "Those two passwords do not match.",
    weak: "That password appears in every published breach list — please choose another.",
    rate: "Too many attempts — please wait a few minutes and try again.",
    invalid: "This reset link is invalid, already used, or expired — request a new one.",
  };

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
              <h1 className="m-title">Choose a new password.</h1>
              <p className="m-lead">
                Eight characters or more. Once it is saved you will be sent back
                to sign in with it.
              </p>
              <p className="m-small" style={{ paddingTop: "1.5rem" }}>
                <Link href="/login" className="m-link">Back to sign in</Link>
              </p>
            </Reveal>

            <Reveal delay={80}>
              <form action={doReset} className="m-form">
                <input type="hidden" name="token" value={token} />

                {error && (
                  <p className="m-err" role="alert">
                    {messages[error] ?? "Something went wrong."}
                  </p>
                )}

                <div className="m-field">
                  <label htmlFor="reset-password">New password</label>
                  <span className="m-hint" id="reset-password-hint">
                    At least 8 characters.
                  </span>
                  <input
                    id="reset-password"
                    className="m-input"
                    name="password"
                    type="password"
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby="reset-password-hint"
                    required
                  />
                </div>

                <div className="m-field">
                  <label htmlFor="reset-confirm">Confirm password</label>
                  <input
                    id="reset-confirm"
                    className="m-input"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="m-actions">
                  <button className="m-btn m-btn-solid m-btn-lg" type="submit">
                    Update password
                    <span className="m-arrow" aria-hidden="true">→</span>
                  </button>
                </div>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
