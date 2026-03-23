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
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { DeleteUsuarioDto } from './dto/delete-usuario.dto';
import { CreateUsuarioNivelDto } from './dto/create-usuario-nivel.dto';
import { UpdateUsuarioNivelDto } from './dto/update-usuario-nivel.dto';
import { SetUsuarioNivelPermissoesDto } from './dto/set-usuario-nivel-permissoes.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import type { Usuario } from '@prisma/client';

@Controller('usuarios')
@Roles('ADMINISTRADOR', 'SAD')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  create(@Body() createUsuarioDto: CreateUsuarioDto, @CurrentUser() user: Usuario) {
    return this.usuariosService.create(createUsuarioDto, user.id);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: Usuario,
  ) {
    return this.usuariosService.findAll(
      user?.id,
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

  @Post('niveis')
  createNivel(
    @Body() createUsuarioNivelDto: CreateUsuarioNivelDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.createNivel(createUsuarioNivelDto, user.id);
  }

  @Patch('niveis/:id')
  updateNivel(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioNivelDto: UpdateUsuarioNivelDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.updateNivel(id, updateUsuarioNivelDto, user.id);
  }

  @Patch('niveis/:id/desativar')
  disableNivel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.disableNivel(id, user.id);
  }

  @Delete('niveis/:id')
  deleteNivel(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.deleteNivel(id, user.id);
  }

  @Get('niveis/:id/permissoes')
  @AnyAuthenticated() // Permite acesso para qualquer usuário autenticado
  listPermissoes(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.listNivelPermissoes(id);
  }

  @Post('niveis/:id/permissoes')
  setPermissoes(
    @Param('id', ParseIntPipe) id: number,
    @Body() setPermissoesDto: SetUsuarioNivelPermissoesDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.setNivelPermissoes(id, setPermissoesDto, user.id);
  }

  @Get('funcoes')
  @AnyAuthenticated() // Permite acesso para qualquer usuário autenticado
  listFuncoes() {
    return this.usuariosService.listFuncoes();
  }

  @Post('funcoes')
  createFuncao(
    @Body() body: { nome: string; descricao?: string | null },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.createFuncao(body, user.id);
  }

  @Patch('funcoes/:id')
  updateFuncao(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome?: string; descricao?: string | null },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.updateFuncao(id, body, user.id);
  }

  @Patch('funcoes/:id/desativar')
  disableFuncao(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.disableFuncao(id, user.id);
  }

  @Delete('funcoes/:id')
  deleteFuncao(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.deleteFuncao(id, user.id);
  }

  @Get('equipes')
  @AnyAuthenticated() // Permite acesso para qualquer usuário autenticado (ex.: filtros avançados em Afastamentos do mês)
  listEquipes() {
    return this.usuariosService.listEquipes();
  }

  @Post('equipes')
  createEquipe(
    @Body() body: { nome: string; descricao?: string | null },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.createEquipe(body, user.id);
  }

  @Patch('equipes/:id')
  updateEquipe(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { nome?: string; descricao?: string | null },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.updateEquipe(id, body, user.id);
  }

  @Patch('equipes/:id/desativar')
  disableEquipe(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.disableEquipe(id, user.id);
  }

  @Delete('equipes/:id')
  deleteEquipe(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.usuariosService.deleteEquipe(id, user.id);
  }

  @Get('perguntas-seguranca')
  listPerguntasSeguranca() {
    return this.usuariosService.listPerguntasSeguranca();
  }

  @Post('perguntas-seguranca')
  createPerguntaSeguranca(
    @Body() body: { texto: string },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.createPerguntaSeguranca(body, user.id);
  }

  @Patch('perguntas-seguranca/:id')
  updatePerguntaSeguranca(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { texto?: string },
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.updatePerguntaSeguranca(id, body, user.id);
  }

  @Patch('perguntas-seguranca/:id/desativar')
  disablePerguntaSeguranca(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.disablePerguntaSeguranca(id, user.id);
  }

  @Delete('perguntas-seguranca/:id')
  deletePerguntaSeguranca(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: Usuario,
  ) {
    return this.usuariosService.deletePerguntaSeguranca(id, user.id);
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

