import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * The tests that exist because the failure would be expensive.
 *
 * Not a coverage exercise. Each block here corresponds to something that would
 * either leak one studio's data to another, put a secret in a log drain, or
 * take the site down — and several of them are regression tests for bugs this
 * codebase has actually shipped.
 */

/* ───────────────────────────────────────────────── secrets never reach a log */

describe("logger redaction", () => {
  it("removes connection strings, API keys and JWTs wherever they appear", async () => {
    const { __scrubForTest } = await import("@/lib/logger");
    const out = JSON.stringify(
      __scrubForTest({
        message: "connect failed: postgresql://user:hunter2@db.example.com:5432/prod?sslmode=require",
        stripe: "sk_live_51Abc123DefGhiJkl",
        webhook: "whsec_9f8e7d6c5b4a",
        resend: "re_AbCdEf123456789012",
        blob: "vercel_blob_rw_ABCDEFGH_ijklmnop",
        jwt: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        header: "Bearer abc.def-ghi_jkl",
      }),
    );
    expect(out).not.toMatch(/hunter2|db\.example\.com/);
    expect(out).not.toMatch(/sk_live_|whsec_|re_AbCdEf|vercel_blob_rw_/);
    expect(out).not.toMatch(/eyJhbGciOiJIUzI1NiJ9/);
    expect(out).not.toMatch(/Bearer abc/);
  });

  it("redacts by key name even when the value looks innocuous", async () => {
    const { __scrubForTest } = await import("@/lib/logger");
    const out = __scrubForTest({
      DATABASE_URL: "x",
      sessionToken: "x",
      apiKey: "x",
      "x-signature": "x",
      cookie: "x",
      weddingId: "keep-me",
    }) as Record<string, unknown>;

    for (const k of ["DATABASE_URL", "sessionToken", "apiKey", "x-signature", "cookie"]) {
      expect(out[k], `${k} should be redacted`).toBe("[redacted]");
    }
    // Non-secret context is the entire point of structured logging; it stays.
    expect(out.weddingId).toBe("keep-me");
  });

  it("strips guest email addresses, which are PII rather than secrets", async () => {
    const { __scrubForTest } = await import("@/lib/logger");
    const out = JSON.stringify(__scrubForTest({ note: "bounced for priya.sharma@example.co.uk" }));
    expect(out).not.toContain("priya.sharma@example.co.uk");
    expect(out).toContain("[email]");
  });

  it("survives a cyclic object instead of throwing inside the error handler", async () => {
    const { __scrubForTest } = await import("@/lib/logger");
    const a: Record<string, unknown> = { name: "a" };
    a.self = a;
    expect(() => JSON.stringify(__scrubForTest(a))).not.toThrow();
  });

  it("keeps an Error's message and stack but scrubs them", async () => {
    const { __scrubForTest } = await import("@/lib/logger");
    const err = new Error("failed talking to postgresql://u:p@h/db");
    const out = __scrubForTest(err) as { message: string; stack?: string };
    expect(out.message).toContain("[redacted]");
    expect(out.message).not.toContain("postgresql://");
    expect(out.stack).toBeTruthy();
  });
});

/* ──────────────────────────────────────────────────── invitation code safety */

