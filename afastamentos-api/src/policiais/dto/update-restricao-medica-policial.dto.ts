import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateRestricaoMedicaPolicialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  restricaoMedicaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string | null;

  @IsOptional()
  @IsDateString()
  dataInicio?: string | null;

  @IsOptional()
  @IsDateString()
  dataFim?: string | null;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  permanente?: boolean;
}

