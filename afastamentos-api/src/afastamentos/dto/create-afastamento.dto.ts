import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
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

  /** Ano da cota (exercício) para férias gozadas em data de outro ano. Opcional; só válido com motivo Férias. */
  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(2100)
  anoExercicioFerias?: number | null;
}

