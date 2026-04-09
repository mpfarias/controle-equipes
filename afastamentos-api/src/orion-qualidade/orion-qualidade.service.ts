import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QualidadeRegistroStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateQualidadeRegistroDto } from './dto/create-qualidade-registro.dto';
import { UpdateQualidadeRegistroDto } from './dto/update-qualidade-registro.dto';

export type UsuarioOrionQualidadeReq = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
};

@Injectable()
export class OrionQualidadeService {
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

  constructor(private readonly prisma: PrismaService) {}

  podeAcessarOrionQualidade(usuario: UsuarioOrionQualidadeReq): boolean {
    const ids = (usuario.sistemasPermitidos ?? []).map((s) =>
      String(s).trim().toUpperCase(),
    );
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
    };
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
