import {
  BadRequestException,
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
import { AfastamentosService } from './afastamentos.service';
import { CreateAfastamentoDto } from './dto/create-afastamento.dto';
import { UpdateAfastamentoDto } from './dto/update-afastamento.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('afastamentos')
export class AfastamentosController {
  constructor(private readonly afastamentosService: AfastamentosService) {}

  @Post()
  create(@Body() createAfastamentoDto: CreateAfastamentoDto, @CurrentUser() user: Usuario) {
    return this.afastamentosService.create(createAfastamentoDto, user.id);
  }

  @Get()
  findAll(
    @Query('policialId') policialId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('equipe') equipe?: string,
    @Query('motivoId') motivoId?: string,
    @Query('status') status?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('includePolicialFuncao') includePolicialFuncao?: string,
  ) {
    const includePolicialFuncaoParsed = includePolicialFuncao !== 'false';
    if (policialId) {
      const id = Number.parseInt(policialId, 10);
      if (Number.isNaN(id)) {
        throw new BadRequestException('O policialId deve ser numérico.');
      }
      return this.afastamentosService.findByPolicial(id, {
        includePolicialFuncao: includePolicialFuncaoParsed,
      });
    }
    const motivoIdParsed = motivoId ? Number.parseInt(motivoId, 10) : undefined;
    if (motivoId && Number.isNaN(motivoIdParsed)) {
      throw new BadRequestException('O motivoId deve ser numérico.');
    }
    return this.afastamentosService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      equipe: equipe || undefined,
      motivoId: motivoIdParsed,
      status: status || undefined,
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      includePolicialFuncao: includePolicialFuncaoParsed,
    });
  }

  @Get('motivos')
  listMotivos() {
    return this.afastamentosService.listMotivos();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.afastamentosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAfastamentoDto: UpdateAfastamentoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.afastamentosService.update(id, updateAfastamentoDto, user.id);
  }

  @Patch(':id/desativar')
  desativar(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.afastamentosService.desativar(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.afastamentosService.remove(id, user.id);
  }
}

