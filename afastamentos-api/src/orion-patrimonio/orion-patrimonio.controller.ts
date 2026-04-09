import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { OrionPatrimonioService } from './orion-patrimonio.service';
import { Public } from '../auth/public.decorator';
import { AnyAuthenticated } from '../auth/any-authenticated.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreatePatrimonioBemDto } from './dto/create-patrimonio-bem.dto';
import { UpdatePatrimonioBemDto } from './dto/update-patrimonio-bem.dto';
import type { UsuarioOrionPatrimonioReq } from './orion-patrimonio.service';

function toPatrimonioUser(user: {
  id: number;
  nome: string;
  matricula: string;
  sistemasPermitidos: string[];
}): UsuarioOrionPatrimonioReq {
  return {
    id: user.id,
    nome: user.nome,
    matricula: user.matricula,
    sistemasPermitidos: user.sistemasPermitidos ?? [],
  };
}

@Controller('orion-patrimonio')
export class OrionPatrimonioController {
  constructor(private readonly orionPatrimonioService: OrionPatrimonioService) {}

  @Public()
  @Get()
  info() {
    return this.orionPatrimonioService.getPublicMeta();
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
    return this.orionPatrimonioService.sessaoResumo(toPatrimonioUser(user));
  }

  @Get('v1/bens')
  @AnyAuthenticated()
  listarBens(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
  ) {
    return this.orionPatrimonioService.listarBens(toPatrimonioUser(user));
  }

  @Get('v1/bens/:id')
  @AnyAuthenticated()
  obterBem(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orionPatrimonioService.obterBem(toPatrimonioUser(user), id);
  }

  @Post('v1/bens')
  @AnyAuthenticated()
  criarBem(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Body() dto: CreatePatrimonioBemDto,
  ) {
    return this.orionPatrimonioService.criarBem(toPatrimonioUser(user), dto);
  }

  @Patch('v1/bens/:id')
  @AnyAuthenticated()
  atualizarBem(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePatrimonioBemDto,
  ) {
    return this.orionPatrimonioService.atualizarBem(toPatrimonioUser(user), id, dto);
  }

  @Delete('v1/bens/:id')
  @AnyAuthenticated()
  excluirBem(
    @CurrentUser()
    user: {
      id: number;
      nome: string;
      matricula: string;
      sistemasPermitidos: string[];
    },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orionPatrimonioService.excluirBem(toPatrimonioUser(user), id);
  }
}
