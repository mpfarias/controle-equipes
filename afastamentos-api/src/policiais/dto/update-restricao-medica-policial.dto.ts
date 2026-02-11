import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateRestricaoMedicaPolicialDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  restricaoMedicaId?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string | null;
}

