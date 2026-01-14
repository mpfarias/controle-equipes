import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Equipe, PolicialStatus } from '@prisma/client';

export class ColaboradorBulkItemDto {
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
  @IsEnum(Equipe)
  equipe?: Equipe;
}

export class CreateColaboradoresBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColaboradorBulkItemDto)
  colaboradores: ColaboradorBulkItemDto[];
}
