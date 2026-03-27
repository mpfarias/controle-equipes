import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { EscalaGeradaLinhaDto } from './escala-gerada-linha.dto';

export class CreateEscalaGeradaDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataEscala deve ser YYYY-MM-DD' })
  dataEscala!: string;

  /** Um valor ou lista separada por vírgula, ex.: `OPERACIONAL` ou `OPERACIONAL,MOTORISTAS`. */
  @IsString()
  @Matches(/^(OPERACIONAL|EXPEDIENTE|MOTORISTAS)(,(OPERACIONAL|EXPEDIENTE|MOTORISTAS))*$/, {
    message: 'tipoServico deve ser OPERACIONAL, EXPEDIENTE e/ou MOTORISTAS (separados por vírgula).',
  })
  tipoServico!: string;

  @IsOptional()
  @IsString()
  resumoEquipes?: string | null;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalaGeradaLinhaDto)
  linhas!: EscalaGeradaLinhaDto[];
}
