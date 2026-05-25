/**
 * Arranque em contentor: schema na base, seed só na primeira vez (sem utilizadores).
 */
const { execSync, spawn } = require("node:child_process");
const path = require("node:path");
const { PrismaClient } = require("@prisma/client");

const root = path.join(__dirname, "..");

async function main() {
  execSync("npx prisma db push", { stdio: "inherit", cwd: root, env: process.env });

  const prisma = new PrismaClient();
  let users = 0;
  try {
    users = await prisma.user.count();
  } finally {
    await prisma.$disconnect();
  }

  if (users === 0) {
    console.log("[docker-entry] Nenhum utilizador na base — a executar seed (login: rafael / senha: 123).");
    execSync("npm run db:seed", { stdio: "inherit", cwd: root, env: process.env });
  }

  const child = spawn(process.execPath, [path.join(__dirname, "next-start.cjs")], {
    stdio: "inherit",
    cwd: root,
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
