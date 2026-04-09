import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean, ValidateIf } from 'class-validator';
import { CreatePolicialDto } from './create-policial.dto';

export class UpdatePolicialDto extends PartialType(CreatePolicialDto) {
  @IsOptional()
  @IsString()
  fotoUrl?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.somenteAnoPrevisaoFerias !== true)
  @IsInt()
  @Min(1)
  @Max(12)
  mesPrevisaoFerias?: number | null;

  @IsOptional()
  @IsInt()
  /** Alinhado a `upsertFeriasPrevisao` (exercícios antigos + planejamento). */
  @Min(1985)
  @Max(2100)
  anoPrevisaoFerias?: number | null;

  @IsOptional()
  @IsBoolean()
  feriasConfirmadas?: boolean;

  @IsOptional()
  @IsBoolean()
  feriasReprogramadas?: boolean;

  /** Só para exercício &lt; ano civil: grava previsão sem mês (mês informado depois). */
  @IsOptional()
  @IsBoolean()
  somenteAnoPrevisaoFerias?: boolean;
}
