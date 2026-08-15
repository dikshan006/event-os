import "server-only";
import { prisma } from "@/lib/db";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legal";
import { logAudit } from "./audit";

/**
 * Whether a planner has agreed to the documents currently in force.
 *
 * The check is equality against the version constants, not existence of any
 * row. That is what makes re-acceptance work: bump `TERMS_VERSION` in
 * `src/lib/legal.ts` and every planner's stored row stops matching, so the gate
 * closes again on their next request with no migration, no backfill and no
 * second flag to remember to flip.
 *
 * Both documents are required, and independently. Someone who accepted the
 * terms in March and the privacy policy in January is only through the gate if
 * *both* of those are still the current versions.
 *
 * One query, not two. A round trip per document would be twice the latency on
 * a check that runs on every planner page load and every planner action.
 */
export async function hasAcceptedCurrentLegal(userId: string): Promise<boolean> {
  if (!userId) return false;

  const rows = await prisma.legalAcceptance.findMany({
    where: {
      userId,
      OR: [
        { document: "TERMS", version: TERMS_VERSION },
        { document: "PRIVACY", version: PRIVACY_VERSION },
      ],
    },
    select: { document: true },
  });

  const docs = new Set(rows.map(r => r.document));
  return docs.has("TERMS") && docs.has("PRIVACY");
}

/**
 * What the planner still has to agree to, for the acceptance screen.
 *
 * Returned rather than inferred in the page so the screen and the gate cannot
 * disagree about what is outstanding.
 */
export async function outstandingLegal(userId: string) {
  const rows = await prisma.legalAcceptance.findMany({
    where: {
      userId,
      OR: [
        { document: "TERMS", version: TERMS_VERSION },
        { document: "PRIVACY", version: PRIVACY_VERSION },
      ],
    },
    select: { document: true },
  });
  const docs = new Set(rows.map(r => r.document));
  return {
    terms: !docs.has("TERMS"),
    privacy: !docs.has("PRIVACY"),
  };
}

/**
 * Record agreement to both documents at their current versions.
 *
 * `createMany` with `skipDuplicates` rather than an upsert, and the difference
 * matters: an upsert would move `acceptedAt` forward if the same version were
 * accepted twice, quietly rewriting when the person actually agreed. Skipping
 * the duplicate keeps the original timestamp, which is the one this record
 * exists to preserve.
 *
 * That also makes the whole operation idempotent without a read first — the
 * unique index on `(userId, document, version)` is what enforces it, so two
 * simultaneous submissions cannot produce two rows.
 *
 * The versions are read from the constants here rather than accepted as
 * arguments. A version supplied by a caller is a version a form could supply,
 * and "I agree to v1" posted against a page showing v2 is exactly the confusion
 * this must not permit.
 */
export async function acceptCurrentLegal(userId: string, actorName: string) {
  if (!userId) throw new Error("acceptCurrentLegal: userId is required");

  const result = await prisma.legalAcceptance.createMany({
    data: [
      { userId, document: "TERMS", version: TERMS_VERSION },
      { userId, document: "PRIVACY", version: PRIVACY_VERSION },
    ],
    skipDuplicates: true,
  });

  // Only when something was actually recorded — a refresh of an already-accepted
  // screen should not fill the audit log with repeated agreements.
  if (result.count > 0) {
    await logAudit({
      actorType: "PLANNER",
      actorId: userId,
      actorName,
      action: `Accepted Terms of Service ${TERMS_VERSION} and Privacy Policy ${PRIVACY_VERSION}`,
    });
  }

  return result.count;
}
