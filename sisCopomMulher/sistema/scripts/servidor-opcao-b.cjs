/**
 * Arranque completo para servidor web: .env → prisma db push → seed se vazio → build se preciso → next start.
 * Uso (pasta sistema): npm run servidor:b
 */
const { execSync, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
process.chdir(root);

require("./load-env.cjs").loadEnvDir(root);
const { listenHost } = require("./default-host.cjs");

const shell = process.platform === "win32";

function sh(cmd) {
  execSync(cmd, { stdio: "inherit", cwd: root, env: process.env, shell });
}

async function main() {
  if (!fs.existsSync(path.join(root, ".env"))) {
    console.error(
      "[servidor:b] Falta .env. Copie .env.example para .env na pasta sistema e defina DATABASE_URL e AUTH_SECRET (mín. 16 caracteres).",
    );
    process.exit(1);
  }

  const auth = process.env.AUTH_SECRET;
  if (!auth || String(auth).trim().length < 16) {
    console.error("[servidor:b] AUTH_SECRET no .env deve ter pelo menos 16 caracteres.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
    console.error("[servidor:b] DATABASE_URL está vazio no .env.");
    process.exit(1);
  }

  console.log("[servidor:b] prisma db push …");
  try {
    sh("npx prisma db push");
  } catch (e) {
    console.error(
      "\n[servidor:b] Falha ao ligar ao PostgreSQL. Confirme:\n" +
        "  · Serviço Postgres a correr\n" +
        "  · DATABASE_URL correto no sistema/.env (utilizador, senha, porta 5432, nome da base)\n" +
        "  · Na primeira vez: crie a base (ex.: copom_mulher) ou use scripts/bootstrap-pg.mjs\n",
    );
    process.exit(1);
  }

  const { PrismaClient } = require("@prisma/client");
  const prisma = new PrismaClient();
  let users = 0;
  try {
    users = await prisma.user.count();
  } finally {
    await prisma.$disconnect();
  }

  if (users === 0) {
    console.log("[servidor:b] Sem utilizadores — a executar seed (login: rafael / senha: 123) …");
    try {
      sh("npm run db:seed");
    } catch {
      console.error("[servidor:b] Seed falhou. Verifique o PostgreSQL e volte a tentar.");
      process.exit(1);
    }
  }

  if (!fs.existsSync(path.join(root, ".next", "BUILD_ID"))) {
    console.log("[servidor:b] A executar npm run build (primeira vez ou após clean) …");
    try {
      sh("npm run build");
    } catch {
      console.error("[servidor:b] Build falhou. Corrija erros acima.");
      process.exit(1);
    }
  }

  const port = String(process.env.PORT || "3001").trim() || "3001";
  const host = listenHost();

  const env = { ...process.env, NODE_ENV: "production", PORT: port, HOST: host };
  const ob = String(process.env.OPEN_BROWSER ?? "1").trim().toLowerCase();
  if (ob !== "0" && ob !== "false" && ob !== "no") {
    env.OPEN_BROWSER = "1";
    env.OPEN_BROWSER_URL = `http://127.0.0.1:${port}`;
  }

  console.log(`\n[servidor:b] Servidor no ar. Abra no browser (use um destes):\n`);
  console.log(`   http://localhost:${port}`);
  console.log(`   http://127.0.0.1:${port}\n`);

  const child = spawn(process.execPath, [path.join(__dirname, "next-start.cjs")], {
    stdio: "inherit",
    cwd: root,
    env,
  });
  child.on("error", (err) => {
    console.error("[servidor:b]", err.message);
    process.exit(1);
  });
  child.on("exit", (code, signal) => {
    if (signal) process.exit(1);
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error("[servidor:b] Erro:", e.message || e);
  process.exit(1);
});
