/**
 * Config dinâmica (padrão Expo em monorepos / vários ambientes).
 * app.json continua a ser a base; aqui só env + extras.
 */
const path = require("node:path");
const { loadEnvLocalFirst } = require("./scripts/load-env-local.cjs");

loadEnvLocalFirst(__dirname);

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra || {}),
    copomLanHint:
      process.env.COPOM_LAN_REWRITE ||
      process.env.REACT_NATIVE_PACKAGER_HOSTNAME ||
      "",
  },
});
