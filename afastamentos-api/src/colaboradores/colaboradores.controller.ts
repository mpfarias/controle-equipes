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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ColaboradoresService } from './colaboradores.service';
import { ArquivoProcessorService } from './arquivo-processor.service';
import { CreateColaboradorDto } from './dto/create-colaborador.dto';
import { UpdateColaboradorDto } from './dto/update-colaborador.dto';
import { CreateColaboradoresBulkDto } from './dto/create-colaboradores-bulk.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('colaboradores')
export class ColaboradoresController {
  constructor(
    private readonly colaboradoresService: ColaboradoresService,
    private readonly arquivoProcessorService: ArquivoProcessorService,
  ) {}

  @Post()
  create(@Body() createColaboradorDto: CreateColaboradorDto, @CurrentUser() user: Usuario) {
    return this.colaboradoresService.create(createColaboradorDto, user.id);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.colaboradoresService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.colaboradoresService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateColaboradorDto: UpdateColaboradorDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.colaboradoresService.update(id, updateColaboradorDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.colaboradoresService.remove(id, user.id);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.colaboradoresService.activate(id, user.id);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }
    return this.arquivoProcessorService.processarArquivo(file);
  }

  @Post('bulk')
  async createBulk(@Body() createBulkDto: CreateColaboradoresBulkDto, @CurrentUser() user: Usuario) {
    return this.colaboradoresService.createBulk(createBulkDto, user.id);
  }
}

