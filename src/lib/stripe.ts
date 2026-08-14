import Stripe from "stripe";

export const stripeEnabled = !!process.env.STRIPE_SECRET_KEY;
export const stripe = stripeEnabled
  ? new Stripe(process.env.STRIPE_SECRET_KEY as string)
  : (null as unknown as Stripe);

/**
 * Is this the deployment real customers use?
 *
 * The distinction exists because "Stripe is not configured" has to mean two
 * opposite things. Locally and on preview it means "skip the payment step so
 * the flow can be exercised", which is a convenience. In front of paying
 * customers it means the paywall is missing, and the convenience becomes a
 * product being given away while the billing history records a payment that
 * never happened.
 *
 * Deliberately fail-closed. An unrecognised or absent `VERCEL_ENV` is treated
 * as live whenever the build is a production build, so the dangerous direction
 * requires an explicit opt-out rather than happening by omission — a variable
 * that fails to arrive should cost a publish, not a payment.
 *
 * One consequence worth knowing: `next build && next start` on a laptop counts
 * as live, so publishing there without Stripe keys is refused. That is the
 * correct answer for a production build, and `next dev` is unaffected.
 */
const NON_LIVE_ENVIRONMENTS = new Set(["preview", "development"]);

export function isLiveDeployment() {
  const vercelEnv = process.env.VERCEL_ENV;
  return vercelEnv
    ? !NON_LIVE_ENVIRONMENTS.has(vercelEnv)
    : process.env.NODE_ENV === "production";
}

/**
 * True when money cannot be taken but the environment expects that it can.
 *
 * A function rather than a constant so it reads the environment when it is
 * asked rather than when the module was first imported — which is what lets a
 * test cover both answers without reloading modules, and keeps a serverless
 * instance from carrying a stale verdict across a configuration change.
 */
export function billingUnavailableInProduction() {
  return !stripeEnabled && isLiveDeployment();
}
