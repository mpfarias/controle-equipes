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
  ValidateIf,
} from 'class-validator';

export class CreatePolicialDto {
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
  @ValidateIf((o) => o.equipe !== null)
  @IsEnum(Equipe)
  equipe?: Equipe | null;

  @IsOptional()
  @IsInt()
  funcaoId?: number;
}
