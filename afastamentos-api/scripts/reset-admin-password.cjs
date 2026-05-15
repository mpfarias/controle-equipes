require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");
const { buildPgPoolConfig } = require("../dist/pg-pool-config");

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não definida.");

  const pool = new Pool(buildPgPoolConfig(databaseUrl));
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const senhaHash = await bcrypt.hash("admin123", 10);
    const user = await prisma.usuario.update({
      where: { matricula: "1966901" },
      data: { senhaHash },
      select: { id: true, nome: true, matricula: true },
    });
    console.log("Senha resetada com sucesso:", user.matricula, "-", user.nome);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
