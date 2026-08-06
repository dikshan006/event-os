import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

/**
 * How long a session lasts, and how often its claims are re-checked.
 *
 * Twelve hours rather than the thirty-day default. A JWT cannot be withdrawn
 * from the holder's browser, so its lifetime is the worst-case window in which
 * a stolen token is useful, and thirty days is a very long time to be wrong
 * about who is holding it. Twelve hours covers a working day without a
 * mid-afternoon sign-out.
 *
 * `updateAge` is what makes that bearable: the token is reissued at most once
 * every fifteen minutes of activity, so an active planner is never signed out
 * mid-task, and an idle one expires on schedule.
 */
const SESSION_MAX_AGE_S = 12 * 60 * 60;
const SESSION_UPDATE_AGE_S = 15 * 60;

/**
 * How stale a token's role and studio may be before they are re-read.
 *
 * Role and studioId are copied into the token at sign-in, which is what makes
 * authorisation a signature check rather than a database read. The cost is that
 * a change to either — a demotion, a studio move — does not reach an existing
 * token. Revocation (`sessionsValidFrom`) covers the deliberate case; this
 * covers drift, by re-reading the user at most once a minute per session.
 *
 * One indexed primary-key lookup per minute per active session is not a
 * meaningful cost, and it means the window in which a demoted admin still holds
 * admin claims is a minute rather than twelve hours.
 */
const CLAIM_REFRESH_MS = 60_000;

/**
 * A real bcrypt hash of a value nobody will guess, used only to burn the same
 * time a genuine comparison would. Computed once here rather than per request,
 * and never compared against anything a caller controls.
 */
const DUMMY_HASH = "$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * The session cookie's name, which production hardens with the `__Host-` prefix.
 *
 * Exported because the edge middleware has to look for the same name. Those two
 * getting out of step is not a subtle bug — the middleware would see no cookie
 * on any production request and bounce every signed-in planner to /login — so
 * they read from one constant rather than two string literals.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-authjs.session-token"
    : "authjs.session-token";

type Claims = {
  uid?: string;
  role?: string;
  studioId?: string | null;
  /** Seconds since the epoch, matching `iat`. Compared against sessionsValidFrom. */
  issuedAt?: number;
  /** Milliseconds since the epoch. When the claims above were last re-read. */
  checkedAt?: number;
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_S,
    updateAge: SESSION_UPDATE_AGE_S,
  },
  /**
   * `__Host-` is the strictest cookie prefix the platform offers: the browser
   * refuses to accept it unless it is Secure, path `/`, and has no Domain
   * attribute — which means a subdomain, including one an attacker manages to
   * stand up, cannot write a session cookie our origin will read. Auth.js
   * already sets httpOnly, sameSite=lax and secure in production; naming the
   * cookie explicitly is what adds the prefix guarantee on top.
   *
   * Production only. The prefix requires Secure, and local development is http.
   */
  cookies:
    process.env.NODE_ENV === "production"
      ? {
          sessionToken: {
            name: SESSION_COOKIE,
            options: { httpOnly: true, sameSite: "lax", path: "/", secure: true },
          },
        }
      : undefined,
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").toLowerCase().trim();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });

        /**
         * The comparison runs even when there is no such user.
         *
         * `if (!user) return null` answers a missing account measurably faster
         * than a wrong password, because it skips the bcrypt work — and bcrypt
         * at cost 12 is tens of milliseconds, which is far above the noise of a
         * network round trip. That difference is a user-enumeration oracle: it
         * tells an attacker which addresses are registered, which is the first
         * step of a credential-stuffing run. Hashing against a dummy makes both
         * paths pay the same cost.
         */
        const hashed = user?.passwordHash ?? DUMMY_HASH;
        const ok = await bcrypt.compare(password, hashed);
        if (!user?.passwordHash || !ok) return null;

        // Suspended tenants cannot sign in at all.
        if (user.studioId) {
          const studio = await prisma.studio.findUnique({ where: { id: user.studioId } });
          if (!studio || studio.status === "SUSPENDED") return null;
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role, studioId: user.studioId } as never;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const t = token as typeof token & Claims;

      // Sign-in: stamp the claims and the issue time.
      if (user) {
        const u = user as unknown as { id: string; role: string; studioId: string | null; name: string };
        t.uid = u.id;
        t.role = u.role;
        t.studioId = u.studioId;
        t.name = u.name;
        t.issuedAt = Math.floor(Date.now() / 1000);
        t.checkedAt = Date.now();
        return t;
      }

      if (!t.uid) return t;

      // Subsequent requests: re-read the account, but not on every single one.
      if (t.checkedAt && Date.now() - t.checkedAt < CLAIM_REFRESH_MS) return t;

      const fresh = await prisma.user.findUnique({
        where: { id: t.uid },
        select: { role: true, studioId: true, name: true, sessionsValidFrom: true },
      });

      /**
       * Returning null from `jwt` destroys the session. Three things do it:
       *
       *  - the user no longer exists (deleted studio cascades to its users);
       *  - the token predates a revocation, so a password reset or an
       *    admin-issued credential has invalidated it;
       *  - the token has no issue time at all, which can only be a token minted
       *    before this check existed. Those are dropped rather than trusted,
       *    which signs everyone out once, at deploy, and never again.
       */
      if (!fresh) return null;
      if (fresh.sessionsValidFrom) {
        if (!t.issuedAt) return null;
        if (t.issuedAt * 1000 < fresh.sessionsValidFrom.getTime()) return null;
      }

      t.role = fresh.role;
      t.studioId = fresh.studioId;
      t.name = fresh.name;
      t.checkedAt = Date.now();
      return t;
    },
    session({ session, token }) {
      const t = token as typeof token & Claims;
      /**
       * Written through a loose record because Auth.js types `user.id` as a
       * required string while the claim is optional here. The optionality is
       * real — a token with no `uid` is one the `jwt` callback has already
       * decided to drop — so widening the write is more honest than asserting a
       * value that may not be there. `requireStudio`/`requireAdmin` treat a
       * missing id as unauthenticated, which is the correct reading.
       */
      const u = session.user as unknown as Record<string, unknown>;
      u.id = t.uid;
      u.role = t.role;
      u.studioId = t.studioId;
      return session;
    },
  },
});

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PLANNER" | "MEMBER";
  studioId: string | null;
};
