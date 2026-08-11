# EventOS — Security Hardening Pass

**Date:** 11 August 2026
**Baseline:** `SECURITY-AUDIT-2026-08.md` (6 August 2026, commit `c370adf`, scored 8.5/10)
**Scope:** the five items that audit left open, plus a re-verification of what it
claimed was already secure.
**Method:** every claim below is labelled with how it was established. Where it
could not be established, it says so rather than inheriting the previous audit's
word for it.

---

## How to read this

Three categories, kept strictly apart, because the difference between them is
the whole point of the exercise.

- **VERIFIED** — checked in this pass, by reading the code or running something
  that would have failed if the claim were false.
- **NOT VERIFIED** — plausible, probably fine, not confirmed here. Includes
  anything that needs a network, a browser or a database this environment does
  not have.
- **REQUIRES MANUAL HOSTING CONFIGURATION** — cannot be fixed in this repository
  at all. Someone has to open a dashboard.

A passing test suite appears in the first category and proves only what it
tested. It is not a synonym for production-ready, and this document does not use
that phrase as a conclusion.

---

## Summary

| Priority | Outcome |
|---|---|
| 1 · Dependencies | VERIFIED — no production vulnerability. The 10 findings resolve to 6 dev-only, and the 4 that looked serious are already on fixed versions |
| 2 · Database backups | REQUIRES MANUAL HOSTING CONFIGURATION — nothing verifiable from the repo; `OPERATIONS.md` now says so explicitly |
| 3 · Distributed rate limiting | FIXED — production now refuses to boot without a shared store |
| 4 · Live security headers | NOT VERIFIED — config is correct and now has a test; the deployed response was not observed |
| 5 · E2E security tests | WRITTEN, NOT RUN — 19 tests across 4 files; needs a database and a browser |
| 6 · Authorization review | VERIFIED — no IDOR found; the previous audit's finding holds |
| 7 · Invitation security | VERIFIED — CSPRNG tokens, no Referer leak, no cross-wedding replay |
| 8 · Upload security | VERIFIED — bounded on size, pixels, format and rate; filenames are server-generated |
| 9 · Environment / secrets | VERIFIED — fails closed, no `NEXT_PUBLIC_` secrets, nothing committed |
| 10 · Regression | PARTIAL — unit tests and lint pass; typecheck and build blocked by sandbox |

**Net change to the score: I would not move it.** One real gap closed (rate
limiting), one gap converted from "unknown" to "known unknown" (backups), and
three items that the previous audit scored as pending are still pending because
they need a browser, a database and a hosting console. The code is in better
shape; the operational picture is unchanged and it is where the remaining risk
lives.

---

## Priority 1 · Dependencies — VERIFIED

`npm audit` reports **10 vulnerabilities (2 critical, 5 high, 3 moderate)** from
a bare lockfile. That headline is misleading, and the detail matters more than
the count.

### The four that looked serious are already fixed

npm resolves the audit tree from the lockfile. Run without `node_modules`
present it reconstructs a pessimistic tree including every platform's optional
dependencies; run against the installed tree it reports what is actually there.
The installed versions:

| Package | Advisory range | Lockfile has | Affected? |
|---|---|---|---|
| `sharp` | `<0.35.0` (libvips CVE-2026-33327/33328/35590/35591) | **0.35.3** | **No** |
| `postcss` | `<=8.5.22` (XSS, arbitrary `.map` read) | **8.5.26** | **No** |
| `nanoid` (under postcss) | `<3.3.17` | **3.3.18** | **No** |
| `next` | flagged via postcss + sharp only | 15.5.22 | **No** — both transitives are on fixed versions |

There is exactly **one** `sharp` in the lockfile — the direct dependency at
0.35.3. Next declares `sharp@^0.34.3` as an *optional* dependency and the
hoisted 0.35.3 satisfies it; no nested vulnerable copy is installed. The
`node_modules/next/node_modules/sharp` path in the audit output is an artefact
of tree reconstruction, not a file on disk.

*Confirm on your machine with `npm ls sharp postcss nanoid`.* This is the one
dependency claim worth re-checking locally, because it is the only one that
would touch production if it were wrong.

### The six that remain are development-only

