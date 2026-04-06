import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ErrorReportsService } from './error-reports.service';
import { CreateErrorReportDto } from './dto/create-error-report.dto';
import { AddErrorReportComentarioDto } from './dto/add-error-report-comentario.dto';
import { UpdateErrorReportStatusDto } from './dto/update-error-report-status.dto';
import { CancelErrorReportDto } from './dto/cancel-error-report.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import type { UsuarioAuth } from './error-reports.service';

@Controller('error-reports')
export class ErrorReportsController {
  constructor(private readonly errorReportsService: ErrorReportsService) {}

  @Post()
  @AnyAuthenticated()
  create(
    @Body() dto: CreateErrorReportDto,
    @CurrentUser() user: UsuarioAuth,
  ) {
    return this.errorReportsService.create(dto, user);
  }

  @Get()
  @AnyAuthenticated()
  findAll(@CurrentUser() user: UsuarioAuth) {
    return this.errorReportsService.findAll(user);
  }

  @Get('admin/contagem-abertos')
  @AnyAuthenticated()
  contagemAbertosAdmin(@CurrentUser() user: UsuarioAuth) {
    return this.errorReportsService.countAbertosAdmin(user);
  }

  @Get('admin/todos')
  @AnyAuthenticated()
  findAllAdmin(@CurrentUser() user: UsuarioAuth) {
    return this.errorReportsService.findAllAdmin(user);
  }

  @Get(':id')
  @AnyAuthenticated()
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: UsuarioAuth,
  ) {
    return this.errorReportsService.findOne(id, user);
  }

  @Post(':id/cancelar')
  @AnyAuthenticated()
  cancelarPeloUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelErrorReportDto,
    @CurrentUser() user: UsuarioAuth,
  ) {
    return this.errorReportsService.cancelarPeloUsuario(id, dto, user);
  }

  @Post(':id/comentarios')
  @AnyAuthenticated()
  adicionarComentario(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddErrorReportComentarioDto,
    @CurrentUser() user: UsuarioAuth,
  ) {
    return this.errorReportsService.adicionarComentario(id, dto, user);
  }

  @Patch(':id/status')
  @AnyAuthenticated()
  atualizarStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateErrorReportStatusDto,
    @CurrentUser() user: UsuarioAuth,
  ) {
    return this.errorReportsService.atualizarStatus(id, dto, user);
  }
}
