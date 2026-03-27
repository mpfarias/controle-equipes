import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { TrocaServicoService } from './troca-servico.service';
import { CreateTrocaServicoDto } from './dto/create-troca-servico.dto';
import { UpdateTrocaServicoDto } from './dto/update-troca-servico.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { Usuario } from '@prisma/client';

@Controller('troca-servico')
export class TrocaServicoController {
  constructor(private readonly trocaServicoService: TrocaServicoService) {}

  /** Qualquer usuário autenticado: aplica retornos à equipe de origem após as datas da troca. */
  @Post('processar-revertes')
  processarRevertes() {
    return this.trocaServicoService.processarRevertesPendentes();
  }

  /** Trocas ainda ativas (não concluídas nem canceladas), com dados dos policiais. */
  @Get('ativas')
  listarAtivas() {
    return this.trocaServicoService.listarAtivas();
  }

  @Post()
  @Roles('ADMINISTRADOR', 'SAD', 'COMANDO')
  criar(@Body() dto: CreateTrocaServicoDto, @CurrentUser() user: Usuario) {
    return this.trocaServicoService.criar(dto, user.id);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'SAD', 'COMANDO')
  atualizarDatas(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrocaServicoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.trocaServicoService.atualizarDatas(id, dto, user.id);
  }

  @Post(':id/cancelar')
  @Roles('ADMINISTRADOR', 'SAD', 'COMANDO')
  cancelar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.trocaServicoService.cancelar(id, user.id);
  }
}
