import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ErrorReportCategoria } from '@prisma/client';

export class CreateErrorReportDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  descricao: string;

  @IsEnum(ErrorReportCategoria)
  categoria: ErrorReportCategoria;

  /** Data URL base64 (imagem ou PDF); opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(12_000_000)
  anexoDataUrl?: string;

  /** Nome original do arquivo (opcional). */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  anexoNome?: string;
}
