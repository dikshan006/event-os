import { Resend } from "resend";
import { prisma } from "@/lib/db";
import { renderHtml, renderText, type Message } from "@/lib/email-render";

/**
 * Outbound email.
 *
 * The workflow above this file is unchanged: the same callers, the same
 * signatures, the same copy. What changed is everything between "send this" and
 * the message arriving — the parts that decide whether it lands in an inbox or
 * a spam folder.
 *
 * The deliverability problems this file addresses, in the order they matter:
 *
 *  1. No plain-text part. An HTML-only message is one of the strongest, easiest
 *     spam signals there is (SpamAssassin `MIME_HTML_ONLY` and equivalents).
 *     Every message now carries both, rendered from one description so they
 *     cannot disagree.
 *  2. No Reply-To. A wedding guest replying to an invitation was writing into
 *     nothing. An unreplyable From on a personal-looking email is both a spam
 *     signal and, more importantly, rude. Replies now go to the studio.
 *  3. The default sender was `onboarding@resend.dev` — Resend's shared sandbox
 *     domain, which can only deliver to your own account address and carries no
 *     domain reputation of yours. Now refused in production with a message that
 *     says exactly what to set.
 *  4. Retries were indiscriminate. Re-sending to an address the provider has
 *     already rejected as invalid does not help, wastes the request budget and
 *     is the sort of behaviour that costs sending reputation. Only transient
 *     failures are retried now, with backoff.
 *  5. No List-Unsubscribe. See the note on `unsubscribe` below.
 */

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

/** The sandbox sender Resend hands out. Useful in dev, useless in production. */
const SANDBOX_FROM = "onboarding@resend.dev";
const FROM = process.env.EMAIL_FROM ?? `EventOS <${SANDBOX_FROM}>`;

export type EmailKind =
  | "GUEST_INVITATION" | "RSVP_CONFIRMATION" | "PLANNER_INVITE" | "CUSTOM_DESIGN_REQUEST"
  | "PAYMENT_RECEIPT" | "PASSWORD_RESET"
  | "ACCESS_REQUEST"
  | "ACCESS_REQUEST_ACK";

type SendArgs = {
  to: string;
  subject: string;
  message: Message;
  kind: EmailKind;
  studioId?: string;
  /**
   * Where a reply goes. A guest answering their invitation should reach the
   * planner; a planner answering a receipt should reach us.
   */
  replyTo?: string | null;
  /**
   * A `mailto:` address that honours unsubscribe requests, for the
   * List-Unsubscribe header.
   *
   * Deliberately mailto and not a one-click URL. RFC 8058 one-click implies a
   * suppression list that silently stops sending — and silently suppressing a
   * wedding invitation is a worse outcome than the spam complaint it prevents,
   * because the guest simply never learns there is a wedding. A mailto routes
   * to a human who can act on it, satisfies the header's purpose, and is what
   * most transactional senders use.
   *
   * Omitted entirely on password resets and receipts, where offering to
   * unsubscribe from a security email is nonsense.
   */
  unsubscribe?: string | null;
};

/* ------------------------------------------------------------ diagnostics -- */

export type EmailConfig = {
  ready: boolean;
  provider: "resend" | "none";
  from: string;
  /** The bare address inside `EMAIL_FROM`, which is what must be on a verified domain. */
  fromAddress: string | null;
  fromDomain: string | null;
  problems: string[];
  warnings: string[];
};

/**
 * What is and is not configured — surfaced rather than discovered by a guest
 * not receiving an invitation.
 */
