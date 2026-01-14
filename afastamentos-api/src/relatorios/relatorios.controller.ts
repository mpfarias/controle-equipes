import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly relatoriosService: RelatoriosService) {}

  @Post('registrar')
  @UseGuards(JwtAuthGuard)
  async registrarGeracao(@Body() body: { tipoRelatorio: string }, @Request() req: any) {
    const user = req.user;
    await this.relatoriosService.registrarGeracaoRelatorio(
      user?.id,
      user?.nome,
      user?.matricula,
      body.tipoRelatorio,
    );
    return { success: true };
  }

  @Get('logs')
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    return this.relatoriosService.findAll({
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    });
  }
}
