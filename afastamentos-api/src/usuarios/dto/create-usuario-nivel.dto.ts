import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUsuarioNivelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nome: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;
}
