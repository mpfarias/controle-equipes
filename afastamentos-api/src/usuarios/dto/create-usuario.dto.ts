import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  IsInt,
  Min,
  IsIn,
} from 'class-validator';

export const EQUIPE_VALUES = ['A', 'B', 'C', 'D', 'E'] as const;
export type EquipeValue = (typeof EQUIPE_VALUES)[number];

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

  @IsString()
  @IsIn(EQUIPE_VALUES)
  equipe: EquipeValue;

  @IsInt()
  @Min(1)
  nivelId: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  funcaoId?: number;
}

