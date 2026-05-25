import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrionAgendaService } from './orion-agenda.service';
import type { UsuarioOrionAgendaReq } from './orion-agenda.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateAgendaCompromissoDto } from './dto/create-agenda-compromisso.dto';
import { UpdateAgendaCompromissoDto } from './dto/update-agenda-compromisso.dto';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
  isAdmin?: boolean;
  nivel?: { nome?: string | null } | null;
};

function toAgendaUser(user: UsuarioJwtRequest): UsuarioOrionAgendaReq {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    sistemasPermitidos: user.sistemasPermitidos ?? [],
    isAdmin: user.isAdmin,
    nivel: user.nivel,
  };
}

@Controller('orion-agenda')
export class OrionAgendaController {
  constructor(private readonly orionAgendaService: OrionAgendaService) {}

  @Public()
  @Get()
  info() {
    return this.orionAgendaService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionAgendaService.sessaoResumo(toAgendaUser(user));
  }

  @Get('v1/policiais-efetivo')
  @AnyAuthenticated()
  listarPoliciaisEfetivo(@CurrentUser() user: UsuarioJwtRequest) {
    return this.orionAgendaService.listarPoliciaisEfetivo(toAgendaUser(user));
  }

  @Get('v1/compromissos')
  @AnyAuthenticated()
  listarCompromissos(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('mes') mes?: string,
    @Query('status') status?: string,
  ) {
    return this.orionAgendaService.listarCompromissos(toAgendaUser(user), { mes, status });
  }

  @Get('v1/compromissos/:id')
  @AnyAuthenticated()
  obterCompromisso(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orionAgendaService.obterCompromisso(toAgendaUser(user), id);
  }

  @Post('v1/compromissos')
  @AnyAuthenticated()
  criarCompromisso(
    @CurrentUser() user: UsuarioJwtRequest,
    @Body() dto: CreateAgendaCompromissoDto,
  ) {
    return this.orionAgendaService.criarCompromisso(toAgendaUser(user), dto);
  }

  @Patch('v1/compromissos/:id')
  @AnyAuthenticated()
  atualizarCompromisso(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgendaCompromissoDto,
  ) {
    return this.orionAgendaService.atualizarCompromisso(toAgendaUser(user), id, dto);
  }

  @Delete('v1/compromissos/:id')
  @AnyAuthenticated()
  excluirCompromisso(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orionAgendaService.excluirCompromisso(toAgendaUser(user), id);
  }
}
