import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuarioStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { JwtPayload } from './jwt.strategy';
import { AcessosService } from '../acessos/acessos.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly acessosService: AcessosService,
  ) {}

  async login(
    matricula: string,
    senha: string,
    ip?: string,
    userAgent?: string,
  ) {
    const matriculaNormalizada = matricula.trim().toUpperCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { matricula: matriculaNormalizada },
      include: {
        nivel: {
          select: {
            id: true,
            nome: true,
            descricao: true,
            ativo: true,
          },
        },
        funcao: {
          select: {
            id: true,
            nome: true,
            descricao: true,
          },
        },
      },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Verificar se o usuário está desativado antes de validar a senha
    if (usuario.status === UsuarioStatus.DESATIVADO) {
      throw new ForbiddenException(
        'Você foi desativado. Contate o Adjunto ou o Oficial de Operações',
      );
    }

    // Verificar se o nível de acesso foi excluído (usuário precisa de novo nível)
    if (usuario.nivelRemovidoEm) {
      throw new ForbiddenException(
        'O seu nível de acesso foi alterado. Entre em contato com o Administrador do sistema urgente.',
      );
    }

    if (usuario.nivelId && usuario.nivel && usuario.nivel.ativo === false) {
      throw new ForbiddenException(
        'Erro: Nível de acesso bloqueado. Entre em contato com o Administrador do sistema',
      );
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Registrar login (após validação bem-sucedida)
    const acessoId = await this.acessosService.registrarLogin({
      userId: usuario.id,
      userName: usuario.nome,
      matricula: usuario.matricula,
      ip: ip || null,
      userAgent: userAgent || null,
    });

    // Gerar token JWT
    const payload: JwtPayload = {
      sub: usuario.id,
      matricula: usuario.matricula,
      isAdmin: usuario.isAdmin || false,
      acessoId, // Incluir acessoId no payload para poder registrar logout depois
    };

    const accessToken = this.jwtService.sign(payload);

    // Retornar apenas token e dados básicos (sem senhaHash)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senhaHash, ...dadosUsuario } = usuario;
    return {
      accessToken,
      usuario: dadosUsuario,
      acessoId,
    };
  }

  async forgotPassword(
    matricula: string,
  ): Promise<{ message: string; perguntaSeguranca?: string }> {
    const matriculaNormalizada = matricula.trim().toUpperCase();

    // Usar Promise.all para executar busca e delay em paralelo (mas garantir delay mínimo)
    const [usuario] = await Promise.all([
      this.prisma.usuario.findUnique({
        where: { matricula: matriculaNormalizada },
      }),
      // Delay mínimo para evitar timing attacks e enumeração de usuários
      new Promise((resolve) => setTimeout(resolve, 500)),
    ]);

    // Sempre retornar a mesma resposta para evitar enumeração de usuários
    // Se o usuário existe e está ativo, incluir a pergunta de segurança
    if (usuario && usuario.status !== UsuarioStatus.DESATIVADO) {
      const perguntaSeguranca = (usuario as any).perguntaSeguranca;
      const respostaSegurancaHash = (usuario as any).respostaSegurancaHash;

      if (perguntaSeguranca && respostaSegurancaHash) {
        return {
          message: 'Responda a pergunta de segurança para redefinir sua senha.',
          perguntaSeguranca,
        };
      }
    }

    // Retornar resposta genérica (mesma mensagem, sem pergunta)
    // Isso evita que atacantes descubram quais matrículas estão cadastradas
    return {
      message:
        'Se a matrícula estiver cadastrada e tiver pergunta de segurança configurada, você receberá a pergunta.',
    };
  }

  async resetPasswordBySecurityQuestion(
    matricula: string,
    respostaSeguranca: string,
    novaSenha: string,
  ): Promise<{ message: string }> {
    const matriculaNormalizada = matricula.trim().toUpperCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { matricula: matriculaNormalizada },
    });

    if (!usuario) {
      throw new BadRequestException(
        'Matrícula não cadastrada. Procure um operador do sistema.',
      );
    }

    if (usuario.status === UsuarioStatus.DESATIVADO) {
      throw new ForbiddenException(
        'Usuário desativado. Procure um operador do sistema.',
      );
    }

    const respostaSegurancaHash = (usuario as any).respostaSegurancaHash;

    if (!respostaSegurancaHash) {
      throw new BadRequestException(
        'Este usuário não possui pergunta de segurança cadastrada. Procure um operador do sistema.',
      );
    }

    // Validar resposta de segurança
    const respostaCorreta = await bcrypt.compare(
      respostaSeguranca.trim().toLowerCase(),
      respostaSegurancaHash,
    );

    if (!respostaCorreta) {
      throw new UnauthorizedException('Resposta de segurança incorreta.');
    }

    // Gerar hash da nova senha
    const senhaHash = await bcrypt.hash(novaSenha, 10);

    // Atualizar senha do usuário
    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { senhaHash },
    });

    return {
      message: 'Senha redefinida com sucesso. Você já pode fazer login com a nova senha.',
    };
  }

  async changePassword(
    userId: number,
    senhaAtual: string,
    novaSenha: string,
  ): Promise<{ message: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: userId },
      select: { id: true, senhaHash: true, status: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    if (usuario.status === UsuarioStatus.DESATIVADO) {
      throw new ForbiddenException(
        'Usuário desativado. Contate o administrador do sistema.',
      );
    }

    const senhaAtualOk = await bcrypt.compare(senhaAtual, usuario.senhaHash);
    if (!senhaAtualOk) {
      throw new UnauthorizedException('Senha atual incorreta.');
    }

    const mesmaSenha = await bcrypt.compare(novaSenha, usuario.senhaHash);
    if (mesmaSenha) {
      throw new BadRequestException(
        'A nova senha deve ser diferente da senha atual.',
      );
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);
    await this.prisma.usuario.update({
      where: { id: userId },
      data: { senhaHash },
    });

    return { message: 'Senha alterada com sucesso.' };
  }

}
