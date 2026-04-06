import { Controller, Get } from '@nestjs/common';
import { OrionQualidadeService } from './orion-qualidade.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
};

@Controller('orion-qualidade')
export class OrionQualidadeController {
  constructor(private readonly orionQualidadeService: OrionQualidadeService) {}

  /** Metadados do sistema (monitoramento, SPA em branco, gateway). */
  @Public()
  @Get()
  info() {
    return this.orionQualidadeService.getPublicMeta();
  }

  /** Confirma JWT e expõe payload mínimo — base para rotas `/v1/*` futuras. */
  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionQualidadeService.sessaoResumo(user);
  }
}
