import type { PoolConfig } from 'pg';

const SSL_QUERY_KEYS = new Set([
  'sslmode',
  'ssl',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'uselibpqcompat',
]);

function connectionStringWithoutSslQueryParams(connectionString: string): string {
  const qIndex = connectionString.indexOf('?');
  if (qIndex === -1) return connectionString;

  const base = connectionString.slice(0, qIndex);
  const query = connectionString.slice(qIndex + 1);

  const kept = query
    .split('&')
    .map((p) => p.trim())
    .filter(Boolean)
    .filter((pair) => {
      const key = pair.split('=')[0]?.toLowerCase();
      return key && !SSL_QUERY_KEYS.has(key);
    })
    .join('&');

  return kept ? `${base}?${kept}` : base;
}

function shouldUseSsl(connectionString: string): boolean {
  // 👉 Força SSL se for DigitalOcean
  if (connectionString.includes('.ondigitalocean.com')) {
    return true;
  }

  // 👉 Ou se explicitamente configurado
  const envValue = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  if (envValue === '0' || envValue?.toLowerCase() === 'false') {
    return true;
  }

  const insecure = process.env.DATABASE_PG_TLS_INSECURE;
  if (insecure === '1' || insecure?.toLowerCase() === 'true') {
    return true;
  }

  return false;
}

export function buildPgPoolConfig(connectionString: string): PoolConfig {
  const useSsl = shouldUseSsl(connectionString);

  if (!useSsl) {
    return {
      connectionString: connectionStringWithoutSslQueryParams(connectionString),
    };
  }

  return {
    connectionString: connectionStringWithoutSslQueryParams(connectionString),
    ssl: {
      rejectUnauthorized: false,
    },
  };
}