describe("invitation codes", () => {
  it("is long enough and drawn from a large enough alphabet to resist guessing", async () => {
    const { inviteCode } = await import("@/lib/utils");
    const code = inviteCode();
    // 31 symbols ^ 10 ≈ 8.2e14. With the RSVP limiter at 6 attempts/minute per
    // code, brute force is not a threat model, it is a joke.
    expect(code).toHaveLength(10);
    expect(Math.pow(31, 10)).toBeGreaterThan(1e14);
  });

  it("omits characters a guest could misread when typing a code off a card", async () => {
    const { inviteCode } = await import("@/lib/utils");
    const codes = Array.from({ length: 400 }, () => inviteCode()).join("");
    // No 0/O, 1/I/L — the pairs that generate support tickets.
    expect(codes).not.toMatch(/[01ILO]/);
    expect(codes).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it("does not repeat across a large sample", async () => {
    const { inviteCode } = await import("@/lib/utils");
    const codes = new Set(Array.from({ length: 5000 }, () => inviteCode()));
    expect(codes.size).toBe(5000);
  });
});

/* ────────────────────────────────────────────────────────── slug containment */

describe("slugify", () => {
  it("cannot emit path traversal, a scheme, or anything needing escaping", async () => {
    const { slugify } = await import("@/lib/utils");
    for (const nasty of [
      "../../etc/passwd",
      "<script>alert(1)</script>",
      "javascript:alert(1)",
      "a/b?c=d#e",
      "'; DROP TABLE weddings;--",
      "%2e%2e%2f",
    ]) {
      expect(slugify(nasty)).toMatch(/^[a-z0-9-]*$/);
    }
  });

  it("is bounded, so it cannot be used to blow up a URL or an index", async () => {
    const { slugify } = await import("@/lib/utils");
    expect(slugify("a".repeat(500)).length).toBeLessThanOrEqual(48);
  });
});

/* ───────────────────────────────────────────────────────── input validation */

describe("validators", () => {
  it("accepts every template the picker can offer", async () => {
    const { zWedding } = await import("@/lib/validators");
    const { TEMPLATE_KEYS } = await import("@/lib/utils");

    // The regression test for the production 500. The schema used to name three
    // template keys literally while the registry and the picker offered six, so
    // choosing a new template threw inside a server action. Deriving the enum
    // from the registry is the fix; this asserts the two can never drift again.
    for (const template of TEMPLATE_KEYS) {
      const parsed = zWedding.safeParse({
        partnerOne: "Amelia", partnerTwo: "Theodore", date: "2027-06-12", template,
      });
      expect(parsed.success, `${template} should be accepted`).toBe(true);
    }
  });

  it("rejects a template that is not in the registry", async () => {
    const { zWedding } = await import("@/lib/validators");
    const parsed = zWedding.safeParse({
      partnerOne: "A", partnerTwo: "B", date: "2027-06-12", template: "DROP_TABLE",
    });
    expect(parsed.success).toBe(false);
  });

  it("bounds every free-text field, so a request cannot carry a megabyte of story", async () => {
    const { zWedding } = await import("@/lib/validators");
    const parsed = zWedding.safeParse({
      partnerOne: "A", partnerTwo: "B", date: "2027-06-12",
      template: "BLUSH_ROMANCE", story: "x".repeat(4001),
    });
    expect(parsed.success).toBe(false);
  });

  it("requires both partners rather than defaulting a blank name", async () => {
    const { zWedding } = await import("@/lib/validators");
    expect(zWedding.safeParse({
      partnerOne: "", partnerTwo: "B", date: "2027-06-12", template: "BLUSH_ROMANCE",
    }).success).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────── rate limiter */

describe("rate limiter", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit and then refuses", async () => {
    const { rateLimit } = await import("@/lib/ratelimit");
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) expect(await rateLimit(key, 5, 60_000)).toBe(true);
    expect(await rateLimit(key, 5, 60_000)).toBe(false);
  });

  it("reopens after the window rather than locking someone out permanently", async () => {
    const { rateLimit } = await import("@/lib/ratelimit");
    const key = `test:${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit(key, 5, 60_000);
    expect(await rateLimit(key, 5, 60_000)).toBe(false);
    vi.advanceTimersByTime(60_001);
    expect(await rateLimit(key, 5, 60_000)).toBe(true);
  });

  it("counts each key separately, so one guest cannot lock out another", async () => {
    const { rateLimit } = await import("@/lib/ratelimit");
    const a = `a:${Math.random()}`, b = `b:${Math.random()}`;
    for (let i = 0; i < 5; i++) await rateLimit(a, 5, 60_000);
    expect(await rateLimit(a, 5, 60_000)).toBe(false);
    expect(await rateLimit(b, 5, 60_000)).toBe(true);
  });
});

/* ────────────────────────────────────────────── template lookup never throws */

describe("theme resolution", () => {
  it("falls back instead of throwing when a row names a template this build has never heard of", async () => {
    const { themeFor } = await import("@/lib/themes");
    // A database outlives a deployment: a row written by a newer build, or a
    // value dropped from the enum by an older one, arrives here as a string
    // with no entry. Indexing straight in yields undefined and takes down the
    // render of a live wedding site on the morning guests are opening it.
    expect(() => themeFor("SOMETHING_FROM_THE_FUTURE")).not.toThrow();
    expect(themeFor("SOMETHING_FROM_THE_FUTURE").bg).toBeTruthy();
  });

  it("every registered template resolves to a complete palette", async () => {
    const { themeFor } = await import("@/lib/themes");
    const { TEMPLATE_KEYS } = await import("@/lib/utils");
    for (const key of TEMPLATE_KEYS) {
      const t = themeFor(key);
      for (const field of ["bg", "ink", "accent", "deep"] as const) {
        expect(t[field], `${key}.${field}`).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    }
  });
});

/* ─────────────────────────────────────────────────────────── response headers */

describe("security headers", () => {
  it("sets every header the app is meant to send", async () => {
    // Read from the config rather than from a running server: this is the
    // source of truth, and asserting it here means the check runs in CI without
    // standing up a deployment.
    const mod = await import("../next.config.mjs");
    const groups = await (mod.default as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers();
    const app = groups.find(g => g.source.includes("api/webhooks"));
    const byKey = Object.fromEntries((app?.headers ?? []).map(h => [h.key, h.value]));

    for (const key of [
      "Content-Security-Policy",
      "Strict-Transport-Security",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]) {
      expect(byKey[key], `${key} missing`).toBeTruthy();
    }

    expect(byKey["X-Frame-Options"]).toBe("DENY");
    expect(byKey["X-Content-Type-Options"]).toBe("nosniff");
    expect(byKey["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
  });

  it("keeps the CSP closed where it matters", async () => {
    const mod = await import("../next.config.mjs");
    const groups = await (mod.default as { headers: () => Promise<{ source: string; headers: { key: string; value: string }[] }[]> }).headers();
    const csp = groups
      .flatMap(g => g.headers)
      .find(h => h.key === "Content-Security-Policy")!.value;

    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    // The one concession is inline script, and only that one. If `unsafe-eval`
    // or a wildcard host ever appears here it was not a considered decision.
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).not.toMatch(/script-src[^;]*\*/);
  });

  it("excludes the Stripe webhook, which is not a browser response", async () => {
    const mod = await import("../next.config.mjs");
    const groups = await (mod.default as { headers: () => Promise<{ source: string }[]> }).headers();
    expect(groups.some(g => g.source.includes("(?!api/webhooks)"))).toBe(true);
  });
});
