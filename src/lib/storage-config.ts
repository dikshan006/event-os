import "server-only";

/**
 * Whether object storage is configured — the single definition.
 *
 * This existed in three places and one of them was wrong. `lib/storage.ts`
 * decides which driver to build, `lib/env.ts` decides whether to warn at boot,
 * and `/api/ready` decides what to report — and the readiness route's copy had
 * drifted: it looked for `BLOB_READ_WRITE_TOKEN` but not `BLOB_STORE_ID`, and
 * accepted `S3_BUCKET` alone without the credentials that go with it.
 *
 * That drift is worse than a cosmetic bug. `/api/ready` is what an operator
 * consults to answer "is this deployment configured", so a false negative sends
 * someone to reconfigure a store that was already working, and a false positive
 * would tell them storage was fine right up until the first upload failed. A
 * probe that disagrees with the thing it is probing is worse than no probe.
 *
 * Deliberately in its own module with **no SDK imports**. `lib/storage.ts`
 * pulls in `@aws-sdk/client-s3` and `@vercel/blob`; a readiness endpoint should
 * not have to load a storage client in order to answer a question about
 * environment variables.
 *
 * Every function reads `process.env` when called rather than at module load, so
 * the behaviour is testable without module-registry gymnastics. `storage.ts`
 * still snapshots the result into its own constants at import, which is what it
 * did before and what its callers expect.
 */

/**
 * Find the Blob token however Vercel chose to name it.
 *
 * Connecting a store normally injects `BLOB_READ_WRITE_TOKEN`, but if an
 * environment-variable *prefix* was entered during setup the name becomes
 * `<PREFIX>_BLOB_READ_WRITE_TOKEN` — at which point a hard-coded lookup finds
 * nothing and the app reports "not configured" while the store sits there
 * perfectly connected. Matching on the suffix removes that whole failure mode.
 */
export function findBlobToken(): string | undefined {
  const exact = process.env.BLOB_READ_WRITE_TOKEN;
  if (exact) return exact;
  const key = Object.keys(process.env).find(k => k.endsWith("BLOB_READ_WRITE_TOKEN"));
  return key ? process.env[key] : undefined;
}

/**
 * A connected Blob store does not necessarily mean a token.
 *
 * Running on Vercel, the SDK authenticates over OIDC using the injected
 * `BLOB_STORE_ID` and the runtime's own identity token; `BLOB_READ_WRITE_TOKEN`
 * is only issued for code running *outside* Vercel. Gating on the token alone
 * therefore rejects a perfectly working store — which is exactly the false
 * negative `/api/ready` was reporting in production.
 */
export const blobConfigured = (): boolean =>
  Boolean(findBlobToken() || process.env.BLOB_STORE_ID);

/**
 * All three, or none.
 *
 * A bucket name without credentials is not a configuration, it is a leftover.
 * The S3 driver would be built and then fail on the first `PutObject`, so
 * reporting it as configured moves the discovery of the problem from a health
 * check to a planner losing a photograph.
 */
export const s3Configured = (): boolean =>
  Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );

/** What `storage()` will find a driver for. Blob wins when both are present. */
export const storageConfigured = (): boolean => blobConfigured() || s3Configured();

/**
 * Names of the storage-related variables actually present — for diagnostics
 * only, never values. Either the list is empty (no store was ever connected to
 * this project) or it shows a name we failed to match.
 */
export function storageEnvKeys(): string[] {
  return Object.keys(process.env)
    .filter(k => k.includes("BLOB") || k.startsWith("S3_"))
    .sort();
}
