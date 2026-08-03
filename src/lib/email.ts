import { Resend } from "resend";
import { prisma } from "@/lib/db";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ?? "EventOS <onboarding@resend.dev>";

export type EmailKind =
  | "GUEST_INVITATION" | "RSVP_CONFIRMATION" | "PLANNER_INVITE"
  | "PAYMENT_RECEIPT" | "PASSWORD_RESET";

type SendArgs = { to: string; subject: string; html: string; kind: EmailKind; studioId?: string };

/** Best-effort persistence — an EmailLog failure must never break the main flow. */
async function record(args: SendArgs, status: "SENT" | "FAILED" | "SKIPPED", provider?: string, error?: string) {
  try {
    await prisma.emailLog.create({
      data: { studioId: args.studioId ?? null, kind: args.kind, toEmail: args.to, subject: args.subject, status, provider, error },
    });
  } catch (e) {
    console.error("[email] failed to write EmailLog", e);
  }
}

async function attempt(args: SendArgs): Promise<{ id?: string; error?: string }> {
  // ROOT CAUSE of "emails not received": the Resend SDK does NOT throw on API
  // errors — it returns { data, error }. The previous code ignored the return
  // value, so unverified domains / bad senders failed 100% silently.
  const { data, error } = await resend!.emails.send({ from: FROM, to: args.to, subject: args.subject, html: args.html });
  if (error) return { error: `${error.name ?? "resend_error"}: ${error.message ?? "unknown"}` };
  return { id: data?.id };
}

/**
 * Send with verification, one retry on failure, and a persisted log row for
 * every outcome. Returns success so callers can surface delivery state, but
 * never throws — email must not break sign-ups, RSVPs, or payments.
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  if (!args.to) { await record(args, "SKIPPED", undefined, "No recipient address"); return false; }
  if (!resend) {
    console.log(`[email:dev] RESEND_API_KEY not set — would send "${args.subject}" to ${args.to}`);
    await record(args, "SKIPPED", undefined, "RESEND_API_KEY not configured");
    return false;
  }
  try {
    let result = await attempt(args);
    if (result.error) {
      console.error(`[email] send failed (will retry once): ${result.error}`);
      await new Promise(r => setTimeout(r, 500));
      result = await attempt(args);
    }
    if (result.error) {
      console.error(`[email] send failed permanently to=${args.to} kind=${args.kind}: ${result.error}`);
      await record(args, "FAILED", undefined, result.error);
      return false;
    }
    await record(args, "SENT", result.id);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[email] transport error to=${args.to} kind=${args.kind}: ${msg}`);
    await record(args, "FAILED", undefined, msg);
    return false;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const shell = (brand: string, color: string, body: string) => `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:32px;color:#211E1B">
    <div style="text-align:center;letter-spacing:.3em;font-size:11px;color:${color};text-transform:uppercase">${esc(brand)}</div>
    <div style="margin-top:24px;font-size:15px;line-height:1.7">${body}</div>
    <div style="margin-top:32px;text-align:center;font-size:10px;letter-spacing:.25em;color:#A9A199;text-transform:uppercase">Designed by ${esc(brand)}</div>
  </div>`;

export const emails = {
  guestInvitation: (o: { to: string; guestName: string; couple: string; studio: string; color: string; link: string; studioId: string }) =>
    sendEmail({
      to: o.to, kind: "GUEST_INVITATION", studioId: o.studioId,
      subject: `You're invited \u2014 ${o.couple}`,
      html: shell(o.studio, o.color,
        `Dear ${esc(o.guestName)},<br/><br/>You are warmly invited to the wedding of <b>${esc(o.couple)}</b>.<br/><br/>
         Your personal invitation \u2014 with a schedule made just for you \u2014 is here:<br/>
         <a href="${o.link}" style="color:${o.color}">${o.link}</a>`),
    }),

  rsvpConfirmation: (o: { to: string; guestName: string; couple: string; studio: string; color: string; status: string; studioId: string }) =>
    sendEmail({
      to: o.to, kind: "RSVP_CONFIRMATION", studioId: o.studioId,
      subject: `RSVP received \u2014 ${o.couple}`,
      html: shell(o.studio, o.color,
        `Thank you, ${esc(o.guestName)}. Your response (<b>${esc(o.status.toLowerCase())}</b>) has been recorded for ${esc(o.couple)}.`),
    }),

  plannerInvite: (o: { to: string; ownerName: string; studio: string; link: string; studioId: string }) =>
    sendEmail({
      to: o.to, kind: "PLANNER_INVITE", studioId: o.studioId,
      subject: `Your ${o.studio} studio is ready`,
      html: shell("EventOS", "#9D5C64",
        `Hi ${esc(o.ownerName)},<br/><br/>Your planner studio <b>${esc(o.studio)}</b> has been created.<br/>
         Sign in here to set up your first wedding: <a href="${o.link}">${o.link}</a><br/><br/>
         Your temporary password was shared by the platform owner \u2014 change it after first login.`),
    }),

  paymentReceipt: (o: { to: string; studio: string; desc: string; amount: string; studioId: string }) =>
    sendEmail({
      to: o.to, kind: "PAYMENT_RECEIPT", studioId: o.studioId,
      subject: `Receipt \u2014 ${o.desc}`,
      html: shell("EventOS", "#9D5C64",
        `Payment received for <b>${esc(o.desc)}</b>: ${esc(o.amount)}. A copy is stored in your Billing page.`),
    }),

  passwordReset: (o: { to: string; name: string; link: string }) =>
    sendEmail({
      to: o.to, kind: "PASSWORD_RESET",
      subject: "Reset your EventOS password",
      html: shell("EventOS", "#9D5C64",
        `Hi ${esc(o.name)},<br/><br/>We received a request to reset your password. This link is valid for 60 minutes:<br/>
         <a href="${o.link}">${o.link}</a><br/><br/>If you didn't request this, you can safely ignore this email.`),
    }),
};
