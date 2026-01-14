import { Equipe, PolicialStatus } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateColaboradorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[0-9xX]+$/, {
    message: 'A matrícula deve conter apenas números ou o X.',
  })
  matricula: string;

  @IsEnum(PolicialStatus)
  status: PolicialStatus;

  @IsOptional()
  @IsEnum(Equipe)
  equipe?: Equipe;

  @IsOptional()
  @IsInt()
  funcaoId?: number;
}

