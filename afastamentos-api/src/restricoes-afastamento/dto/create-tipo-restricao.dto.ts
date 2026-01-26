import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateTipoRestricaoDto {
  @IsString()
  @MaxLength(255)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descricao?: string | null;
}
