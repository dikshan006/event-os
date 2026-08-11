# Operations

Backup, recovery, rotation and alerting for EventOS.

Written as decisions with reasons rather than a checklist, because the numbers
below are the ones that matter when something has gone wrong and nobody has time
to work them out from first principles.

---

## What is actually at risk

EventOS holds three kinds of state, and they fail differently.

| State | Where | Recreatable? |
|---|---|---|
| Weddings, guests, RSVPs, seating, registry | Postgres | **No.** This is the product. |
| Photographs | Vercel Blob / S3-compatible | Only by asking the planner to re-upload. |
| Sessions | JWT, stateless | Yes — everyone signs in again. |

Only the first two need a recovery plan. The third is why session loss is an
inconvenience rather than an incident.

---

## RPO and RTO

**RPO — how much data may be lost.** Target: **5 minutes.**

Set by what a planner can reconstruct. Five minutes is one editing session: they
remember what they typed and can type it again. An hour is a guest list import
and a seating plan, which they cannot. Neon and Supabase both offer
point-in-time recovery at second granularity on paid tiers; the RPO is therefore
a function of *enabling it*, not of engineering.

**RTO — how long until service is restored.** Target: **1 hour** for data loss,
**15 minutes** for an application fault.

Those differ because the remedies differ. An application fault is a Vercel
rollback: one click, effective in about a minute, and the previous deployment is
already built. Data loss means restoring a database branch and repointing
`DATABASE_URL`, which is a human decision — how far back, and what gets lost in
between — and the hour is mostly deciding, not waiting.

A wedding is a fixed date. The worst possible hour for an outage is the morning
guests are opening their invitations, which is precisely when a planner cannot
wait for a support ticket.

---

## Backups

### Configuration status — last checked 11 August 2026

**Nothing in this section is verified.** It is a hosting configuration, and this
repository cannot see it. A connection string proves a database exists; it says
nothing about whether anyone can get the data back. The targets below this
heading are what we intend, not what is true — and the difference between the
two is invisible until the morning it matters.

What the repository *does* prove:

| Fact | How it was established |
|---|---|
| Postgres, reached through a pooled endpoint | `DATABASE_URL` / `DIRECT_URL` in `.env`, and the split is what `prisma migrate` needs |
| The provider is Neon or Supabase | the connection string's host |
| Migrations run at build time | `"build": "prisma generate && prisma migrate deploy && next build"` |
| Deletes cascade widely | `onDelete: Cascade` from Studio → weddings → guests; one mistaken delete removes a great deal |

That last row is the reason this matters more here than in an average
application. Deleting a studio is a single statement that takes its weddings,
guests, RSVPs, seating and photographs with it, and there is no soft-delete and
no undo in the product.

**Confirm these five things in the provider console, then replace this block
with what you actually found — including the date and the plan name.** The
answers change with the plan, so "it was on when we launched" is not durable.

1. **Point-in-time recovery is enabled.** Neon: Console → Project → Settings →
   *History retention*. Supabase: Dashboard → Database → *Backups*.
2. **The retention window is at least 7 days.** Free tiers commonly give 24
   hours or nothing, which does not cover the failure that actually happens — a
   planner deletes a wedding and the couple asks about it a week later.
3. **Who can perform a restore.** Names, not roles. If it is one person, that
   person is a single point of failure on a fixed-date product.
4. **Where the console is, and how to reach it without the app.** An incident
   that takes out `APP_URL` should not also take out the runbook.
5. **A restore has been performed at least once.** Not tested is not backed up.

Until those are answered in writing, treat the RPO and RTO above as aspirations.
The honest current position is: **recovery capability unknown.**

### Postgres — the one that matters

**Enable point-in-time recovery on the database provider.** This is the single
most important item in this document and it is a setting, not a project.

- **Neon** — PITR is on by default; the retention window is per-plan. Set it to
  **at least 7 days**. Check: Console → Project → Settings → History retention.
- **Supabase** — daily backups on Pro; PITR is a paid add-on. Enable the add-on.
- **Vercel Postgres / Neon-backed** — as Neon.

Seven days rather than one because the most likely destructive event is not a
disk failure, it is a person: a planner deletes a wedding, and nobody notices
until the couple asks a week later. A 24-hour window does not cover the case
that actually happens.

### Verify the restore, not the backup

An untested backup is a belief, not a plan. **Once a quarter**, restore to a new
branch and check that a wedding, its guests and its RSVPs are intact. Restores
fail for boring reasons — a missing extension, a role that does not exist on the
target — and finding that out during an incident doubles the RTO.

### Photographs

Vercel Blob and S3 are durable but **not versioned by default**: a delete is a
delete. The application already avoids the worst case — deleting a photo removes
one prefix, and orphaned derivatives are cleaned up on failure — but there is no
undo.

If photo loss is unacceptable, enable object versioning on the bucket (S3/R2) or
mirror to a second bucket weekly. Currently accepted: photographs are held by
the planner too, so the recovery path is asking them to re-upload.

---

## Recovery procedures

### Application is broken after a deploy

1. Vercel → Deployments → the last known-good one → **Promote to Production**.
2. Confirm on `/api/health` (database reachable) and `/api/ready` (configuration
   present).
