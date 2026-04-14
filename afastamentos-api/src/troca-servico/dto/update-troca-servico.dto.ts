import { IsIn, IsOptional, Matches } from 'class-validator';

export class UpdateTrocaServicoDto {
  @Matches(/^\d{4}-\d{2}-\d{2}/, { message: 'Use o formato AAAA-MM-DD.' })
  dataServicoA: string;

  @Matches(/^\d{4}-\d{2}-\d{2}/, { message: 'Use o formato AAAA-MM-DD.' })
  dataServicoB: string;

  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoA?: 'DIURNO' | 'NOTURNO';

  @IsOptional()
  @IsIn(['DIURNO', 'NOTURNO'])
  turnoServicoB?: 'DIURNO' | 'NOTURNO';
}
