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
import { EscalasService } from './escalas.service';
import { UpdateEscalaParametrosDto } from './dto/update-escala-parametros.dto';
import { CreateEscalaInformacaoDto } from './dto/create-escala-informacao.dto';
import { UpdateEscalaInformacaoDto } from './dto/update-escala-informacao.dto';
import { CreateEscalaGeradaDto } from './dto/create-escala-gerada.dto';
import { Roles } from '../auth/roles.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('escalas')
export class EscalasController {
  constructor(private readonly escalasService: EscalasService) {}

  @Get('parametros')
  @AnyAuthenticated()
  getParametros() {
    return this.escalasService.getParametros();
  }

  @Patch('parametros')
  @Roles('ADMINISTRADOR', 'SAD')
  updateParametros(@Body() dto: UpdateEscalaParametrosDto, @CurrentUser() user: Usuario) {
    return this.escalasService.updateParametros(dto, { id: user.id, nome: user.nome });
  }

  @Get('informacoes')
  @AnyAuthenticated()
  listInformacoes(@Query('todos') todos?: string) {
    const apenasAtivos = todos !== '1' && todos !== 'true';
    return this.escalasService.listInformacoes(apenasAtivos);
  }

  @Post('informacoes')
  @Roles('ADMINISTRADOR', 'SAD')
  createInformacao(@Body() dto: CreateEscalaInformacaoDto, @CurrentUser() user: Usuario) {
    return this.escalasService.createInformacao(dto, { id: user.id, nome: user.nome });
  }

  @Patch('informacoes/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  updateInformacao(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEscalaInformacaoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.escalasService.updateInformacao(id, dto, { id: user.id, nome: user.nome });
  }

  @Delete('informacoes/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  deleteInformacao(@Param('id', ParseIntPipe) id: number) {
    return this.escalasService.deleteInformacao(id);
  }

  @Post('geradas')
  @AnyAuthenticated()
  createEscalaGerada(@Body() dto: CreateEscalaGeradaDto, @CurrentUser() user: Usuario) {
    return this.escalasService.createEscalaGerada(dto, { id: user.id, nome: user.nome });
  }

  @Get('geradas')
  @AnyAuthenticated()
  listEscalaGeradas(@Query('take') take?: string, @Query('skip') skip?: string) {
    const t = take !== undefined && take !== '' ? Number.parseInt(take, 10) : undefined;
    const s = skip !== undefined && skip !== '' ? Number.parseInt(skip, 10) : undefined;
    return this.escalasService.listEscalaGeradas({
      take: Number.isFinite(t) ? t : undefined,
      skip: Number.isFinite(s) ? s : undefined,
    });
  }

  @Get('geradas/:id')
  @AnyAuthenticated()
  getEscalaGerada(@Param('id', ParseIntPipe) id: number) {
    return this.escalasService.getEscalaGeradaById(id);
  }

  @Patch('geradas/:id/desativar')
  @Roles('ADMINISTRADOR', 'SAD', 'COMANDO')
  desativarEscalaGerada(@Param('id', ParseIntPipe) id: number) {
    return this.escalasService.desativarEscalaGerada(id);
  }

  @Delete('geradas/:id')
  @Roles('ADMINISTRADOR', 'SAD', 'COMANDO')
  deleteEscalaGerada(@Param('id', ParseIntPipe) id: number) {
    return this.escalasService.deleteEscalaGerada(id);
  }
}
