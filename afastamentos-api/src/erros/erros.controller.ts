import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { ErrosService } from './erros.service';

@Controller('erros')
export class ErrosController {
  constructor(private readonly errosService: ErrosService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('dataInicio') dataInicio?: string,
    @Query('dataFim') dataFim?: string,
  ) {
    const options = {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      dataInicio: dataInicio ? new Date(dataInicio) : undefined,
      dataFim: dataFim ? new Date(dataFim) : undefined,
    };

    return this.errosService.findAll(options);
  }
}
