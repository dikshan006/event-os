import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthError } from "next-auth";
import { auth, signIn, type SessionUser } from "@/lib/auth";
import { gateLogin, applyDelay, clearLoginFailures } from "@/lib/lockout";
import { recordSecurityEvent, pseudonymise } from "@/server/services/security-events";
import { Reveal } from "@/components/Reveal";

export const metadata: Metadata = {
  title: "Sign in — EventOS",
  robots: { index: false, follow: false },
};

/**
 * Sign in.
 *
 * Lives in the `(marketing)` route group, which is what makes it a continuation
 * of the public site rather than the front door of a different application: it
 * inherits the same layout, the same navigation, the same stylesheet and the
 * same scroll behaviour, and it does so by being in the same place rather than
 * by copying anything. The URL is unchanged — a route group contributes no path
 * segment — so every existing link and redirect still resolves here.
 *
 * The authentication below is untouched: same action, same rate limit, same
 * `redirectTo`, same error codes. A change of address and of clothes, not of
 * behaviour.
 */
async function login(formData: FormData) {
  "use server";
  const ip = ((await headers()).get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const email = String(formData.get("email") ?? "");
  // The address is hashed before it is used as a counter key or written to a
  // security event. Keys end up in memory dumps and slow-query logs like
  // anything else, and the security log should not become a list of everyone
  // who has ever tried to sign in.
  const subject = await pseudonymise(email);

  const gate = await gateLogin(subject, ip);
  if (!gate.allow) {
    await recordSecurityEvent("SECURITY.LOGIN_LOCKED", {
      email, ip, metadata: { reason: gate.reason, retryAfter: gate.retryAfter },
    });
    redirect("/login?error=rate");
  }
  // Escalating delay before the password is checked, so the cost of guessing
  // rises with the number of guesses rather than staying flat.
  await applyDelay(gate.delayMs);

  try {
    // `/continue` reads the session and forwards to the right dashboard.
    // Sending them to "/" put a signed-in planner on the marketing homepage
    // with a "Dashboard" link to find, which is a step nobody wants.
    await signIn("credentials", { email, password: formData.get("password"), redirectTo: "/continue" });
  } catch (err) {
    if (err instanceof AuthError) {
      await recordSecurityEvent("SECURITY.LOGIN_FAILED", { email, ip });
      redirect("/login?error=1");
    }
    throw err; // NEXT_REDIRECT passes through
  }

  // Unreachable on success — `signIn` redirects by throwing NEXT_REDIRECT —
  // but kept correct so that if the redirect behaviour ever changes, the
  // counters are still cleared rather than silently accumulating.
  await clearLoginFailures(subject, ip);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  const session = await auth();
  const user = session?.user as SessionUser | undefined;
  if (user) redirect(user.role === "ADMIN" ? "/admin" : "/studio");
  const { error, reset } = await searchParams;

  const notice =
    error === "1"
      ? "Invalid credentials, or your studio has been suspended."
      : error === "rate"
        ? "Too many attempts — please wait a minute and try again."
        : null;

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
              <span className="m-eyebrow">Sign in</span>
              <h1 className="m-title">Welcome back.</h1>
              <p className="m-lead">
                Your studio, your weddings and everything you have published are
                where you left them.
              </p>

              <div className="m-rows" style={{ marginTop: "var(--m-block)" }}>
                {[
                  [
                    "Guests do not sign in",
                    "Every guest has a personal invitation link. There is no account to remember and no password to lose.",
                  ],
                  [
                    "No studio yet",
                    "We set each one up ourselves rather than through a signup form.",
                  ],
                ].map(([t, b]) => (
                  <div className="m-row" key={t}>
                    <span />
                    <h3>{t}</h3>
                    <p>{b}</p>
                  </div>
                ))}
              </div>

              <p className="m-small" style={{ paddingTop: "1.5rem" }}>
                Need one? <Link href="/request-access" className="m-link">Request access</Link>
              </p>
            </Reveal>

            <Reveal delay={80}>
              {/* A plain form posting to a server action, so it submits before
                  any JavaScript has run — the right property for the one page a
                  planner cannot get past if it fails. */}
              <form action={login} className="m-form">
                {notice && (
                  <p className="m-err" role="alert">
                    {notice}
                  </p>
                )}
                {reset && (
                  <p className="m-small" role="status">
                    Password updated — sign in with your new one.
                  </p>
                )}

                <div className="m-field">
                  <label htmlFor="login-email">Email</label>
                  <input
                    id="login-email"
                    className="m-input"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@studio.com"
                    required
                  />
                </div>

                <div className="m-field">
                  <label htmlFor="login-password">Password</label>
                  <input
                    id="login-password"
                    className="m-input"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="m-actions">
                  <button className="m-btn m-btn-solid m-btn-lg" type="submit">
                    Sign in
                    <span className="m-arrow" aria-hidden="true">→</span>
                  </button>
                  <Link href="/forgot-password" className="m-link m-small">
                    Forgot password?
                  </Link>
                </div>
              </form>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}