export function emailConfig(): EmailConfig {
  const problems: string[] = [];
  const warnings: string[] = [];

  const fromAddress = FROM.match(/<([^>]+)>/)?.[1] ?? (FROM.includes("@") ? FROM.trim() : null);
  const fromDomain = fromAddress?.split("@")[1] ?? null;
  const isProd = process.env.NODE_ENV === "production";

  if (!process.env.RESEND_API_KEY) {
    problems.push("RESEND_API_KEY is not set — nothing can be sent.");
  }
  if (!process.env.EMAIL_FROM) {
    (isProd ? problems : warnings).push(
      "EMAIL_FROM is not set, so the sandbox sender is in use. It only delivers to your own Resend account address.",
    );
  }
  if (fromAddress === SANDBOX_FROM && isProd) {
    problems.push(
      `EMAIL_FROM still points at ${SANDBOX_FROM}. Set it to an address on a domain verified in Resend, e.g. "Your Studio <hello@yourdomain.com>".`,
    );
  }
  if (fromDomain && /^(gmail|outlook|hotmail|yahoo|icloud|live|aol)\./i.test(fromDomain)) {
    problems.push(
      `EMAIL_FROM uses ${fromDomain}, a consumer mailbox provider. Their DMARC policy rejects mail sent on their behalf by anyone else, so this will fail at most recipients. Use a domain you control.`,
    );
  }
  if (!process.env.APP_URL) {
    problems.push("APP_URL is not set — invitation links would be built against an empty origin.");
  }
  if (!process.env.EMAIL_REPLY_TO && !isProd) {
    warnings.push("EMAIL_REPLY_TO is not set; platform emails fall back to the From address.");
  }

  return {
    ready: problems.length === 0,
    provider: resend ? "resend" : "none",
    from: FROM,
    fromAddress,
    fromDomain,
    problems,
    warnings,
  };
}

/* ------------------------------------------------------------------ send -- */

/** Best-effort persistence — an EmailLog failure must never break the main flow. */
async function record(
  args: SendArgs,
  status: "SENT" | "FAILED" | "SKIPPED",
  provider?: string,
  error?: string,
) {
  try {
    await prisma.emailLog.create({
      data: {
        studioId: args.studioId ?? null,
        kind: args.kind,
        toEmail: args.to,
        subject: args.subject,
        status,
        provider,
        error,
      },
    });
  } catch (e) {
    console.error("[email] failed to write EmailLog", e);
  }
}

type Attempt = { id?: string; error?: string; retryable?: boolean };

/**
 * Which failures are worth trying again.
 *
 * Retrying a permanent rejection is not merely useless — repeatedly sending to
 * an address the provider has told you is invalid is exactly the pattern that
 * damages a sending reputation. Rate limits, gateway errors and network faults
 * are transient and worth another go; a malformed address or an unverified
 * domain will fail identically forever.
 */
function isRetryable(name: string, message: string): boolean {
  const n = `${name} ${message}`.toLowerCase();
  if (/rate.?limit|too.?many|429/.test(n)) return true;
  if (/timeout|timed out|socket|econn|network|fetch failed|enotfound|eai_again/.test(n)) return true;
  if (/\b5\d\d\b|internal|unavailable|bad gateway/.test(n)) return true;
  // Everything else — invalid recipient, unverified domain, bad key, missing
  // field — is a configuration or data problem that a second attempt repeats.
  return false;
}

async function attempt(args: SendArgs, html: string, text: string): Promise<Attempt> {
  // The Resend SDK does not throw on API errors — it returns { data, error }.
  // Ignoring that return value is how sends fail silently, which is the state
  // this file was originally written to fix; the check stays.
  const headers: Record<string, string> = {
    // Tells Gmail and others this is a one-off message rather than a campaign,
    // and suppresses auto-replies and out-of-office bounces back at us.
    "X-Entity-Ref-ID": `${args.kind}:${Date.now()}`,
    "Auto-Submitted": "auto-generated",
  };
  if (args.unsubscribe) {
    headers["List-Unsubscribe"] = `<mailto:${args.unsubscribe}?subject=Unsubscribe>`;
  }

  const { data, error } = await resend!.emails.send({
    from: FROM,
    to: args.to,
    subject: args.subject,
    html,
    // The part that matters most for deliverability, and the cheapest to add.
    text,
    ...(args.replyTo ? { replyTo: args.replyTo } : {}),
    headers,
    // Lets the provider dashboard break delivery down by message type, so a
    // problem specific to invitations is visible as one.
    tags: [{ name: "kind", value: args.kind.toLowerCase() }],
  });

  if (error) {
    const name = error.name ?? "resend_error";
    const message = error.message ?? "unknown";
    return { error: `${name}: ${message}`, retryable: isRetryable(name, message) };
  }
  return { id: data?.id };
}

