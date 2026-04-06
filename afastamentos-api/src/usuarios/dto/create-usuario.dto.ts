import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  IsArray,
  ArrayMaxSize,
  IsIn,
  ArrayMinSize,
  IsBoolean,
  ValidateIf,
} from 'class-validator';
import { SISTEMAS_EXTERNOS_IDS } from '../constants/sistemas-externos';

export class CreateUsuarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[0-9xX]+$/, {
    message: 'A matrícula deve conter apenas números ou o X.',
  })
  matricula: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, {
    message: 'A senha deve ter pelo menos 8 caracteres.',
  })
  @MaxLength(100, {
    message: 'A senha não pode ter mais de 100 caracteres.',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'A senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número.',
  })
  senha: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  perguntaSeguranca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  respostaSeguranca?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  equipe?: string;

  @IsInt()
  @Min(1)
  nivelId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  funcaoId?: number;

  @IsOptional()
  @IsString()
  fotoUrl?: string | null;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(32)
  @IsString({ each: true })
  /** Aceita PATRIMONIO_OPERACOES por compatibilidade; normalizado para PATRIMONIO + OPERACOES no serviço. */
  @IsIn([...SISTEMAS_EXTERNOS_IDS, 'PATRIMONIO_OPERACOES'], { each: true })
  sistemasPermitidos: string[];

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsBoolean()
  /**
   * Órion Suporte no cadastro: omit/null = herdar do nível; true = garantir;
   * false = bloquear mesmo que o nível conceda.
   */
  acessoOrionSuporte?: boolean | null;
}

