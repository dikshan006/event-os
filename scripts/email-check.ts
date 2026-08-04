/**
 * Preflight for outbound email.
 *
 *   npm run email:check
 *
 * Prints what is configured and what is missing, in the terms the fix is
 * expressed in. Cheaper than discovering a misconfiguration by way of a guest
 * who never received an invitation.
 */
import { emailConfig } from "../src/lib/email";

const c = emailConfig();

console.log("\n  EventOS — email configuration\n");
console.log(`  provider      ${c.provider}`);
console.log(`  from          ${c.from}`);
console.log(`  from address  ${c.fromAddress ?? "—"}`);
console.log(`  from domain   ${c.fromDomain ?? "—"}   ← this is the domain that must be verified in Resend`);
console.log(`  reply-to      ${process.env.EMAIL_REPLY_TO ?? "— (falls back to From)"}`);
console.log(`  app url       ${process.env.APP_URL ?? "—"}`);

if (c.problems.length) {
  console.log("\n  Problems — sending will not work until these are fixed:\n");
  c.problems.forEach(p => console.log(`   ✗ ${p}`));
}
if (c.warnings.length) {
  console.log("\n  Warnings:\n");
  c.warnings.forEach(p => console.log(`   ! ${p}`));
}
if (c.ready) {
  console.log("\n  ✓ Ready to send.");
  console.log("    DNS is not checked from here — confirm SPF, DKIM and DMARC all PASS");
  console.log("    in Gmail's “Show original” on a real message. See EMAIL.md.\n");
} else {
  console.log("\n  See EMAIL.md for the DNS records and environment variables.\n");
  process.exit(1);
}
