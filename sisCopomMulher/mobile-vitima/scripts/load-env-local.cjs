/**
 * Carrega .env.local e .env na pasta mobile-vitima (sem dependência dotenv).
 * Permite COPOM_LAN_REWRITE=192.168.x.x quando o IP automático falha.
 */
const fs = require("node:fs");
const path = require("node:path");

function parseLine(line) {
  const s = line.trim();
  if (!s || s.startsWith("#")) return null;
  const eq = s.indexOf("=");
  if (eq <= 0) return null;
  const key = s.slice(0, eq).trim();
  let val = s.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return { key, val };
}

function loadEnvFile(dir, name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return;
  const txt = fs.readFileSync(p, "utf8");
  for (const line of txt.split(/\r?\n/)) {
    const pair = parseLine(line);
    if (!pair) continue;
    if (process.env[pair.key] === undefined) process.env[pair.key] = pair.val;
  }
}

function loadEnvLocalFirst(projectRoot) {
  loadEnvFile(projectRoot, ".env.local");
  loadEnvFile(projectRoot, ".env");
}

module.exports = { loadEnvLocalFirst };
