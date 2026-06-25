import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  StreamableFile,
} from '@nestjs/common';
import { QualidadeRegistroStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateQualidadeRegistroDto } from './dto/create-qualidade-registro.dto';
import { UpdateQualidadeRegistroDto } from './dto/update-qualidade-registro.dto';
import { IntegraSspPoolService } from './integra-ssp-pool.service';
import { intervaloDiaAtualBrasilia } from './integra-ssp-brasilia.util';
import {
  type ChamadaIntegraSspRow,
  type ChamadaQualidadeApiRow,
  mapChamadaIntegraSspParaApi,
} from './integra-ssp-chamadas.mapper';
import { ramalAtendeFiltroQualidade, SQL_WHERE_RAMAL_PREFIXO_MSSQL, SQL_WHERE_RAMAL_PREFIXO_POSTGRES } from './integra-ssp-chamadas.filter';
import { buscarLocalizacoesPorChamadaIds } from './integra-ssp-chamadas-localizacao.util';
import { listarOcorrenciasIntegraPaginado } from './integra-ssp-ocorrencias.util';
import { listarChamadasIntegraPaginado } from './integra-ssp-chamadas-listagem.util';
import { listarCatalogoNaturezasIntegra } from './integra-ssp-naturezas.util';
import { consultarCoberturaChamadasIntegra } from './integra-ssp-cobertura.util';
import {
  nomeArquivoGravacao,
  parseRecordFileConfig,
  resolveRecordFileDownloadUrl,
  type RecordFileConfig,
} from './integra-ssp-record-file.util';

export type UsuarioOrionQualidadeReq = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
  isAdmin?: boolean;
  nivel?: { nome?: string | null } | null;
};

/**
 * Órion Qualidade: dados de negócio do próprio módulo (registros, cruzamento com `Policial`) vêm do
 * Prisma (`DATABASE_URL`). O `IntegraSspPoolService` é opcional e separado — só para integrações
 * com o banco remoto integra_ssp ao desenvolver ferramentas; nunca para validar credenciais.
 */
@Injectable()
export class OrionQualidadeService {
  /** Período máximo permitido na consulta de chamadas (evita travamentos). */
  private static readonly PERIODO_MAXIMO_CHAMADAS_MS = 31 * 24 * 60 * 60 * 1000;

  /** Partículas que não contam como “nome” para exigir dois termos na planilha. */
  private static readonly PARTICULAS_NOME = new Set([
    'de',
    'da',
    'do',
    'dos',
    'das',
    'e',
    'a',
    'o',
    'ao',
    'aos',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integraSspPool: IntegraSspPoolService,
  ) {}

  private readonly recordFileConfig: RecordFileConfig | null = parseRecordFileConfig(process.env);

  private enrichChamadasComGravacao(rows: ChamadaQualidadeApiRow[]): ChamadaQualidadeApiRow[] {
    return rows.map((row) => ({ ...row, recordFileUrl: '' }));
  }

  podeAcessarOrionQualidade(usuario: UsuarioOrionQualidadeReq): boolean {
    if (usuario.isAdmin === true) return true;
    const nomeNivel = usuario.nivel?.nome?.trim().toUpperCase();
    if (nomeNivel === 'ADMINISTRADOR') return true;
    const ids = (usuario.sistemasPermitidos ?? []).map((s) => String(s).trim().toUpperCase());
    return ids.includes('ORION_QUALIDADE');
  }

  private assertAcessoModulo(usuario: UsuarioOrionQualidadeReq): void {
    if (!this.podeAcessarOrionQualidade(usuario)) {
      throw new ForbiddenException(
        'Acesso ao Órion Qualidade não autorizado para este perfil. Um administrador deve incluir o módulo "Órion Qualidade" em seus sistemas permitidos (SAD → Usuários).',
      );
    }
  }

  getPublicMeta() {
    return {
      sistema: 'orion-qualidade',
      nome: 'Órion Qualidade',
      versao: '0.2.0',
      fase: 'dashboard-visual',
      /** Indicador fixo: login/JWT/usuários usam sempre o Prisma (`DATABASE_URL`), nunca integra_ssp. */
      autenticacaoViaPrisma: true,
      integraSspConfigurado: this.integraSspPool.isConfigured(),
      integraSspDriver: this.integraSspPool.getDriver(),
    };
  }

  /** Diagnóstico do pool opcional integra_ssp (ferramentas). Autenticação não usa esta URL. */
  async statusIntegraSsp(usuario: UsuarioOrionQualidadeReq) {
    this.assertAcessoModulo(usuario);
    const configurado = this.integraSspPool.isConfigured();
    const ping = await this.integraSspPool.ping();
    if (ping.ok) {
      return {
        configurado,
        conectado: true,
        driver: ping.driver,
        bancoAtual: ping.bancoAtual,
        gravacaoDownloadConfigurada: this.recordFileConfig != null,
      };
    }
    return {
      configurado,
      conectado: false,
      mensagem: ping.mensagem,
      gravacaoDownloadConfigurada: this.recordFileConfig != null,
    };
  }

  private resolverIntervaloConsultaIntegra(opts?: {
    dataInicio?: string;
    dataFim?: string;
  }): { dataInicio: Date; dataFim: Date; rotuloDia: string } {
    if (opts?.dataInicio || opts?.dataFim) {
      if (!opts.dataInicio || !opts.dataFim) {
        throw new BadRequestException('Informe dataInicio e dataFim juntos (ISO 8601).');
      }
      const dataInicio = new Date(opts.dataInicio);
      const dataFim = new Date(opts.dataFim);
      if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
        throw new BadRequestException('dataInicio ou dataFim inválidos.');
      }
      if (dataFim.getTime() < dataInicio.getTime()) {
        throw new BadRequestException('dataFim deve ser posterior a dataInicio.');
      }
      if (dataFim.getTime() - dataInicio.getTime() > OrionQualidadeService.PERIODO_MAXIMO_CHAMADAS_MS) {
        throw new BadRequestException('Período máximo para consulta: 31 dias.');
      }
      return { dataInicio, dataFim, rotuloDia: opts.dataInicio.slice(0, 10) };
    }
    const intervalo = intervaloDiaAtualBrasilia();
    return {
      dataInicio: intervalo.dataInicio,
      dataFim: intervalo.dataFim,
      rotuloDia: intervalo.rotuloDia,
    };
  }

