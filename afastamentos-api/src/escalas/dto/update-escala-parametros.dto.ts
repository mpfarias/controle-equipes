import { IsOptional, IsString, Matches } from 'class-validator';

/** Atualização parcial dos parâmetros da escala (ISO date YYYY-MM-DD e sequências separadas por vírgula). */
export class UpdateEscalaParametrosDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicioEquipes deve ser YYYY-MM-DD' })
  /** Início civil da escala 12×24 das equipes operacionais. */
  dataInicioEquipes?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataInicioMotoristas deve ser YYYY-MM-DD' })
  /** Início civil do rodízio 24×72 do motorista de dia. */
  dataInicioMotoristas?: string;

  @IsOptional()
  @IsString()
  /** Letras das equipes na escala 12×24 (ex.: D,E,B,A,C). */
  sequenciaEquipes?: string;

  @IsOptional()
  @IsString()
  /** Letras na escala 24×72 do motorista de dia (ex.: A,B,C,D). */
  sequenciaMotoristas?: string;
}
