import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsDateString,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateRestricaoAfastamentoDto {
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  tipoRestricaoId: number;

  @IsInt()
  @IsNotEmpty()
  @Min(2000)
  @Max(2100)
  ano: number;

  @IsDateString()
  @IsNotEmpty()
  dataInicio: string;

  @IsDateString()
  @IsNotEmpty()
  dataFim: string;
}
