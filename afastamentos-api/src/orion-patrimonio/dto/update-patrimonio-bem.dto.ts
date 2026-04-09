import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PatrimonioBemSituacao } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePatrimonioBemDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  marca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  numeroSerie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  localizacaoSetor?: string;

  @IsOptional()
  @IsEnum(PatrimonioBemSituacao)
  situacao?: PatrimonioBemSituacao;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsDateString()
  dataAquisicao?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  valorAquisicao?: number | null;
}
