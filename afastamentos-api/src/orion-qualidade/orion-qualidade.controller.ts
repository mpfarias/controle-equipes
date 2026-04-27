import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrionQualidadeService } from './orion-qualidade.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateQualidadeRegistroDto } from './dto/create-qualidade-registro.dto';
import { UpdateQualidadeRegistroDto } from './dto/update-qualidade-registro.dto';
import { EquipesPorNomeDto } from './dto/equipes-por-nome.dto';
import type { UsuarioOrionQualidadeReq } from './orion-qualidade.service';

function toQualidadeUser(user: {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
}): UsuarioOrionQualidadeReq {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    sistemasPermitidos: user.sistemasPermitidos ?? [],
  };
}

@Controller('orion-qualidade')
export class OrionQualidadeController {
  constructor(private readonly orionQualidadeService: OrionQualidadeService) {}

  @Public()
  @Get()
  info() {
    return this.orionQualidadeService.getPublicMeta();
  }

  @Get('v1/sessao')
  @AnyAuthenticated()
  sessao(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
  ) {
    return this.orionQualidadeService.sessaoResumo(toQualidadeUser(user));
  }

  @Get('v1/integra-ssp/status')
  @AnyAuthenticated()
  statusIntegraSsp(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
  ) {
    return this.orionQualidadeService.statusIntegraSsp(toQualidadeUser(user));
  }

  @Get('v1/registros')
  @AnyAuthenticated()
  listarRegistros(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
  ) {
    return this.orionQualidadeService.listarRegistros(toQualidadeUser(user));
  }

  @Post('v1/registros')
  @AnyAuthenticated()
  criarRegistro(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Body() dto: CreateQualidadeRegistroDto,
  ) {
    return this.orionQualidadeService.criarRegistro(toQualidadeUser(user), dto);
  }

  @Post('v1/policiais/equipes-por-nome')
  @AnyAuthenticated()
  equipesPorNome(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Body() dto: EquipesPorNomeDto,
  ) {
    return this.orionQualidadeService.resolverEquipesPorNomes(
      toQualidadeUser(user),
      dto.nomes ?? [],
    );
  }

  @Patch('v1/registros/:id')
  @AnyAuthenticated()
  atualizarRegistro(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateQualidadeRegistroDto,
  ) {
    return this.orionQualidadeService.atualizarRegistro(
      toQualidadeUser(user),
      id,
      dto,
    );
  }
}
