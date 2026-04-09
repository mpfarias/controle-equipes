import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

/** Nomes como exibidos no Qualidade (ex.: após formatação título), para cruzar com `Policial.nome`. */
export class EquipesPorNomeDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(400)
  @IsString({ each: true })
  nomes?: string[];
}
