/**
 * One-off: give existing weddings a real timezone.
 *
 * Every wedding created before timezones existed carries "UTC", and its event
 * instants were backfilled as wall time interpreted as UTC — self-consistent,
 * but only correct for a wedding in London in winter.
 *
 * This derives the zone from the location the planner already entered and moves
 * the event instants with it, so the times on the invitation stay exactly as
 * typed. It reuses the same lookup the application uses, rather than a second
 * copy of the mapping in SQL, so there is only ever one answer to "what zone is
 * this?".
 *
 * Safe to run repeatedly: it only touches weddings still on "UTC" whose
 * location resolves to something else.
 *
 *   DATABASE_URL="…" DIRECT_URL="…" npm run db:backfill-timezones
 *   …           --apply     to write; without it, prints what it would do
 */
import { PrismaClient } from "@prisma/client";
import { guessTimeZone } from "../src/lib/timezone-lookup";
import { utcToZonedInputs, zonedWallTimeToUtc, parseLocalInput } from "../src/lib/timezone";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

async function main() {
  const weddings = await prisma.wedding.findMany({
    where: { timeZone: "UTC" },
    select: {
      id: true, partnerOne: true, partnerTwo: true,
      city: true, venue: true, venueAddress: true,
      events: { select: { id: true, startsAt: true, endsAt: true } },
    },
  });

  if (!weddings.length) {
    console.log("No weddings left on UTC. Nothing to do.");
    return;
  }

  let changed = 0;
  for (const w of weddings) {
    const couple = `${w.partnerOne} & ${w.partnerTwo}`;
    const guess = guessTimeZone(w.city, w.venueAddress, w.venue);

    if (!guess) {
      console.log(`  skip  ${couple} — nothing in "${w.city ?? ""} ${w.venue ?? ""}".trim() to go on`);
      continue;
    }

    const dated = w.events.filter(e => e.startsAt || e.endsAt);
    console.log(
      `  ${apply ? "set " : "would"}  ${couple} -> ${guess.zone} (matched "${guess.matched}")` +
        (dated.length ? `, moving ${dated.length} event time${dated.length === 1 ? "" : "s"}` : ""),
    );
    changed++;
    if (!apply) continue;

    const shift = (instant: Date | null) => {
      if (!instant) return null;
      const wall = utcToZonedInputs(instant, "UTC");
      const parts = parseLocalInput(wall.date, wall.time);
      return parts ? zonedWallTimeToUtc(parts, guess.zone) : instant;
    };

    await prisma.$transaction([
      prisma.wedding.update({ where: { id: w.id }, data: { timeZone: guess.zone } }),
      ...dated.map(e =>
        prisma.event.update({
          where: { id: e.id },
          data: { startsAt: shift(e.startsAt), endsAt: shift(e.endsAt) },
        }),
      ),
    ]);
  }

  console.log(
    apply
      ? `\nUpdated ${changed} wedding${changed === 1 ? "" : "s"}.`
      : `\n${changed} wedding${changed === 1 ? "" : "s"} would change. Re-run with --apply to write.`,
  );
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
