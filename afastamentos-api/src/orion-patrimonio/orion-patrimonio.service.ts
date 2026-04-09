import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatrimonioBemSituacao, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreatePatrimonioBemDto } from './dto/create-patrimonio-bem.dto';
import { UpdatePatrimonioBemDto } from './dto/update-patrimonio-bem.dto';

export type UsuarioOrionPatrimonioReq = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
};

@Injectable()
export class OrionPatrimonioService {
  constructor(private readonly prisma: PrismaService) {}

  podeAcessarOrionPatrimonio(usuario: UsuarioOrionPatrimonioReq): boolean {
    const ids = (usuario.sistemasPermitidos ?? []).map((s) =>
      String(s).trim().toUpperCase(),
    );
    return ids.includes('ORION_PATRIMONIO') || ids.includes('PATRIMONIO');
  }

  private assertAcessoModulo(usuario: UsuarioOrionPatrimonioReq): void {
    if (!this.podeAcessarOrionPatrimonio(usuario)) {
      throw new ForbiddenException(
        'Acesso ao Órion Patrimônio não autorizado. Um administrador deve incluir "Órion Patrimônio" em sistemas permitidos (SAD → Usuários).',
      );
    }
  }

  getPublicMeta() {
    return {
      sistema: 'orion-patrimonio',
      nome: 'Órion Patrimônio',
      versao: '0.1.0',
      fase: 'cadastro-bens',
    };
  }

  sessaoResumo(usuario: UsuarioOrionPatrimonioReq) {
    const pode = this.podeAcessarOrionPatrimonio(usuario);
    return {
      ok: true,
      sistema: 'orion-patrimonio',
      podeAcessarModulo: pode,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        matricula: usuario.matricula,
      },
      mensagem: pode
        ? 'Módulo disponível: gestão de bens patrimoniais do COPOM.'
        : 'Seu usuário autenticou na API, mas não possui permissão para usar o Órion Patrimônio.',
    };
  }

  async listarBens(usuario: UsuarioOrionPatrimonioReq) {
    this.assertAcessoModulo(usuario);
    return this.prisma.patrimonioBem.findMany({
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
  }

  async obterBem(usuario: UsuarioOrionPatrimonioReq, id: number) {
    this.assertAcessoModulo(usuario);
    const row = await this.prisma.patrimonioBem.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Bem não encontrado.');
    }
    return row;
  }

  async criarBem(usuario: UsuarioOrionPatrimonioReq, dto: CreatePatrimonioBemDto) {
    this.assertAcessoModulo(usuario);
    const tombamento = dto.tombamento.trim();
    if (!tombamento) {
      throw new BadRequestException('Tombamento é obrigatório.');
    }

    const data: Prisma.PatrimonioBemCreateInput = {
      tombamento,
      descricao: dto.descricao.trim(),
      categoria: dto.categoria?.trim() || null,
      marca: dto.marca?.trim() || null,
      modelo: dto.modelo?.trim() || null,
      numeroSerie: dto.numeroSerie?.trim() || null,
      localizacaoSetor: dto.localizacaoSetor?.trim() || null,
      situacao: dto.situacao ?? PatrimonioBemSituacao.EM_USO,
      observacoes: dto.observacoes?.trim() || null,
      dataAquisicao: dto.dataAquisicao
        ? new Date(`${dto.dataAquisicao.slice(0, 10)}T12:00:00.000Z`)
        : null,
      valorAquisicao:
        dto.valorAquisicao != null ? new Prisma.Decimal(dto.valorAquisicao) : null,
      criadoPor: { connect: { id: usuario.id } },
      criadoPorNome: usuario.nome,
    };

    try {
      return await this.prisma.patrimonioBem.create({ data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new BadRequestException('Já existe bem com este tombamento.');
      }
      throw e;
    }
  }

  async atualizarBem(
    usuario: UsuarioOrionPatrimonioReq,
    id: number,
    dto: UpdatePatrimonioBemDto,
  ) {
    this.assertAcessoModulo(usuario);
    const existente = await this.prisma.patrimonioBem.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('Bem não encontrado.');
    }

    const entries = Object.entries(dto).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      throw new BadRequestException('Informe ao menos um campo para atualizar.');
    }

    const data: Prisma.PatrimonioBemUpdateInput = {
      atualizadoPorId: usuario.id,
      atualizadoPorNome: usuario.nome,
    };

    if (dto.descricao !== undefined) {
      data.descricao = dto.descricao.trim();
    }
    if (dto.categoria !== undefined) {
      data.categoria = dto.categoria?.trim() || null;
    }
    if (dto.marca !== undefined) {
      data.marca = dto.marca?.trim() || null;
    }
    if (dto.modelo !== undefined) {
      data.modelo = dto.modelo?.trim() || null;
    }
    if (dto.numeroSerie !== undefined) {
      data.numeroSerie = dto.numeroSerie?.trim() || null;
    }
    if (dto.localizacaoSetor !== undefined) {
      data.localizacaoSetor = dto.localizacaoSetor?.trim() || null;
    }
    if (dto.situacao !== undefined) {
      data.situacao = dto.situacao;
    }
    if (dto.observacoes !== undefined) {
      data.observacoes = dto.observacoes?.trim() || null;
    }
    if (dto.dataAquisicao !== undefined) {
      data.dataAquisicao =
        dto.dataAquisicao == null || dto.dataAquisicao === ''
          ? null
          : new Date(`${dto.dataAquisicao.slice(0, 10)}T12:00:00.000Z`);
    }
    if (dto.valorAquisicao !== undefined) {
      data.valorAquisicao =
        dto.valorAquisicao == null ? null : new Prisma.Decimal(dto.valorAquisicao);
    }

    return this.prisma.patrimonioBem.update({
      where: { id },
      data,
    });
  }

  async excluirBem(usuario: UsuarioOrionPatrimonioReq, id: number) {
    this.assertAcessoModulo(usuario);
    const existente = await this.prisma.patrimonioBem.findUnique({ where: { id } });
    if (!existente) {
      throw new NotFoundException('Bem não encontrado.');
    }
    await this.prisma.patrimonioBem.delete({ where: { id } });
    return { ok: true };
  }
}
