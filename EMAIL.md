# Email deliverability

Everything needed to make invitations land in the inbox. Budget about fifteen
minutes, most of it waiting for DNS.

---

## Why invitations get marked as spam

Worth understanding before changing records, because four of these were true of
this codebase and are now fixed in the application layer — but the first two can
only be fixed by you, in DNS.

| Cause | Effect | Fixed by |
|---|---|---|
| **No SPF/DKIM on the sending domain** | Gmail and Outlook cannot verify the mail is really from you. Since Feb 2024 both *require* authentication; unauthenticated mail is rejected or filtered outright. | DNS, below |
| **No DMARC record** | Nothing tells receivers what to do with mail that fails the checks, and there is no reporting when something breaks. Gmail requires at least `p=none` for bulk senders. | DNS, below |
| **HTML-only message, no plain-text part** | Trips `MIME_HTML_ONLY` in SpamAssassin and its equivalents. The single cheapest deliverability win available. | ✅ Application |
| **No `Reply-To`, unreplyable sender** | Reads as a broadcast rather than correspondence. A guest who replies gets a bounce. | ✅ Application |
| **A raw URL as the visible link text** | The oldest phishing shape there is, scored accordingly. | ✅ Application |
| **A burst of identical messages from a cold domain** | Two hundred invitations in ten seconds from a domain with no history is exactly the pattern reputation systems watch for. | ✅ Application — sends are paced |
| **Sending from `onboarding@resend.dev`** | Resend's shared sandbox domain. Delivers only to your own account address; carries none of your reputation. | Set `EMAIL_FROM` |
| **Sending from a Gmail/Outlook address** | Their own DMARC policy tells the world to reject mail sent on their behalf by third parties. It will fail almost everywhere. | Use a domain you own |

---

## 1. Choose a sending domain

Use a subdomain, not your root domain:

```
mail.yourstudio.com        ← recommended
yourstudio.com             ← works, but see below
```

**Why a subdomain.** Sending reputation is tracked per-domain. If a batch of
invitations ever goes badly — a stale guest list, a spam complaint — the damage
is contained to `mail.yourstudio.com` and your ordinary business email on
`yourstudio.com` is untouched. It also keeps the SPF record for your sending
separate from whatever your mailbox provider needs on the root.

---

## 2. Verify the domain in Resend

1. Resend → **Domains** → **Add Domain** → enter `mail.yourstudio.com`
2. Choose the region closest to your guests.
3. Resend prints three or four records. Add them at your DNS host, then press
   **Verify**. Propagation is usually a few minutes.

### The records, and what each one does

Resend gives you exact values — the table explains what you are adding.

#### DKIM — proves the message was not altered

```
Type:  TXT
Name:  resend._domainkey.mail
Value: p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQ… (from Resend)
TTL:   Auto / 3600
```

Resend signs every message with a private key. This record publishes the public
half, so a receiving server can confirm the message really came from you and was
not modified in transit. **This is the most important record of the three** —
DKIM survives forwarding, where SPF does not.

#### SPF — lists who may send as you

```
Type:  TXT
Name:  mail            (or "send.mail" — use exactly what Resend shows)
Value: v=spf1 include:amazonses.com ~all
TTL:   Auto / 3600
```

Names the servers permitted to send mail using your domain in the envelope.
`~all` is a soft fail: anything else is suspicious but not automatically
rejected — the right setting while you are establishing reputation.

> **One SPF record per domain, ever.** Two `v=spf1` records is a permanent error
> and *breaks* authentication rather than adding to it. If the name already has
> one, merge the `include:` into the existing record instead of adding a second.

#### MX for the bounce subdomain

```
Type:     MX
Name:     send.mail       (as shown by Resend)
Value:    feedback-smtp.<region>.amazonses.com
Priority: 10
```

Where bounces and complaints are returned, so Resend can tell you an address is
dead instead of you sending to it for two years.

#### DMARC — the policy, and the reporting

Resend does not give you this one. Add it yourself:

```
Type:  TXT
Name:  _dmarc.mail
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourstudio.com; fo=1; adkim=r; aspf=r
TTL:   Auto / 3600
```

