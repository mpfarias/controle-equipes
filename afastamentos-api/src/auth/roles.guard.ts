import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY, type RoleName } from './roles.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ANY_AUTHENTICATED_KEY } from './any-authenticated.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Verificar se o endpoint é público primeiro
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Verificar se o endpoint permite qualquer usuário autenticado
    const anyAuthenticated = this.reflector.getAllAndOverride<boolean>(ANY_AUTHENTICATED_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (anyAuthenticated) {
      const request = context.switchToHttp().getRequest();
      const user = request.user as { isAdmin?: boolean; nivel?: { nome?: string } } | undefined;
      
      if (!user) {
        throw new ForbiddenException('Usuário não autenticado.');
      }
      
      return true;
    }

    const roles = this.reflector.getAllAndOverride<RoleName[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se não há roles definidas no handler nem na classe, permitir acesso para qualquer usuário autenticado
    if (!roles || roles.length === 0) {
      const request = context.switchToHttp().getRequest();
      const user = request.user as { isAdmin?: boolean; nivel?: { nome?: string } } | undefined;
      
      if (!user) {
        throw new ForbiddenException('Usuário não autenticado.');
      }
      
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
