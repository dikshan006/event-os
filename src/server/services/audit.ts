import "server-only";
import { prisma } from "@/lib/db";

export function logAudit(opts: {
  actorType: "ADMIN" | "PLANNER" | "GUEST" | "SYSTEM";
  action: string;
  actorId?: string;
  actorName?: string;
  studioId?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.auditLog.create({ data: { ...opts, metadata: opts.metadata as any } });
}
