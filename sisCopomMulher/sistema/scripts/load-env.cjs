/**
 * Carrega `sistema/.env` → process.env (não sobrescreve chaves já definidas no ambiente).
 * Evita falhas quando `dotenv` não está instalado ou em `npm ci --omit=dev`.
 */
const fs = require("node:fs");
const path = require("node:path");

function loadEnvDir(root) {
  const fp = path.join(root, ".env");
  if (!fs.existsSync(fp)) return;
  let raw;
  try {
    raw = fs.readFileSync(fp, "utf8");
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
  } catch {
    return;
  }
  for (let line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    val = val.replace(/\\n/g, "\n");
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

module.exports = { loadEnvDir };
