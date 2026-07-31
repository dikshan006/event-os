# Wedding Planner OS

Multi-tenant SaaS for professional wedding planners: a platform owner creates
white-labeled **Planner Studios**; planners build weddings from three fixed
luxury templates; every guest gets a **unique invitation link** with a
schedule personalized to their groups. Publishing is gated by Stripe
($99/wedding, first one free).

Built on **Next.js 15 (App Router) · PostgreSQL + Prisma · Auth.js v5 ·
Stripe Checkout · Resend**. See `ARCHITECTURE.md` (delivered alongside this
repo) for the full system design this implements.

---

## Quick start

```bash
cp .env.example .env        # fill in DATABASE_URL + AUTH_SECRET at minimum
npm install
npx prisma migrate dev      # creates the schema
npm run db:seed             # demo admin, studio, wedding, guests
npm run dev
```

Seeded logins (password for both: `password123`):

| Role            | Email                       | Lands on  |
|-----------------|-----------------------------|-----------|
| Platform Admin  | owner@weddingos.app         | `/admin`  |
| Planner         | sarah@prestigeweddings.com  | `/studio` |

The seed also prints **guest invite codes** — open `/invite/<CODE>` in a
private window to see a personalized guest portal and submit an RSVP, then
watch it appear in the studio's RSVP dashboard.

Public site for the seeded wedding: `/w/sarah-and-james`.

## Stripe (optional in dev)

Without `STRIPE_SECRET_KEY`, publishing a paid wedding records a dev-mode
payment and publishes immediately — so the whole flow is testable locally.

With Stripe configured:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# put the whsec_… it prints into STRIPE_WEBHOOK_SECRET
```

Publishing then redirects to Stripe Checkout; the webhook flips the wedding
to PUBLISHED and stores the receipt. Test card: `4242 4242 4242 4242`.

## Photos

Planners manage photographs at **Studio → a wedding → Photos**, in four slots:
hero (one), couple, story, and an optional gallery.

On upload each image is EXIF-stripped, auto-rotated, and re-encoded into a
ladder of four widths (480/960/1600/2400, capped at the source width) in both
**AVIF and WebP**, plus a ~1 KB inline blur placeholder. The public site then
serves plain `<picture srcset>`: no per-request transform, no image-optimization
bill, identical behaviour on any host. Frames reserve their aspect ratio, so
nothing shifts as photos load.

Storage sits behind a small driver interface (`src/lib/storage.ts`):

```bash
# Cloudflare R2, AWS S3, Backblaze B2 and MinIO all work by env var alone
S3_BUCKET=wedding-photos
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com   # omit for AWS S3
S3_REGION=auto
S3_PUBLIC_URL=https://photos.yourdomain.com              # public bucket or CDN
```

With `S3_BUCKET` unset, uploads are written to `public/uploads` instead, so the
whole flow is testable locally — the same dev fallback pattern as Stripe and
Resend. The dashboard says which mode it's in.

## Emails (optional in dev)

Without `RESEND_API_KEY`, emails log to the server console. With it, guests
receive branded invitations ("Designed by {Studio}") and RSVP confirmations;
planners get studio invites and payment receipts.

## What's implemented

- **Auth & roles** — credentials auth (bcrypt), JWT sessions carrying
  `role` + `studioId`; edge middleware gates signed-out traffic while
  `requireAdmin()`/`requireStudio()` enforce roles server-side; suspended
  studios cannot sign in.
- **Tenant isolation** — every service call derives `studioId` from the
  session (`src/server/services/context.ts`); queries filter by it; cross-
  tenant lookups 404 rather than 403.
- **Admin** — dashboard aggregates, planner CRUD (temp password shown once),
  suspend/delete (cascades), all weddings/payments, audit log, platform
  pricing settings.
- **Studio** — wedding CRUD + duplicate, 3 templates, section toggles,
  guests with groups + CSV import + invitation emails, schedule builder with
  audiences, registry + cash funds, RSVP dashboard, branding settings.
- **Publish billing** — first-wedding-free logic, Stripe Checkout,
  idempotent webhook fulfillment, receipts, full payment history.
- **Guest experience** — public site `/w/[slug]` (public events only),
  personalized portal `/invite/[code]` (invite code is the credential),
  RSVP round-trip with confirmation email.
- **Photos** — four managed slots, S3-compatible storage with a local dev
  driver, AVIF/WebP responsive ladders generated at upload, blur-up placeholders,
  and the hero doubling as the Open Graph preview image.

## Deliberate V1 simplifications (documented in code)

- Guest groups & event audiences are Postgres `text[]` columns instead of
  the join tables in ARCHITECTURE.md — identical behavior, much less code;
  migrating to join tables later is mechanical.
- Payments use Stripe **Checkout** (redirect) rather than saved-card
  PaymentIntents — simpler, SCA-proof; saved cards can be layered on.
- Registry URL scraping, subscriptions, and Postgres RLS as a second isolation
  layer are stubbed/TODO — the schema and hooks for them exist.
- Photo reordering is up/down buttons rather than drag-and-drop: it works
  without JavaScript, on touch, and with a keyboard. Drag can be layered on.

## Honest caveat

This codebase was written in a sandbox **without network access**, so it has
not been `npm install`-ed or executed. It follows current stable APIs
(Next 15 async params, Auth.js v5 beta, Prisma 6), but expect the usual
first-run wrinkles — a missing type, an import path, a Prisma nullability —
of the kind `npm run dev` surfaces immediately. Point Claude Code at the
repo and it will clear those in minutes.