`vitest`, `@vitest/coverage-v8`, `@vitest/mocker`, `vite`, `vite-node`,
`esbuild`. All `devDependencies`. The substantive advisory is
[GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) —
esbuild's **development server** accepts cross-origin requests. EventOS never
runs `vite dev`; vitest uses vite as a transform pipeline, not a server. The two
"critical" entries are `vitest` and `@vitest/coverage-v8` inheriting severity
from that transitive chain, not independent findings.

### What was deliberately not done

**`npm audit fix --force` was not run, and should not be.** It installs
`next@16.3.0` and `vitest@4.1.10` — two major-version jumps, one of them the
framework — to remediate a dev-server issue and two advisories whose fixed
versions are already installed. That trades a real risk of breaking a working
application for no production security gain. The instruction was to update only
when appropriate; here it is not.

Plain `npm audit fix` is safe but currently a no-op for anything reachable.

**`bcryptjs` remains on 2.4.3** while 3.x exists. No CVE, and the previous audit
flagged it as a next-pass item. Left alone: changing the password hashing
library is not a change to make in the same pass as everything else here.

---

## Priority 2 · Database backups — REQUIRES MANUAL HOSTING CONFIGURATION

**Nothing about backups was verified, and nothing in this repository can verify
it.** A connection string proves a database exists. It says nothing about
whether the data can be recovered.

What the repository does establish: Postgres behind a pooled endpoint, provider
is Neon or Supabase (from the connection host), migrations run at build time,
and `onDelete: Cascade` runs from Studio through weddings, guests, RSVPs,
seating and photos. That last point raises the stakes — deleting one studio is a
single statement that removes a great deal, with no soft-delete and no undo in
the product.

`OPERATIONS.md` already contained a considered RPO/RTO section (5 minutes / 1
hour) and provider-specific PITR instructions. What it lacked was any statement
of whether the setting is actually on. It now opens with a status block that
says plainly that it is unverified, and lists the five things to confirm:

1. PITR enabled — Neon: Settings → History retention. Supabase: Database → Backups.
2. Retention ≥ 7 days.
3. **Who** can perform a restore, by name.
4. Where the console is, reachable without the app.
5. That a restore has actually been performed once.

Until those are answered in writing, the honest position is **recovery
capability unknown**, and the RPO/RTO figures are intentions rather than
measurements.

---

## Priority 3 · Distributed rate limiting — FIXED

### What was wrong

`lib/ratelimit.ts` was already well built: Upstash REST when configured, an
in-process `Map` when not, `EXPIRE ... NX` so a hammering caller cannot hold
their own window open, and a runtime fallback if Redis becomes unreachable. All
of that is correct and none of it was changed.

The gap was that **nothing required the configuration to exist.** Without the
Upstash variables, `distributed` is `false` and every serverless instance keeps
its own counters — so the effective limit is the configured one multiplied by
however many instances are warm, and every deployment resets all of them. The
login throttle is the one that matters: a credential-stuffing run spread across
instances walks through a limit that looks correct in the source.

The failure is silent. `consume()` returns an ordinary allow/deny either way,
and no log line distinguishes a limit of 10 from a limit of 10 per instance
across eight instances.

### The fix

Production now requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
(`src/lib/env.ts`). Missing either throws at boot via `instrumentation.ts`,
which fails the deploy rather than shipping a limiter that quietly does not
hold. Outside production nothing changed — the in-memory fallback is correct for
local development and CI, and a limiter that refused to start without Redis
would make a first clone a stack trace.

The **runtime** fallback in `consume()` is deliberately untouched. Redis being
unreachable mid-flight still degrades to the weaker limiter rather than refusing
every request; refusing would convert a dependency blip into a total outage and
hand an attacker a better denial of service than the one being prevented. This
change closes only the case where it was never configured at all.

Two tests added (`tests/audit-fixes.test.ts`): production fails without the
store, development does not require it. `.env.example` documents both variables
and why they are mandatory in production.

### Coverage — VERIFIED by reading every call site

Every endpoint named in the brief was already limited. None were removed.

