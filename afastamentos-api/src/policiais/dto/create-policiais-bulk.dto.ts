import { ArrayMaxSize, IsArray, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateNested, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { Equipe, PolicialStatus } from '@prisma/client';

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

  @IsEnum(PolicialStatus)
  status: PolicialStatus;

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
