/**
 * Create (or re-password) the platform admin on a real database.
 *
 * `npm run db:seed` is demo data — it creates a fake studio, a fake wedding and
 * a shared `password123`, which has no place in production. This script instead
 * creates exactly one ADMIN user plus the PlatformSetting row the billing code
 * reads, using a password you supply on the command line.
 *
 *   npm run db:create-admin -- you@yourdomain.com "Your Name" 'a-strong-password'
 *
 * Safe to re-run: an existing admin has their password updated rather than
 * being duplicated.
 *
 * On environment: Prisma Client does not read .env — only the Prisma CLI does,
 * which is why `prisma db seed` works without any help and a plain `tsx` script
 * does not. The npm script therefore passes `--env-file=.env`. Variables
 * already present in the shell take precedence over the file, so
 *
 *   DATABASE_URL="<prod>" DIRECT_URL="<prod>" npm run db:create-admin -- …
 *
 * targets production even though .env is also loaded.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, name, password] = process.argv.slice(2);

  if (!email || !name || !password) {
    console.error(
      "Usage: npm run db:create-admin -- <email> <name> <password>\n" +
        "Example: npm run db:create-admin -- owner@studio.com \"Platform Owner\" 'S0me-Long-Passphrase'",
    );
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Refusing to set a password shorter than 12 characters for a platform admin.");
    process.exit(1);
  }

  // Fail with a readable message rather than a Prisma datasource validation dump.
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("postgres")) {
    console.error(
      "DATABASE_URL is not set (or is not a postgres:// URL).\n" +
        "Either run this from the project root so .env is picked up, or pass it explicitly:\n" +
        '  DATABASE_URL="<pooled>" DIRECT_URL="<direct>" npm run db:create-admin -- <email> <name> <password>',
    );
    process.exit(1);
  }
  console.log(`Target database: ${url.replace(/:\/\/[^@]*@/, "://****@").split("?")[0]}`);

  // The billing code reads row id=1; without it, publishing prices are undefined.
  await prisma.platformSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, pricePerWeddingCents: 9900, firstWeddingFree: true },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase().trim() },
    update: { passwordHash, role: "ADMIN", name },
    create: { email: email.toLowerCase().trim(), name, role: "ADMIN", passwordHash },
  });

  console.log(`Admin ready: ${user.email} — sign in at /login and you will land on /admin`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