| Surface | Key | Limit |
|---|---|---|
| Login (per account) | `login:acct:<pseudonymised>` | 10 / 15 min, escalating delay from 6 |
| Login (per address) | `login:ip:<ip>` | 30 / 15 min |
| Forgot password | `forgot:<ip>` | 5 / min |
| Password reset | `reset:<ip>` | 10 / 10 min |
| Invitation resend | `resend:<guestId>` | 3 / hour |
| RSVP | `rsvp:<inviteCode>` | 6 / min |
| Gift claiming | `gift:<weddingId>` | 30 / hour |
| Access requests | `access:<ip>` | 3 / hour |
| Photo upload | `upload:<studioId>` | 120 / hour |
| Logo upload | `logo:<studioId>` | 20 / hour |
| Custom design request | `custom-design:<studioId>` | 5 / day |

Bulk invitation *sending* is not rate limited and does not need to be: it selects
on `invitedAt: null`, is paced at 600ms per message, and is wrapped in the
idempotency key. Resend is the path that bypasses that brake, and it is limited.

One call site reads oddly and is correct: `forgot-password/page.tsx` uses
`if (await rateLimit(...))` where every other site uses `if (!(await ...))`. It
drops the request silently when throttled and always redirects identically,
which is what preserves the non-enumerable response. Left alone.

---

## Priority 4 · Live security headers — NOT VERIFIED

**The deployed response was not observed.** No browser is connected to this
session, and fetching raw headers by other means is outside what I can do here.
The production alias is `https://event-os-brown.vercel.app` (Vercel project
`event-os`, team `dikshantennis2006-8271s-projects`).

The source configuration was re-read and is correct — CSP with
`default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`,
`base-uri 'self'`, `form-action 'self'`; HSTS 2 years with `includeSubDomains`
and `preload`; `X-Frame-Options: DENY`; `nosniff`;
`strict-origin-when-cross-origin`; a fully enumerated Permissions-Policy; COOP
`same-origin`; CORP `same-site`; `poweredByHeader: false`. The CSP was **not**
weakened; `script-src 'unsafe-inline'` remains the documented, accepted trade.

**What is missing is confirmation that these survive to the wire.** A `source`
pattern that fails to match, or a platform that overrides, produces a
correct-looking config and a bare response.

Two ways to close this:

```bash
curl -sSI https://event-os-brown.vercel.app/ | grep -iE \
  'content-security-policy|strict-transport|x-frame|x-content-type|referrer-policy|permissions-policy|cross-origin'
```

or, now checked in and repeatable:

```bash
E2E_BASE_URL=https://event-os-brown.vercel.app npx playwright test headers
```

`tests/e2e/headers.spec.ts` asserts all eight headers across a static page, a
dynamic page and a redirect, plus a guard that the CSP has not been widened
(`'unsafe-eval'`, wildcard `default-src`).

One thing observed and worth a look: Vercel deployment protection is
`ssoProtection: all_except_custom_domains`, and the project reports
`live: false` with the latest deployment having `target: null` — a preview, not
production. Worth confirming which deployment the production alias actually
points at before treating a header check as authoritative.

---

## Priority 5 · E2E security tests — WRITTEN, NOT RUN

Four files, 19 tests, covering all 15 requested cases. **None have been
executed.** They need a Postgres database, a browser and a production build;
this environment has none of the three, and Prisma's engine downloads are
blocked here.

```
playwright.config.ts          production build on :3100, serial, no retries
tests/e2e/seed.ts             two studios that must never see each other
tests/e2e/helpers.ts          real form sign-in; no forged cookies
tests/e2e/authorization.spec.ts   cases 1–10
tests/e2e/abuse.spec.ts           cases 11–15
tests/e2e/headers.spec.ts         priority 4
```

| # | Case | File |
|---|---|---|
| 1–4 | Planner A cannot reach B's wedding, guests, seating, RSVPs (page + CSV export) | authorization |
| 5 | Guest and planner cannot reach planner/admin routes | authorization |
| 6 | Suspended studio loses access mid-session | authorization |
| 7 | Password reset invalidates existing sessions | authorization |
| 8 | Admin-issued password invalidates existing sessions | authorization |
| 9 | Expired session cannot reach a protected route | authorization |
| 10 | Invite code cannot be replayed against another wedding | authorization |
| 11 | Concurrent gift claims produce exactly one winner | abuse |
| 12 | Free wedding cannot be claimed twice concurrently | abuse |
| 13 | Invitation resend limit holds | abuse |
| 14 | Login throttle engages | abuse |
| 15 | CSV formula injection is neutralised | abuse |

