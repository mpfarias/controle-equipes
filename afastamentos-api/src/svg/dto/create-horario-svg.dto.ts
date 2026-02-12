import { IsString, Matches } from 'class-validator';

export class CreateHorarioSvgDto {
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaInicio deve estar no formato HH:mm (ex: 08:00)',
  })
  horaInicio: string;

  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'horaFim deve estar no formato HH:mm (ex: 16:00)',
  })
  horaFim: string;
}
