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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    const { responsavelId, ...data } = createUsuarioDto;
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
    return this.usuariosService.create(data, actorId);
  }

  @Get()
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
  ) {
    const { responsavelId, ...data } = updateUsuarioDto;
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
    return this.usuariosService.update(id, data, actorId);
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
    return this.usuariosService.remove(id, actorId);
  }
}

