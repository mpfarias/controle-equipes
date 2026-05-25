/**
 * Liberta as portas usadas pelo dev local (Windows: netstat + taskkill).
 * Uso na raiz: npm run parar:dev
 */
const { execSync } = require("node:child_process");
const ports = [3001, 8095];

function pidsOnPortWin(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
    const set = new Set();
    for (const line of out.split("\n")) {
      const m = line.match(/LISTENING\s+(\d+)\s*$/);
      if (m) set.add(m[1]);
    }
    return [...set];
  } catch {
    return [];
  }
}

console.log("A libertar portas:", ports.join(", "));
for (const port of ports) {
  const pids = pidsOnPortWin(port);
  for (const pid of pids) {
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: "inherit" });
      console.log(`Porta ${port}: processo ${pid} terminado.`);
    } catch {
      console.warn(`Porta ${port}: não foi possível terminar PID ${pid}.`);
    }
  }
}
console.log("Feito. Pode correr: npm run dev:tudo");
