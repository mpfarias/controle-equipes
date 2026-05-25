/**
 * Chamado a partir de instrumentation.ts (só em Node).
 */
const { spawn } = require("node:child_process");

function scheduleOpenBrowser(url, delayMs) {
  setTimeout(() => {
    try {
      if (process.platform === "win32") {
        spawn("cmd.exe", ["/c", "start", "", url], {
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        }).unref();
      } else if (process.platform === "darwin") {
        spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
      } else {
        spawn("xdg-open", [url], { detached: true, stdio: "ignore" }).unref();
      }
      console.log(`\n[OPEN_BROWSER] A abrir: ${url}\n`);
    } catch {
      /* ignora */
    }
  }, delayMs);
}

module.exports = { scheduleOpenBrowser };
