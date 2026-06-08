import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class PolicialDependenteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  nome?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.condicao != null && o.condicao !== '')
  @IsIn(['CONJUGE', 'FILHO', 'OUTROS'], { message: 'Condição do dependente inválida.' })
  condicao?: 'CONJUGE' | 'FILHO' | 'OUTROS' | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  condicaoOutros?: string | null;
}
