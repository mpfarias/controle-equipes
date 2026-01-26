import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { RestricoesAfastamentoService } from './restricoes-afastamento.service';
import { CreateRestricaoAfastamentoDto } from './dto/create-restricao-afastamento.dto';
import { UpdateRestricaoAfastamentoDto } from './dto/update-restricao-afastamento.dto';
import { CreateTipoRestricaoDto } from './dto/create-tipo-restricao.dto';
import { UpdateTipoRestricaoDto } from './dto/update-tipo-restricao.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('restricoes-afastamento')
export class RestricoesAfastamentoController {
  constructor(
    private readonly restricoesAfastamentoService: RestricoesAfastamentoService,
  ) {}

  @Post()
  create(
    @Body() createRestricaoAfastamentoDto: CreateRestricaoAfastamentoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.restricoesAfastamentoService.create(
      createRestricaoAfastamentoDto,
      user.id,
    );
  }

  @Get('tipos')
  listTiposRestricao() {
    return this.restricoesAfastamentoService.listTiposRestricao();
  }

  @Post('tipos')
  createTipoRestricao(
    @Body() createTipoRestricaoDto: CreateTipoRestricaoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.restricoesAfastamentoService.createTipoRestricao(createTipoRestricaoDto, user.id);
  }

  @Patch('tipos/:id')
  updateTipoRestricao(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTipoRestricaoDto: UpdateTipoRestricaoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.restricoesAfastamentoService.updateTipoRestricao(id, updateTipoRestricaoDto, user.id);
  }

  @Delete('tipos/:id')
  deleteTipoRestricao(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.restricoesAfastamentoService.deleteTipoRestricao(id, user.id);
  }

  @Get()
  findAll() {
    return this.restricoesAfastamentoService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.restricoesAfastamentoService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRestricaoAfastamentoDto: UpdateRestricaoAfastamentoDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.restricoesAfastamentoService.update(
      id,
      updateRestricaoAfastamentoDto,
      user.id,
    );
  }

  @Patch(':id/desativar')
  disable(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.restricoesAfastamentoService.disable(id, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.restricoesAfastamentoService.remove(id, user.id);
  }
}
