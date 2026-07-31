# Deploying Wedding Planner OS

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
| `EMAIL_FROM` | yes | `WeddingOS <hello@yourdomain.com>` — must be on a domain verified in Resend |
| `STRIPE_SECRET_KEY` | yes | Stripe → Developers → API keys (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | yes | From step 5 below (`whsec_…`) |

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

4. Create the platform admin. **Do not run `db:seed` in production** — that is
   demo data with a shared `password123`.

```bash
DATABASE_URL="<neon pooled url>" DIRECT_URL="<neon direct url>" \
  npm run db:create-admin -- you@yourdomain.com "Platform Owner" 'a-long-passphrase'
```

Migrations are run manually rather than in the build so a failed migration can
never take the site down mid-deploy.

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

- [ ] `/login` — sign in with the admin from step 2 → lands on `/admin`
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
- [ ] **Submit an RSVP** → confirmation email arrives → response appears in the
      studio's RSVP dashboard
- [ ] Visit `/w/<slug>` in a private window → public site loads, hero photo
      present, no draft data visible

---

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
