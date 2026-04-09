import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateQualidadeRegistroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  descricao?: string;
}
