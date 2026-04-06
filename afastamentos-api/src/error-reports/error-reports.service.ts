import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  ErrorReportStatus,
  type Usuario,
} from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateErrorReportDto } from './dto/create-error-report.dto';
import { AddErrorReportComentarioDto } from './dto/add-error-report-comentario.dto';
import { UpdateErrorReportStatusDto } from './dto/update-error-report-status.dto';
import { CancelErrorReportDto } from './dto/cancel-error-report.dto';
import {
  montarProtocolo,
  partesDataBrasilia,
  PROTOCOLO_CODIGO_CATEGORIA,
} from './error-report-protocol.util';
import {
  normalizarAnexoNome,
  validarAnexoDataUrl,
} from './error-report-anexo.util';
import { usuarioTemAcessoOrionSuporteEfetivo } from '../usuarios/orion-suporte-access.util';

export type UsuarioAuth = Usuario & {
  nivel: { nome: string; acessoOrionSuporte?: boolean } | null;
};

const usuarioIncludeBasico = {
  select: { id: true, nome: true, matricula: true },
} as const;

function usuarioPodeGerenciarChamados(user: UsuarioAuth): boolean {
  return usuarioTemAcessoOrionSuporteEfetivo(user);
}

type TipoAcao =
  | 'CHAMADO_CRIADO'
  | 'COMENTARIO'
  | 'STATUS_ALTERADO'
  | 'CHAMADO_CANCELADO';

interface AcaoEntrada {
  tipo: TipoAcao;
  em: string;
  usuarioId: number;
  usuarioNome: string;
  detalhes?: Record<string, unknown>;
}

