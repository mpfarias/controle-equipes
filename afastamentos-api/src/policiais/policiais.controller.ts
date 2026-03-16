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
import { CreatePoliciaisBulkDto } from './dto/create-policiais-bulk.dto.js';
import { DeletePolicialDto } from './dto/delete-policial.dto';
import { DesativarPolicialDto } from './dto/desativar-policial.dto';
import { RemoveRestricaoMedicaDto } from './dto/remove-restricao-medica.dto';
import { CreateRestricaoMedicaDto } from './dto/create-restricao-medica.dto';
import { UpdateRestricaoMedicaDto } from './dto/update-restricao-medica.dto';
import { UpdateRestricaoMedicaPolicialDto } from './dto/update-restricao-medica-policial.dto';
import { CreateStatusDto } from './dto/create-status.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import type { Usuario } from '@prisma/client';

@Controller('policiais')
export class PoliciaisController {
  constructor(
    private readonly policiaisService: PoliciaisService,
    private readonly arquivoProcessorService: ArquivoProcessorService,
  ) {}

  @Post()
  @Roles('ADMINISTRADOR', 'SAD')
  create(@Body() createPolicialDto: CreatePolicialDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.create(createPolicialDto, user.id);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('includeAfastamentos') includeAfastamentos?: string,
    @Query('includeRestricoes') includeRestricoes?: string,
    @Query('search') search?: string,
    @Query('equipe') equipe?: string,
    @Query('status') status?: string,
    @Query('funcaoId') funcaoId?: string,
    @Query('orderBy') orderBy?: string,
    @Query('orderDir') orderDir?: string,
    @Query('mesPrevisaoFerias') mesPrevisaoFerias?: string,
    @Query('anoPrevisaoFerias') anoPrevisaoFerias?: string,
  ) {
    const includeAfastamentosParsed = includeAfastamentos === 'true';
    const includeRestricoesParsed = includeRestricoes === 'true';
    const funcaoIdParsed = funcaoId ? Number.parseInt(funcaoId, 10) : undefined;
    if (funcaoId && Number.isNaN(funcaoIdParsed)) {
      throw new BadRequestException('O funcaoId deve ser numérico.');
    }
    const orderByAllowed = orderBy === 'nome' || orderBy === 'matricula' || orderBy === 'equipe' || orderBy === 'status' || orderBy === 'funcao';
    if (orderBy && !orderByAllowed) {
      throw new BadRequestException('O orderBy deve ser nome, matricula, equipe, status ou funcao.');
    }
    const orderDirAllowed = orderDir === 'asc' || orderDir === 'desc';
    if (orderDir && !orderDirAllowed) {
      throw new BadRequestException('O orderDir deve ser asc ou desc.');
    }
    const mesPrevisaoParsed = mesPrevisaoFerias ? Number.parseInt(mesPrevisaoFerias, 10) : undefined;
    const anoPrevisaoParsed = anoPrevisaoFerias ? Number.parseInt(anoPrevisaoFerias, 10) : undefined;
    if (mesPrevisaoFerias && Number.isNaN(mesPrevisaoParsed!)) {
      throw new BadRequestException('O mesPrevisaoFerias deve ser numérico (1-12).');
    }
    if (anoPrevisaoFerias && Number.isNaN(anoPrevisaoParsed!)) {
      throw new BadRequestException('O anoPrevisaoFerias deve ser numérico.');
    }
    return this.policiaisService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      includeAfastamentos: includeAfastamentosParsed,
      includeRestricoes: includeRestricoesParsed,
      search: search || undefined,
      equipe: equipe || undefined,
      status: status || undefined,
      funcaoId: funcaoIdParsed,
      orderBy: orderByAllowed ? (orderBy as 'nome' | 'matricula' | 'equipe' | 'status' | 'funcao') : undefined,
      orderDir: orderDirAllowed ? (orderDir as 'asc' | 'desc') : undefined,
      mesPrevisaoFerias: mesPrevisaoParsed,
      anoPrevisaoFerias: anoPrevisaoParsed,
    });
  }

  @Get('restricoes-medicas')
  listRestricoesMedicas() {
    return this.policiaisService.listRestricoesMedicas();
  }

  @Post('restricoes-medicas')
  @Roles('ADMINISTRADOR', 'SAD')
  createRestricaoMedica(@Body() dto: CreateRestricaoMedicaDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.createRestricaoMedica(dto, user.id);
  }

  @Patch('restricoes-medicas/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  updateRestricaoMedicaOption(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRestricaoMedicaDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.updateRestricaoMedicaOption(id, dto, user.id);
  }

  @Delete('restricoes-medicas/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  deleteRestricaoMedicaOption(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.deleteRestricaoMedicaOption(id, user.id);
  }

  @Get('efetivo-por-posto')
  getEfetivoPorPosto(@Query('equipe') equipe?: string) {
    return this.policiaisService.getEfetivoPorPosto(equipe ?? undefined);
  }

  @Get('por-posto/:posto')
  getPoliciaisPorPosto(
    @Param('posto') posto: string,
    @Query('equipe') equipe?: string,
  ) {
    const postoValido = ['oficial', 'praca', 'civil', 'outros'].includes(posto);
    if (!postoValido) {
      throw new BadRequestException('Posto inválido. Use: oficial, praca, civil ou outros.');
    }
    return this.policiaisService.findPoliciaisPorPosto(
      posto as 'oficial' | 'praca' | 'civil' | 'outros',
      equipe ?? undefined,
    );
  }

  @Get('ferias-programadas-sem-afastamento')
  getFeriasProgramadasSemAfastamento(@Query('equipe') equipe?: string) {
    return this.policiaisService.findPoliciaisComFeriasProgramadasSemAfastamento(equipe ?? undefined);
  }

  @Get('ferias-programadas-atrasadas-sem-afastamento')
  getFeriasProgramadasAtrasadasSemAfastamento(@Query('equipe') equipe?: string) {
    return this.policiaisService.findPoliciaisComFeriasAtrasadasSemAfastamento(equipe ?? undefined);
  }

  @Get('status')
  listStatusPolicial() {
    return this.policiaisService.listStatusPolicial();
  }

  @Post('status')
  @Roles('ADMINISTRADOR', 'SAD')
  createStatusPolicial(@Body() createStatusDto: CreateStatusDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.createStatusPolicial(createStatusDto, user.id);
  }

  @Patch('status/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  updateStatusPolicial(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.updateStatusPolicial(id, updateStatusDto, user.id);
  }

  @Delete('status/:id')
  @Roles('ADMINISTRADOR', 'SAD')
  deleteStatusPolicial(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.deleteStatusPolicial(id, user.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.policiaisService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMINISTRADOR', 'SAD')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePolicialDto: UpdatePolicialDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.update(id, updatePolicialDto, user.id);
  }

  @Delete(':id')
  @Roles('ADMINISTRADOR', 'SAD')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.remove(id, user.id);
  }

  @Patch(':id/desativar')
  @Roles('ADMINISTRADOR', 'SAD')
  desativar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DesativarPolicialDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.desativar(id, dto, user.id);
  }

  @Patch(':id/activate')
  @Roles('ADMINISTRADOR', 'SAD')
  activate(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: Usuario) {
    return this.policiaisService.activate(id, user.id);
  }

  @Post('upload')
  @Roles('ADMINISTRADOR', 'SAD')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, callback) => {
        const fileName = file.originalname.toLowerCase();
        const isAllowed =
          fileName.endsWith('.pdf') ||
          fileName.endsWith('.xlsx') ||
          fileName.endsWith('.xls');
        if (!isAllowed) {
          return callback(
            new BadRequestException('Tipo de arquivo inválido. Envie um arquivo PDF ou Excel (.xlsx, .xls).'),
            false,
          );
        }
        return callback(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Arquivo não fornecido');
    }
    return this.arquivoProcessorService.processarArquivo(file);
  }

  @Post('bulk')
  @Roles('ADMINISTRADOR', 'SAD')
  async createBulk(@Body() createBulkDto: CreatePoliciaisBulkDto, @CurrentUser() user: Usuario) {
    return this.policiaisService.createBulk(createBulkDto, user.id);
  }

  @Post(':id/delete-permanent')
  @Roles('ADMINISTRADOR', 'SAD')
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
  @Roles('ADMINISTRADOR', 'SAD')
  updateRestricaoMedica(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateRestricaoMedicaPolicialDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.updateRestricaoMedica(
      id,
      body.restricaoMedicaId ?? null,
      user.id,
      body.observacao ?? null,
    );
  }

  @Delete(':id/restricao-medica')
  @Roles('ADMINISTRADOR', 'SAD')
  removeRestricaoMedica(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: RemoveRestricaoMedicaDto,
    @CurrentUser() user: Usuario,
  ) {
    return this.policiaisService.removeRestricaoMedica(id, body.senha, user.id);
  }
}
