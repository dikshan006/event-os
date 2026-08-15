import type { Metadata } from "next";
import { LegalDocument } from "@/components/marketing/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const DOC = LEGAL_DOCUMENTS.PRIVACY;

export const metadata: Metadata = {
  title: "Privacy Policy — EventOS",
  description: "What data EventOS holds, why, and who it is shared with.",
  robots: { index: true, follow: true },
};

/**
 * Public, for the same reasons as the terms.
 *
 * The sub-processor list below is the real one, taken from what the code
 * actually calls: Neon for the database, Vercel for hosting, Resend for email,
 * Vercel Blob or S3 for uploads, Upstash for rate limiting, Stripe for
 * payments. If an integration is added or removed, this list and
 * `PRIVACY_VERSION` in `src/lib/legal.ts` both need to move.
 */
export default function PrivacyPage() {
  return (
    <LegalDocument title={DOC.title} version={DOC.version} effective={DOC.effective}>
      <h2>1. Two kinds of people</h2>
      <p>
        This policy covers two groups, and they are treated differently.
      </p>
      <p>
        <b>Planners</b> hold an EventOS account. We are the controller of their account
        data: we decide what to collect and why.
      </p>
      <p>
        <b>Guests</b> never hold an account. Their details are entered by the planner who
        invited them. For that data the planner is the controller and we are the
        processor — we hold and process it on their instructions, not our own.
      </p>

      <h2>2. What we hold about planners</h2>
      <ul>
        <li>Name, email address and password (stored only as a bcrypt hash — we cannot read it).</li>
        <li>Studio details you enter: name, contact email and phone, website, social handle, logo and brand colour.</li>
        <li>Sign-in activity: the time of your last sign-in, and a record of failed sign-in attempts used to stop password guessing.</li>
        <li>A log of significant actions taken in your account, so you and we can see what happened and when.</li>
        <li>Billing records: what was charged, when, and the plan it was charged on.</li>
        <li>Which version of these documents you accepted, and when.</li>
        <li>Support tickets you open, and the messages in them.</li>
      </ul>

      <h2>3. What we hold about guests</h2>
      <ul>
        <li>Name, and email address or phone number where the planner has entered one.</li>
        <li>The groups the planner has assigned them to.</li>
        <li>Their invitation code — an unguessable string that acts as their personal link.</li>
        <li>Their RSVP: whether they are coming, meal choice, dietary notes and any message they leave.</li>
        <li>Their seat, where the planner has arranged seating.</li>
        <li>A record of invitations sent to them and whether delivery succeeded.</li>
      </ul>
      <p>
        Guests are not asked to create an account, are not given a password, and are not
        tracked across sites.
      </p>

      <h2>4. Why we hold it</h2>
      <p>
        To run the service: to let planners sign in and manage their events, to send the
        invitations they ask us to send, to publish the websites they build, to take
        payment where a plan requires it, and to keep the platform secure.
      </p>
      <p>
        We do not sell personal data. We do not use guest data to market anything to
        guests. We do not run advertising.
      </p>

      <h2>5. Who else processes it</h2>
      <p>
        EventOS runs on services provided by other companies. Each one processes data
        only to provide its part of the service:
      </p>
      <ul>
        <li><b>Vercel</b> — hosting and delivery of the application.</li>
        <li><b>Neon</b> — the PostgreSQL database where account, wedding and guest records are stored.</li>
        <li><b>Resend</b> — sending invitations, password resets and notifications.</li>
        <li><b>Vercel Blob</b> or an S3-compatible provider — storing uploaded photographs and logos.</li>
        <li><b>Upstash</b> — the shared counters behind rate limiting.</li>
        <li><b>Stripe</b> — payment processing where a plan requires payment. Card details are entered on Stripe&rsquo;s systems and are never seen or stored by EventOS.</li>
      </ul>

      <h2>6. Uploaded files</h2>
      <p>
        Photographs and logos are stored at addresses that cannot be guessed. A
        published wedding website is public by design, so images used on it are
        reachable by anyone holding the link. Do not upload anything to a published
        wedding that you would not want a guest to be able to share.
      </p>

      <h2>7. How long we keep it</h2>
      <p>
        Account and event data is kept while the account is open. When a studio is
        deleted, its weddings, guests, events, photographs, uploaded files and email
        records are deleted with it. Records of what version of these documents were
        accepted are deleted with the account too.
      </p>
      <p>
        A record of platform-level actions is kept after deletion without the account
        attached to it, so that we retain an account of what the platform did.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are hashed with bcrypt and never stored in readable form. Sessions are
        signed, expire after twelve hours, and can be revoked — resetting a password
        signs out every other session immediately. Each studio&rsquo;s data is separated
        at the query level. Traffic is encrypted in transit. Rate limits protect sign-in,
        password reset and invitation sending.
      </p>
      <p>
        No system is perfectly secure, and we do not claim otherwise.
      </p>

      <h2>9. Your rights</h2>
      <p>
        Depending on where you live, you may have the right to see the personal data we
        hold about you, to have it corrected, to have it deleted, or to object to how it
        is used. Contact us through the Help Center in your account.
      </p>
      <p>
        If you are a <b>guest</b> and want your details changed or removed, ask the planner
        who invited you — the data is theirs and they can edit or delete it directly. If
        you cannot reach them, contact us and we will help.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We may publish a new version. When we make a material change we will ask planners
        to accept the new version the next time they sign in. Each version carries a
        version number and an effective date.
      </p>

      <h2>11. Contact</h2>
      <p>
        Open a ticket from the Help Center inside your EventOS account, or reply to any
        email we have sent you.
      </p>
    </LegalDocument>
  );
}
