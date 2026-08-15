import type { Metadata } from "next";
import { LegalDocument } from "@/components/marketing/LegalDocument";
import { LEGAL_DOCUMENTS } from "@/lib/legal";

const DOC = LEGAL_DOCUMENTS.TERMS;

export const metadata: Metadata = {
  title: "Terms of Service — EventOS",
  description: "The terms under which planners use EventOS.",
  robots: { index: true, follow: true },
};

/**
 * Public, deliberately.
 *
 * A planner has to be able to read this *before* agreeing to it, from a screen
 * that has not yet let them in — so it cannot sit behind the gate it is part
 * of. It is also a document a prospective customer should be able to read
 * before signing up at all.
 *
 * Every statement below was written from the behaviour in this repository:
 * multi-tenant studios, guest data held on the planner's behalf, the named
 * sub-processors, and what `deletePlanner()` actually removes. Nothing here
 * describes a feature that does not exist.
 */
export default function TermsPage() {
  return (
    <LegalDocument title={DOC.title} version={DOC.version} effective={DOC.effective}>
      <h2>1. Who this agreement is between</h2>
      <p>
        These terms are between EventOS (&ldquo;we&rdquo;, &ldquo;us&rdquo;) and the
        professional event planner or planning studio that holds an EventOS account
        (&ldquo;you&rdquo;). They cover your use of the EventOS planner application and
        the wedding websites it publishes on your behalf.
      </p>
      <p>
        They do not cover your guests. A guest who opens an invitation link is not a
        party to this agreement and is not asked to accept it.
      </p>

      <h2>2. Accounts</h2>
      <p>
        EventOS accounts are created by us for one studio at a time. You are
        responsible for the security of your account, for the accuracy of the details
        you enter, and for everything done through it.
      </p>
      <p>
        Your account is issued to your studio. Each studio&rsquo;s data is separated
        from every other studio&rsquo;s, and you may only access your own.
      </p>

      <h2>3. What you may use EventOS for</h2>
      <p>
        You may use EventOS to plan and publish events you have been engaged to run:
        building wedding websites, managing guest lists, sending invitations,
        collecting RSVPs, arranging seating and schedules, and maintaining a gift
        registry.
      </p>
      <p>You may not use EventOS to:</p>
      <ul>
        <li>send unsolicited mail to people who have not given you their address for this purpose;</li>
        <li>upload content you do not have the right to publish;</li>
        <li>impersonate anyone, or misrepresent who is sending an invitation;</li>
        <li>attempt to access another studio&rsquo;s data, or to circumvent any access control;</li>
        <li>resell access to EventOS itself.</li>
      </ul>

      <h2>4. Your content</h2>
      <p>
        Photographs, wording, guest lists and everything else you put into EventOS
        remain yours. You grant us only the permission needed to operate the service:
        to store that content, process it, and display it on the wedding websites and
        in the emails you ask us to send.
      </p>
      <p>
        You confirm that you have the right to upload what you upload, including
        photographs taken by someone else, and that you have a lawful basis for giving
        us the guest details you enter.
      </p>

      <h2>5. Guest data</h2>
      <p>
        The guest information you enter is yours, not ours. We hold and process it on
        your instructions, in order to send the invitations you send and to run the
        websites you publish. We do not sell it, and we do not use it to market
        anything to your guests.
      </p>
      <p>
        You are responsible for telling your guests what you are doing with their
        details, and for having a lawful basis for doing it.
      </p>

      <h2>6. Invitations and email</h2>
      <p>
        Invitations are sent from a domain we control, on your studio&rsquo;s behalf and
        carrying your studio&rsquo;s name. Sending limits apply to protect delivery for
        every studio on the platform: invitations to any one guest are limited to three
        per hour, and bulk sends are paced.
      </p>
      <p>
        We record the outcome of every send. We cannot guarantee delivery, because
        whether a message reaches an inbox is decided by the recipient&rsquo;s mail
        provider and not by us.
      </p>

      <h2>7. Publishing and payment</h2>
      <p>
        Publishing a wedding makes its website publicly reachable. Depending on your
        studio&rsquo;s plan, publishing may be included in a subscription, covered by a
        free first wedding, or charged per published wedding at the price shown to you
        before you confirm.
      </p>
      <p>
        Prices are set by us and shown in your account. If we change a price, the change
        applies to future charges; it does not alter a subscription you are already on
        or a wedding you have already paid to publish.
      </p>

      <h2>8. Availability</h2>
      <p>
        We aim to keep EventOS available and working, but we do not promise
        uninterrupted service. We may change or remove features, and we will not remove
        something you depend on without notice where we can avoid it.
      </p>

      <h2>9. Ending the agreement</h2>
      <p>
        You may stop using EventOS at any time and ask us to close your account. We may
        suspend or close an account that breaches these terms.
      </p>
      <p>
        When a studio account is deleted, its weddings, guests, events, photographs and
        uploaded files are deleted with it. Published wedding websites stop working.
        This cannot be undone, so export anything you want to keep first.
      </p>

      <h2>10. Liability</h2>
      <p>
        EventOS is provided as it is. To the extent the law allows, we are not liable
        for indirect or consequential loss, for lost profit, or for content you or your
        guests put into the service. Nothing here limits liability that cannot lawfully
        be limited.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We may publish a new version of these terms. When we make a material change, we
        will ask you to accept the new version the next time you sign in, and you will
        need to accept it before continuing to use your account. Each version carries a
        version number and an effective date, and we keep a record of which version you
        accepted and when.
      </p>

      <h2>12. Contact</h2>
      <p>
        Open a ticket from the Help Center inside your EventOS account, or reply to any
        email we have sent you.
      </p>
    </LegalDocument>
  );
}
