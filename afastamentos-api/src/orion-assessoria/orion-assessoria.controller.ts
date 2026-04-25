import { Controller, Get } from '@nestjs/common';
import { OrionAssessoriaService } from './orion-assessoria.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
};

@Controller('orion-assessoria')
export class OrionAssessoriaController {
  constructor(private readonly orionAssessoriaService: OrionAssessoriaService) {}

  @Public()
  @Get()
  info() {
    return this.orionAssessoriaService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionAssessoriaService.sessaoResumo(user);
  }
}
