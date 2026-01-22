import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { CreatePolicialDto } from './create-policial.dto';

export class UpdatePolicialDto extends PartialType(CreatePolicialDto) {
  @IsOptional()
  @IsString()
  fotoUrl?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  mesPrevisaoFerias?: number | null;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  anoPrevisaoFerias?: number | null;

  @IsOptional()
  @IsBoolean()
  feriasConfirmadas?: boolean;

  @IsOptional()
  @IsBoolean()
  feriasReprogramadas?: boolean;
}