/**
 * Send, with retries for transient failures only, and a log row for every
 * outcome. Returns success so callers can surface delivery state, but never
 * throws — email must not break sign-ups, RSVPs or payments.
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  if (!args.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(args.to)) {
    await record(args, "SKIPPED", undefined, args.to ? `Not a valid address: ${args.to}` : "No recipient address");
    return false;
  }

  if (!resend) {
    console.log(`[email:dev] RESEND_API_KEY not set — would send "${args.subject}" to ${args.to}`);
    await record(args, "SKIPPED", undefined, "RESEND_API_KEY not configured");
    return false;
  }

  // A misconfigured sender fails every message identically. Say so once, in
  // terms that name the fix, rather than logging a provider error per guest.
  const cfg = emailConfig();
  if (!cfg.ready) {
    const why = cfg.problems.join(" ");
    console.error(`[email] not configured for sending: ${why}`);
    await record(args, "SKIPPED", undefined, why);
    return false;
  }

  const html = renderHtml(args.message);
  const text = renderText(args.message);

  // Three attempts, backing off. Enough to ride out a rate limit or a blip,
  // few enough that a queued batch cannot stall on one address.
  const delays = [400, 1500];
  let result: Attempt = {};

  for (let i = 0; i <= delays.length; i++) {
    try {
      result = await attempt(args, html, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result = { error: msg, retryable: isRetryable("transport", msg) };
    }

    if (!result.error) {
      await record(args, "SENT", result.id);
      return true;
    }
    if (!result.retryable || i === delays.length) break;

    console.warn(`[email] transient failure, retrying in ${delays[i]}ms: ${result.error}`);
    await new Promise(r => setTimeout(r, delays[i]));
  }

  console.error(
    `[email] send failed to=${args.to} kind=${args.kind} retryable=${result.retryable ?? false}: ${result.error}`,
  );
  await record(args, "FAILED", undefined, result.error);
  return false;
}

/* -------------------------------------------------------------- messages -- */

const PLATFORM_COLOR = "#9D5C64";
const PLATFORM_REPLY_TO = process.env.EMAIL_REPLY_TO ?? null;

/**
 * Where platform notifications go.
 *
 * `ACCESS_REQUEST_TO` if set, otherwise the address inside `EMAIL_FROM` — which
 * is almost always the owner's own inbox and means notifications work out of
 * the box rather than needing a second variable nobody knows to set. Null when
 * neither is configured, in which case the request is still recorded and only
 * the nudge is lost.
 */
export const PLATFORM_INBOX: string | null = (() => {
  const explicit = process.env.ACCESS_REQUEST_TO?.trim();
  if (explicit) return explicit;
  const from = process.env.EMAIL_FROM ?? "";
  return from.match(/<([^>]+)>/)?.[1] ?? (from.includes("@") ? from.trim() : null);
})();