Design decisions worth knowing:

- **Sign-in goes through the real form.** A helper that minted a JWT would skip
  the credentials provider, the `jwt` callback that stamps `issuedAt`, and the
  `__Host-` cookie name middleware has to agree with — which is most of what
  cases 6–9 are actually testing.
- **Production build, not `next dev`.** The `__Host-` prefix, the environment
  guard and the security headers only exist in production.
- **Assertions are on status and redirect, not markup.** The tenancy contract is
  a redirect (`ownWedding` bounces rather than 403s so existence never leaks), so
  the redirect target *is* the assertion. Selectors would break on redesign.
- **Races are fired with `Promise.all`.** A sequential pair passes against the
  read-then-write code these tests exist to catch.
- **`seed.ts` refuses to run** unless `DATABASE_URL` looks like a test database.
  The suite suspends studios and deletes rows.

Two caveats to run with your eyes open:

- Cases 7 and 8 each sleep 61 seconds, because claim refresh is throttled to
  once a minute per session. The suite takes ~3 minutes.
- Case 8 drives the admin server action by POST and falls back to writing
  `sessionsValidFrom` directly if the wire format does not match. Server actions
  have no documented POST contract. If it takes the fallback it still asserts the
  revocation rule, but not that the admin *path* triggers it — check the run
  output.

To run:

```bash
npm install
npx playwright install chromium
DATABASE_URL=<scratch db> npm run test:e2e
```

Expect first-run failures from selector or route-shape drift. They have never
been executed; treat the first green run as the actual verification.

---

## Priority 6 · Authorization review — VERIFIED

I re-derived the previous audit's central finding rather than accepting it, and
it holds. Asked of every service: *can a user read or modify an object by
knowing its ID?* I could not construct a case.

The pattern is consistent, including where it is inconvenient:

- `requireStudio()` re-reads the studio **on every request** and turns away a
  suspended one. A live check, not a cached claim.
- `ownWedding()` filters `{ id, studioId }` and **redirects** rather than 403s,
  so a foreign id and a missing id are indistinguishable.
- Writes are `updateMany`/`deleteMany` with the tenant in the WHERE clause
  rather than `update({ where: { id } })` — the tenancy check and the write are
  one statement, with no gap between them.
- `updateEvent` re-reads through `wedding: { studioId }` rather than trusting
  the event id.
- `assignGuest` checks both objects belong to the studio *and* that
  `guest.weddingId === table.weddingId` — cross-wedding seating within one
  studio is also refused.
- `guests/export` is a route handler, so it does not inherit layout checks, and
  it re-authenticates independently. This is the most likely place for a gap and
  it does not have one.
- **No client-provided `studioId` is trusted anywhere.** Every service takes it
  from `requireStudio()`.

Calls that look unscoped and are not: `photosBySlot(weddingId)` and
`publicRegistry(weddingId)` serve public wedding pages, where the data is public
by definition; `seatsForGuest(guestId)` is reached only from an already-scoped
guest record.

`MEMBER` remains defined and unreferenced — `requireStudio()` accepts only
`PLANNER`, so a MEMBER cannot sign into anything. Fails closed. Still worth a
comment in the schema before someone implements team access.

---

## Priority 7 · Invitation security — VERIFIED

Invitation URLs are capability URLs and were reviewed as such.

- **CSPRNG** — `nanoid`'s `customAlphabet`, which draws from
  `crypto.getRandomValues`. Not `Math.random`.
- **Entropy** — 10 characters from a 31-symbol alphabet (ambiguous glyphs
  removed) = 31¹⁰ ≈ 8.19 × 10¹⁴ ≈ **49.5 bits**. Not brute-forceable at any
  realistic rate against a rate-limited endpoint. The previous audit's advice
  stands: widen to 16 characters if guest records ever carry more than a
  schedule.
- **Referer leakage** — `Referrer-Policy: strict-origin-when-cross-origin`, so a
  guest following a registry link to a retailer sends the origin only, never the
  path containing their code. This is the single most important header for this
  product and it is set correctly.
