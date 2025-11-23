import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsuarioStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(matricula: string, senha: string) {
    const matriculaNormalizada = matricula.trim().toUpperCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { matricula: matriculaNormalizada },
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

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senhaHash, ...dadosUsuario } = usuario;
    return dadosUsuario;
  }

  async forgotPassword(
    matricula: string,
  ): Promise<{ message: string; perguntaSeguranca?: string }> {
    const matriculaNormalizada = matricula.trim().toUpperCase();

    const usuario = await this.prisma.usuario.findUnique({
      where: { matricula: matriculaNormalizada },
    });

    // Verificar se a matrícula existe
    if (!usuario) {
      throw new BadRequestException(
        'Matrícula não cadastrada. Procure um operador do sistema.',
      );
    }

    // Verificar se o usuário está desativado
    if (usuario.status === UsuarioStatus.DESATIVADO) {
      throw new ForbiddenException(
        'Usuário desativado. Procure um operador do sistema.',
      );
    }

    // Verificar se tem pergunta de segurança cadastrada
    const perguntaSeguranca = (usuario as any).perguntaSeguranca;
    const respostaSegurancaHash = (usuario as any).respostaSegurancaHash;

    if (!perguntaSeguranca || !respostaSegurancaHash) {
      throw new BadRequestException(
        'Este usuário não possui pergunta de segurança cadastrada. Procure um operador do sistema.',
      );
    }

    return {
      message: 'Responda a pergunta de segurança para redefinir sua senha.',
      perguntaSeguranca,
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

}