export const emails = {
  guestInvitation: (o: {
    to: string; guestName: string; couple: string; studio: string;
    color: string; link: string; studioId: string;
    /** The studio's own address, so a guest's reply reaches the planner. */
    studioEmail?: string | null;
    /** Letterhead: the studio's logo and typeface. See lib/branding.ts. */
    logo?: { src: string; width: number; height: number } | null;
    face?: string;
  }) =>
    sendEmail({
      to: o.to,
      kind: "GUEST_INVITATION",
      studioId: o.studioId,
      subject: `You're invited — ${o.couple}`,
      replyTo: o.studioEmail ?? PLATFORM_REPLY_TO,
      unsubscribe: o.studioEmail ?? PLATFORM_REPLY_TO,
      message: {
        brand: o.studio,
        color: o.color,
        logo: o.logo,
        face: o.face,
        preheader: `${o.guestName}, your personal invitation to ${o.couple} is ready.`,
        blocks: [
          { t: "p", text: `Dear ${o.guestName},` },
          { t: "p", text: `You are warmly invited to the wedding of ${o.couple}.` },
          { t: "p", text: "Your personal invitation includes the schedule for your day, directions, and a place to reply." },
          { t: "button", label: "Open your invitation", href: o.link },
          { t: "fallback", href: o.link },
        ],
        footnote: `You are receiving this because ${o.couple} added you to their guest list. Reply to this email to reach ${o.studio}.`,
      },
    }),

  rsvpConfirmation: (o: {
    to: string; guestName: string; couple: string; studio: string;
    color: string; status: string; studioId: string; studioEmail?: string | null;
    logo?: { src: string; width: number; height: number } | null;
    face?: string;
  }) =>
    sendEmail({
      to: o.to,
      kind: "RSVP_CONFIRMATION",
      studioId: o.studioId,
      subject: `RSVP received — ${o.couple}`,
      replyTo: o.studioEmail ?? PLATFORM_REPLY_TO,
      message: {
        brand: o.studio,
        color: o.color,
        logo: o.logo,
        face: o.face,
        preheader: `Your reply to ${o.couple} has been recorded.`,
        blocks: [
          { t: "p", text: `Thank you, ${o.guestName}.` },
          { t: "p", text: `Your response has been recorded for ${o.couple}.` },
          { t: "lines", items: [["Response", o.status.toLowerCase()]] },
          { t: "p", text: "If anything changes, open your invitation again and reply once more — the most recent answer is the one that counts." },
        ],
        footnote: `Reply to this email to reach ${o.studio}.`,
      },
    }),

  plannerInvite: (o: {
    to: string; ownerName: string; studio: string; link: string; studioId: string;
    /** Shown once, in this email, and never stored in plaintext anywhere. */
    tempPassword: string;
    /** One-time link that lets them set their own password without using the temporary one. */
    resetLink: string;
  }) =>
    sendEmail({
      to: o.to,
      kind: "PLANNER_INVITE",
      studioId: o.studioId,
      subject: `Your ${o.studio} studio is ready`,
      replyTo: PLATFORM_REPLY_TO,
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: `${o.studio} is set up and waiting for your first wedding.`,
        /**
         * The credential travels in this email.
         *
         * It used to say the password "was shared with you separately", which
         * was not true of any mechanism that existed — the admin saw it once on
         * screen and the planner received an email telling them to sign in with
         * something nobody had sent them.
         *
         * Emailing a temporary password is a real, accepted tradeoff rather
         * than an oversight: it is single-use in practice, it is bounded by the
         * invitation link's lifetime, and the alternative is a credential
         * handed over on the phone. The mitigation is the button above it — a
         * one-time link that sets a password of their own, so the temporary one
         * can go unused entirely.
         */
        blocks: [
          { t: "p", text: `Hi ${o.ownerName},` },
          { t: "p", text: `Your planner studio ${o.studio} has been created and is ready for its first wedding.` },
          { t: "button", label: "Set your password", href: o.resetLink },
          { t: "fallback", href: o.resetLink },
          { t: "p", text: "That link is good for seven days and can be used once." },
          { t: "rule" },
          { t: "p", text: "If you would rather sign in straight away, use this temporary password and change it from Settings:" },
          { t: "quote", text: o.tempPassword },
          { t: "button", label: "Sign in instead", href: o.link },
          { t: "fallback", href: o.link },
        ],
      },
    }),

  paymentReceipt: (o: { to: string; studio: string; desc: string; amount: string; studioId: string }) =>
    sendEmail({
      to: o.to,
      kind: "PAYMENT_RECEIPT",
      studioId: o.studioId,
      subject: `Receipt — ${o.desc}`,
      replyTo: PLATFORM_REPLY_TO,
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: `Payment received: ${o.amount}.`,
        blocks: [
          { t: "p", text: "Thank you — your payment has been received." },
          { t: "lines", items: [["Item", o.desc], ["Amount", o.amount]] },
          { t: "p", text: "A copy is kept on your Billing page." },
        ],
      },
    }),

  /**
   * A planner asking for a design outside the six templates.
   *
   * Goes to the platform inbox, not to the planner — they get an on-screen
   * acknowledgement instead, because the useful reply here is a person, not a
   * receipt. `replyTo` is unset deliberately: the request is attributed to a
   * studio the owner can already look up, and the conversation that follows is
   * usually a call about pricing rather than an email thread.
   */
  customDesignRequest: (o: {
    to: string; studio: string; studioId: string; actorName: string; note?: string;
  }) =>
    sendEmail({
      to: o.to,
      kind: "CUSTOM_DESIGN_REQUEST",
      studioId: o.studioId,
      subject: `Custom design request — ${o.studio}`,
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: `${o.studio} would like a custom wedding design.`,
        blocks: [
          { t: "p", text: `${o.actorName} at ${o.studio} has asked about a custom wedding design.` },
          ...(o.note ? ([{ t: "quote", text: o.note }] as const) : []),
          { t: "p", text: "They have been told an admin will contact them shortly." },
          { t: "button", label: "Open the activity log", href: `${(process.env.APP_URL ?? "").replace(/\/$/, "")}/admin/activity` },
        ],
      },
    }),

  accessRequest: (o: {
    to: string; name: string; email: string; company?: string | null;
    website?: string | null; volume?: string | null; message?: string | null; link: string;
  }) =>
    sendEmail({
      to: o.to,
      kind: "ACCESS_REQUEST",
      subject: `Access request — ${o.name}${o.company ? ` (${o.company})` : ""}`,
      // Replying to the notification should reach the person who asked.
      replyTo: o.email,
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: `${o.name}${o.company ? ` of ${o.company}` : ""} asked for access.`,
        blocks: [
          { t: "p", text: `${o.name} asked for access to EventOS.` },
          {
            t: "lines",
            items: [
              ["Email", o.email],
              ...(o.company ? ([["Studio", o.company]] as [string, string][]) : []),
              ...(o.website ? ([["Website", o.website]] as [string, string][]) : []),
              ...(o.volume ? ([["Weddings a year", o.volume]] as [string, string][]) : []),
            ],
          },
          ...(o.message ? ([{ t: "quote", text: o.message }] as const) : []),
          { t: "button", label: "Open the requests inbox", href: o.link },
        ],
      },
    }),

  accessRequestAck: (o: { to: string; name: string }) =>
    sendEmail({
      to: o.to,
      kind: "ACCESS_REQUEST_ACK",
      subject: "We have your request — EventOS",
      replyTo: PLATFORM_REPLY_TO,
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: "A person reads every request. You will hear back either way.",
        blocks: [
          { t: "p", text: `Hi ${o.name},` },
          { t: "p", text: "Thank you — we have your request for access to EventOS." },
          { t: "p", text: "We set up each studio by hand, so this is read by a person rather than a queue. You will hear back from us either way." },
        ],
      },
    }),

  passwordReset: (o: { to: string; name: string; link: string }) =>
    sendEmail({
      to: o.to,
      kind: "PASSWORD_RESET",
      subject: "Reset your EventOS password",
      replyTo: PLATFORM_REPLY_TO,
      // No List-Unsubscribe: offering to opt out of a security email is
      // nonsense, and filters treat one on a transactional message as noise.
      message: {
        brand: "EventOS",
        wordmark: true,
        color: PLATFORM_COLOR,
        preheader: "This link is valid for 60 minutes.",
        blocks: [
          { t: "p", text: `Hi ${o.name},` },
          { t: "p", text: "We received a request to reset your password. This link is valid for 60 minutes." },
          { t: "button", label: "Choose a new password", href: o.link },
          { t: "fallback", href: o.link },
          { t: "p", text: "If you did not request this, you can safely ignore this email — your password will not change." },
        ],
      },
    }),
};
