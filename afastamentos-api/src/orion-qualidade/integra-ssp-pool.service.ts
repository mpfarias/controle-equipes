import { Injectable, OnModuleDestroy } from '@nestjs/common';
import sql from 'mssql';
import { Pool } from 'pg';
import { buildPgPoolConfig } from '../pg-pool-config';
import { parseIntegraSspConfig, type IntegraSspConfig } from './integra-ssp-config';
import { buildIntegraSspMssqlPoolConfig } from './integra-ssp-mssql.util';

/**
 * Pool opcional para o banco remoto integra_ssp (SQL Server ou PostgreSQL), usado apenas
 * para consultas do Órion Qualidade — não para login, JWT nem cadastro de usuários.
 *
 * SQL Server (produção): INTEGRA_SSP_MSSQL_HOST, PORT, DATABASE, USER, PASSWORD.
 * PostgreSQL (legado/dev): INTEGRA_SSP_DATABASE_URL=postgresql://...
 */
@Injectable()
export class IntegraSspPoolService implements OnModuleDestroy {
  private readonly config: IntegraSspConfig | null;
  private readonly pgPool: Pool | null;
  private mssqlPool: sql.ConnectionPool | null = null;
  private mssqlPoolPromise: Promise<sql.ConnectionPool> | null = null;

  constructor() {
    this.config = parseIntegraSspConfig(process.env);
    this.pgPool =
      this.config?.driver === 'postgres'
        ? new Pool(buildPgPoolConfig(this.config.url))
        : null;
  }

  isConfigured(): boolean {
    return this.config != null;
  }

  getDriver(): 'mssql' | 'postgres' | null {
    return this.config?.driver ?? null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pgPool?.end();
    if (this.mssqlPool) {
      try {
        await this.mssqlPool.close();
      } catch {
        /* ignore */
      }
      this.mssqlPool = null;
    }
    this.mssqlPoolPromise = null;
  }

  private async getMssqlPool(): Promise<sql.ConnectionPool> {
    if (this.config?.driver !== 'mssql') {
      throw new Error('Pool MSSQL não configurado.');
    }
    if (this.mssqlPool?.connected) return this.mssqlPool;
    if (this.mssqlPoolPromise) return this.mssqlPoolPromise;

    const cfg = this.config;
    this.mssqlPoolPromise = (async () => {
      const pool = new sql.ConnectionPool(buildIntegraSspMssqlPoolConfig(cfg));
      await pool.connect();
      this.mssqlPool = pool;
      return pool;
    })();

    try {
      return await this.mssqlPoolPromise;
    } catch (e) {
      this.mssqlPoolPromise = null;
      throw e;
    }
  }

  async ping(): Promise<
    | { ok: true; bancoAtual: string; driver: 'mssql' | 'postgres' }
    | { ok: false; mensagem: string }
  > {
    if (!this.config) {
      return {
        ok: false,
        mensagem:
          'Integra SSP não configurado. Defina INTEGRA_SSP_MSSQL_* (SQL Server) ou INTEGRA_SSP_DATABASE_URL (PostgreSQL).',
      };
    }

    try {
      if (this.config.driver === 'postgres') {
        if (!this.pgPool) {
          return { ok: false, mensagem: 'Pool PostgreSQL não inicializado.' };
        }
        const r = await this.pgPool.query<{ current_database: string }>(
          'SELECT current_database() AS current_database',
        );
        const bancoAtual = r.rows[0]?.current_database?.trim() || '';
        return { ok: true, bancoAtual: bancoAtual || '?', driver: 'postgres' };
      }

      const pool = await this.getMssqlPool();
      const r = await pool.request().query<{ banco_atual: string }>(
        'SELECT DB_NAME() AS banco_atual',
      );
      const bancoAtual = r.recordset[0]?.banco_atual?.trim() || '';
      return { ok: true, bancoAtual: bancoAtual || '?', driver: 'mssql' };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      return { ok: false, mensagem };
    }
  }

  /** Consulta SQL no integra_ssp (somente SELECT). */
  async queryRows<T extends Record<string, unknown>>(
    queryText: string,
    params?: Record<string, string | number | Date | null>,
  ): Promise<T[]> {
    if (!this.config) {
      throw new Error('Integra SSP não configurado.');
    }

    if (this.config.driver === 'postgres') {
      if (!this.pgPool) throw new Error('Pool PostgreSQL não inicializado.');
      if (params && Object.keys(params).length > 0) {
        const values = Object.values(params);
        const r = await this.pgPool.query<T>(queryText, values);
        return r.rows;
      }
      const r = await this.pgPool.query<T>(queryText);
      return r.rows;
    }

    const pool = await this.getMssqlPool();
    const req = pool.request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        req.input(key, value);
      }
    }
    const r = await req.query<T>(queryText);
    return r.recordset ?? [];
  }
}
