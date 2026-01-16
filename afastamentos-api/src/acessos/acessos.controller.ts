import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { AcessosService } from './acessos.service';

@Controller('acessos')
export class AcessosController {
  constructor(private readonly acessosService: AcessosService) {}

  @Post('login')
  async registrarLogin(@Body() data: { acessoId?: number }) {
    // Este endpoint será chamado pelo controller de autenticação
    // Retorna o ID do acesso criado
    return { acessoId: data.acessoId || 0 };
  }

  @Post('logout')
  async registrarLogout(@Body() data: { acessoId: number }) {
    await this.acessosService.registrarLogout(data.acessoId);
    return { success: true };
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
    @Query('userId') userId?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
      userId: userId ? parseInt(userId, 10) : undefined,
    };

    return this.acessosService.findAll(options);
  }
}
