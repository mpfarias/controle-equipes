/**
 * 1) Testa ligação ao PostgreSQL (utilizador postgres + senha)
 * 2) Cria a base copom_mulher se não existir
 * 3) Grava DATABASE_URL no .env (password com URL-encoding)
 *
 * PowerShell (substitua pela senha real do instalador):
 *   $env:POSTGRES_PASSWORD='SUA_SENHA'; node scripts/bootstrap-pg.mjs
 *
 * Depois:
 *   npm run setup:db
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const envPath = path.join(root, ".env");

function findPsql() {
  const bases = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe",
    "C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe",
  ];
  for (const p of bases) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function psqlExec(psql, env, sql) {
  return execFileSync(psql, ["-U", "postgres", "-h", "localhost", "-p", "5432", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-c", sql], {
    env,
    encoding: "utf8",
  });
}

async function main() {
  let password = process.env.POSTGRES_PASSWORD?.trim() ?? "";
  if (!password) {
    password = await ask("Senha do utilizador postgres (definida na instalação): ");
  }
  if (!password) {
    console.error("Senha vazia. Use: $env:POSTGRES_PASSWORD='...'; node scripts/bootstrap-pg.mjs");
    process.exit(1);
  }

  const psql = findPsql();
  if (!psql) {
    console.error("psql.exe não encontrado em Program Files\\PostgreSQL\\{15..18}\\bin");
    process.exit(1);
  }

  const env = { ...process.env, PGPASSWORD: password };

  try {
    psqlExec(psql, env, "SELECT 1 AS ok;");
  } catch (e) {
    console.error("Ligação falhou. Verifique a senha do utilizador postgres.");
    console.error(String(e.stderr || e.message || e));
    process.exit(1);
  }

  try {
    psqlExec(psql, env, "CREATE DATABASE copom_mulher;");
    console.log("Base copom_mulher criada.");
  } catch (e) {
    const msg = String(e.stderr || e.stdout || e.message || "");
    if (/already exists/i.test(msg)) {
      console.log("Base copom_mulher já existe (ok).");
    } else {
      console.error(msg);
      process.exit(1);
    }
  }

  const enc = encodeURIComponent(password);
  const url = `postgresql://postgres:${enc}@localhost:5432/copom_mulher?schema=public`;

  let envText = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const line = `DATABASE_URL="${url}"`;
  if (/^DATABASE_URL=/m.test(envText)) {
    envText = envText.replace(/^DATABASE_URL=.*$/m, line);
  } else {
    envText = `${line}\n${envText}`;
  }
  fs.writeFileSync(envPath, envText, "utf8");
  console.log("Ficheiro .env atualizado com DATABASE_URL.");
  console.log("Execute na pasta sistema: npm run setup:db && npm run dev");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
