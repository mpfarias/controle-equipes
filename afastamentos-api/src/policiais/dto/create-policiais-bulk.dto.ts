import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested, ValidateIf, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Equipe } from '@prisma/client';

const POLICIAL_STATUS_VALUES = [
  'ATIVO',
  'DESIGNADO',
  'COMISSIONADO',
  'PTTC',
  'DESATIVADO',
] as const;

export class PolicialBulkItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[0-9xX]+$/, {
    message: 'A matrícula deve conter apenas números ou o X.',
  })
  matricula: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsIn(POLICIAL_STATUS_VALUES)
  status: typeof POLICIAL_STATUS_VALUES[number];

  @IsOptional()
  @IsInt()
  funcaoId?: number;

  @IsOptional()
  @ValidateIf((o) => o.equipe !== null)
  @IsEnum(Equipe)
  equipe?: Equipe | null;
}

export class CreatePoliciaisBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicialBulkItemDto)
  @ArrayMaxSize(2000)
  policiais: PolicialBulkItemDto[];
}
