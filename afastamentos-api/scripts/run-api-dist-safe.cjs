const { spawn } = require('child_process');
const path = require('path');

const freePortScript = path.resolve(__dirname, 'free-api-port.cjs');
const startScript = path.resolve(__dirname, 'start-dist-main-safe.cjs');

let mainProcess = null;

function runNodeScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Script falhou (${scriptPath}) com código ${code ?? 'desconhecido'}.`));
    });
  });
}

async function start() {
  await runNodeScript(freePortScript);

  mainProcess = spawn(process.execPath, [startScript], {
    stdio: 'inherit',
    shell: false,
  });

  mainProcess.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });
}

function shutdown(signal) {
  if (!mainProcess || mainProcess.killed) {
    process.exit(0);
    return;
  }
  mainProcess.once('exit', () => process.exit(0));
  mainProcess.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[run-api-dist-safe] Falha ao iniciar API:', error);
  process.exit(1);
});
