/**
 * Sobe o Metro: --host lan + variáveis para o @expo/cli, e IP fixo no Metro (reescrita de manifesto).
 * Mesmo com exp://127.0.0.1 no telemóvel, o JSON devolvido passa a apontar o bundle para a LAN.
 */
const path = require("node:path");
const { spawn } = require("node:child_process");
const { loadEnvLocalFirst } = require("./load-env-local.cjs");
const { firstLanIPv4 } = require("./resolve-lan-host.cjs");

const projectDir = path.join(__dirname, "..");
loadEnvLocalFirst(projectDir);

// IP efetivo: .env.local (COPOM_LAN_REWRITE) > REACT_* > 1.º IPv4 (mesmo padrão que muitos projetos Expo, ex. sisBatalhaoRural).
const fromEnv = (process.env.COPOM_LAN_REWRITE || process.env.REACT_NATIVE_PACKAGER_HOSTNAME || "").trim();
const ip = fromEnv || firstLanIPv4() || "";
const port = 8095;

if (ip) {
  if (!process.env.REACT_NATIVE_PACKAGER_HOSTNAME) process.env.REACT_NATIVE_PACKAGER_HOSTNAME = ip;
  if (!process.env.COPOM_LAN_REWRITE) process.env.COPOM_LAN_REWRITE = ip;
  // O @expo/cli usa Isto em primeiro (UrlCreator.getUrlComponents) — o manifesto deixa de depender do Host: 127.0.0.1.
  if (!process.env.EXPO_PACKAGER_PROXY_URL) {
    process.env.EXPO_PACKAGER_PROXY_URL = `http://${ip}:${port}`;
  }
  console.log("\n\x1b[1m\x1b[35m[Copom mobile]\x1b[0m IP / proxy Expo: \x1b[1m" + ip + ":" + port + "\x1b[0m  (\x1b[90mEXPO_PACKAGER_PROXY_URL\x1b[0m)");
  console.log("  Telemóvel: \x1b[36mhttp://" + ip + ":" + port + "\x1b[0m  ou  \x1b[36mexp://" + ip + ":" + port + "\x1b[0m  — \x1b[33mno telemóvel nunca 127.0.0.1\x1b[0m (é o aparelho).");
  console.log("  PC: \x1b[36mhttp://127.0.0.1:" + port + "\x1b[0m ou \x1b[36mhttp://" + ip + ":" + port + "\x1b[0m\n");
} else {
  console.log("\n\x1b[33m[Copom mobile] Sem IP LAN. Crie .env.local com COPOM_LAN_REWRITE=192.168.x.x ou ligue Wi-Fi. Tunnel: npm run start:tunnel\x1b[0m\n");
}

const args = process.argv.slice(2);
const env = { ...process.env };
if (!env.CI || String(env.CI).trim() === "") delete env.CI;
const child = spawn("npx", ["expo", "start", "--port", "8095", "--host", "lan", ...args], {
  stdio: "inherit",
  env,
  shell: true,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
