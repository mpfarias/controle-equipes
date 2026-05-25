/**
 * Next.js chama `register()` uma vez quando o servidor Node arranca.
 * Abre o browser se OPEN_BROWSER=1 (definido por npm run servidor:b).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const ob = String(process.env.OPEN_BROWSER ?? "").trim().toLowerCase();
  if (ob !== "1" && ob !== "true" && ob !== "yes") return;

  const port = process.env.PORT || "3001";
  const base = (process.env.OPEN_BROWSER_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, "");
  const url = /\/login\/?$/i.test(base) ? base : `${base}/login`;
  const delay = Math.min(30_000, Math.max(2000, Number(process.env.OPEN_BROWSER_DELAY_MS || "4500")));

  const mod = await import("./scripts/open-browser-once.cjs");
  const scheduleOpenBrowser = (mod as { scheduleOpenBrowser?: (url: string, delay: number) => void })
    .scheduleOpenBrowser;
  if (typeof scheduleOpenBrowser !== "function") return;
  scheduleOpenBrowser(url, delay);
}
