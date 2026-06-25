import type { IntegraSspMssqlConfig } from './integra-ssp-config';

const IPV4_RE = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Hostname usado no SNI/TLS quando a conexão TCP é por IP (RFC 6066). */
export function resolveIntegraSspTlsServerName(cfg: IntegraSspMssqlConfig): string | undefined {
  if (cfg.tlsServerName?.trim()) return cfg.tlsServerName.trim();
  if (IPV4_RE.test(cfg.server.trim())) {
    return 'LISTEN-SQL-PROD';
  }
  return undefined;
}

/** Configuração do driver `mssql`/`tedious` para integra_ssp. */
export function buildIntegraSspMssqlPoolConfig(cfg: IntegraSspMssqlConfig) {
  const tlsServerName = resolveIntegraSspTlsServerName(cfg);
  return {
    server: cfg.server,
    port: cfg.port,
    database: cfg.database,
    user: cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.encrypt,
      trustServerCertificate: cfg.trustServerCertificate,
      ...(tlsServerName ? { serverName: tlsServerName } : {}),
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30_000 },
    requestTimeout: 120_000,
    connectionTimeout: 30_000,
  };
}
