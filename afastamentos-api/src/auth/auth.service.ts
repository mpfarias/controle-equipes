import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaCorreta) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senhaHash, ...dadosUsuario } = usuario;
    return dadosUsuario;
  }
}
