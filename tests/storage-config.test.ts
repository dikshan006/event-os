import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import {
  blobConfigured, s3Configured, storageConfigured, findBlobToken, storageEnvKeys,
} from "@/lib/storage-config";

vi.mock("server-only", () => ({}));

/**
 * Which environment counts as "storage is configured".
 *
 * This existed as three separate copies of the same rule, and the copy in
 * `/api/ready` had drifted: production reported `storage: false` while a
 * connected Vercel Blob store was working perfectly, because that copy looked
 * for `BLOB_READ_WRITE_TOKEN` and Vercel had injected `BLOB_STORE_ID` instead.
 *
 * A readiness probe that disagrees with the thing it probes is worse than no
 * probe — it sends an operator to fix something that was never broken. These
 * tests pin the rule so the three call sites cannot drift apart again.
 *
 * The predicates read `process.env` when called rather than at module load,
 * which is what makes this testable without re-importing the module registry
 * between cases.
 */

const ORIGINAL = { ...process.env };

/** Replace the environment wholesale, so no case leaks into the next. */
function env(vars: Record<string, string | undefined>) {
  const next: Record<string, string | undefined> = { ...ORIGINAL };
  // Anything storage-related from the ambient environment is cleared first,
  // or a developer with S3 vars in their shell gets different results to CI.
  for (const k of Object.keys(next)) {
    if (k.includes("BLOB") || k.startsWith("S3_")) delete next[k];
  }
  process.env = { ...next, ...vars } as NodeJS.ProcessEnv;
}

beforeEach(() => env({}));
afterAll(() => {
  process.env = ORIGINAL;
});

describe("Vercel Blob", () => {
  /**
   * The case that was reported wrong in production. On Vercel the SDK
   * authenticates over OIDC using the runtime's own identity, so a connected
   * store injects `BLOB_STORE_ID` and never issues a token.
   */
  it("BLOB_STORE_ID alone is a valid configuration", () => {
    env({ BLOB_STORE_ID: "store_abc123" });
    expect(blobConfigured()).toBe(true);
    expect(storageConfigured()).toBe(true);
  });

  it("BLOB_READ_WRITE_TOKEN alone is a valid configuration", () => {
    env({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_notarealtoken" });
    expect(blobConfigured()).toBe(true);
    expect(storageConfigured()).toBe(true);
  });

  /**
   * Entering an environment-variable *prefix* when connecting the store renames
   * the token, and a hard-coded lookup then finds nothing while the store sits
   * there working.
   */
  it("finds a prefixed token, e.g. PHOTOS_BLOB_READ_WRITE_TOKEN", () => {
    env({ PHOTOS_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_notarealtoken" });
    expect(findBlobToken()).toBeTruthy();
    expect(blobConfigured()).toBe(true);
    expect(storageConfigured()).toBe(true);
  });

  it("an unrelated variable containing BLOB does not count", () => {
    env({ BLOB_STORE_REGION: "iad1" });
    expect(blobConfigured()).toBe(false);
    expect(storageConfigured()).toBe(false);
  });
});

describe("S3-compatible", () => {
  const FULL = {
    S3_BUCKET: "eventos-photos",
    S3_ACCESS_KEY_ID: "AKIAEXAMPLENOTREAL00",
    S3_SECRET_ACCESS_KEY: "not-a-real-secret",
  };

  it("bucket plus both credentials is a valid configuration", () => {
    env(FULL);
    expect(s3Configured()).toBe(true);
    expect(storageConfigured()).toBe(true);
  });

  /**
   * The false positive the old readiness check would have produced. A bucket
   * name with nothing behind it is a leftover, not a configuration: the driver
   * would build and then fail on the first PutObject, moving the discovery of
   * the problem from a health check to a planner losing a photograph.
   */
  it("S3_BUCKET on its own is NOT configured", () => {
    env({ S3_BUCKET: FULL.S3_BUCKET });
    expect(s3Configured()).toBe(false);
    expect(storageConfigured()).toBe(false);
  });

  it("is not configured when either credential is missing", () => {
    env({ S3_BUCKET: FULL.S3_BUCKET, S3_ACCESS_KEY_ID: FULL.S3_ACCESS_KEY_ID });
    expect(s3Configured()).toBe(false);

    env({ S3_BUCKET: FULL.S3_BUCKET, S3_SECRET_ACCESS_KEY: FULL.S3_SECRET_ACCESS_KEY });
    expect(s3Configured()).toBe(false);

    env({ S3_ACCESS_KEY_ID: FULL.S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY: FULL.S3_SECRET_ACCESS_KEY });
    expect(s3Configured()).toBe(false);
  });

  it("treats an empty string as absent", () => {
    env({ ...FULL, S3_SECRET_ACCESS_KEY: "" });
    expect(s3Configured()).toBe(false);
    expect(storageConfigured()).toBe(false);
  });
});

describe("neither provider", () => {
  it("reports not configured", () => {
    env({});
    expect(blobConfigured()).toBe(false);
    expect(s3Configured()).toBe(false);
    expect(storageConfigured()).toBe(false);
  });
});

describe("both providers", () => {
  /**
   * `storage()` picks Blob when both are present, so the aggregate must agree.
   * Half-finished S3 variables left behind must not make the report disagree
   * with the driver that will actually be built.
   */
  it("reports configured, and both individual checks stay true", () => {
    env({
      BLOB_STORE_ID: "store_abc123",
      S3_BUCKET: "eventos-photos",
      S3_ACCESS_KEY_ID: "AKIAEXAMPLENOTREAL00",
      S3_SECRET_ACCESS_KEY: "not-a-real-secret",
    });
    expect(blobConfigured()).toBe(true);
    expect(s3Configured()).toBe(true);
    expect(storageConfigured()).toBe(true);
  });
});

describe("diagnostics", () => {
  /**
   * Names only. This output goes to a log drain, and its whole purpose is to
   * distinguish "no store was ever connected" from "a name we failed to match".
   */
  it("lists storage variable names and never their values", () => {
    env({ BLOB_STORE_ID: "store_abc123", S3_BUCKET: "eventos-photos" });
    const keys = storageEnvKeys();
    expect(keys).toContain("BLOB_STORE_ID");
    expect(keys).toContain("S3_BUCKET");
    expect(keys.join(" ")).not.toContain("store_abc123");
    expect(keys.join(" ")).not.toContain("eventos-photos");
  });

  it("is empty when nothing storage-related is set", () => {
    env({});
    expect(storageEnvKeys()).toEqual([]);
  });
});

/* ------------------------------------------------- the reported symptom --- */

describe("the production report", () => {
  /**
   * The regression, stated as the operator experienced it: Blob connected and
   * scoped to Production, `/api/ready` returning `storage: false`. `/api/ready`
   * now calls `storageConfigured()`, so this is the assertion that its answer
   * and the driver's answer are the same one.
   */
  it("a Blob store connected on Vercel reports configured", () => {
    env({ BLOB_STORE_ID: "store_abc123" });
    expect(
      storageConfigured(),
      "/api/ready must not report false for a working Blob store",
    ).toBe(true);
  });
});
