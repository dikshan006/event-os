# Deploying EventOS

Target stack: **Vercel** (app) · **Neon** (Postgres) · **Cloudflare R2** (photos) ·
**Resend** (email) · **Stripe** (publishing fees).

Status of the code: `next build` passes clean — 29 routes, no type errors.
Everything below is configuration, not code changes.

---

## 0. Before anything else (on your Mac)

`node_modules` currently contains Linux binaries and a stripped Prisma client
from the build verification. Restore it:

```bash
cd ~/Desktop/wedding-planner-os
npm install
npx prisma generate
npx prisma migrate dev      # applies the photos migration to your dev database
npm run dev                 # confirm the app still runs locally
```

---

## 1. Environment variables

Every one of these goes into **Vercel → Project → Settings → Environment
Variables**, scoped to *Production* (and *Preview*, if you want previews to work).

| Variable | Required | Where it comes from |
|---|---|---|
| `DATABASE_URL` | yes | Neon **pooled** connection string — the host containing `-pooler`. Serverless opens a connection per invocation; the direct endpoint will run out. |
| `DIRECT_URL` | yes | Neon **direct** connection string (no `-pooler`). Only `prisma migrate` uses it. |
| `AUTH_SECRET` | yes | `openssl rand -base64 32`. Generate a **new** one for production — do not reuse the dev value. |
| `AUTH_TRUST_HOST` | yes | `true` |
| `APP_URL` | yes | `https://your-app.vercel.app` (or your custom domain). No trailing slash. Every emailed invite link is built from this. |
| `S3_BUCKET` | yes | R2 bucket name, e.g. `weddingos-photos` |
| `S3_ACCESS_KEY_ID` | yes | R2 → Manage API Tokens → Object Read & Write |
| `S3_SECRET_ACCESS_KEY` | yes | same token |
| `S3_ENDPOINT` | yes for R2 | `https://<account-id>.r2.cloudflarestorage.com` (leave empty for AWS S3) |
| `S3_REGION` | yes | `auto` for R2; the real region for AWS |
| `S3_PUBLIC_URL` | yes | The bucket's public URL or custom domain, e.g. `https://photos.yourdomain.com` |
| `RESEND_API_KEY` | yes | Resend → API Keys |
| `EMAIL_FROM` | yes | `EventOS <hello@yourdomain.com>` — must be on a domain verified in Resend |
| `STRIPE_SECRET_KEY` | yes | Stripe → Developers → API keys (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | yes | From step 5 below (`whsec_…`) |
| `SHOWCASE_WEDDING_SLUGS` | no | Comma-separated slugs shown in "View an example wedding" on /weddings, in the order given. Left unset, the most recently published weddings are used. Only PUBLISHED weddings are ever eligible. |
| `ACCESS_REQUEST_TO` | no | Where "Request access" submissions are emailed. Falls back to the address inside `EMAIL_FROM`. Requests are stored either way — only the notification is lost. |

**Without `S3_BUCKET` the app now refuses to start the storage driver in
production** rather than writing photos to a disk that disappears on the next
deploy. That guard is deliberate.

---

## 2. Database (Neon)

1. Create a **production** database — separate from the one your dev `.env` points at.
2. Copy both connection strings (pooled and direct) into the variables above.
3. Apply migrations from your Mac, pointed at production:

```bash
DATABASE_URL="<neon pooled url>" DIRECT_URL="<neon direct url>" npx prisma migrate deploy
```

This includes:

- `20260803170000_access_request` — the table behind the public site's Request
  access form. Until it is applied that form errors.
- `20260804090000_calendar_and_maps` — real start/end instants on events, venue
  address, coordinates and a timezone. It also best-effort backfills `startsAt`
  for existing events whose time reads like "7:00 PM" or "19:00", anchored to
  the wedding's own date. Anything it cannot parse is left NULL and flagged in
  the Schedule Builder rather than guessed at.

Run migrations before pointing a domain at the site.

4. Create the platform admin. **Do not run `db:seed` in production** — that is
   demo data with a shared `password123`.

```bash
DATABASE_URL="<neon pooled url>" DIRECT_URL="<neon direct url>" \
  npm run db:create-admin -- you@yourdomain.com "Platform Owner" 'a-long-passphrase'
```

### Migrations run in the build, on purpose

`package.json` now runs `prisma migrate deploy` as part of `build`.

This reverses an earlier decision, for a reason worth recording. Running them
by hand was meant to stop a bad migration taking the site down mid-deploy. What
actually happened was the opposite failure, and it is the more likely one: code
was pushed, Vercel deployed it, the migration was forgotten, and every planner
got a 500 because the Prisma client selected four columns the database did not
have.

Running them in the build makes that impossible. A migration that fails fails
the build, and Vercel keeps serving the **previous** deployment — so the worst
case is "the new version did not ship", not "the live site is broken". Code can
never get ahead of the schema again.

Two consequences to know about:

- `DIRECT_URL` must be present at build time, not just at runtime.
- A destructive migration still deserves a look before you push. The build
  guard protects against forgetting; it does not protect against a bad
  migration you wrote on purpose.

To apply migrations without deploying (the old behaviour):

```bash
DATABASE_URL="<neon pooled url>" DIRECT_URL="<neon direct url>" npm run db:deploy
```

---

## 3. Photo storage (Cloudflare R2)

1. R2 → Create bucket (e.g. `weddingos-photos`).
2. **Settings → Public access**: either enable `r2.dev` (fine to start) or
   connect a custom domain like `photos.yourdomain.com` (better — stable URL,
   your own TLS). Whatever you end up with is `S3_PUBLIC_URL`.
3. **Manage API Tokens → Create token → Object Read & Write**, scoped to this
   bucket. That gives you the key id and secret.
4. CORS is *not* required: the browser only ever reads images from the bucket,
   and uploads go through the app server, never directly to R2.

---

## 4. Email (Resend)

1. Resend → Domains → add your domain, then add the DKIM/SPF records it prints
   to your DNS.
2. Wait for verification. **Until it verifies, Resend only delivers to your own
   account email** — this is the single most common cause of "no emails arrived".
3. Set `EMAIL_FROM` to an address on that verified domain.
4. After deploying, send one invitation and check both the Resend dashboard and
   the `EmailLog` table. Every attempt is recorded there as SENT / FAILED /
   SKIPPED with the provider error.

---

## 5. Stripe

1. Stripe → Developers → **Webhooks → Add endpoint**
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Event: `checkout.session.completed`
2. Copy the signing secret (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` on Vercel
   and redeploy.
3. Test with a real publish, or Stripe's "Send test webhook".

The publish flow: first wedding per studio is free, after that publishing
redirects to Stripe Checkout and the webhook flips the wedding to PUBLISHED.
If `STRIPE_SECRET_KEY` is missing the app falls back to dev-mode publishing —
so a missing key means weddings publish **for free**. Set it.

---

## 6. GitHub

Git is initialised and the first commit exists. Create an empty repo on GitHub
(no README, no .gitignore), then:

```bash
cd ~/Desktop/wedding-planner-os
git remote add origin https://github.com/<you>/wedding-planner-os.git
git push -u origin main
```

`.env` is git-ignored and was verified absent from the commit.

---

## 7. Vercel

1. vercel.com → **Add New → Project → Import** your GitHub repo.
2. Framework preset: **Next.js**. Leave build/output settings at their defaults —
   `package.json` already runs `prisma generate && next build`.
3. Paste in every variable from section 1 **before** the first deploy.
4. Deploy.
5. Set `APP_URL` to the real deployed URL and redeploy if it changed.

Node 20+ is pinned in `package.json`; Vercel will honour it.

---

## 8. Smoke test, in this order

Each step depends on the one above it.

- [ ] `/` — the public homepage loads, signed out, and the nav offers Sign in
- [ ] `/weddings` — the hero photograph renders (AVIF in Chrome, WebP in Safari)
- [ ] `/weddings#example` — links to a real published wedding, or says none is published yet
- [ ] `/request-access` — submit the form → success view appears, a row lands in
      `AccessRequest`, and two emails are logged in `EmailLog`
- [ ] `/login` — sign in with the admin from step 2 → lands on `/admin`
- [ ] **Admin → Requests** → the submission is listed → *Create their studio*
      opens New Planner with the name, email and studio prefilled
- [ ] `/` while signed in — the nav now offers Dashboard, and `/dashboard`
      resolves to `/admin` or `/studio` by role
- [ ] **Admin → Planners → Create planner** → temp password appears for 90s
- [ ] **Check email** — planner invite arrives (proves Resend + domain)
- [ ] Sign out, sign in as that planner → lands on `/studio`
- [ ] **Create a wedding** → appears in the studio list
- [ ] **Photos tab → upload a hero image** → thumbnail renders
      (proves R2 credentials, public URL, and sharp on the serverless runtime)
- [ ] **Publish the wedding** → first one is free, no Stripe redirect
- [ ] Create a **second** wedding and publish → Stripe Checkout appears →
      pay with `4242 4242 4242 4242` → returns and shows PUBLISHED
      (proves the webhook; if it stays DRAFT, the webhook secret is wrong)
- [ ] **Add a guest with your own email → Send invitations** → email arrives
- [ ] Open the `/invite/<CODE>` link → personalised invitation renders with the
      hero photo and the guest's name
- [ ] On an event, **Add to calendar → Google** opens Google with the right
      title, date and venue prefilled
- [ ] **Add to calendar → Apple Calendar** downloads an .ics; open it and check
      the time matches the venue's local time, not yours
- [ ] **Directions → Google Maps / Apple Maps** opens the venue. On a phone it
      should open the installed app, not a browser tab
- [ ] `/calendar/<CODE>/all.ics` downloads the whole personal schedule
- [ ] `/calendar/<wrong-code>/all.ics` returns 404
- [ ] **Submit an RSVP** → confirmation email arrives → response appears in the
      studio's RSVP dashboard
- [ ] Visit `/w/<slug>` in a private window → public site loads, hero photo
      present, no draft data visible

---

## Troubleshooting photo uploads

Uploads run through a **server action**, not a REST route — so Vercel's access
log always shows `POST /studio/weddings/[id]/photos → 200` regardless of
outcome, and there is no JSON body to inspect. The real result is in the
**runtime logs**, tagged for grepping:

| Log line | Meaning |
|---|---|
| `[storage] PutObject failed …` | R2 rejected the write. The SDK error name says which: `InvalidAccessKeyId`, `SignatureDoesNotMatch`, `NoSuchBucket`, `AccessDenied`. |
| `[photo-upload] Photo storage is not configured — missing …` | Those variables are absent from the Vercel environment. Add and redeploy. |
| `[photo-upload] ref=abc123` | An unexpected fault. The same reference appears in the on-screen message, and the full stack sits next to it in the log. |

**Maximum upload size on Vercel is 4.5 MB**, enforced at the platform edge
before any application code runs — `serverActions.bodySizeLimit` cannot raise
it. `MAX_UPLOAD_BYTES` is set to 4 MB to stay inside it. Modern phone
photographs regularly exceed this; lifting the ceiling means switching to
presigned direct-to-R2 uploads, where the browser sends the file straight to
the bucket and the server only signs the request.

If uploads succeed but images render blank, `S3_PUBLIC_URL` is wrong — the
bytes are in the bucket but the public URL doesn't resolve. Open one derivative
URL directly to confirm, and check the bucket allows public reads.

## Calendar and maps

Nothing to configure — no Google Maps key, no calendar API, no third-party
script. Guest-facing links are the documented universal URL schemes, and .ics
files are generated per request at `/calendar/{token}/{event}.ics`, where the
token is a guest's invite code or a published wedding's slug. Authorisation is
inherited from the same rules the invitation page uses, so the file can never
contain an event the page would not show.

The timezone fills itself in from the city or address the planner already
typed — "Charleston, SC" resolves to America/New_York, "Tuscany" to Europe/Rome
— using an offline IANA lookup, no geocoding key. It stays editable, and
changing it re-anchors every existing event so the times keep the clock values
the planner entered rather than silently shifting by the offset.

One thing the planner must still set:

- **A start time on each event** (Schedule Builder). Events without one appear
  on the invitation but offer no calendar button; the builder shows a
  "No time set" chip so this is visible rather than silent.

Weddings created before timezones existed are left on UTC. To give them the
right zone in one go, reusing the same lookup the app uses:

```bash
DATABASE_URL="…" DIRECT_URL="…" npm run db:backfill-timezones           # dry run
DATABASE_URL="…" DIRECT_URL="…" npm run db:backfill-timezones -- --apply
```

## Known limitations to revisit after launch

- **Rate limiting is per-instance.** `src/lib/ratelimit.ts` uses an in-memory
  map, so on serverless each instance has its own counter and the login limiter
  is weaker than it looks. Move to Upstash Redis when traffic justifies it.
- **Bulk invitation sending is synchronous.** Fine below ~200 guests per send;
  beyond that it needs a queue to stay under the function timeout.
- **No automated tests.** The highest-value additions are tenant isolation
  ("studio A cannot read studio B's data") and webhook idempotency.
- **Stripe edge cases.** Only `checkout.session.completed` is handled; abandoned
  checkouts leave PENDING payment rows and refunds have no code path.
