import { IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class EscalaGeradaLinhaDto {
  @IsIn(['DISPONIVEL', 'AFASTADO'])
  lista!: 'DISPONIVEL' | 'AFASTADO';

  @IsInt()
  policialId!: number;

  @IsString()
  @MinLength(1)
  nome!: string;

  @IsString()
  @MinLength(1)
  matricula!: string;

  @IsOptional()
  @IsString()
  equipe?: string | null;

  @IsString()
  @MinLength(1)
  horarioServico!: string;

  @IsOptional()
  @IsString()
  funcaoNome?: string | null;

  @IsOptional()
  @IsString()
  detalheAfastamento?: string | null;
}
