import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

/* ─────────────────────────────────────────────────────── progressive lockout */

describe("login throttling", () => {
  beforeEach(async () => {
    vi.resetModules();
    const { __clearForTest } = await import("@/lib/ratelimit");
    __clearForTest();
  });

  it("costs nothing for the first few mistypes", async () => {
    const { gateLogin, LOCKOUT_LIMITS } = await import("@/lib/lockout");
    const subject = `s${Math.random()}`;
    for (let i = 0; i < LOCKOUT_LIMITS.ACCOUNT_SOFT; i++) {
      const gate = await gateLogin(subject, "203.0.113.5");
      expect(gate.allow).toBe(true);
      if (gate.allow) expect(gate.delayMs).toBe(0);
    }
  });

  it("escalates the delay once past the soft threshold", async () => {
    const { gateLogin, LOCKOUT_LIMITS } = await import("@/lib/lockout");
    const subject = `s${Math.random()}`;
    const delays: number[] = [];
    for (let i = 0; i < LOCKOUT_LIMITS.ACCOUNT_HARD; i++) {
      const gate = await gateLogin(subject, "203.0.113.6");
      if (gate.allow) delays.push(gate.delayMs);
    }
    const climbing = delays.filter(d => d > 0);
    expect(climbing.length).toBeGreaterThan(0);
    // strictly increasing, and bounded so a request cannot outlive the function
    for (let i = 1; i < climbing.length; i++) expect(climbing[i]).toBeGreaterThan(climbing[i - 1]);
    expect(Math.max(...climbing)).toBeLessThanOrEqual(4000);
  });

  it("refuses outright at the hard limit, with a retry-after", async () => {
    const { gateLogin, LOCKOUT_LIMITS } = await import("@/lib/lockout");
    const subject = `s${Math.random()}`;
    for (let i = 0; i < LOCKOUT_LIMITS.ACCOUNT_HARD; i++) await gateLogin(subject, "203.0.113.7");
    const gate = await gateLogin(subject, "203.0.113.7");
    expect(gate.allow).toBe(false);
    if (!gate.allow) {
      expect(gate.reason).toBe("account");
      expect(gate.retryAfter).toBeGreaterThan(0);
    }
  });

  it("stops credential stuffing, which the per-account counter cannot see", async () => {
    // One password against many accounts: every account sees a single failure,
    // so only the per-address counter can catch it.
    const { gateLogin, LOCKOUT_LIMITS } = await import("@/lib/lockout");
    const ip = "198.51.100.9";
    let refused = false;
    for (let i = 0; i < LOCKOUT_LIMITS.IP_HARD + 2; i++) {
      const gate = await gateLogin(`victim-${i}`, ip);
      if (!gate.allow) { expect(gate.reason).toBe("address"); refused = true; break; }
    }
    expect(refused, "an address spraying many accounts must be stopped").toBe(true);
  });

  it("clears both counters on success, so one typo is not carried forward", async () => {
    const { gateLogin, clearLoginFailures } = await import("@/lib/lockout");
    const subject = `s${Math.random()}`;
    const ip = "203.0.113.8";
    for (let i = 0; i < 8; i++) await gateLogin(subject, ip);
    await clearLoginFailures(subject, ip);
    const gate = await gateLogin(subject, ip);
    expect(gate.allow).toBe(true);
    if (gate.allow) expect(gate.delayMs).toBe(0);
  });

  it("never locks an account permanently — a hard lock is itself a denial of service", async () => {
    const { LOCKOUT_LIMITS } = await import("@/lib/lockout");
    // Anyone who knows a planner's address could otherwise lock them out of
    // their own studio on the morning of a wedding, at will.
    expect(LOCKOUT_LIMITS.ACCOUNT_WINDOW_MS).toBeLessThanOrEqual(60 * 60_000);
  });
});

/* ────────────────────────────────────────────────── security event hygiene */

describe("security events", () => {
  it("pseudonymises addresses rather than storing them", async () => {
    const { pseudonymise } = await import("@/server/services/security-events");
    const hash = await pseudonymise("Priya.Sharma@Example.com");
    expect(hash).not.toContain("@");
    expect(hash).not.toContain("priya");
    expect(hash).toHaveLength(12);
    // Stable, so events correlate to one account across a log...
    expect(await pseudonymise("priya.sharma@example.com")).toBe(hash);
    // ...and distinct for a different address.
    expect(await pseudonymise("someone.else@example.com")).not.toBe(hash);
  });

  it("coarsens an IP to a network rather than a person", async () => {
    const { coarsenIp } = await import("@/server/services/security-events");
    expect(coarsenIp("203.0.113.47")).toBe("203.0.113.0");
    expect(coarsenIp("203.0.113.47, 70.41.3.18")).toBe("203.0.113.0");
    expect(coarsenIp("2001:db8:1:2::1")).toBe("2001:db8:1::");
  });
});