  /**
   * Chamadas do HEFESTO (Integra SSP) para gráficos do Órion Qualidade.
   * Por padrão retorna o dia civil atual em Brasília a partir de 00:01.
   */
  async listarChamadasIntegraSsp(
    usuario: UsuarioOrionQualidadeReq,
    opts?: { dataInicio?: string; dataFim?: string },
  ) {
    this.assertAcessoModulo(usuario);

    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integra SSP não configurado na API. Defina INTEGRA_SSP_MSSQL_* ou INTEGRA_SSP_DATABASE_URL.',
      );
    }

    const { dataInicio, dataFim, rotuloDia } = this.resolverIntervaloConsultaIntegra(opts);

    const queryText =
      this.integraSspPool.getDriver() === 'postgres'
        ? `
          SELECT c.id, c.unique_id, c.chamador, c.fila, c.ramal, c.status,
                 c.hora_entra_fila, c.hora_atende, c.hora_desliga,
                 c.tempo_espera, c.duracao, c.quem_desliga,
                 c."NO_USER_CADASTRO",
                 c.record_file,
                 m.motivo_encerramento
          FROM "PRD_STG_HEFESTO"."CHAMADAS" c
          LEFT JOIN "PRD_STG_HEFESTO"."MOTIVO_ENCERRAMENTO" m
            ON m.id = c.cod_motivo_encerramento
          WHERE c.hora_entra_fila >= $1 AND c.hora_entra_fila <= $2
            ${SQL_WHERE_RAMAL_PREFIXO_POSTGRES}
          ORDER BY c.hora_entra_fila ASC
        `
        : `
          SELECT c.id, c.unique_id, c.chamador, c.fila, c.ramal, c.status,
                 c.hora_entra_fila, c.hora_atende, c.hora_desliga,
                 c.tempo_espera, c.duracao, c.quem_desliga,
                 c.NO_USER_CADASTRO,
                 c.record_file,
                 m.motivo_encerramento
          FROM PRD_STG_HEFESTO.CHAMADAS c
          LEFT JOIN PRD_STG_HEFESTO.MOTIVO_ENCERRAMENTO m
            ON m.id = c.cod_motivo_encerramento
          WHERE c.hora_entra_fila >= @dataInicio AND c.hora_entra_fila <= @dataFim
            ${SQL_WHERE_RAMAL_PREFIXO_MSSQL}
          ORDER BY c.hora_entra_fila ASC
        `;

    let rowsBrutas: ChamadaIntegraSspRow[];
    try {
      rowsBrutas = await this.integraSspPool.queryRows<ChamadaIntegraSspRow>(queryText, {
        dataInicio,
        dataFim,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao consultar chamadas no Integra SSP: ${msg}`);
    }

    const rows = this.enrichChamadasComGravacao(
      rowsBrutas
        .filter((row) => ramalAtendeFiltroQualidade(row.ramal))
        .map(mapChamadaIntegraSspParaApi),
    );

    const coberturaIntegra = await consultarCoberturaChamadasIntegra(
      this.integraSspPool,
      dataInicio,
      dataFim,
    );

    return {
      fonte: 'integra_ssp' as const,
      rotuloDia,
      dataInicio: dataInicio.toISOString(),
      dataFim: dataFim.toISOString(),
      total: rows.length,
      coberturaIntegra,
      rows,
    };
  }

  private async buscarRecordFileChamada(id: string): Promise<string | null> {
    const idNum = Number.parseInt(id, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) return null;

    const queryText =
      this.integraSspPool.getDriver() === 'postgres'
        ? `SELECT record_file FROM "PRD_STG_HEFESTO"."CHAMADAS" WHERE id = $1`
        : `SELECT record_file FROM PRD_STG_HEFESTO.CHAMADAS WHERE id = @id`;

    const rows = await this.integraSspPool.queryRows<{ record_file?: string | null }>(queryText, {
      id: idNum,
    });
    const raw = rows[0]?.record_file;
    if (raw == null) return null;
    const texto = String(raw).trim();
    return texto.length > 0 ? texto : null;
  }

  /** Baixa o áudio da chamada (proxy autenticado para o arquivo Asterisk). */
  async baixarGravacaoChamadaIntegraSsp(
    usuario: UsuarioOrionQualidadeReq,
    id: string,
  ): Promise<StreamableFile> {
    this.assertAcessoModulo(usuario);

    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException('Integra SSP não configurado na API.');
    }
    if (!this.recordFileConfig) {
      throw new ServiceUnavailableException(
        'Download de gravações não configurado. Defina INTEGRA_SSP_RECORD_FILE_BASE_URL no .env da API ' +
          '(o caminho do arquivo vem de record_file no banco, ex.: /var/spool/asterisk/monitor/...).',
      );
    }

    let recordFile: string | null;
    try {
      recordFile = await this.buscarRecordFileChamada(id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao consultar gravação no Integra SSP: ${msg}`);
    }

    if (!recordFile) {
      throw new NotFoundException('Gravação não encontrada para esta chamada.');
    }

    const downloadUrl = resolveRecordFileDownloadUrl(recordFile, this.recordFileConfig);
    if (!downloadUrl) {
      throw new ServiceUnavailableException('Não foi possível montar a URL de download da gravação.');
    }

    let response: Response;
    try {
      response = await fetch(downloadUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao acessar o servidor de gravações: ${msg}`);
    }

    if (!response.ok) {
      throw new NotFoundException(
        `Arquivo de gravação indisponível no servidor (${response.status}). Verifique INTEGRA_SSP_RECORD_FILE_BASE_URL.`,
      );
    }

    const filename = nomeArquivoGravacao(recordFile);
    const contentType = response.headers.get('content-type')?.trim() || 'audio/wav';
    const buffer = Buffer.from(await response.arrayBuffer());

    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
    });
  }

  /** Localização (OCORRENCIA) sob demanda — usada na modal de registros do atendente. */
  async localizacoesChamadasIntegraSsp(usuario: UsuarioOrionQualidadeReq, ids: number[]) {
    this.assertAcessoModulo(usuario);
    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException('Integra SSP não configurado na API.');
    }
    const unicos = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(0, 2000);
    if (unicos.length === 0) {
      return { itens: [] as Array<{ id: number; latitude: string; longitude: string }> };
    }
    try {
      const map = await buscarLocalizacoesPorChamadaIds(this.integraSspPool, unicos);
      const itens = [...map.entries()].map(([id, loc]) => ({
        id,
        latitude: loc.latitude,
        longitude: loc.longitude,
      }));
      return { itens };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao consultar localizações: ${msg}`);
    }
  }

  /** Ocorrências HEFESTO (Integra SSP) — listagem paginada para exploração de dados. */
  async listarOcorrenciasIntegraSsp(
    usuario: UsuarioOrionQualidadeReq,
    opts?: { page?: number; dataInicio?: string; dataFim?: string },
  ) {
    this.assertAcessoModulo(usuario);

    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integra SSP não configurado na API. Defina INTEGRA_SSP_MSSQL_* ou INTEGRA_SSP_DATABASE_URL.',
      );
    }

    const { dataInicio, dataFim, rotuloDia } = this.resolverIntervaloConsultaIntegra(opts);

    try {
      const paginado = await listarOcorrenciasIntegraPaginado(this.integraSspPool, {
        dataInicio,
        dataFim,
        page: opts?.page ?? 1,
      });

      return {
        fonte: 'integra_ssp' as const,
        tabela: 'PRD_STG_HEFESTO.OCORRENCIA',
        rotuloDia,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        ...paginado,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao consultar ocorrências no Integra SSP: ${msg}`);
    }
  }

  /** Chamadas HEFESTO (Integra SSP) — listagem paginada da tabela CHAMADAS. */
  async listarChamadasTabelaIntegraSsp(
    usuario: UsuarioOrionQualidadeReq,
    opts?: { page?: number; dataInicio?: string; dataFim?: string },
  ) {
    this.assertAcessoModulo(usuario);

    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integra SSP não configurado na API. Defina INTEGRA_SSP_MSSQL_* ou INTEGRA_SSP_DATABASE_URL.',
      );
    }

    const { dataInicio, dataFim, rotuloDia } = this.resolverIntervaloConsultaIntegra(opts);

    try {
      const paginado = await listarChamadasIntegraPaginado(this.integraSspPool, {
        dataInicio,
        dataFim,
        page: opts?.page ?? 1,
      });

      const coberturaIntegra = await consultarCoberturaChamadasIntegra(
        this.integraSspPool,
        dataInicio,
        dataFim,
      );

      return {
        fonte: 'integra_ssp' as const,
        tabela: 'PRD_STG_HEFESTO.CHAMADAS',
        rotuloDia,
        dataInicio: dataInicio.toISOString(),
        dataFim: dataFim.toISOString(),
        coberturaIntegra,
        ...paginado,
        items: this.enrichChamadasComGravacao(paginado.items),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao consultar chamadas no Integra SSP: ${msg}`);
    }
  }

  /**
   * Catálogo NAT-* → descrição legível.
   * Não existe tabela de domínio acessível no Integra SSP; descrições vêm da narrativa.
   */
  async catalogoNaturezasIntegraSsp(usuario: UsuarioOrionQualidadeReq) {
    this.assertAcessoModulo(usuario);

    if (!this.integraSspPool.isConfigured()) {
      throw new ServiceUnavailableException(
        'Integra SSP não configurado na API. Defina INTEGRA_SSP_MSSQL_* ou INTEGRA_SSP_DATABASE_URL.',
      );
    }

    try {
      const items = await listarCatalogoNaturezasIntegra(this.integraSspPool);
      const comDescricao = items.filter((i) => i.descricao).length;
      return {
        fonte: 'integra_ssp' as const,
        metodo: 'narrativa' as const,
        tabelaDominio: null as string | null,
        aviso:
          'Não há tabela de naturezas no Integra SSP acessível a este usuário. ' +
          'As descrições foram inferidas do campo narrativa (padrão "Natureza: … | Descrição:").',
        totalCodigos: items.length,
        totalComDescricao: comDescricao,
        items,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new ServiceUnavailableException(`Falha ao montar catálogo de naturezas: ${msg}`);
    }
  }

  sessaoResumo(usuario: UsuarioOrionQualidadeReq) {
    const pode = this.podeAcessarOrionQualidade(usuario);
    return {
      ok: true,
      sistema: 'orion-qualidade',
      podeAcessarModulo: pode,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: pode
        ? 'Módulo disponível: registros de gestão da qualidade.'
        : 'Seu usuário autenticou na API, mas não possui permissão para usar o Órion Qualidade.',
    };
  }

  async listarRegistros(usuario: UsuarioOrionQualidadeReq) {
    this.assertAcessoModulo(usuario);
    return this.prisma.qualidadeRegistro.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async criarRegistro(
    usuario: UsuarioOrionQualidadeReq,
    dto: CreateQualidadeRegistroDto,
  ) {
    this.assertAcessoModulo(usuario);
    return this.prisma.qualidadeRegistro.create({
      data: {
        titulo: dto.titulo.trim(),
        descricao: dto.descricao?.trim() || null,
        criadoPorId: usuario.id,
        criadoPorNome: usuario.nome,
      },
    });
  }

  async atualizarRegistro(
    usuario: UsuarioOrionQualidadeReq,
    id: number,
    dto: UpdateQualidadeRegistroDto,
  ) {
    this.assertAcessoModulo(usuario);
    const existente = await this.prisma.qualidadeRegistro.findUnique({
      where: { id },
    });
    if (!existente) {
      throw new NotFoundException('Registro não encontrado.');
    }

    if (
      dto.titulo === undefined &&
      dto.descricao === undefined &&
      dto.status === undefined
    ) {
      throw new BadRequestException(
        'Informe ao menos um campo para atualizar (título, descrição ou status).',
      );
    }

    const data: {
      titulo?: string;
      descricao?: string | null;
      status?: QualidadeRegistroStatus;
      atualizadoPorId: number;
      atualizadoPorNome: string;
    } = {
      atualizadoPorId: usuario.id,
      atualizadoPorNome: usuario.nome,
    };

    if (dto.titulo !== undefined) {
      data.titulo = dto.titulo.trim();
    }
    if (dto.descricao !== undefined) {
      data.descricao = dto.descricao.trim() || null;
    }
    if (dto.status !== undefined) {
      data.status = dto.status;
    }

    return this.prisma.qualidadeRegistro.update({
      where: { id },
      data,
    });
  }

  private normalizarNomeComparacao(s: string): string {
    return s
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Palavras com ≥2 caracteres, ignorando partículas (de, da…). */
  private tokensNomeParaMatch(s: string): string[] {
    const n = this.normalizarNomeComparacao(s);
    const parts = n
      .split(/[\s\-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);
    return parts.filter((t) => !OrionQualidadeService.PARTICULAS_NOME.has(t));
  }

  /** Cada token da planilha deve aparecer como token inteiro no nome do cadastro. */
  private nomeCadastroContemTodosTokensPlanilha(
    nomeCadastro: string,
    tokensPlanilha: string[],
  ): boolean {
    if (tokensPlanilha.length < 2) return false;
    const setCad = new Set(this.tokensNomeParaMatch(nomeCadastro));
    return tokensPlanilha.every((t) => setCad.has(t));
  }

  private escolherMelhorPolicialEntreCandidatos(
    candidatos: { id: number; nome: string; equipe: string | null }[],
    qtdTokensPlanilha: number,
  ): { id: number; nome: string; equipe: string | null } | undefined {
    if (candidatos.length === 0) return undefined;
    if (candidatos.length === 1) return candidatos[0];
    return [...candidatos].sort((a, b) => {
      const lenA = this.tokensNomeParaMatch(a.nome).length;
      const lenB = this.tokensNomeParaMatch(b.nome).length;
      const dA = Math.abs(lenA - qtdTokensPlanilha);
      const dB = Math.abs(lenB - qtdTokensPlanilha);
      if (dA !== dB) return dA - dB;
      return a.id - b.id;
    })[0];
  }

  /**
   * Cruza nomes do XLSX (atendentes) com cadastro de policiais ativos no SAD e retorna a equipe.
   * - Nome completo igual (normalizado): aceita.
   * - Pelo menos 2 termos significativos na planilha: todos devem aparecer como palavras no nome do cadastro
   *   (ex.: planilha "João Silva" casa com "João Carlos Silva Santos").
   * - Só 1 termo na planilha após filtros: mantém apenas igualdade do nome completo normalizado.
   */
  async resolverEquipesPorNomes(
    usuario: UsuarioOrionQualidadeReq,
    nomes: string[],
  ): Promise<{
    itens: Array<{
      nome: string;
      equipe: string | null;
      encontrado: boolean;
      nomeCadastro: string | null;
    }>;
  }> {
    this.assertAcessoModulo(usuario);

    const vistos = new Set<string>();
    const uniq: string[] = [];
    for (const raw of nomes) {
      const n = String(raw ?? '').trim();
      if (!n || n === '(Não informado)') continue;
      if (vistos.has(n)) continue;
      vistos.add(n);
      uniq.push(n);
      if (uniq.length >= 400) break;
    }

    if (uniq.length === 0) {
      return { itens: [] };
    }

    const policiais = await this.prisma.policial.findMany({
      where: { status: { nome: { not: 'DESATIVADO' } } },
      select: { id: true, nome: true, equipe: true },
      orderBy: { id: 'asc' },
    });

    const itens = uniq.map((nome) => {
      const normPla = this.normalizarNomeComparacao(nome);
      const tPlan = this.tokensNomeParaMatch(nome);

      const candidatos = policiais.filter((p) => {
        const normCad = this.normalizarNomeComparacao(p.nome);
        if (normPla.length > 0 && normCad === normPla) {
          return true;
        }
        if (tPlan.length >= 2) {
          return this.nomeCadastroContemTodosTokensPlanilha(p.nome, tPlan);
        }
        return false;
      });

      const hit = this.escolherMelhorPolicialEntreCandidatos(candidatos, tPlan.length);
      const equipeVal = hit?.equipe?.trim() ? hit.equipe.trim() : null;

      return {
        nome,
        equipe: equipeVal,
        encontrado: Boolean(hit),
        nomeCadastro: hit?.nome ?? null,
      };
    });

    return { itens };
  }
}
