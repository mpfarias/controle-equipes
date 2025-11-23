import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class DeleteUsuarioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  responsavelId?: number;

  @IsString()
  @IsNotEmpty()
  senha: string;
}

