/**
 * PostgreSQL local na porta 5433 (sem Docker), dados em sistema/.pg-local
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const dataDir = path.join(root, ".pg-local");
const logDir = path.join(root, ".pg-local-logs");
const logFile = path.join(logDir, "postgres.log");

function findPgBin(name) {
  for (const ver of ["18", "17", "16", "15"]) {
    const p = path.join("C:", "Program Files", "PostgreSQL", ver, "bin", name);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

const initdb = findPgBin("initdb.exe");
const pgCtl = findPgBin("pg_ctl.exe");
const psql = findPgBin("psql.exe");

if (!initdb || !pgCtl || !psql) {
  console.error("[pg:local] PostgreSQL não encontrado em Program Files\\PostgreSQL\\{15..18}\\bin");
  process.exit(1);
}

fs.mkdirSync(logDir, { recursive: true });

if (!fs.existsSync(path.join(dataDir, "PG_VERSION"))) {
  console.log("[pg:local] A inicializar cluster em .pg-local …");
  execFileSync(initdb, ["-D", dataDir, "-U", "copom", "-E", "UTF8", "--locale=C", "--auth-local=trust", "--auth-host=trust"], {
    stdio: "inherit",
  });
  fs.appendFileSync(
    path.join(dataDir, "postgresql.conf"),
    "\nport = 5433\nlisten_addresses = '127.0.0.1'\nshared_buffers = 256MB\neffective_cache_size = 768MB\nwork_mem = 8MB\nmaintenance_work_mem = 128MB\nmax_connections = 100\n",
  );
}

const status = spawnSync(pgCtl, ["-D", dataDir, "status"], { encoding: "utf8" });
if (status.status !== 0) {
  console.log("[pg:local] A iniciar PostgreSQL na porta 5433 …");
  execFileSync(pgCtl, ["-D", dataDir, "-l", logFile, "start", "-w"], { stdio: "inherit" });
} else {
  console.log("[pg:local] PostgreSQL já está a correr (porta 5433).");
}

try {
  execFileSync(psql, ["-h", "127.0.0.1", "-p", "5433", "-U", "copom", "-d", "postgres", "-c", "CREATE DATABASE copom_mulher;"], {
    encoding: "utf8",
    stdio: "pipe",
  });
  console.log("[pg:local] Base copom_mulher criada.");
} catch (e) {
  const msg = String(e.stderr || e.stdout || "");
  if (!/already exists/i.test(msg)) throw e;
}

console.log("[pg:local] Pronto — DATABASE_URL=postgresql://copom@127.0.0.1:5433/copom_mulher?schema=public");
