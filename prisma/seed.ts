import { DEMO_GIFTS, giftTile } from "../src/lib/demo-gifts";
import { PrismaClient, TemplateKey, WeddingStatus, RsvpStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();
const code = () => nanoid(10).toUpperCase();

async function main() {
  const pw = await bcrypt.hash("password123", 12);

  await prisma.platformSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, pricePerWeddingCents: 9900, firstWeddingFree: true },
  });

  await prisma.user.upsert({
    where: { email: "owner@eventos.app" },
    update: {},
    create: { email: "owner@eventos.app", name: "Platform Owner", role: "ADMIN", passwordHash: pw },
  });

  const studio = await prisma.studio.upsert({
    where: { slug: "prestige-weddings" },
    update: {},
    create: {
      name: "Prestige Weddings",
      slug: "prestige-weddings",
      brandColor: "#9D5C64",
      website: "prestigeweddings.com",
      instagram: "@prestige.weddings",
      contactEmail: "hello@prestigeweddings.com",
      freeWeddingUsed: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "sarah@prestigeweddings.com" },
    update: {},
    create: { email: "sarah@prestigeweddings.com", name: "Sarah Carter", role: "PLANNER", studioId: studio.id, passwordHash: pw },
  });

  const existing = await prisma.wedding.findUnique({ where: { slug: "sarah-and-james" } });
  if (!existing) {
    const wedding = await prisma.wedding.create({
      data: {
        studioId: studio.id,
        slug: "sarah-and-james",
        template: TemplateKey.CLASSIC_ELEGANCE,
        status: WeddingStatus.PUBLISHED,
        publishedAt: new Date(),
        partnerOne: "Sarah",
        partnerTwo: "James",
        date: new Date("2027-09-25T16:00:00Z"),
        venue: "The Magnolia Estate",
        city: "Charleston, SC",
        venueAddress: "3550 Ashley River Rd, Charleston, SC 29414",
        venueLat: 32.8098, venueLng: -80.0731,
        timeZone: "America/New_York",
        story:
          "Our journey began with a chance meeting and quickly grew into something special, filled with laughter, adventures and unforgettable memories. As we prepare to say \u201CI do,\u201D we\u2019re excited to celebrate this next chapter with our loved ones.",
        faqs: {
          create: [
            { question: "What should I wear?", answer: "Dress codes are listed with each event in your personal schedule.", sortOrder: 0 },
            { question: "Can I bring a plus one?", answer: "Invitations are addressed to everyone included in your party.", sortOrder: 1 },
          ],
        },
        // The same twenty gifts the template preview uses, so a freshly seeded
        // database shows the wishlist as guests will actually meet it. Two are
        // pre-claimed, which is the only way to see the toggle and the badge
        // without buying something.
        registry: {
          create: DEMO_GIFTS.map((g, i) => ({
            title: g.title.replace(/&amp;/g, "&"),
            retailer: g.retailer.replace(/&amp;/g, "&"),
            price: g.price,
            url: g.url,
            imageUrl: giftTile(g.tint, g.title.trim()[0] ?? "\u00b7"),
            featured: Boolean(g.featured),
            sortOrder: i * 10,
            ...(i === 4 ? { purchasedBy: "Sarah Whitfield", purchasedAt: new Date() } : {}),
            ...(i === 11 ? { purchasedBy: "Tom Iversen", purchasedAt: new Date() } : {}),
          })),
        },
        funds: {
          create: [{ name: "Honeymoon Fund", blurb: "Help us toast to a week on the Amalfi Coast.", venmoUrl: "https://venmo.com", goalCents: 500000 }],
        },
        events: {
          create: [
            { title: "Welcome Dinner", day: "Friday, September 24", time: "7:00 PM", sortKey: 10,
              startsAt: new Date("2027-09-24T23:00:00Z"), endsAt: new Date("2027-09-25T02:00:00Z"), location: "The Vineyard Terrace", dressCode: "Cocktail attire", audiences: ["Family", "VIP"] },
            { title: "Ceremony", day: "Saturday, September 25", time: "4:00 PM", sortKey: 20,
              startsAt: new Date("2027-09-25T20:00:00Z"), endsAt: new Date("2027-09-25T21:00:00Z"), location: "The Grand Lawn", dressCode: "Black tie optional", isPublic: true },
            { title: "Reception", day: "Saturday, September 25", time: "6:30 PM", sortKey: 30,
              startsAt: new Date("2027-09-25T22:30:00Z"), endsAt: new Date("2027-09-26T03:00:00Z"), location: "The Orangery", dressCode: "Black tie optional", isPublic: true },
            { title: "After Party", day: "Saturday, September 25", time: "11:00 PM", sortKey: 40,
              startsAt: new Date("2027-09-26T03:00:00Z"), location: "The Cellar Bar", dressCode: "Come as you are", audiences: ["Friends", "Bridesmaids", "Groomsmen"] },
            { title: "Farewell Brunch", day: "Sunday, September 26", time: "10:30 AM", sortKey: 50,
              startsAt: new Date("2027-09-26T14:30:00Z"), location: "Garden Pavilion", dressCode: "Casual", audiences: ["Family", "VIP"] },
          ],
        },
      },
    });

    const guests = [
      { name: "Margaret Ellison", email: "margaret@ellison.com", groups: ["Family", "VIP"], rsvp: { status: RsvpStatus.ACCEPTED, meal: "Salmon", notes: "Arriving Thursday" } },
      { name: "John Peterson", email: "john.p@example.com", groups: ["Friends"], rsvp: { status: RsvpStatus.ACCEPTED, meal: "Beef" } },
      { name: "Helen Russo", email: "helen@example.com", groups: ["Family"], rsvp: null },
      { name: "David Okafor", email: "d.okafor@example.com", groups: ["Groomsmen"], rsvp: { status: RsvpStatus.MAYBE, notes: "Travel pending" } },
    ];
    for (const g of guests) {
      await prisma.guest.create({
        data: {
          weddingId: wedding.id,
          studioId: studio.id,
          name: g.name,
          email: g.email,
          groups: g.groups,
          inviteCode: code(),
          invitedAt: new Date(),
          ...(g.rsvp ? { rsvp: { create: g.rsvp } } : {}),
        },
      });
    }
    await prisma.payment.create({
      data: { studioId: studio.id, weddingId: wedding.id, amountCents: 9900, status: "PAID", description: "Publish \u2014 Sarah & James" },
    });
  }

  const codes = await prisma.guest.findMany({ where: { studioId: studio.id }, select: { name: true, inviteCode: true } });
  console.log("Seeded. Logins: owner@eventos.app / sarah@prestigeweddings.com (password123)");
  console.log("Guest invite codes:", codes);
}

main().finally(() => prisma.$disconnect());
