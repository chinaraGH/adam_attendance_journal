import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

// Reuse one client per server process (Vercel warm instances) to avoid extra DB connections.
globalForPrisma.prisma = prisma;
