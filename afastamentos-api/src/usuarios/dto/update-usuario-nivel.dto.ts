import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateUsuarioNivelDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nome?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  descricao?: string;
}
