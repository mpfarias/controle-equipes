import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { buildPgPoolConfig } from '../pg-pool-config';

/**
 * Pool opcional para o banco remoto integra_ssp (PostgreSQL), usado apenas para ferramentas
 * e consultas do módulo — não para login, JWT nem cadastro de usuários.
 *
 * Autenticação e permissões do ecossistema permanecem sempre no banco principal da API
 * (`DATABASE_URL` / Prisma: tabelas `Usuario`, `AcessoLog`, etc.).
 *
 * Defina `INTEGRA_SSP_DATABASE_URL` no ambiente da API — não no front do Órion Qualidade.
 * Microsoft SQL Server exigiria outro driver (`tedious`/`mssql`); este serviço é só Postgres.
 */
@Injectable()
export class IntegraSspPoolService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('INTEGRA_SSP_DATABASE_URL')?.trim();
    this.pool = url ? new Pool(buildPgPoolConfig(url)) : null;
  }

  isConfigured(): boolean {
    return this.pool != null;
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  async ping(): Promise<
    | { ok: true; bancoAtual: string }
    | { ok: false; mensagem: string }
  > {
    if (!this.pool) {
      return { ok: false, mensagem: 'INTEGRA_SSP_DATABASE_URL não definida no servidor.' };
    }
    try {
      const r = await this.pool.query<{ current_database: string }>(
        'SELECT current_database() AS current_database',
      );
      const bancoAtual = r.rows[0]?.current_database?.trim() || '';
      return { ok: true, bancoAtual: bancoAtual || '?' };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      return { ok: false, mensagem };
    }
  }
}
