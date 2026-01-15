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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { DeleteUsuarioDto } from './dto/delete-usuario.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() createUsuarioDto: CreateUsuarioDto, @CurrentUser() user: Usuario) {
    return this.usuariosService.create(createUsuarioDto, user.id);
  }

  @Get()
  findAll(
    @Query('currentUserId') currentUserId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const userId = currentUserId ? Number(currentUserId) : undefined;
    return this.usuariosService.findAll(
      userId && !Number.isNaN(userId) ? userId : undefined,
      {
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      },
    );
  }

  @Get('niveis')
  findNiveis() {
    return this.usuariosService.findNiveis();
  }

  @Get('funcoes')
  listFuncoes() {
    return this.usuariosService.listFuncoes();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.remove(id, user.id);
  }

  @Post(':id/delete-permanent')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Body() deleteUsuarioDto: DeleteUsuarioDto,
    @CurrentUser() user: Usuario,
  ) {
    const { responsavelId, ...rest } = deleteUsuarioDto;
    return this.usuariosService.delete(id, {
      ...rest,
      responsavelId: user.id,
    });
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.activate(id, user.id);
  }
}

