-- Support tickets.
--
-- Written by hand rather than generated, because the environment this was
-- authored in cannot reach Prisma's migration engine. It is therefore worth
-- reading closely rather than trusting: it is checked against the model
-- definitions in schema.prisma, and `prisma migrate deploy` will apply it
-- verbatim during the next build.
--
-- Additive only. No existing table, column, index or constraint is touched, so
-- this cannot affect anything already running.

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_PLANNER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketAuthor" AS ENUM ('PLANNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GETTING_STARTED', 'GUESTS_AND_RSVPS', 'WEBSITE_AND_DESIGN', 'SCHEDULE_AND_SEATING', 'BILLING', 'SOMETHING_BROKEN', 'OTHER');

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "TicketCategory" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstReplyAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorType" "TicketAuthor" NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The planner's own list: their tickets, most recent activity first.
CREATE INDEX "SupportTicket_studioId_lastMessageAt_idx" ON "SupportTicket"("studioId", "lastMessageAt");

-- CreateIndex
-- The admin queue: everything at one status, oldest first.
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
-- A studio's tickets filtered by status, for the planner-side tabs.
CREATE INDEX "SupportTicket_studioId_status_idx" ON "SupportTicket"("studioId", "status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

-- AddForeignKey
-- Cascade, matching Studio -> Wedding: deleting a studio removes its tickets.
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