3. Confirm the commit with `/api/build`.

No database action. Migrations in this project are additive — new columns, new
enum values — so an older build runs against a newer schema.

### Data was deleted or corrupted

1. **Stop writes if it is spreading.** Suspend the studio (Admin → Planners →
   Suspend) rather than taking the whole platform down.
2. **Fix the time.** `AuditLog` holds who did what and when — find the action
   and take the timestamp immediately before it.
3. **Restore to a branch, never over the top.** Neon: create a branch from that
   timestamp. Restoring in place destroys everything written since, which
   usually includes other studios' work.
4. **Extract, then re-insert.** Pull the affected rows from the branch and
   re-insert them into production. A whole-database rollback to fix one studio's
   mistake is an outage for every other studio.
5. Only if the damage is platform-wide: repoint `DATABASE_URL` and `DIRECT_URL`
   at the branch, and redeploy.

### Database is unreachable

`/api/health` returns 503 and `/api/ready` reports `db: "unreachable"`.

1. Check the provider's status page before anything else.
2. Check connection limits — a serverless deployment exhausting Postgres
   connections looks exactly like an outage. `DATABASE_URL` must point at the
   **pooled** endpoint; `DIRECT_URL` at the direct one, and only migrations use
   it.
3. If the provider is down, there is no application-side remedy. The marketing
   site is static and stays up; the studio and guest sites do not.

---

## Secrets

### Rotation

| Secret | Rotate | Blast radius on leak |
|---|---|---|
| `AUTH_SECRET` | Annually, and on any suspicion | Every session forged. **Highest.** |
| `DATABASE_URL` / `DIRECT_URL` | On staff change or suspicion | Full data access. |
| `STRIPE_SECRET_KEY` | Annually | Charges and refunds. |
| `STRIPE_WEBHOOK_SECRET` | On endpoint change | Forged payment events. |
| `RESEND_API_KEY` | Annually | Mail sent as the studio. |
| `BLOB_READ_WRITE_TOKEN` | Annually | Read and delete every photograph. |

**Rotating `AUTH_SECRET` signs everybody out.** Sessions are JWTs signed with
it, so a new value invalidates all of them. That is the correct behaviour after
a suspected compromise and an unpleasant surprise otherwise — do it deliberately,
outside business hours, and tell planners first.

This is also, today, the **only** way to revoke a session. There is no
per-session revocation and no "log out everywhere": with a stateless JWT there is
nothing server-side to delete. Adding a `tokenVersion` column to `User`, checking
it in the JWT callback and incrementing it on demand is the standard fix and is
listed as recommended, not done.

### Rules

- Secrets live in the Vercel dashboard and nowhere else. Never in the repository,
  never in `NEXT_PUBLIC_*` (which is compiled into the browser bundle).
- After rotating, redeploy — Vercel injects environment variables at build time
  for the build and at runtime for functions, and a stale build can hold an old
  value.
- `src/lib/logger.ts` redacts secrets by key name and by value shape before
  anything reaches a log drain, so a secret in an error message does not become
  a secret in a searchable log. That is a safety net, not permission to be
  careless.

---

## Monitoring and alerting

### Endpoints

| Path | Answers | Poll |
|---|---|---|
| `/api/health` | Is this instance alive, and can it reach Postgres? | 60s |
| `/api/ready` | Is it configured to do its job? | On deploy |
| `/api/build` | Which commit is serving? | On demand |

Point an uptime monitor (Better Stack, Pingdom, UptimeRobot) at `/api/health`
and alert on **two consecutive failures** — one failure is a cold start.

### What to alert on

Every event below is emitted as one line of JSON by `src/lib/logger.ts`, so
these are log-drain queries rather than new instrumentation.

| Event | Meaning | Priority |
|---|---|---|
| `health.db_unreachable` | Database is down | **Page** |
| `exception` with `area: "billing"` | A payment failed | **Page** |
| `SECURITY.LOGIN_LOCKED` — a spike | Credential stuffing | Investigate |
| `exception` with `area: "email"` | Invitations are not arriving | Investigate |
| `ratelimit.redis_unavailable` | Limiter degraded to per-instance | Investigate |
| `idempotency.duplicate_suppressed` | Working as intended | Informational |

### Error monitoring

`src/lib/monitoring.ts` is the single seam every unexpected error passes
through. It reports to the structured log today; attaching Sentry is one
function body, and the redaction runs first either way — which matters, because
a vendor SDK handed a raw error will happily transmit a connection string in the
message and a guest's address in the breadcrumbs.

---

## Scaling notes

Known limits, with the trigger for acting on each.

- **Rate limiting** is distributed only when `UPSTASH_REDIS_REST_URL` and
  `UPSTASH_REDIS_REST_TOKEN` are set. Without them it falls back to per-instance
  counters — a real limit, multiplied by the number of warm instances. `/api/ready`
  reports which mode is live. Set them before launch.
- **Guest lists** are read in full on the seating and guest pages. Fine to a few
  hundred; paginate past roughly a thousand.
- **Photographs** are processed synchronously during upload, inside the function
  timeout. A very large image on a cold start is the case to watch; the 4 MB and
  100-megapixel caps exist to bound it.
