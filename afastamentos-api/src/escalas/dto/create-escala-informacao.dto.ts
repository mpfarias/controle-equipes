import { IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateEscalaInformacaoDto {
  @IsString()
  @MinLength(1, { message: 'Informe o título.' })
  titulo!: string;

  @IsString()
  @MinLength(1, { message: 'Informe o conteúdo.' })
  conteudo!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ordem?: number;
}
