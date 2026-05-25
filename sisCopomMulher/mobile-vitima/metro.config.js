/**
 * Windows: URLs do manifest/Metro não podem conter \ ou %5C — o Expo Go falha a carregar o JS.
 * Reescrita LAN: ver scripts/resolve-lan-host.cjs (manifest Expo Updates usa o Host do pedido).
 *
 * Nota: `res.end` pode enviar Buffer, string ou Uint8Array — todas são tratadas.
 */
const { getDefaultConfig } = require("expo/metro-config");
const { loadEnvLocalFirst } = require("./scripts/load-env-local.cjs");

loadEnvLocalFirst(__dirname);
const { getLanHost, patchExpoManifestBodyIfNeeded } = require("./scripts/resolve-lan-host.cjs");

function chunkToUtf8(chunk) {
  if (chunk == null) return null;
  if (typeof chunk === "string") return chunk;
  if (Buffer.isBuffer(chunk)) return chunk.toString("utf8");
  if (chunk instanceof Uint8Array) return Buffer.from(chunk).toString("utf8");
  if (chunk.buffer instanceof ArrayBuffer && typeof chunk.byteLength === "number") {
    return Buffer.from(chunk.buffer, chunk.byteOffset || 0, chunk.byteLength).toString("utf8");
  }
  return null;
}

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);
const origRewrite = config.server.rewriteRequestUrl;

if (origRewrite) {
  config.server.rewriteRequestUrl = (url) => {
    const normalizedIn = typeof url === "string" ? url.replace(/\\/g, "/") : url;
    const out = origRewrite(normalizedIn);
    if (typeof out === "string") {
      return out.replace(/\\/g, "/").replace(/%5C/gi, "/");
    }
    return out;
  };
}

const priorEnhance = config.server.enhanceMiddleware;
const lan = getLanHost();
config.server.enhanceMiddleware = (middleware, server) => {
  const stack = priorEnhance ? priorEnhance(middleware, server) : middleware;
  return (req, res, next) => {
    const _end = res.end.bind(res);
    res.end = (chunk, encoding, cb) => {
      if (typeof encoding === "function") {
        cb = encoding;
        encoding = undefined;
      }
      if (res.getHeader?.("content-encoding") === "gzip") {
        return _end(chunk, encoding, cb);
      }
      const s0 = chunkToUtf8(chunk);
      if (s0 == null) {
        return _end(chunk, encoding, cb);
      }
      if (s0.length >= 6_000_000) {
        return _end(chunk, encoding, cb);
      }

      let s = s0;
      if (s.includes("launchAsset") && (s.includes("%5C") || /https?:\/\/[^"]*\\/.test(s))) {
        s = s
          .replace(/%5C/gi, "/")
          .replace(/(https?:\/\/[A-Za-z0-9.:%[\]/\-]+)/g, (m) => m.replace(/\\/g, "/"));
      }

      const fromLan = patchExpoManifestBodyIfNeeded(s, lan);
      if (fromLan) {
        s = fromLan;
      }

      if (s !== s0) {
        const buf = Buffer.from(s, "utf8");
        try {
          res.setHeader("Content-Length", buf.length);
        } catch {
          /* header já enviado */
        }
        return _end(buf, encoding, cb);
      }
      return _end(chunk, encoding, cb);
    };
    return stack(req, res, next);
  };
};

module.exports = config;
