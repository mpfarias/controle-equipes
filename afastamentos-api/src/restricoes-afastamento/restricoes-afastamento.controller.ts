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

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.restricoesAfastamentoService.remove(id, user.id);
  }
}
