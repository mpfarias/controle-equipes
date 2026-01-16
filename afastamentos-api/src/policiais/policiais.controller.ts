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
import { PoliciaisService } from './policiais.service';
import { ArquivoProcessorService } from './arquivo-processor.service';
import { CreatePolicialDto } from './dto/create-policial.dto';
import { UpdatePolicialDto } from './dto/update-policial.dto';
import { CreatePoliciaisBulkDto } from './dto/create-policiais-bulk.dto';
import { DeletePolicialDto } from './dto/delete-policial.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Usuario } from '@prisma/client';

@Controller('policiais')
export class PoliciaisController {
  constructor(
    private readonly policiaisService: PoliciaisService,
    private readonly arquivoProcessorService: ArquivoProcessorService,
  ) {}

  @Post()
  create(@Body() createPolicialDto: CreatePolicialDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.create(createPolicialDto, user.id);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.policiaisService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('restricoes-medicas')
  listRestricoesMedicas() {
    return this.policiaisService.listRestricoesMedicas();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.policiaisService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePolicialDto: UpdatePolicialDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.update(id, updatePolicialDto, user.id);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.remove(id, user.id);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.activate(id, user.id);
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
  async createBulk(@Body() createBulkDto: CreatePoliciaisBulkDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.createBulk(createBulkDto, user.id);
  }

  @Post(':id/delete-permanent')
  delete(
    @Param('id', ParseIntPipe) id: number,
    @Body() deletePolicialDto: DeletePolicialDto,
    @CurrentUser() user: Usuario,
  ) {
    const { responsavelId, ...rest } = deletePolicialDto;
    return this.policiaisService.delete(id, {
      ...rest,
      responsavelId: user.id,
    }, user);
  }

  @Patch(':id/restricao-medica')
  updateRestricaoMedica(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { restricaoMedicaId: number | null },
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.updateRestricaoMedica(
      id,
      body.restricaoMedicaId,
      user.id,
    );
  }
}
