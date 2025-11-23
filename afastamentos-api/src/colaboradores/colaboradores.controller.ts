import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ColaboradoresService } from './colaboradores.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';

@Controller('colaboradores')
export class ColaboradoresController {
  constructor(private readonly colaboradoresService: ColaboradoresService) {}

  @Post()
  create(@Body() createColaboradorDto: CreateColaboradorDto) {
    const { responsavelId, ...data } = createColaboradorDto;
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
    return this.colaboradoresService.create(data, actorId);
  }

  @Get()
  findAll() {
    return this.colaboradoresService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColaboradorDto: UpdateColaboradorDto,
  ) {
    const { responsavelId, ...data } = updateColaboradorDto;
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
    return this.colaboradoresService.update(id, data, actorId);
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
    return this.colaboradoresService.remove(id, actorId);
  }

  @Patch(':id/activate')
  activate(
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
    return this.colaboradoresService.activate(id, actorId);
  }
}

