import { prisma } from "@/lib/prisma";

/**
 * Lê `mustChangePassword` sem incluir o campo no `select` do Prisma.
 * Assim o login continua a funcionar se a coluna ainda não existir na base
 * (antes de `npx prisma db push`). Quando a coluna existir, devolve o valor real.
 */
export async function readMustChangePasswordSafe(userId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ m: boolean | null }[]>`
      SELECT "mustChangePassword" AS m FROM "User" WHERE "id" = ${userId} LIMIT 1
    `;
    return rows[0]?.m === true;
  } catch {
    return false;
  }
}
