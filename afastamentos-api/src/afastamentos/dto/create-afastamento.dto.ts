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
  policialId: number;

  @IsInt()
  @Min(1)
  motivoId: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;
}

