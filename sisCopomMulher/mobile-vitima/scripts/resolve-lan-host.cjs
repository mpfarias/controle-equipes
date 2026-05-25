/**
 * IP da rede para o dev server. Usado no Metro (reescrita do manifesto) e no arranque do Expo.
 * Evita que, quando o telemóvel liga a exp://127.0.0.1, o JSON aponte 127.0.0.1 = próprio aparelho.
 */
const os = require("node:os");

function looksLikeExpoUpdatesManifest(s) {
  if (s.includes("launchAsset")) return true;
  if (s.includes("expoClient") && s.includes("hostUri")) return true;
  return false;
}

const SKIP = process.env.COPOM_DISABLE_MANIFEST_LAN_REWRITE === "1";

function firstLanIPv4() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const x of ifs[name] || []) {
      if (x.family !== "IPv4" && x.family !== 4) continue;
      if (x.internal) continue;
      if (String(x.address).startsWith("169.254.")) continue;
      return x.address;
    }
  }
  return null;
}

/** Hostname ou IPv4 a usar no manifest; null = não reescrever. */
function getLanHost() {
  if (SKIP) return null;
  const a = (process.env.COPOM_LAN_REWRITE && process.env.COPOM_LAN_REWRITE.trim()) || "";
  if (a) return a;
  const b = (process.env.REACT_NATIVE_PACKAGER_HOSTNAME && process.env.REACT_NATIVE_PACKAGER_HOSTNAME.trim()) || "";
  if (b) return b;
  return firstLanIPv4();
}

function shouldPatchManifest() {
  return getLanHost() != null;
}

/**
 * Só aplica a manifest/updates JSON (evita tocar noutros JSON ou bundles JS).
 * Substitui 127.0.0.1 e localhost nos campos de URL / host do Expo.
 */
function patchExpoManifestBodyIfNeeded(chunk, lan) {
  if (lan == null) return null;
  const s0 = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  if (s0.length < 20 || s0.length > 8_000_000) return null;
  if (s0.includes("127.0.0.1") === false && s0.includes("localhost:") === false) return null;
  if (!looksLikeExpoUpdatesManifest(s0)) return null;

  let s = s0
    .replace(/https?:\/\/127\.0\.0\.1:(\d+)/g, (m, port) => `http://${lan}:${port}`)
    .replace(/https?:\/\/localhost:(\d+)/g, (m, port) => `http://${lan}:${port}`)
    .replace(/"hostUri":"(127\.0\.0\.1|localhost):(\d+)"/g, (_m, _h, port) => `"hostUri":"${lan}:${port}"`)
    .replace(/"debuggerHost":"(127\.0\.0\.1|localhost):(\d+)"/g, (_m, _h, port) => `"debuggerHost":"${lan}:${port}"`);
  if (s.includes("127.0.0.1")) s = s.replace(/127\.0\.0\.1/g, lan);
  return s !== s0 ? s : null;
}

module.exports = { getLanHost, firstLanIPv4, shouldPatchManifest, patchExpoManifestBodyIfNeeded, SKIP };