- `p=none` — monitor only. **Start here.** It changes nothing about delivery but
  turns on the reports, which is the only way to see whether your setup is
  actually working before you enforce it.
- `rua=` — where the daily aggregate reports go. Use a real address you check.
- `adkim=r` `aspf=r` — relaxed alignment, so a subdomain sender still aligns
  with the organisational domain.

**After two to four weeks** of clean reports, tighten it:

```
v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc@yourstudio.com; fo=1
```

and later `p=reject`. Do not start at `p=reject` — if anything is misconfigured
you will silently lose real mail, including your own.

---

## 3. Set the environment variables

Vercel → Project → **Settings → Environment Variables**, scoped to Production
(and Preview if you want previews to send).

| Variable | Required | Example | Notes |
|---|---|---|---|
| `RESEND_API_KEY` | yes | `re_…` | Resend → API Keys. **Sending access** is enough; it does not need full access. |
| `EMAIL_FROM` | yes | `Atelier Blanc <hello@mail.yourstudio.com>` | The address must be on the domain you verified. The display name is what a guest sees in their inbox — use the studio's name, not "EventOS". |
| `EMAIL_REPLY_TO` | recommended | `studio@yourstudio.com` | Where platform emails route replies. Guest invitations override this with the studio's own contact address automatically. |
| `APP_URL` | yes | `https://yourstudio.com` | Invitation links are built from it. A wrong value produces links that 404. |

`EMAIL_FROM` is checked at send time. In production, a sandbox sender, a missing
value or a consumer domain is refused with a message naming the fix, and the
reason is written to `EmailLog` — rather than every guest silently receiving
nothing.

---

## 4. Verify before you rely on it

```bash
npm run email:check          # configuration, locally or with prod vars
```

Then send one real invitation to an address you control and check:

- **Gmail → ⋮ → Show original.** You want `SPF: PASS`, `DKIM: PASS`,
  `DMARC: PASS`. Anything else means a record is wrong or has not propagated.
- **The `EmailLog` table** — every attempt is recorded `SENT`/`FAILED`/`SKIPPED`
  with the provider's message id or error.
- Send to a **Gmail**, an **Outlook** and an **iCloud** address. They filter
  very differently, and passing one says little about the others.

Useful external checks: [mail-tester.com](https://www.mail-tester.com) scores a
message out of 10 and names what it dislikes; [dmarcian](https://dmarcian.com)
and [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) inspect published records.

---

## 5. Warming up

A domain with no sending history is treated with suspicion no matter how
correct the DNS is.

- First week: keep it under ~50 messages a day.
- Increase gradually. A studio sending a few hundred invitations a month never
  needs to think about this again.
- Invitations are already paced at one every 600ms, which keeps a large wedding
  inside the provider's rate limit and away from burst detection.
- **Never send to a purchased or scraped list.** One spam-trap hit can undo
  months of reputation, and a wedding guest list should be clean by definition.

---

## What the application does, so you do not have to

- **Plain-text alternative** on every message, rendered from the same source as
  the HTML so the two cannot drift apart.
- **Correct sender identity** — display name is the studio's, not the platform's.
- **`Reply-To`** routed to the studio's contact address on anything a guest
  receives, so replies reach a person.
- **`List-Unsubscribe`** on guest mail, as a `mailto:` to the studio.
  Deliberately not RFC 8058 one-click: that implies a suppression list, and
  silently suppressing a wedding invitation is worse than the complaint it
  avoids — the guest simply never learns there is a wedding.
- **`Auto-Submitted`** and **`X-Entity-Ref-ID`** headers, so out-of-office
  replies do not bounce back and the message is treated as transactional.
- **Retries on transient failures only** — rate limits, timeouts and 5xx, with
  backoff. A rejected address is never retried, because repeatedly sending to a
  known-bad address is what damages reputation.
- **Every attempt logged** to `EmailLog` with the provider's id or error.
- **Accessible, responsive HTML** — semantic document, real `lang`, presentational
  tables, dark-mode aware, single-column under 600px, no image-only content.
