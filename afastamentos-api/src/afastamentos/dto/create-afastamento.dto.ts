import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^\d+$/, {
    message: 'O SEI nº deve conter apenas números.',
  })
  seiNumero: string;

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

