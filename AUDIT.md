# Production Audit — EventOS

Scope: full static audit of every file, with fixes applied only where something
was broken, unsafe, or missing for production. Working code was left untouched.
Constraint disclosed: performed without executing the app (no network in the
audit sandbox), so runtime-only issues — actual Resend delivery, migration
execution — are verified by inspection plus the manual steps listed at the end.

## 1. Issues found and fixed

### EMAIL (highest priority) — root cause found
**E1. Resend errors were swallowed — the root cause of "no emails received."**
The Resend SDK v4 does not throw on API failures; it returns `{ data, error }`.
`src/lib/email.ts` ignored the return value, so an unverified domain, a bad
`EMAIL_FROM`, or a sandbox-restricted recipient failed 100% silently while the
app reported success.
*Fix:* every send now checks the result, retries once on failure, logs the
outcome to the console, and persists a row to the new `EmailLog` table
(SENT / FAILED / SKIPPED with the provider error). Nothing fails silently;
every success stores the Resend message id.

**E2. Missing API key degraded to a silent console log.** In production, a
forgotten `RESEND_API_KEY` looked identical to success. *Fix:* recorded as
`SKIPPED` with the reason in EmailLog, visible in dashboards.

**E3. One bad address aborted an entire invitation batch.** `sendInvitations`
emailed in a loop then marked *all* guests invited in one `updateMany`; a
mid-loop throw left earlier guests emailed but nobody marked, causing
duplicates on retry. *Fix:* per-guest isolation — each guest is marked
`invitedAt` only when their email was accepted by the provider; failures stay
un-invited so the next run retries exactly the right people.

**E4. Email templates didn't escape user content.** Guest/studio names
containing `<` or `&` could break or inject into email HTML. *Fix:* all
interpolated user strings are HTML-escaped.

**E5. Password reset emails didn't exist** (see A2).

### AUTHENTICATION
**A1. No rate limiting on login.** Credential stuffing was free. *Fix:*
10 attempts/min/IP via a new dependency-free limiter (`src/lib/ratelimit.ts`).

**A2. No password reset flow at all.** A planner who forgot their password was
permanently locked out; the admin had no remediation. *Fix:* full flow —
`PasswordResetToken` model (SHA-256 hashed tokens, 60-min expiry, single-use,
sibling-token invalidation), `/forgot-password` and `/reset-password/[token]`
pages, branded email, account-existence never revealed, rate-limited.

Verified correct and left untouched: bcrypt(12) hashing, JWT sessions,
suspended-studio sign-in block, role guards in `requireAdmin`/`requireStudio`,
NEXT_REDIRECT pass-through in the login action.

### SECURITY
**S1. Temporary planner password was passed in the URL** (`?temp=...`) —
URLs persist in browser history and server/proxy logs. *Fix:* moved to a
90-second httpOnly `SameSite=Lax` flash cookie with an explicit Dismiss.

**S2. RSVP server action accepted drafts.** The portal page 404'd unpublished
weddings but the action itself was callable directly with any code. *Fix:*
`submitRsvp` re-checks `status === "PUBLISHED"` (defense in depth) and the
action is rate-limited per invite code (6/min).

**S3. Invite portals were indexable.** They are capability URLs; a crawled
link leaks a guest's personal page. *Fix:* `robots: noindex` +
`force-dynamic` on `/invite/[code]`.

Verified and left untouched: tenant isolation (session-derived `studioId` on
every query, 404-not-403), Prisma parameterization (no raw SQL anywhere),
Zod validation on all mutating inputs, Next server actions' built-in origin
checks for CSRF, React's default XSS escaping, Stripe webhook signature
verification, secrets only via env.

### ADMIN DASHBOARD
**AD1. No search/filter and no way to inspect a planner.** *Fix:* search by
studio name or owner email + status filter on the list; new
`/admin/planners/[id]` profile page showing weddings, guests, billing history,
revenue, free-wedding state, brand color, owner email, **account creation
date, last login**, per-studio email delivery stats, and the studio's activity
trail. Suspend/resume/delete verified working (delete cascades via the schema)
and left as-is.

### GUEST MANAGEMENT (the "unfinished" page)
**G1. Layout wasted the screen** — the roster shared a grid row with the
forms. *Fix:* full-width table first (horizontal-scroll safe), add/edit and
import forms in a two-column band below.
**G2–G7 added:** search + group filter (server-side), edit guest (same form,
prefilled), per-guest **Resend/Send invitation**, "last invitation sent" date,
CSV **export** (auth- and tenant-checked route), CSV import **validation**
(missing name or malformed email → line skipped) with an explicit
imported/skipped report, and send-batch result banners. RSVP badges already
existed and were kept.

