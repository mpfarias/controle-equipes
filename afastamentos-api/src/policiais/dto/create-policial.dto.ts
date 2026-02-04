import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  IsEmail,
  IsISO8601,
} from 'class-validator';
import { Transform } from 'class-transformer';

const POLICIAL_STATUS_VALUES = [
  'ATIVO',
  'DESIGNADO',
  'COMISSIONADO',
  'PTTC',
  'DESATIVADO',
] as const;

/** CPF: apenas dígitos, 11 caracteres. Validação dos dígitos verificadores é feita no service. */
const CPF_REGEX = /^\d{11}$/;

export class CreatePolicialDto {
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

  @IsIn(POLICIAL_STATUS_VALUES)
  status: typeof POLICIAL_STATUS_VALUES[number];

  @IsOptional()
  @ValidateIf((o) => o.cpf != null && String(o.cpf).replace(/\D/g, '').length > 0)
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(CPF_REGEX, {
    message: 'CPF deve conter exatamente 11 dígitos (apenas números).',
  })
  cpf?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.dataNascimento != null && o.dataNascimento !== '')
  @IsISO8601({ strict: true }, { message: 'Data de nascimento inválida (use o formato ISO: AAAA-MM-DD).' })
  dataNascimento?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.email != null && o.email !== '')
  @IsEmail({}, { message: 'E-mail inválido.' })
  @MaxLength(255)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  matriculaComissionadoGdf?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.equipe !== null)
  @IsString()
  @MaxLength(50)
  equipe?: string | null;

  @IsOptional()
  @IsInt()
  funcaoId?: number;
}
