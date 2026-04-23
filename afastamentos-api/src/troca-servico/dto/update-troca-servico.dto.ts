import { IsIn, IsOptional, Matches } from 'class-validator';

export class UpdateTrocaServicoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}/, { message: 'Use o formato AAAA-MM-DD.' })
  dataServicoA: string;

  @Matches(/^\d{4}-\d{2}-\d{2}/, { message: 'Use o formato AAAA-MM-DD.' })
  dataServicoB: string;

  /** Opcional por compatibilidade: a API recalcula automaticamente o turno correto com base na escala. */
  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoA?: 'DIURNO' | 'NOTURNO';

  /** Opcional por compatibilidade: a API recalcula automaticamente o turno correto com base na escala. */
  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoB?: 'DIURNO' | 'NOTURNO';
}
