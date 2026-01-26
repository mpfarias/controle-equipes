import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const POLICIAL_STATUS_VALUES = [
  'ATIVO',
  'DESIGNADO',
  'COMISSIONADO',
  'PTTC',
  'DESATIVADO',
] as const;

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

  @IsIn(POLICIAL_STATUS_VALUES)
  status: typeof POLICIAL_STATUS_VALUES[number];

  @IsOptional()
  @ValidateIf((o) => o.equipe !== null)
  @IsString()
  @MaxLength(50)
  equipe?: string | null;

  @IsOptional()
  @IsInt()
  funcaoId?: number;
}
