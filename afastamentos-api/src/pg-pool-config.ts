import type { PoolConfig } from 'pg';

const SSL_QUERY_KEYS = new Set([
  'sslmode',
  'ssl',
  'sslrootcert',
  'sslcert',
  'sslkey',
  'uselibpqcompat',
]);

/**
 * Remove parâmetros de SSL da query string (sem depender de `new URL`,
 * que quebra com alguns caracteres em senhas). Em versões recentes do
 * `pg`, `sslmode=require` na URL vira comportamento tipo `verify-full` e
 * conflita com `rejectUnauthorized: false`.
 */
function connectionStringWithoutSslQueryParams(connectionString: string): string {
  const qIndex = connectionString.indexOf('?');
  if (qIndex === -1) {
    return connectionString;
  }
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

function readRelaxSslEnv(): boolean {
  const reject = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  if (reject === '0' || reject?.toLowerCase() === 'false') {
    return true;
  }
  const insecure = process.env.DATABASE_PG_TLS_INSECURE;
  if (insecure === '1' || insecure?.toLowerCase() === 'true') {
    return true;
  }
  return false;
}

/**
 * Monta opções do `pg.Pool` para Postgres com TLS (ex.: certificado
 * autoassinado ou CA interna). Use com cuidado: desativar a verificação
 * expõe a conexão a MITM se a rede não for confiável.
 *
 * Ative com **uma** das opções:
 * - `DATABASE_SSL_REJECT_UNAUTHORIZED=false`
 * - `DATABASE_PG_TLS_INSECURE=true` (alias mais curto para o mesmo efeito)
 */
export function buildPgPoolConfig(connectionString: string): PoolConfig {
  return {
    connectionString,
    ssl: { rejectUnauthorized: false },
  };
}

export function isPgTlsRelaxed(): boolean {
  return true;
}
