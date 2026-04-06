import { Controller, Get } from '@nestjs/common';
import { OrionJuridicoService } from './orion-juridico.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
};

@Controller('orion-juridico')
export class OrionJuridicoController {
  constructor(private readonly orionJuridicoService: OrionJuridicoService) {}

  @Public()
  @Get()
  info() {
    return this.orionJuridicoService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionJuridicoService.sessaoResumo(user);
  }
}
