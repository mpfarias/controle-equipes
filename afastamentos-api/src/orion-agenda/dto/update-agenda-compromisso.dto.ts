import { PartialType } from '@nestjs/mapped-types';
import { CreateAgendaCompromissoDto } from './create-agenda-compromisso.dto';

export class UpdateAgendaCompromissoDto extends PartialType(CreateAgendaCompromissoDto) {}
