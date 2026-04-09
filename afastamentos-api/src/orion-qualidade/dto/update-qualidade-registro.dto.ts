import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { QualidadeRegistroStatus } from '@prisma/client';

export class UpdateQualidadeRegistroDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  titulo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  descricao?: string;

  @IsOptional()
  @IsEnum(QualidadeRegistroStatus)
  status?: QualidadeRegistroStatus;
}
