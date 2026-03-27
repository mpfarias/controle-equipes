import { IsOptional, IsString, Matches } from 'class-validator';

/** Atualização parcial dos parâmetros da escala (ISO date YYYY-MM-DD e sequências separadas por vírgula). */
export class UpdateEscalaParametrosDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicioEquipes deve ser YYYY-MM-DD' })
  dataInicioEquipes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicioMotoristas deve ser YYYY-MM-DD' })
  dataInicioMotoristas?: string;

  @IsOptional()
  @IsString()
  sequenciaEquipes?: string;

  @IsOptional()
  @IsString()
  sequenciaMotoristas?: string;
}
