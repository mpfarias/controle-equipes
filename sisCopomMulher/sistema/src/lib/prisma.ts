import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** Cliente singleton; use DATABASE_URL com PostgreSQL (ver .env.example). */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? [] : ["error"],
  });

/** Em produção também reutiliza a instância (evita vários pools e lentidão sob carga). */
globalForPrisma.prisma = prisma;
