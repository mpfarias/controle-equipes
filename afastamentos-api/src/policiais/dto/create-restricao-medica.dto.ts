import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateRestricaoMedicaDto {
  @IsString()
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;
}

