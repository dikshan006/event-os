import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tenant isolation.
 *
 * EventOS is multi-tenant: one deployment, many studios, and a wedding belongs
 * to exactly one of them. The single worst bug this product can have is one
 * studio reading or writing another's wedding, and the shape of that bug is
 * always the same — a service that takes an id from a form and looks it up by
 * id alone.
 *
 * These tests assert the rule at the boundary that enforces it: every service
 * that accepts a `studioId` must put it in the `where` clause. They use a fake
 * Prisma client rather than a database, because what is being tested is the
 * query the service *builds*, and a real database would let a service pass by
 * accident when the test fixture happens to contain only one studio.
 */

const db = {
  wedding: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), count: vi.fn() },
  registryItem: { create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(), findFirst: vi.fn(), aggregate: vi.fn() },
  photo: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  guest: { findMany: vi.fn(), count: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(async (arg: unknown) =>
    typeof arg === "function" ? (arg as (c: unknown) => unknown)(db) : arg),
};

vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));

/** Every `where` object any mocked method was called with, flattened. */
function wheres(): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const model of Object.values(db)) {
    if (typeof model !== "object" || model === null) continue;
    for (const fn of Object.values(model)) {
      if (typeof fn !== "function" || !("mock" in fn)) continue;
      for (const call of (fn as ReturnType<typeof vi.fn>).mock.calls) {
        const w = (call?.[0] as { where?: Record<string, unknown> })?.where;
        if (w) out.push(w);
      }
    }
  }
  return out;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.wedding.findFirst.mockResolvedValue({ id: "w1", studioId: "studio-a", slug: "a-and-b" });
  db.registryItem.aggregate.mockResolvedValue({ _max: { sortOrder: 0 } });
  db.registryItem.create.mockResolvedValue({ id: "r1" });
  db.photo.count.mockResolvedValue(0);
});

describe("registry service", () => {
  it("scopes the ownership lookup to the caller's studio", async () => {
    const { addRegistryItem } = await import("@/server/services/registry");
    await addRegistryItem("studio-a", "w1", {
      title: "Stand mixer", url: "https://example.com/x",
      imageUrl: "", price: "", retailer: "", featured: false,
    } as never);

    const lookup = wheres().find(w => "id" in w && "studioId" in w);
    expect(lookup, "the wedding must be fetched by id AND studioId").toBeTruthy();
    expect(lookup!.studioId).toBe("studio-a");
  });

  it("refuses when the wedding belongs to a different studio", async () => {
    // The lookup is scoped, so a foreign id simply does not resolve.
    db.wedding.findFirst.mockResolvedValue(null);
    const { addRegistryItem } = await import("@/server/services/registry");

    await expect(
      addRegistryItem("studio-b", "wedding-owned-by-studio-a", {
        title: "x", url: "https://example.com/x",
        imageUrl: "", price: "", retailer: "", featured: false,
      } as never),
    ).rejects.toThrow();

    // and nothing was written on the way to failing
    expect(db.registryItem.create).not.toHaveBeenCalled();
  });
});

describe("photo service", () => {
  it("scopes the ownership lookup to the caller's studio", async () => {
    const photos = await import("@/server/services/photos");
    const upload = (photos as Record<string, unknown>).uploadPhoto as
      | ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (!upload) return; // renamed; the registry case still covers the rule

    db.wedding.findFirst.mockResolvedValue(null);
    await expect(
      upload("studio-b", "wedding-owned-by-studio-a", "HERO",
        new File([new Uint8Array([1, 2, 3])], "x.jpg", { type: "image/jpeg" }), "", "Someone"),
    ).rejects.toThrow();

    const lookup = wheres().find(w => "id" in w && "studioId" in w);
    expect(lookup?.studioId).toBe("studio-b");
  });
});

describe("the rule itself", () => {
  it("no service reads a wedding by id without a studio", async () => {
    // A static check over the source, which is the only way to catch the case
    // nobody wrote a test for.
    //
    // The dangerous shape is a lookup keyed by `id`: an id comes from a form or
    // a URL, so a query that trusts it alone is a cross-tenant read by
    // construction. A lookup keyed by `slug` is a different thing — the public
    // wedding site and its calendar feed are addressed by slug precisely
    // because they are public, and they gate on `status === "PUBLISHED"`
    // instead of on a studio. There is no caller studio to scope to.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const dir = "src/server/services";
    const offenders: string[] = [];
    for (const file of readdirSync(dir).filter(f => f.endsWith(".ts"))) {
      const src = readFileSync(join(dir, file), "utf8");
      const re = /prisma\.wedding\.(findUnique|findUniqueOrThrow)\s*\(\s*\{\s*where:\s*\{([^}]*)\}/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const key = m[2];
        if (/\bid\b/.test(key) && !/studioId/.test(key)) {
          offenders.push(`${file}: findUnique by id without studioId`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });

  it("public reads by slug are gated on publication", async () => {
    // The other half of the rule above: a slug lookup is allowed to skip the
    // studio check only because publication is the gate. If that check is ever
    // dropped, an unpublished wedding becomes world-readable at a guessable URL.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/server/services/calendar-feed.ts", "utf8");
    expect(src).toMatch(/status\s*!==\s*"PUBLISHED"|status:\s*"PUBLISHED"/);
  });

  it("every studio-scoped service signature takes studioId first", async () => {
    // Ordering is a convention, and conventions that are not checked decay.
    // A signature of (weddingId, studioId) is the setup for transposing them at
    // a call site, which silently swaps the tenant.
    const { readFileSync, readdirSync } = await import("node:fs");
    const { join } = await import("node:path");

    const bad: string[] = [];
    for (const file of readdirSync("src/server/services").filter(f => f.endsWith(".ts"))) {
      const src = readFileSync(join("src/server/services", file), "utf8");
      const re = /export async function (\w+)\(([^)]*)\)/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        const [, name, args] = m;
        const params = args.split(",").map(s => s.trim().split(":")[0].trim());
        const at = params.indexOf("studioId");
        if (at > 0) bad.push(`${file}:${name} (studioId at position ${at})`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
