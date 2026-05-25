/**
 * Produção: `next start` com PORT e HOST.
 * Carrega `.env` sem depender do pacote dotenv.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.join(__dirname, "..");
require("./load-env.cjs").loadEnvDir(root);

if (!process.env.NODE_ENV) process.env.NODE_ENV = "production";

const { listenHost } = require("./default-host.cjs");
const port = String(process.env.PORT || "3001").trim() || "3001";
const host = listenHost();

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextBin)) {
  console.error(
    "[next-start] Não encontrei Next.js em node_modules. Na pasta sistema execute: npm ci && npm run build",
  );
  process.exit(1);
}

const child = spawn(process.execPath, [nextBin, "start", "-p", port, "-H", host], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, HOST: host, PORT: port },
});

child.on("error", (err) => {
  console.error("[next-start] Falha ao arrancar:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
