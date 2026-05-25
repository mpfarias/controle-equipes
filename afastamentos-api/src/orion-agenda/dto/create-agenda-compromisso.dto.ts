import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { OrionAgendaStatus, OrionAgendaTipo } from '@prisma/client';
import { ORION_AGENDA_STATUS, ORION_AGENDA_TIPOS } from '../orion-agenda.constants';

export class CreateAgendaCompromissoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  titulo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsDateString()
  dataInicio: string;

  @IsOptional()
  @IsDateString()
  dataFim?: string;

  @IsOptional()
  @IsBoolean()
  diaInteiro?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  local?: string;

  @IsOptional()
  @IsIn(ORION_AGENDA_TIPOS)
  tipo?: OrionAgendaTipo;

  @IsOptional()
  @IsIn(ORION_AGENDA_STATUS)
  status?: OrionAgendaStatus;

  @IsOptional()
  @IsInt()
  policialId?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  policialIds?: number[];
}
