import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe } from '@nestjs/common';
import { SvgService } from './svg.service';
import { CreateHorarioSvgDto } from './dto/create-horario-svg.dto';
import { Roles } from '../auth/roles.decorator';
import type { Usuario } from '@prisma/client';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('svg')
export class SvgController {
  constructor(private readonly svgService: SvgService) {}

  @Get('horarios')
  listHorarios() {
    return this.svgService.listHorarios();
  }

  @Post('horarios')
  @Roles('ADMINISTRADOR', 'SAD')
  createHorario(@Body() dto: CreateHorarioSvgDto, @CurrentUser() user: Usuario) {
    return this.svgService.createHorario(dto);
  }

  @Delete('horarios/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  deleteHorario(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.svgService.deleteHorario(id);
  }
}
