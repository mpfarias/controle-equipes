import { Controller, Get } from '@nestjs/common';
import { OrionOperacoesService } from './orion-operacoes.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
};

@Controller('orion-operacoes')
export class OrionOperacoesController {
  constructor(private readonly orionOperacoesService: OrionOperacoesService) {}

  @Public()
  @Get()
  info() {
    return this.orionOperacoesService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionOperacoesService.sessaoResumo(user);
  }
}
