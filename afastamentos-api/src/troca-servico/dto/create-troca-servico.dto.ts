import { IsDateString, IsIn, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTrocaServicoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  policialOrigemId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  policialOutroId!: number;

  /** Dia em que o policial de origem cumpre serviço na equipe do outro (após a troca, já escalado na equipe trocada). */
  @IsDateString()
  dataServicoPolicialOrigem!: string;

  /** Dia em que o outro policial cumpre serviço na equipe do policial de origem. */
  @IsDateString()
  dataServicoPolicialOutro!: string;

  /** Turno 12×24 em que o policial de origem cumpre o serviço trocado nessa data (revert após o fim do turno em Brasília). */
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoPolicialOrigem!: 'DIURNO' | 'NOTURNO';

  /** Turno 12×24 em que o outro policial cumpre o serviço trocado nessa data. */
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoPolicialOutro!: 'DIURNO' | 'NOTURNO';
}