/* ─────────────────────────────────────────────────────── retry and fallback */

describe("withRetry", () => {
  it("retries a timeout and succeeds", async () => {
    const { withRetry } = await import("@/lib/monitoring");
    let calls = 0;
    const result = await withRetry(async () => {
      calls++;
      if (calls < 3) throw Object.assign(new Error("fetch failed"), { name: "TypeError" });
      return "ok";
    }, { baseMs: 1 });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a 4xx, which is the same answer however often it is asked", async () => {
    const { withRetry } = await import("@/lib/monitoring");
    let calls = 0;
    await expect(withRetry(async () => {
      calls++;
      throw Object.assign(new Error("bad request"), { status: 422 });
    }, { baseMs: 1 })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it("retries a 429 and a 503", async () => {
    const { withRetry } = await import("@/lib/monitoring");
    for (const status of [429, 503]) {
      let calls = 0;
      await expect(withRetry(async () => {
        calls++;
        throw Object.assign(new Error("busy"), { status });
      }, { attempts: 2, baseMs: 1 })).rejects.toThrow();
      expect(calls, `status ${status} should be retried`).toBe(2);
    }
  });

  it("jitters, so a herd does not retry in lockstep after an outage", async () => {
    const { withRetry } = await import("@/lib/monitoring");
    const waits: number[] = [];
    const spy = vi.spyOn(globalThis, "setTimeout").mockImplementation(((fn: () => void, ms?: number) => {
      waits.push(ms ?? 0); fn(); return 0 as unknown as NodeJS.Timeout;
    }) as never);
    try {
      for (let i = 0; i < 6; i++) {
        await withRetry(async () => { throw Object.assign(new Error("x"), { status: 500 }); },
          { attempts: 2, baseMs: 500 }).catch(() => {});
      }
    } finally { spy.mockRestore(); }
    expect(new Set(waits).size).toBeGreaterThan(1);
  });

  it("gives up and rethrows rather than looping forever", async () => {
    const { withRetry } = await import("@/lib/monitoring");
    let calls = 0;
    await expect(withRetry(async () => {
      calls++; throw Object.assign(new Error("down"), { status: 500 });
    }, { attempts: 3, baseMs: 1 })).rejects.toThrow("down");
    expect(calls).toBe(3);
  });
});

describe("degradeGracefully", () => {
  it("returns the fallback instead of failing the whole page", async () => {
    const { degradeGracefully } = await import("@/lib/monitoring");
    const out = await degradeGracefully({ area: "storage" },
      async () => { throw new Error("bucket unreachable"); }, []);
    expect(out).toEqual([]);
  });

  it("reports rather than swallowing — a silent catch is how an outage lasts a week", async () => {
    const errors: unknown[] = [];
    vi.doMock("@/lib/logger", () => ({
      log: { error: (_e: string, f: unknown) => errors.push(f), warn: () => {}, info: () => {}, debug: () => {} },
    }));
    vi.resetModules();
    const { degradeGracefully } = await import("@/lib/monitoring");
    await degradeGracefully({ area: "photos" }, async () => { throw new Error("nope"); }, null);
    expect(errors.length).toBe(1);
    vi.doUnmock("@/lib/logger");
  });
});

/* ──────────────────────────────────────────────────────────── idempotency */

describe("idempotency key derivation", () => {
  it("is the same for a repeat of the same send", async () => {
    const { invitationKey } = await import("@/server/services/idempotency");
    expect(invitationKey("w1", "g1", "ABC")).toBe(invitationKey("w1", "g1", "ABC"));
  });

  it("differs per guest, so one send does not suppress another", async () => {
    const { invitationKey } = await import("@/server/services/idempotency");
    expect(invitationKey("w1", "g1", "ABC")).not.toBe(invitationKey("w1", "g2", "ABC"));
  });

  it("changes when the code is reissued, which is a deliberate re-send", async () => {
    const { invitationKey } = await import("@/server/services/idempotency");
    expect(invitationKey("w1", "g1", "ABC")).not.toBe(invitationKey("w1", "g1", "XYZ"));
  });
});

afterEach(() => vi.restoreAllMocks());
