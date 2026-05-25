/**
 * Testes HTTP (com `npm run dev` a correr).
 * Uso: npm run smoke
 *      SMOKE_BASE=http://127.0.0.1:3001 npm run smoke
 */
const base = (process.env.SMOKE_BASE || "http://127.0.0.1:3001").replace(/\/$/, "");
const baseUrl = new URL(base);

function assertSameOriginRedirect(location, label) {
  if (!location) return;
  if (location.startsWith("/")) return;
  const loc = new URL(location, base);
  if (loc.hostname !== baseUrl.hostname) {
    throw new Error(
      `${label}: redirect para host "${loc.hostname}" mas o pedido foi "${baseUrl.hostname}" — cookies e assets falham. Corrija o middleware.`,
    );
  }
}

async function get(path, { redirect = "manual" } = {}) {
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { redirect });
  const loc = res.headers.get("location");
  return { url, status: res.status, loc };
}

async function main() {
  let r = await get("/", { redirect: "manual" });
  console.log(`GET / -> ${r.status}${r.loc ? ` -> ${r.loc}` : ""}`);
  assertSameOriginRedirect(r.loc, "GET /");
  if (!(r.status === 307 || r.status === 308 || r.status === 302 || r.status === 200)) {
    throw new Error(`Esperado 307/302/200 em /, obtido ${r.status}`);
  }

  r = await get("/login");
  console.log(`GET /login -> ${r.status}`);
  if (r.status !== 200) throw new Error(`/login devolveu ${r.status}`);

  r = await get("/api/health");
  console.log(`GET /api/health -> ${r.status}`);
  if (r.status !== 200) throw new Error(`/api/health devolveu ${r.status}`);

  r = await get("/api/auth/me");
  console.log(`GET /api/auth/me -> ${r.status}`);
  if (r.status !== 401 && r.status !== 200) {
    throw new Error(`/api/auth/me inesperado: ${r.status}`);
  }

  console.log("SMOKE OK —", base);
}

main().catch((e) => {
  console.error("SMOKE FALHOU:", e.message);
  console.error("Na pasta sistema: pare outros `node`, `npm run clean`, `npm run dev`, depois `npm run smoke`.");
  process.exit(1);
});
