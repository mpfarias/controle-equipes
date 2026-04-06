import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CancelErrorReportDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Informe o motivo com pelo menos 3 caracteres.' })
  @MaxLength(4000)
  motivo: string;
}
