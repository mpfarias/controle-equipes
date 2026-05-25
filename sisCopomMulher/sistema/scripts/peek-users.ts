import "dotenv/config";
import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const users = await prisma.user.findMany({
    select: { email: true, ativo: true, role: true, nomeCompleto: true },
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
