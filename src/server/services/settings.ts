import "server-only";
import { prisma } from "@/lib/db";

export async function getSettings() {
  return (
    (await prisma.platformSetting.findUnique({ where: { id: 1 } })) ??
    (await prisma.platformSetting.create({ data: { id: 1 } }))
  );
}
