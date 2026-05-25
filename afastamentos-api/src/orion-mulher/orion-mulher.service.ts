import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MulherOperadorPerfilEnum,
  MulherOrigemOcorrencia,
  MulherVitimaPanicEncaminhamento,
  MulherVitimaPanicFinalizacao,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { MulherDashboardService } from './mulher-dashboard.service';
import { MulherExcelImportService } from './mulher-excel-import.service';
import {
  MULHER_OCORRENCIAS_PAGE_SIZE,
  UsuarioOrionMulherReq,
  buildMulherOccurrenceWhere,
  mulherOccurrenceListSelect,
  normalizarTelefoneDigits,
  pickMulherOccurrenceInput,
  validarTelefoneDigits,
} from './mulher-ocorrencia.util';

export type { UsuarioOrionMulherReq } from './mulher-ocorrencia.util';

@Injectable()
export class OrionMulherService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dashboardService: MulherDashboardService,
    private readonly excelImportService: MulherExcelImportService,
  ) {}

  podeAcessarOrionMulher(usuario: UsuarioOrionMulherReq): boolean {
    if (usuario.isAdmin === true) return true;
    const nomeNivel = usuario.nivel?.nome?.trim().toUpperCase();
    if (nomeNivel === 'ADMINISTRADOR') return true;
    const ids = (usuario.sistemasPermitidos ?? []).map((s) => String(s).trim().toUpperCase());
    return ids.includes('ORION_MULHER');
  }

  private assertAcessoModulo(usuario: UsuarioOrionMulherReq): void {
    if (!this.podeAcessarOrionMulher(usuario)) {
      throw new ForbiddenException(
        'Acesso ao Órion Mulher não autorizado. Inclua "Órion Mulher" em sistemas permitidos (SAD → Usuários).',
      );
    }
  }

  async resolvePerfil(usuario: UsuarioOrionMulherReq): Promise<MulherOperadorPerfilEnum> {
    if (usuario.isAdmin === true) return 'ADMINISTRADOR';
    const nomeNivel = usuario.nivel?.nome?.trim().toUpperCase();
    if (nomeNivel === 'ADMINISTRADOR') return 'ADMINISTRADOR';
    const row = await this.prisma.mulherOperadorPerfil.findUnique({
      where: { usuarioId: usuario.id },
    });
    return row?.perfil ?? 'ATENDENTE';
  }

  private async assertPerfilMinimo(
    usuario: UsuarioOrionMulherReq,
    allowed: MulherOperadorPerfilEnum[],
  ): Promise<MulherOperadorPerfilEnum> {
    this.assertAcessoModulo(usuario);
    const perfil = await this.resolvePerfil(usuario);
    if (!allowed.includes(perfil)) {
      throw new ForbiddenException('Sem permissão para esta operação no Órion Mulher.');
    }
    return perfil;
  }

  private async registrarAuditoria(
    usuario: UsuarioOrionMulherReq | null,
    acao: string,
    entidade: string,
    entidadeId?: string,
    detalhes?: Record<string, unknown>,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.prisma.mulherAuditoria.create({
      data: {
        usuarioId: usuario?.id ?? null,
        usuarioNome: usuario?.nome ?? null,
        acao,
        entidade,
        entidadeId: entidadeId ?? null,
        detalhes: detalhes ? JSON.stringify(detalhes) : null,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      },
    });
  }

  getPublicMeta() {
    return {
      sistema: 'orion-mulher',
      nome: 'Órion Mulher',
      versao: '1.0.0',
      fase: 'ocorrencias-central-vitima',
    };
  }

  async sessaoResumo(usuario: UsuarioOrionMulherReq) {
    const pode = this.podeAcessarOrionMulher(usuario);
    const perfil = pode ? await this.resolvePerfil(usuario) : null;
    return {
      ok: true,
      sistema: 'orion-mulher',
      podeAcessarModulo: pode,
      perfil,
      usuario: { id: usuario.id, nome: usuario.nome, matricula: usuario.matricula },
      mensagem: pode
        ? 'Módulo COPOM Mulher — ocorrências de violência doméstica, central da vítima e painel BI.'
        : 'Usuário autenticado sem permissão ORION_MULHER.',
    };
  }

  async listarOcorrencias(
    usuario: UsuarioOrionMulherReq,
    params: { page?: number; q?: string; porId?: string; porCad?: string },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE', 'CONSULTA']);
    const where = buildMulherOccurrenceWhere(params.q, params.porId, params.porCad);
    const total = await this.prisma.mulherOcorrencia.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / MULHER_OCORRENCIAS_PAGE_SIZE));
    const page = Math.min(Math.max(1, Math.floor(params.page ?? 1) || 1), totalPages);
    const skip = (page - 1) * MULHER_OCORRENCIAS_PAGE_SIZE;
    const items = await this.prisma.mulherOcorrencia.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: MULHER_OCORRENCIAS_PAGE_SIZE,
      skip,
      select: mulherOccurrenceListSelect,
    });
    return { items, total, page, totalPages, pageSize: MULHER_OCORRENCIAS_PAGE_SIZE, skip };
  }

  async obterOcorrencia(usuario: UsuarioOrionMulherReq, id: string) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE', 'CONSULTA']);
    const row = await this.prisma.mulherOcorrencia.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Ocorrência não encontrada.');
    return row;
  }

  async criarOcorrencia(
    usuario: UsuarioOrionMulherReq,
    body: Record<string, unknown>,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const picked = pickMulherOccurrenceInput(body);
    const faseAtual = typeof picked.faseAtual === 'number' ? picked.faseAtual : 1;
    const concluida = Boolean(picked.concluida);
    const created = await this.prisma.mulherOcorrencia.create({
      data: {
        ...picked,
        origem: MulherOrigemOcorrencia.SISTEMA,
        faseAtual,
        concluida,
        criadoPorId: usuario.id,
        atualizadoPorId: usuario.id,
      },
    });
    await this.registrarAuditoria(
      usuario,
      'CRIAR_OCORRENCIA',
      'MulherOcorrencia',
      created.id,
      { faseAtual, concluida },
      meta,
    );
    return { occurrence: created };
  }

  async atualizarOcorrencia(
    usuario: UsuarioOrionMulherReq,
    id: string,
    body: Record<string, unknown>,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const before = await this.prisma.mulherOcorrencia.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ocorrência não encontrada.');
    const picked = pickMulherOccurrenceInput(body);
    const updated = await this.prisma.mulherOcorrencia.update({
      where: { id },
      data: { ...picked, atualizadoPorId: usuario.id },
    });
    await this.registrarAuditoria(
      usuario,
      'ATUALIZAR_OCORRENCIA',
      'MulherOcorrencia',
      id,
      undefined,
      meta,
    );
    return { occurrence: updated };
  }

  async excluirOcorrencia(
    usuario: UsuarioOrionMulherReq,
    id: string,
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const before = await this.prisma.mulherOcorrencia.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ocorrência não encontrada.');
    await this.prisma.mulherOcorrencia.delete({ where: { id } });
    await this.registrarAuditoria(usuario, 'EXCLUIR_OCORRENCIA', 'MulherOcorrencia', id, undefined, meta);
    return { ok: true };
  }

  async dashboardStats(usuario: UsuarioOrionMulherReq, range?: { from?: string; to?: string }) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE', 'CONSULTA']);
    const from = range?.from ? new Date(range.from) : undefined;
    const to = range?.to ? new Date(range.to) : undefined;
    return this.dashboardService.computeStats({ from, to });
  }

  async importarExcel(
    usuario: UsuarioOrionMulherReq,
    opts: { mode: 'replace' | 'append'; buffer?: Buffer; useEnvPath?: boolean },
    meta?: { ip?: string; userAgent?: string },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR']);
    let result;
    if (opts.useEnvPath) {
      const p = this.excelImportService.resolveDefaultExcelPath();
      if (!p) {
        throw new BadRequestException(
          'Planilha padrão não encontrada. Defina MULHER_EXCEL_PATH ou envie o arquivo.',
        );
      }
      result =
        opts.mode === 'replace'
          ? await this.excelImportService.replaceExcelImport(p)
          : await this.excelImportService.appendExcelImport(p);
    } else if (opts.buffer) {
      result =
        opts.mode === 'replace'
          ? await this.excelImportService.replaceExcelImport(opts.buffer)
          : await this.excelImportService.appendExcelImport(opts.buffer);
    } else {
      throw new BadRequestException('Envie um arquivo .xlsx ou use useEnvPath.');
    }
    await this.registrarAuditoria(
      usuario,
      opts.mode === 'replace' ? 'IMPORTAR_EXCEL_SUBSTITUIR' : 'IMPORTAR_EXCEL_ACRESCENTAR',
      'MulherOcorrencia',
      undefined,
      { inserted: result.inserted, skipped: result.skipped },
      meta,
    );
    return result;
  }

  async listarCadastrosCentral(usuario: UsuarioOrionMulherReq, limit = 100) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const take = Math.min(200, Math.max(1, limit));
    return this.prisma.mulherVitimaCadastroMobile.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async listarPanicoCentral(usuario: UsuarioOrionMulherReq, limit = 100) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const take = Math.min(200, Math.max(1, limit));
    return this.prisma.mulherVitimaPanicoMobile.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        cadastro: { select: { id: true, nomeVitima: true, telefoneDigits: true } },
      },
    });
  }

  async atualizarPanicoCentral(
    usuario: UsuarioOrionMulherReq,
    panicId: string,
    body: {
      encaminhamento?: MulherVitimaPanicEncaminhamento | null;
      finalizacao?: MulherVitimaPanicFinalizacao | null;
      acknowledged?: boolean;
    },
  ) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const row = await this.prisma.mulherVitimaPanicoMobile.findUnique({ where: { id: panicId } });
    if (!row) throw new NotFoundException('Pânico não encontrado.');
    const now = new Date();
    const data: Prisma.MulherVitimaPanicoMobileUpdateInput = {};
    if (body.encaminhamento !== undefined) data.encaminhamento = body.encaminhamento;
    if (body.finalizacao !== undefined) data.finalizacao = body.finalizacao;
    if (body.acknowledged || body.encaminhamento !== undefined || body.finalizacao !== undefined) {
      data.acknowledgedBy = { connect: { id: usuario.id } };
      if (!row.acknowledgedAt) data.acknowledgedAt = now;
    }
    return this.prisma.mulherVitimaPanicoMobile.update({
      where: { id: panicId },
      data,
      include: { cadastro: { select: { id: true, nomeVitima: true, telefoneDigits: true } } },
    });
  }

  async listarAuditoria(usuario: UsuarioOrionMulherReq, limit = 100) {
    await this.assertPerfilMinimo(usuario, ['ADMINISTRADOR', 'ATENDENTE']);
    const take = Math.min(500, Math.max(1, limit));
    return this.prisma.mulherAuditoria.findMany({
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  // ─── App vítima (público, sem JWT Órion) ───────────────────────────────────

  async vitimaAppCadastro(body: Record<string, unknown>) {
    const telefone = normalizarTelefoneDigits(String(body.telefone ?? ''));
    if (!validarTelefoneDigits(telefone)) {
      throw new BadRequestException('Telefone deve ter 10 ou 11 dígitos.');
    }
    const nomeVitima = String(body.nomeVitima ?? '').trim();
    const enderecoResidencia = String(body.enderecoResidencia ?? '').trim();
    const nomeAgressor = String(body.nomeAgressor ?? '').trim();
    const enderecoAgressor = String(body.enderecoAgressor ?? '').trim();
    if (!nomeVitima || !enderecoResidencia || !nomeAgressor || !enderecoAgressor) {
      throw new BadRequestException('Campos obrigatórios ausentes.');
    }
    const row = await this.prisma.mulherVitimaCadastroMobile.create({
      data: {
        telefoneDigits: telefone,
        nomeVitima,
        idade: body.idade ? String(body.idade) : undefined,
        cpf: body.cpf ? String(body.cpf) : undefined,
        identidade: body.identidade ? String(body.identidade) : undefined,
        medidaProtetiva: body.medidaProtetiva ? String(body.medidaProtetiva) : undefined,
        enderecoResidencia,
        latitude: typeof body.latitude === 'number' ? body.latitude : undefined,
        longitude: typeof body.longitude === 'number' ? body.longitude : undefined,
        accuracyM: typeof body.accuracyM === 'number' ? body.accuracyM : undefined,
        nomeAgressor,
        enderecoAgressor,
        fotoVitimaNome: body.fotoVitimaNome ? String(body.fotoVitimaNome) : undefined,
        fotoAgressorNome: body.fotoAgressorNome ? String(body.fotoAgressorNome) : undefined,
      },
    });
    return { ok: true, id: row.id, message: 'Cadastro realizado com sucesso.' };
  }

  async vitimaAppCarregar(body: Record<string, unknown>) {
    const telefone = normalizarTelefoneDigits(String(body.telefone ?? ''));
    if (!validarTelefoneDigits(telefone)) {
      throw new BadRequestException('Telefone inválido.');
    }
    const row = await this.prisma.mulherVitimaCadastroMobile.findFirst({
      where: { telefoneDigits: telefone },
      orderBy: { createdAt: 'desc' },
    });
    return { cadastro: row };
  }

  async vitimaAppPanico(body: Record<string, unknown>) {
    const telefone = normalizarTelefoneDigits(String(body.telefone ?? ''));
    if (!validarTelefoneDigits(telefone)) {
      throw new BadRequestException('Telefone inválido.');
    }
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('Coordenadas inválidas.');
    }
    const latest = await this.prisma.mulherVitimaCadastroMobile.findFirst({
      where: { telefoneDigits: telefone },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    const row = await this.prisma.mulherVitimaPanicoMobile.create({
      data: {
        telefoneDigits: telefone,
        latitude,
        longitude,
        accuracyM: typeof body.accuracyM === 'number' ? body.accuracyM : undefined,
        cadastroId: latest?.id,
      },
    });
    return { ok: true, id: row.id };
  }

  async vitimaAppAtualizarCadastro(id: string, body: Record<string, unknown>) {
    const telefone = normalizarTelefoneDigits(String(body.telefone ?? ''));
    if (!validarTelefoneDigits(telefone)) {
      throw new BadRequestException('Telefone inválido.');
    }
    const row = await this.prisma.mulherVitimaCadastroMobile.findUnique({ where: { id } });
    if (!row || row.telefoneDigits !== telefone) {
      throw new NotFoundException('Cadastro não encontrado.');
    }
    const updated = await this.prisma.mulherVitimaCadastroMobile.update({
      where: { id },
      data: {
        nomeVitima: String(body.nomeVitima ?? row.nomeVitima ?? '').trim() || row.nomeVitima,
        enderecoResidencia:
          String(body.enderecoResidencia ?? row.enderecoResidencia ?? '').trim() ||
          row.enderecoResidencia,
        nomeAgressor: String(body.nomeAgressor ?? row.nomeAgressor ?? '').trim() || row.nomeAgressor,
        enderecoAgressor:
          String(body.enderecoAgressor ?? row.enderecoAgressor ?? '').trim() || row.enderecoAgressor,
      },
    });
    return { ok: true, cadastro: updated };
  }
}