@Injectable()
export class ErrorReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private parseAcoes(json: Prisma.JsonValue): AcaoEntrada[] {
    if (!Array.isArray(json)) return [];
    return json as unknown as AcaoEntrada[];
  }

  private appendAcao(
    atual: Prisma.JsonValue,
    acao: Omit<AcaoEntrada, 'em'> & { em?: string },
  ): Prisma.InputJsonValue {
    const lista = this.parseAcoes(atual);
    lista.push({
      ...acao,
      em: acao.em ?? new Date().toISOString(),
    });
    return lista as unknown as Prisma.InputJsonValue;
  }

  async create(dto: CreateErrorReportDto, user: UsuarioAuth) {
    const anexoTrim = dto.anexoDataUrl?.trim();
    const temAnexo = Boolean(anexoTrim);
    if (temAnexo) {
      validarAnexoDataUrl(anexoTrim);
    }
    const anexoNome = normalizarAnexoNome(dto.anexoNome);

    return this.prisma.$transaction(async (tx) => {
      const agora = new Date();
      const { yyyy, mm, dd } = partesDataBrasilia(agora);
      const seqRow = await tx.errorReportProtocolSequence.upsert({
        where: { anoReferencia: yyyy },
        create: { anoReferencia: yyyy, contador: 1 },
        update: { contador: { increment: 1 } },
      });
      const codigoCat = PROTOCOLO_CODIGO_CATEGORIA[dto.categoria];
      const protocolo = montarProtocolo(yyyy, codigoCat, mm, dd, seqRow.contador);

      const detalhesCriacao: Record<string, unknown> = {
        categoria: dto.categoria,
        protocolo,
      };
      if (temAnexo) {
        detalhesCriacao.anexo = true;
        if (anexoNome) detalhesCriacao.anexoNome = anexoNome;
      }

      const acoes = this.appendAcao([], {
        tipo: 'CHAMADO_CRIADO',
        usuarioId: user.id,
        usuarioNome: user.nome,
        detalhes: detalhesCriacao,
      });

      return tx.errorReport.create({
        data: {
          usuarioId: user.id,
          protocolo,
          descricao: dto.descricao.trim(),
          categoria: dto.categoria,
          acoes,
          anexoDataUrl: temAnexo ? anexoTrim : null,
          anexoNome: temAnexo ? anexoNome ?? 'anexo' : null,
        },
        include: { usuario: usuarioIncludeBasico },
      });
    });
  }

  async findAll(viewer: UsuarioAuth) {
    return this.prisma.errorReport.findMany({
      where: { usuarioId: viewer.id },
      orderBy: { createdAt: 'desc' },
      include: { usuario: usuarioIncludeBasico },
    });
  }

  async findOne(id: number, viewer: UsuarioAuth) {
    const row = await this.prisma.errorReport.findUnique({
      where: { id },
      include: { usuario: usuarioIncludeBasico },
    });
    if (!row) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    if (row.usuarioId !== viewer.id) {
      throw new ForbiddenException('Você não tem permissão para este chamado.');
    }
    return row;
  }

  /** Autor do chamado: cancela com motivo (apenas aberto ou em análise). */
  async cancelarPeloUsuario(
    id: number,
    dto: CancelErrorReportDto,
    viewer: UsuarioAuth,
  ) {
    const row = await this.findOne(id, viewer);
    if (
      row.status !== ErrorReportStatus.ABERTO &&
      row.status !== ErrorReportStatus.EM_ANALISE
    ) {
      throw new BadRequestException(
        'Só é possível cancelar chamados abertos ou em análise.',
      );
    }
    const motivo = dto.motivo.trim();
    const acoes = this.appendAcao(row.acoes, {
      tipo: 'CHAMADO_CANCELADO',
      usuarioId: viewer.id,
      usuarioNome: viewer.nome,
      detalhes: { motivo },
    });

    return this.prisma.errorReport.update({
      where: { id: row.id },
      data: {
        status: ErrorReportStatus.CANCELADO,
        acoes,
      },
      include: { usuario: usuarioIncludeBasico },
    });
  }

  async adicionarComentario(
    id: number,
    dto: AddErrorReportComentarioDto,
    viewer: UsuarioAuth,
  ) {
    const row = await this.findOne(id, viewer);
    const acoes = this.appendAcao(row.acoes, {
      tipo: 'COMENTARIO',
      usuarioId: viewer.id,
      usuarioNome: viewer.nome,
      detalhes: { texto: dto.texto.trim() },
    });

    return this.prisma.errorReport.update({
      where: { id: row.id },
      data: { acoes },
      include: { usuario: usuarioIncludeBasico },
    });
  }

  async atualizarStatus(
    id: number,
    dto: UpdateErrorReportStatusDto,
    viewer: UsuarioAuth,
  ) {
    if (!usuarioPodeGerenciarChamados(viewer)) {
      throw new ForbiddenException(
        'Apenas gestores do Órion Suporte podem alterar o status deste chamado.',
      );
    }

    const row = await this.prisma.errorReport.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Chamado não encontrado.');
    }
    if (row.usuarioId !== viewer.id && !usuarioPodeGerenciarChamados(viewer)) {
      throw new ForbiddenException('Você não tem permissão para alterar este chamado.');
    }

    if (row.status === dto.status) {
      return this.prisma.errorReport.findUniqueOrThrow({
        where: { id },
        include: { usuario: usuarioIncludeBasico },
      });
    }

    const acoes = this.appendAcao(row.acoes, {
      tipo: 'STATUS_ALTERADO',
      usuarioId: viewer.id,
      usuarioNome: viewer.nome,
      detalhes: { de: row.status, para: dto.status },
    });

    return this.prisma.errorReport.update({
      where: { id },
      data: {
        status: dto.status as ErrorReportStatus,
        acoes,
      },
      include: { usuario: usuarioIncludeBasico },
    });
  }

  /** Gestão Órion Suporte: quantidade de chamados ainda não encerrados (abertos ou em análise). */
  async countAbertosAdmin(viewer: UsuarioAuth) {
    if (!usuarioPodeGerenciarChamados(viewer)) {
      throw new ForbiddenException(
        'Apenas gestores do Órion Suporte podem consultar esta informação.',
      );
    }
    const total = await this.prisma.errorReport.count({
      where: {
        status: { in: [ErrorReportStatus.ABERTO, ErrorReportStatus.EM_ANALISE] },
      },
    });
    return { total };
  }

  /** Gestão Órion Suporte: todos os chamados, qualquer autor. */
  async findAllAdmin(viewer: UsuarioAuth) {
    if (!usuarioPodeGerenciarChamados(viewer)) {
      throw new ForbiddenException(
        'Apenas gestores do Órion Suporte podem listar todos os chamados.',
      );
    }
    return this.prisma.errorReport.findMany({
      orderBy: { createdAt: 'desc' },
      include: { usuario: usuarioIncludeBasico },
    });
  }
}
