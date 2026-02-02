import { IsString, IsOptional, IsDateString } from 'class-validator';

export class DesativarPolicialDto {
  @IsOptional()
  @IsDateString()
  dataAPartirDe?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
