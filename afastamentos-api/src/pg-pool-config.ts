import type { PoolConfig } from 'pg';

/**
 * Remove parâmetros de SSL da query string. Em versões recentes do driver
 * `pg`, `sslmode=require` (e similares) na URL é interpretado como
 * `verify-full`, o que conflita com `rejectUnauthorized: false` e ainda
 * gera "self-signed certificate in certificate chain".
 */
function connectionStringWithoutSslQueryParams(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    u.searchParams.delete('sslmode');
    u.searchParams.delete('ssl');
    u.searchParams.delete('sslrootcert');
    u.searchParams.delete('sslcert');
    u.searchParams.delete('sslkey');
    u.searchParams.delete('uselibpqcompat');
    const qs = u.searchParams.toString();
    u.search = qs ? `?${qs}` : '';
    return u.toString();
  } catch {
    return connectionString;
  }
}

/**
 * Monta opções do `pg.Pool` para Postgres com TLS (ex.: certificado
 * autoassinado ou CA interna). Use com cuidado: desativar a verificação
 * expõe a conexão a MITM se a rede não for confiável.
 *
 * Defina `DATABASE_SSL_REJECT_UNAUTHORIZED=false` no ambiente quando o
 * servidor usar certificado que o Node não confia por padrão.
 */
export function buildPgPoolConfig(connectionString: string): PoolConfig {
  const raw = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED;
  const relaxSsl = raw === '0' || raw?.toLowerCase() === 'false';
  if (!relaxSsl) {
    return { connectionString };
  }
  return {
    connectionString: connectionStringWithoutSslQueryParams(connectionString),
    ssl: { rejectUnauthorized: false },
  };
}