- **No cross-wedding use** — `submitRsvp` resolves the guest by `inviteCode` and
  works from `guest.weddingId`; the code cannot address another wedding.
  `claimGift` filters `{ id: itemId, weddingId }`, so one wedding's form cannot
  be replayed against another's gift id. The calendar feed accepts a code or a
  published slug and returns only that guest's personalised events or the
  wedding's public ones.
- **No planner information on guest surfaces** — the guest sees the studio's
  branding, name and contact address, which is the intended white-label
  behaviour, and nothing else about the studio or the platform.
- **A bad code is a 404, never a 403**, so the token space stays opaque.
- **Draft weddings are refused** in the server action as well as the page —
  `submitRsvp` re-checks `status !== "PUBLISHED"` because the action is callable
  directly.

Public wedding pages expose no guest names, emails, phone numbers or invite
codes — checked by reading `w/[slug]/page.tsx`. `publicRegistry` returns
`purchasedBy` (a first name a guest chose to enter), which is a deliberate
product decision documented in the source.

---

## Priority 8 · Upload security — VERIFIED

| Control | Implementation |
|---|---|
| Size | `MAX_UPLOAD_BYTES` 4 MB, checked **before** sharp touches the buffer |
| Request body | `serverActions.bodySizeLimit: "4.5mb"`, under Vercel's own cap |
| Type | Allowlist on sharp's detected format, not on the client's Content-Type or extension |
| SVG | Rejected explicitly for logos and absent from the allowlist for photos — no XML parser is reachable |
| Pixel bombs | 100 MP for photos, 40 MP for logos, rejected after `metadata()` and before decode |
| Rate | 120/hour per studio (photos), 20/hour (logos) |
| Filenames | **Never client-controlled.** `studios/<studioId>/weddings/<weddingId>/<randomUUID()>` |
| Traversal | Not reachable — no user input reaches a storage key |
| Execution | Output is re-encoded to AVIF/WebP; the original bytes are never stored or served |
| Cleanup | `deletePrefix` on failure, so a failed encode leaves no orphans |
| Tenancy | The wedding is fetched `{ id, studioId }` before any processing |

The 120/hour and 20/hour limits are the right shape: the per-slot caps bound how
many images are *kept*, and upload-and-delete in a loop would run eight
encodes per iteration past them. 120/hour is roughly two full galleries.

Note that these limits are only meaningful once Upstash is configured —
which is exactly what Priority 3 now enforces. Before that change, "120/hour"
meant 120 per hour *per warm instance*.

One accepted trade: `failOn: "none"` tells sharp to decode slightly malformed
files rather than reject them, which is right for real camera output and does
widen what reaches libvips. The pixel guard and size cap are what bound it, and
`sharp` is on 0.35.3 — past the libvips CVEs in the advisory above.

---

## Priority 9 · Environment and secrets — VERIFIED

**Fails closed.** `lib/env.ts` throws in production for missing `DATABASE_URL`,
`AUTH_SECRET`, `APP_URL`, and now the Upstash pair. It also rejects an
`AUTH_SECRET` that is present but under 32 characters or matches a placeholder
pattern, and an `APP_URL` still pointing at localhost — both cases where a
missing value would fail loudly and a wrong one would fail silently.
`instrumentation.ts` runs the check at boot, so it fails the deploy rather than
the first user's request.

Stripe, Resend and storage are **expected, not required**: they warn at startup
and appear in `/api/ready`. That tiering is right — the app genuinely serves
wedding sites without email, and refusing to boot would be a worse failure than
degrading.

- **No `NEXT_PUBLIC_*` anywhere in the repository.** Grepped; zero hits.
- **No `process.env` in any client component.** Checked every `"use client"`
  file.
- **Nothing sensitive committed.** Scanned the working tree and all 200+
  commits for Stripe, Resend, AWS, GitHub and JWT key shapes plus private key
  blocks. The only matches are `logger.ts`'s redaction patterns and synthetic
  fixtures in `security.test.ts` — fake values whose purpose is to prove
  redaction works.
- **`.env` is gitignored and has never been committed** (`git log --all -- .env`
  is empty).
- **Log redaction** covers connection strings, Stripe/Resend keys, JWTs and
  bearer tokens, and reduces emails to `[email]`.

