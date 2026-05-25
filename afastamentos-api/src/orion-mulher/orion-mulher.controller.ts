import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { OrionMulherService } from './orion-mulher.service';
import type { UsuarioOrionMulherReq } from './orion-mulher.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';

type UsuarioJwtRequest = {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
  isAdmin?: boolean;
  nivel?: { nome?: string | null } | null;
};

function toMulherUser(user: UsuarioJwtRequest): UsuarioOrionMulherReq {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    sistemasPermitidos: user.sistemasPermitidos ?? [],
    isAdmin: user.isAdmin,
    nivel: user.nivel,
  };
}

function reqMeta(req: Request) {
  return {
    ip: req.ip || req.headers['x-forwarded-for']?.toString(),
    userAgent: req.headers['user-agent'],
  };
}

@Controller('orion-mulher')
export class OrionMulherController {
  constructor(private readonly mulherService: OrionMulherService) {}

  @Public()
  @Get()
  info() {
    return this.mulherService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(@CurrentUser() user: UsuarioJwtRequest) {
    return this.mulherService.sessaoResumo(toMulherUser(user));
  }

  @Get('v1/dashboard/stats')
  @AnyAuthenticated()
  dashboard(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.mulherService.dashboardStats(toMulherUser(user), { from, to });
  }

  @Get('v1/ocorrencias')
  @AnyAuthenticated()
  listarOcorrencias(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('page') page?: string,
    @Query('q') q?: string,
    @Query('id') porId?: string,
    @Query('cad') porCad?: string,
  ) {
    return this.mulherService.listarOcorrencias(toMulherUser(user), {
      page: page ? Number(page) : 1,
      q,
      porId,
      porCad,
    });
  }

  @Get('v1/ocorrencias/:id')
  @AnyAuthenticated()
  obterOcorrencia(@CurrentUser() user: UsuarioJwtRequest, @Param('id') id: string) {
    return this.mulherService.obterOcorrencia(toMulherUser(user), id);
  }

  @Post('v1/ocorrencias')
  @AnyAuthenticated()
  criarOcorrencia(
    @CurrentUser() user: UsuarioJwtRequest,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.mulherService.criarOcorrencia(toMulherUser(user), body, reqMeta(req));
  }

  @Patch('v1/ocorrencias/:id')
  @AnyAuthenticated()
  atualizarOcorrencia(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.mulherService.atualizarOcorrencia(toMulherUser(user), id, body, reqMeta(req));
  }

  @Delete('v1/ocorrencias/:id')
  @AnyAuthenticated()
  excluirOcorrencia(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.mulherService.excluirOcorrencia(toMulherUser(user), id, reqMeta(req));
  }

  @Get('v1/central/vitima-cadastros')
  @AnyAuthenticated()
  centralCadastros(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('limit') limit?: string,
  ) {
    return this.mulherService.listarCadastrosCentral(
      toMulherUser(user),
      limit ? Number(limit) : 100,
    );
  }

  @Get('v1/central/vitima-panicos')
  @AnyAuthenticated()
  centralPanico(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('limit') limit?: string,
  ) {
    return this.mulherService.listarPanicoCentral(
      toMulherUser(user),
      limit ? Number(limit) : 100,
    );
  }

  @Patch('v1/central/vitima-panicos/:id')
  @AnyAuthenticated()
  atualizarPanico(
    @CurrentUser() user: UsuarioJwtRequest,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.mulherService.atualizarPanicoCentral(toMulherUser(user), id, {
      encaminhamento: body.encaminhamento as never,
      finalizacao: body.finalizacao as never,
      acknowledged: body.acknowledged === true,
    });
  }

  @Get('v1/auditoria')
  @AnyAuthenticated()
  auditoria(
    @CurrentUser() user: UsuarioJwtRequest,
    @Query('limit') limit?: string,
  ) {
    return this.mulherService.listarAuditoria(toMulherUser(user), limit ? Number(limit) : 100);
  }

  @Post('v1/import/excel')
  @AnyAuthenticated()
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  importarExcel(
    @CurrentUser() user: UsuarioJwtRequest,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('mode') mode?: string,
    @Body('useEnvPath') useEnvPath?: string,
    @Req() req?: Request,
  ) {
    const modo = mode === 'append' ? 'append' : 'replace';
    const usarEnv = useEnvPath === 'true' || useEnvPath === '1';
    return this.mulherService.importarExcel(
      toMulherUser(user),
      {
        mode: modo,
        buffer: file?.buffer,
        useEnvPath: usarEnv && !file?.buffer,
      },
      req ? reqMeta(req) : undefined,
    );
  }

  // ─── Rotas públicas do app vítima (sem JWT Órion) ──────────────────────────

  @Public()
  @Post('v1/vitima-app/cadastro')
  vitimaCadastro(@Body() body: Record<string, unknown>) {
    return this.mulherService.vitimaAppCadastro(body);
  }

  @Public()
  @Post('v1/vitima-app/cadastro/carregar')
  vitimaCarregar(@Body() body: Record<string, unknown>) {
    return this.mulherService.vitimaAppCarregar(body);
  }

  @Public()
  @Patch('v1/vitima-app/cadastro/:id')
  vitimaAtualizar(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.mulherService.vitimaAppAtualizarCadastro(id, body);
  }

  @Public()
  @Post('v1/vitima-app/panico')
  vitimaPanico(@Body() body: Record<string, unknown>) {
    return this.mulherService.vitimaAppPanico(body);
  }
}
