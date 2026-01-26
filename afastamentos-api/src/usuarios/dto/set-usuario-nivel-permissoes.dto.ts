import { IsArray, IsIn, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const PERMISSAO_ACOES = ['VISUALIZAR', 'EDITAR', 'DESATIVAR', 'EXCLUIR'] as const;

export class UsuarioNivelPermissaoItemDto {
  @IsString()
  @IsNotEmpty()
  telaKey: string;

  @IsString()
  @IsIn(PERMISSAO_ACOES)
  acao: (typeof PERMISSAO_ACOES)[number];
}

export class SetUsuarioNivelPermissoesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UsuarioNivelPermissaoItemDto)
  itens: UsuarioNivelPermissaoItemDto[];
}
