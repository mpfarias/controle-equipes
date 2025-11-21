import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAfastamentoDto {
  @IsInt()
  @Min(1)
  colaboradorId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  responsavelId?: number;
}

