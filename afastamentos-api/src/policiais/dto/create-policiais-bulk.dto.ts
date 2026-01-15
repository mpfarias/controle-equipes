import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { Equipe, PolicialStatus } from '@prisma/client';

export class PolicialBulkItemDto {
  @IsString()
  @IsNotEmpty()
  matricula: string;

  @IsString()
  @IsNotEmpty()
  nome: string;

  @IsEnum(PolicialStatus)
  status: PolicialStatus;

  @IsOptional()
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
  policiais: PolicialBulkItemDto[];
}