### PLANNER DASHBOARD
**P1. No analytics beyond raw counts.** *Fix:* RSVP breakdown
(accepted/declined/maybe), pending-invitation count, email delivery stats
(from EmailLog), and a recent-activity feed scoped to the studio. Existing
wedding cards untouched. Also removed a duplicate count query (guest count and
RSVP count now come from one `groupBy` + one `count`).

### WEDDING WEBSITE
**W1. No social previews.** *Fix:* full Open Graph + Twitter metadata on
`/w/[slug]` (title, description with date/venue, studio as site name).
**W2. Every public page view hit the database.** *Fix:* `revalidate = 60` —
public sites are read-heavy and change rarely.
Checked and left as-is: mobile breakpoints, semantic headings/labels,
font loading, RSVP flow (pending state already present), template rendering.
No images exist yet, so no image-optimization work applies.

### SCHEMA / PRISMA
**D1. Invalid enum syntax** (single-line enums) — the bug you hit; now fixed
in-repo with one value per line. `npx prisma validate` requirements
hand-verified for Prisma 6: scalar-list defaults, `@db.Text`, nullable
`@unique`, cascades, `Json?`.
**D2. New models:** `EmailLog`, `PasswordResetToken` (+ `EmailStatus` enum,
`User.resetTokens` relation). Indexed for the queries that read them.

### BILLING
Audited, no defects found, no changes: first-free transaction, Stripe
Checkout session with metadata, idempotent webhook fulfillment
(`payment.status === "PAID"` guard), pending-payment records, dev-mode
fallback, receipts (which now also benefit from E1 logging).

## 2. Files modified
- `prisma/schema.prisma` — enum syntax fix + EmailLog, PasswordResetToken
- `src/lib/email.ts` — rewritten (root-cause fix, logging, retry, escaping)
- `src/lib/ratelimit.ts` — **new**
- `src/server/services/guests.ts` — batch isolation, resend, edit, import validation, search
- `src/server/services/rsvp.ts` — published check
- `src/server/services/passwordReset.ts` — **new**
- `src/server/services/admin.ts`, `src/server/services/billing.ts` — email call-site updates
- `src/app/login/page.tsx` — rate limit, reset link, autocomplete attrs
- `src/app/forgot-password/page.tsx`, `src/app/reset-password/[token]/page.tsx` — **new**
- `src/app/admin/planners/page.tsx` — search/filter, flash cookie, detail links
- `src/app/admin/planners/[id]/page.tsx` — **new**
- `src/app/studio/weddings/[id]/guests/page.tsx` — redesigned
- `src/app/studio/weddings/[id]/guests/export/route.ts` — **new**
- `src/app/studio/page.tsx` — analytics + activity
- `src/app/w/[slug]/page.tsx` — metadata + caching
- `src/app/invite/[code]/page.tsx` — rate limit + noindex

Everything else is untouched.

## 3. Database migrations required
One migration (new models + enum): run
`npx prisma migrate dev --name audit_email_log_password_reset`
No existing columns changed — no data migration needed.

## 4. New dependencies
None. (Rate limiting, hashing, and tokens use Node built-ins.)

## 5. Manual configuration you must perform (email will not work without this)
1. **Verify your sending domain in Resend** (Dashboard → Domains → add DKIM/SPF
   DNS records). Until verified, Resend only delivers to your own account
   email, from `onboarding@resend.dev` — this alone likely explains what you saw.
2. Set `EMAIL_FROM` to an address **on that verified domain**
   (e.g. `EventOS <hello@yourdomain.com>`).
3. Set `RESEND_API_KEY` and a production `APP_URL` (it's used in every emailed link).
4. After deploying: send one invitation, then check the Resend dashboard
   *and* the `EmailLog` table — you should see `SENT` rows with message ids.
5. Run the migration above, and configure the Stripe webhook endpoint +
   `STRIPE_WEBHOOK_SECRET` in production.

## 6. Recommended future work, intentionally left out
- Distributed rate limiting (Upstash/Redis) — current limiter is per-instance.
- Postgres RLS as a second isolation layer behind the service guards.
- Background job queue for bulk email (fine synchronously below ~200 guests/send).
- Logo upload + photo galleries (needs R2/S3 wiring).
- Column sorting and bulk guest actions (filters cover the immediate need).
- Subscription billing (schema-ready; product decision pending).
- Automated tests — the highest-value next investment once the app boots.
