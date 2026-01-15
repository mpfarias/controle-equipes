import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateColaboradorDto } from './create-colaborador.dto';

export class UpdateColaboradorDto extends PartialType(CreateColaboradorDto) {
  @IsOptional()
  @IsString()
  fotoUrl?: string | null;
}

