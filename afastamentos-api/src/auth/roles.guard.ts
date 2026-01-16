import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type RoleName } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { isAdmin?: boolean; nivel?: { nome?: string } } | undefined;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const nivelNome = user.nivel?.nome;
    const isAdmin = user.isAdmin === true || nivelNome === 'ADMINISTRADOR';

    if (isAdmin) {
      return true;
    }

    if (nivelNome && roles.includes(nivelNome)) {
      return true;
    }

    throw new ForbiddenException('Sem permissão para acessar este recurso.');
  }
}