No secret values appear in this document or in any output produced during this
pass.

---

## Priority 10 · Regression

| Check | Result |
|---|---|
| `npm test` | **86 passed** (84 before; +2 for the new environment guard) — VERIFIED |
| `npm run lint` | **0 errors**, 31 warnings, all pre-existing (`no-console` in scripts, one `exhaustive-deps`, one `any`) — VERIFIED |
| `npm run typecheck` | **NOT VERIFIED** — needs a generated Prisma client; engine download is blocked here (403 from `binaries.prisma.sh`) |
| `npm audit` | VERIFIED — see Priority 1 |
| `npm run build` | **NOT VERIFIED** — same Prisma engine block |
| Playwright | **NOT RUN** — no database, no browser |

The previous audit hit the same two walls for the same reason. Run locally:

```bash
npm run typecheck && npm run build && npm test && npm audit
npx playwright install chromium
DATABASE_URL=<scratch db> npm run test:e2e
```

---

## Changes made

| File | Change |
|---|---|
| `src/lib/env.ts` | Production requires the Upstash pair; documented why the runtime fallback stays |
| `tests/audit-fixes.test.ts` | Upstash added to the production fixture; 2 tests for the new guard |
| `.env.example` | Upstash variables documented as production-required |
| `OPERATIONS.md` | Backup **status** block — states plainly that nothing is verified, lists the five things to confirm |
| `playwright.config.ts` | New |
| `tests/e2e/*` | New — seed, helpers, 19 tests |
| `package.json` | `@playwright/test`, `test:e2e`, `test:e2e:headers` |
| `SECURITY_AUDIT.md` | This document |

No product code, UI, or existing security control was modified. The only
behavioural change is that a production deploy without a shared rate-limit store
now fails instead of starting.

---

## Remaining risks

**Ranked by what would actually hurt.**

1. **Recovery capability is unknown.** If PITR is off or retention is 24 hours,
   a deleted studio is unrecoverable — and cascade deletes make that one
   statement. This is the largest risk in the product and it is not a code
   problem.
2. **Headers unconfirmed on the live deployment.** Low likelihood, cheap to
   check, and one `curl` closes it.
3. **E2E tests have never been executed.** Until the first green run they are an
   intention. They may need fixing before they pass.
4. **Rate limiting is enforced-by-refusal, not yet configured.** The next
   production deploy will *fail* until `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN` are set. That is the intended behaviour and it is
   worth knowing before you deploy.
5. **CSP retains `script-src 'unsafe-inline'`.** Accepted, unchanged, correctly
   reasoned. Revisit when the app renders user-controlled rich text — at that
   point React's escaping stops being the whole defence.
6. **`MEMBER` role defined but unreferenced.** Fails closed today; becomes a
   vulnerability if team access is implemented without noticing.
7. **Photo storage is unversioned.** A delete is a delete. Accepted, because
   planners hold the originals.
8. **`bcryptjs` on 2.4.3.** No CVE. Next dependency pass.

---

## Configuration still required, in order

1. **Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel**
   (Production scope) — *the next deploy fails without them.*
2. **Confirm PITR and retention** in Neon/Supabase; write the real numbers,
   plan name, date and named restore owner into `OPERATIONS.md`.
3. **Verify live headers** — `curl -sSI https://event-os-brown.vercel.app/`.
4. **Confirm which deployment the production alias serves** — the project
   currently reports `live: false` and a latest deployment with `target: null`.
5. **Run the E2E suite once** against a scratch database and fix what drifts.
6. **Perform one restore drill.** Not tested is not backed up.

---

## Verdict

The code is in good shape and was already in good shape; the previous audit's
central claim — that tenant isolation is correct in every service — survived a
deliberate attempt to break it. One genuine gap was closed: rate limiting can no
longer silently degrade to per-instance counting in production.

**I am not calling this production-ready, and the passing tests are not the
reason.** Four of the six items on the list above are verification and
configuration rather than code, which is roughly where a codebase should be
before launch — but "roughly where it should be" is not the same as done. The
one that matters is backups: everything else on this list is a control that
reduces the chance of a bad day, and that one is the difference between a bad
day and the end of the business. It is also the only item that cannot be
verified from anywhere except a dashboard someone has to open.
