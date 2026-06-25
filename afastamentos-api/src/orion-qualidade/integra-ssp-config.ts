export type IntegraSspPostgresConfig = {
  driver: 'postgres';
  url: string;
};

export type IntegraSspMssqlConfig = {
  driver: 'mssql';
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  trustServerCertificate: boolean;
  /** TLS SNI quando `server` é IP (ex.: LISTEN-SQL-PROD). */
  tlsServerName?: string;
  encrypt: boolean;
};

export type IntegraSspConfig = IntegraSspPostgresConfig | IntegraSspMssqlConfig;

function truthyEnv(v: string | undefined): boolean {
  if (v == null) return false;
  const t = v.trim().toLowerCase();
  return t === '1' || t === 'true' || t === 'yes' || t === 'on';
}

/** Lê configuração do pool opcional integra_ssp (Postgres ou SQL Server). */
export function parseIntegraSspConfig(env: NodeJS.ProcessEnv): IntegraSspConfig | null {
  const mssqlHost = env.INTEGRA_SSP_MSSQL_HOST?.trim();
  if (mssqlHost) {
    const portRaw = env.INTEGRA_SSP_MSSQL_PORT?.trim();
    const port = portRaw ? Number.parseInt(portRaw, 10) : 1433;
    const database = env.INTEGRA_SSP_MSSQL_DATABASE?.trim() || 'integra_ssp';
    const user = env.INTEGRA_SSP_MSSQL_USER?.trim();
    const password = env.INTEGRA_SSP_MSSQL_PASSWORD ?? '';
    if (!user) return null;
    const trustDefault = env.INTEGRA_SSP_MSSQL_TRUST_SERVER_CERTIFICATE == null;
    const trustServerCertificate =
      trustDefault || truthyEnv(env.INTEGRA_SSP_MSSQL_TRUST_SERVER_CERTIFICATE);
    const encrypt =
      env.INTEGRA_SSP_MSSQL_ENCRYPT == null ? true : truthyEnv(env.INTEGRA_SSP_MSSQL_ENCRYPT);
    const tlsServerName = env.INTEGRA_SSP_MSSQL_TLS_SERVER_NAME?.trim() || undefined;
    return {
      driver: 'mssql',
      server: mssqlHost,
      port: Number.isFinite(port) && port > 0 ? port : 1433,
      database,
      user,
      password,
      trustServerCertificate,
      tlsServerName,
      encrypt,
    };
  }

  const url = env.INTEGRA_SSP_DATABASE_URL?.trim();
  if (url && /^postgres(ql)?:\/\//i.test(url)) {
    return { driver: 'postgres', url };
  }

  return null;
}
