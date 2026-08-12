# Support tickets

How the support system works, and the one part of it that is not built.

---

## Shape

Two tables. `SupportTicket` holds the subject, category, status, priority and
the tenant; `TicketMessage` holds the conversation, append-only.

```
Studio ──< SupportTicket ──< TicketMessage
User   ──<
```

`studioId` is denormalised onto the ticket for the same reason it is on `Guest`
and `Photo`: an ownership check should be one indexed column, not a join.
`userId` records who actually wrote it, which starts mattering the moment a
studio has two people in it.

There is no update path on `TicketMessage` anywhere in the service, and no UI
that offers one. A support thread that can be rewritten after the fact is not a
record of what was said.

### Routes

| Route | Who | What |
|---|---|---|
| `/studio/help/tickets` | planner | their studio's tickets, open above settled |
| `/studio/help/tickets/new` | planner | open one |
| `/studio/help/tickets/[id]` | planner | the thread, and reply |
| `/admin/support` | admin | the queue, filterable by status, searchable |
| `/admin/support/[id]` | admin | thread, reply, status, priority |

### Status flow

```
        planner opens                admin replies
   ──────────────────► OPEN ──────────────────────► WAITING_FOR_PLANNER
                        │                                    │
                        │ admin picks up                     │ planner replies
                        ▼                                    ▼
                  IN_PROGRESS ◄─────────────────────── IN_PROGRESS
                        │
                        │ admin settles
                        ▼
                RESOLVED / CLOSED
                        │
                        │ planner replies
                        ▼
                      OPEN
```

A planner replying to a resolved ticket reopens it. Leaving it settled would
park the thread in a state nobody is looking at, which is the worst available
outcome for someone who has just told us it was not fixed.

---

## Authorization

The rule, stated once: **a planner-facing function takes `studioId` from the
session and puts it in the WHERE clause. An admin-facing function takes no
studio parameter at all.**

Both halves live in `src/server/services/support.ts`, separated by a banner
rather than split across two files — the mistake most likely to happen here is
calling an admin function from a planner page, and adjacency makes that visible
in review where separate files would hide it.

What that buys, concretely:

- `getMyTicket(studioId, id)` queries `{ id, studioId }` in one statement. There
  is no branch where a foreign ticket has been loaded and a guard is the only
  thing between it and the response.
- `replyAsPlanner` re-reads scoped, then writes with `updateMany` carrying
  `studioId`. A foreign id updates zero rows.
- The page answers `notFound()` rather than 403, so a ticket that is not yours
  and a ticket that does not exist are indistinguishable. Otherwise the response
  is an oracle for which ids are real.
- **Ownership is not an input.** `zTicket` has no `studioId` or `userId` field,
  and `createTicket` takes both from `requireStudio()`. A validator can be
  bypassed by a later refactor; a parameter that does not exist cannot.
- Every server action re-runs `requireStudio()` / `requireAdmin()` inside
  itself. Actions are endpoints — independently reachable, not covered by the
  layout, not covered by whatever check the component above them performed.

Nineteen tests in `tests/support.test.ts` cover this, including a sweep that
fails if *any* planner-side query is issued without `studioId`.

---

## Notifications

Reuses the existing mail system; no new infrastructure.

- **New ticket → platform inbox.** `SUPPORT_TICKET_TO`, falling back to
  `ACCESS_REQUEST_TO`, falling back to the address inside `EMAIL_FROM`. Carries
  the body, because the recipient is us and triage happens on a phone. `replyTo`
  is the planner.
- **Admin reply → planner.** Carries the ticket reference, the subject and a
  link. **Not the reply itself.** Email is forwarded, quoted and left open on
  shared screens, and a support thread can contain a planner's own account
  details. Reading the answer requires their session.

Both are `Promise.allSettled` and cannot fail the request: the ticket is already
saved, so a mail outage must not tell someone their message was lost. Every
attempt is recorded in `EmailLog`.

---

## Attachments — NOT BUILT

The form has a block explaining that screenshots are not available yet, rather
than a file input that would fail. That is deliberate.

**Why not:** `/api/ready` on production reports `storage: false`. Neither
`BLOB_READ_WRITE_TOKEN` nor the `S3_*` set is configured, so there is nowhere
for an uploaded file to go. Building the upload path against storage that does
not exist would produce a control that appears to work and silently discards
what a planner attaches.

The existing image pipeline is also the wrong tool. `processImage` re-encodes to
AVIF and WebP against a fixed set of photo slots with minimum dimensions —
correct for a wedding gallery, wrong for a 900×200 screenshot of an error
message, which it would reject for being too small.

**What it would take:**

1. **Configure storage.** Either `BLOB_READ_WRITE_TOKEN`, or the five `S3_*`
   variables. Nothing below is possible first.
2. **`TicketAttachment` model** — `id`, `ticketId`, `messageId`, `studioId`
   (denormalised, so an access check is one column), `storageKey`, `fileName`,
   `contentType`, `bytes`, `createdAt`. Plus a migration.
3. **A validating upload path.** Reuse the shape of `uploadPhoto`: cap bytes
   before anything touches the buffer, allowlist on the *detected* type rather
   than the client's `Content-Type` or the extension, and reject SVG outright —
   it is a document with a script engine, not an image.
4. **Server-generated keys.** `studios/<studioId>/tickets/<ticketId>/<uuid>`,
   exactly as photos do it. The planner's filename is stored for display and
   never used in a path. This is what makes traversal unreachable rather than
   filtered.
5. **An access-controlled read route.** The hard part, and the reason this is
   not a small job. Vercel Blob URLs are public to anyone holding them, which is
   acceptable for a wedding photograph and not for a screenshot that may show a
   guest list. Attachments need `/studio/help/tickets/[id]/attachments/[aid]`
   re-checking `studioId` from the session on every read and streaming the bytes
   — or signed, short-lived URLs if the provider supports them.
6. **Rate limiting**, keyed per studio, alongside the existing `support:` bucket.
7. **Tests**: size, type, traversal, and the one that matters — planner B
   requesting planner A's attachment id gets a 404.

Step 5 is the reason this was not done in the same pass as everything else.
An attachment endpoint that returns a public URL is a tenant-isolation hole in
a product whose central promise is that one studio cannot see another's guest
data, and it is not worth shipping quickly.

---

## Not verified

The migration `20260812090000_support_tickets` is **hand-written**, because the
environment this was authored in cannot reach Prisma's migration engine. It is
additive only — four new enums, two new tables, four indexes, three foreign
keys — and touches nothing that already exists, so it cannot affect anything
running. It has still never been applied to a database. Run it against a scratch
copy before production.

Everything in this document describes code that passes 105 unit tests and has
never been run against Postgres or a browser.
