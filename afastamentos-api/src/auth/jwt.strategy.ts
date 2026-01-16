import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { UsuarioStatus } from '@prisma/client';

export interface JwtPayload {
  sub: number; // userId
  matricula: string;
  isAdmin?: boolean;
  acessoId?: number; // ID do log de acesso para registrar logout
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'temporary-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
      include: { nivel: true },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado.');
    }

    if (usuario.status === UsuarioStatus.DESATIVADO) {
      throw new UnauthorizedException('Usuário desativado.');
    }

    // Retornar dados do usuário que serão disponibilizados no request
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senhaHash, ...dadosUsuario } = usuario;
    return dadosUsuario;
  }
}
