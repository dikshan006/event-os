/**
 * Empty a preview database so `prisma migrate deploy` can build it from zero.
 *
 *   npx tsx --env-file=.env.preview scripts/reset-preview-db.ts
 *   npx tsx --env-file=.env.preview scripts/reset-preview-db.ts --yes
 *
 * ── why this exists ──────────────────────────────────────────────────────
 *
 * A Neon schema-only branch copies DDL and no rows. `_prisma_migrations` is an
 * ordinary table, so the branch gets the table and none of its contents —
 * which leaves a database whose schema is fully built and whose migration
 * history is empty. `migrate deploy` reads that, concludes nothing has ever
 * been applied, starts at `init`, and dies on `CREATE TYPE "Role"` because the
 * type is already there (42710 → P3018).
 *
 * The textbook fix is `migrate resolve --applied` for every migration. That
 * makes the build pass and leaves the app broken: the price-plan migration is
 * the one that seeds rows, schema-only copied the empty table, and marking it
 * applied means the seed never runs. `resolvePrice` then throws rather than
 * invent an amount, and every billing page 500s. A green build hiding a broken
 * environment is worse than the honest failure it replaced.
 *
 * So preview gets a genuinely empty database and rebuilds the whole history.
 * Nothing is lost, because a schema-only branch never had anything, and the
 * deploy becomes a real test of the migration chain.
 *
 * ── why this cannot hit production ───────────────────────────────────────
 *
 * The guard is not a flag or a hostname allowlist, both of which are one typo
 * from being wrong. It is the data itself: this script refuses to touch a
 * database that contains any application rows. Production has studios, users
 * and weddings in it; a schema-only preview branch has none. Pointing this at
 * production therefore does not do damage — it stops and says so.
 */
import { PrismaClient } from "@prisma/client";

/** Tables whose emptiness defines "this is not a database anybody is using". */
const CANARY_TABLES = ["User", "Studio", "Wedding", "Guest", "Payment"] as const;

/** Migrations and DDL need a real session, which a transaction pooler cannot give. */
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

function hostOf(connection: string): string {
  try {
    return new URL(connection).host;
  } catch {
    return "(unparseable connection string)";
  }
}

async function main() {
  if (!url) {
    console.error("\n  DIRECT_URL and DATABASE_URL are both unset. Nothing to do.\n");
    process.exit(1);
  }

  // The host, never the credentials. This output ends up in terminals and
  // sometimes in CI logs.
  const host = hostOf(url);
  console.log(`\n  Target: ${host}`);
  if (!process.env.DIRECT_URL) {
    console.log("  (DIRECT_URL unset — using DATABASE_URL, which may be the pooled endpoint)");
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    /**
     * Count only the tables that exist. A brand-new branch may legitimately be
     * missing some, and asking for a row count from a table that is not there
     * would abort with an error that reads like a failure rather than the
     * "already empty, carry on" that it is.
     */
    const present = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${[...CANARY_TABLES]}::text[])
    `;

    const counts: Array<[string, number]> = [];
    for (const { table_name } of present) {
      const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        `SELECT COUNT(*)::bigint AS n FROM "${table_name}"`,
      );
      counts.push([table_name, Number(row.n)]);
    }

    const occupied = counts.filter(([, n]) => n > 0);

    if (occupied.length > 0) {
      console.error(
        "\n  REFUSING — this database has data in it.\n" +
          occupied.map(([t, n]) => `    ${t}: ${n} row${n === 1 ? "" : "s"}`).join("\n") +
          "\n\n  A schema-only preview branch is empty. Something with rows in it is\n" +
          "  production, or a branch somebody is using. Check which connection\n" +
          "  string is loaded before running this again.\n",
      );
      process.exit(1);
    }

    console.log(
      present.length === 0
        ? "  No application tables — the schema is already empty."
        : `  ${present.length} application table${present.length === 1 ? "" : "s"} present, all empty.`,
    );

    if (!process.argv.includes("--yes")) {
      console.log(
        "\n  Dry run. This would drop and recreate the `public` schema on the\n" +
          `  database above, so the next \`prisma migrate deploy\` builds all\n` +
          "  migrations from zero.\n\n  Re-run with --yes to do it.\n",
      );
      return;
    }

    /**
     * DROP SCHEMA rather than deleting rows from `_prisma_migrations`.
     *
     * Clearing the history alone would leave every type and table in place and
     * put us straight back where we started: `migrate deploy` would replay
     * `init` against objects that already exist. What has to go is the schema.
     */
    await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
    await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);

    console.log(
      "\n  Done. `public` is empty.\n\n" +
        "  Redeploy Preview. `prisma migrate deploy` will apply all migrations\n" +
        "  from zero, including the price-plan seed, and the history will match\n" +
        "  the repository exactly.\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error("\n  Failed:", err instanceof Error ? err.message : err, "\n");
  process.exit(1);
});
