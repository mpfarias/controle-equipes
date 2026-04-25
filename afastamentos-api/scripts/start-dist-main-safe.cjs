const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const mainPath = path.resolve(__dirname, '..', 'dist', 'main.js');
let child = null;

if (!fs.existsSync(mainPath)) {
  console.log('[start-dist-main-safe] dist/main.js ainda nao existe; aguardando proxima recompilacao...');
  process.exit(0);
}

child = spawn(process.execPath, [mainPath], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function shutdown(signal) {
  if (!child || child.killed) {
    process.exit(0);
    return;
  }
  child.once('exit', () => process.exit(0));
  child.kill(signal);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGUSR2', () => shutdown('SIGTERM'));

