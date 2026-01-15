import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreatePolicialDto } from './create-policial.dto';

export class UpdatePolicialDto extends PartialType(CreatePolicialDto) {
  @IsOptional()
  @IsString()
  fotoUrl?: string | null;
}
