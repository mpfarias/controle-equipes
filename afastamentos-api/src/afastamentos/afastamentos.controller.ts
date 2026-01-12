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

@Controller('afastamentos')
export class AfastamentosController {
  constructor(private readonly afastamentosService: AfastamentosService) {}

  @Post()
  create(@Body() createAfastamentoDto: CreateAfastamentoDto) {
    const { responsavelId, ...data } = createAfastamentoDto;
    const actorIdNumber =
      typeof responsavelId === 'number'
        ? responsavelId
        : responsavelId !== undefined
          ? Number(responsavelId)
          : undefined;
    const actorId =
      actorIdNumber !== undefined && Number.isNaN(actorIdNumber)
        ? undefined
        : actorIdNumber;
    return this.afastamentosService.create(data, actorId);
  }

  @Get()
  findAll(@Query('colaboradorId') colaboradorId?: string) {
    if (colaboradorId) {
      const id = Number.parseInt(colaboradorId, 10);
      if (Number.isNaN(id)) {
        throw new BadRequestException('O colaboradorId deve ser numérico.');
      }
      return this.afastamentosService.findByColaborador(id);
    }
    return this.afastamentosService.findAll();
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
  ) {
    const { responsavelId, ...data } = updateAfastamentoDto;
    const actorIdNumber =
      typeof responsavelId === 'number'
        ? responsavelId
        : responsavelId !== undefined
          ? Number(responsavelId)
          : undefined;
    const actorId =
      actorIdNumber !== undefined && Number.isNaN(actorIdNumber)
        ? undefined
        : actorIdNumber;
    return this.afastamentosService.update(id, data, actorId);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Body('responsavelId') responsavelId?: number,
  ) {
    const actorIdNumber =
      typeof responsavelId === 'number'
        ? responsavelId
        : responsavelId !== undefined
          ? Number(responsavelId)
          : undefined;
    const actorId =
      actorIdNumber !== undefined && Number.isNaN(actorIdNumber)
        ? undefined
        : actorIdNumber;
    return this.afastamentosService.remove(id, actorId);
  }
}

