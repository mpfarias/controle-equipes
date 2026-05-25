/**
 * `next dev` com NODE_ENV=development sempre.
 * Se o shell tiver NODE_ENV=production (comum após `npm run build` / outro projeto),
 * o middleware Edge falha com: EvalError: Code generation from strings disallowed for this context.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
const env = { ...process.env, NODE_ENV: "development" };

/**
 * `--hostname 0.0.0.0`: o emulador Android acede ao PC via 10.0.2.2:3001; com só 127.0.0.1
 * por vezes a ligação falha. No browser continue a usar http://127.0.0.1:3001
 */
const child = spawn(process.execPath, [nextCli, "dev", "--turbo", "-p", "3001", "--hostname", "0.0.0.0"], {
  cwd: root,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 0);
});
