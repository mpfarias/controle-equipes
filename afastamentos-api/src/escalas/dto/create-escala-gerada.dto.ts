import { Type } from 'class-transformer';
import { IsArray, IsObject, IsOptional, IsString, Matches, ValidateNested } from 'class-validator';
import { EscalaGeradaLinhaDto } from './escala-gerada-linha.dto';

export class CreateEscalaGeradaDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dataEscala deve ser YYYY-MM-DD' })
  dataEscala!: string;

  /** Um valor ou lista separada por vírgula, ex.: `OPERACIONAL` ou `OPERACIONAL,MOTORISTAS`. */
  @IsString()
  @Matches(
    /^(OPERACIONAL|EXPEDIENTE|MOTORISTAS|EXTRAORDINARIA)(,(OPERACIONAL|EXPEDIENTE|MOTORISTAS|EXTRAORDINARIA))*$/,
    {
      message:
        'tipoServico deve ser OPERACIONAL, EXPEDIENTE, MOTORISTAS e/ou EXTRAORDINARIA (separados por vírgula).',
    },
  )
  tipoServico!: string;

  @IsOptional()
  @IsString()
  resumoEquipes?: string | null;

  /** Mesmo objeto enviado à janela de impressão definitiva (para reabrir idêntico em «Ver escalas geradas»). */
  @IsOptional()
  @IsObject()
  impressaoDraft?: Record<string, unknown>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EscalaGeradaLinhaDto)
  linhas!: EscalaGeradaLinhaDto[];
}
