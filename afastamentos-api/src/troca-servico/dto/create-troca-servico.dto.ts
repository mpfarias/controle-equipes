import { IsDateString, IsIn, IsInt, IsOptional, Min } from 'class-validator';
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

  /** Dia em que o policial de origem cumpre o plantão na equipe do parceiro (troca operacional; cadastro de equipe não muda). */
  @IsDateString()
  dataServicoPolicialOrigem!: string;

  /** Dia em que o outro policial cumpre serviço na equipe do policial de origem. */
  @IsDateString()
  dataServicoPolicialOutro!: string;

  /** Opcional por compatibilidade: quando ausente, a API define o turno automaticamente pela escala do dia/equipe. */
  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoPolicialOrigem?: 'DIURNO' | 'NOTURNO';

  /** Opcional por compatibilidade: quando ausente, a API define o turno automaticamente pela escala do dia/equipe. */
  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoPolicialOutro?: 'DIURNO' | 'NOTURNO';
}
