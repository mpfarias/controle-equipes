import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsIn,
  IsBoolean,
  Matches,
  MaxLength,
  Min,
  Max,
  ValidateIf,
  IsEmail,
  IsISO8601,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { PolicialDependenteDto } from './policial-dependente.dto';

const POLICIAL_STATUS_VALUES = [
  'ATIVO',
  'DESIGNADO',
  'COMISSIONADO',
  'PTTC',
  'DESATIVADO',
] as const;

/** CPF: apenas dígitos, 11 caracteres. Validação dos dígitos verificadores é feita no service. */
const CPF_REGEX = /^\d{11}$/;
const TELEFONE_REGEX = /^\d{11}$/;
const CEP_REGEX = /^\d{8}$/;
const UF_REGEX = /^[A-Z]{2}$/;

export class CreatePolicialDto {
  @IsNotEmpty({ message: 'O posto/graduação é obrigatório.' })
  @IsInt()
  postoGraduacaoId: number;

  @IsNotEmpty({ message: 'O quadro é obrigatório.' })
  @IsInt()
  quadroId: number;

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
  @ValidateIf((o) => o.telefone != null && String(o.telefone).replace(/\D/g, '').length > 0)
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(TELEFONE_REGEX, {
    message: 'Telefone deve conter exatamente 11 dígitos (apenas números).',
  })
  telefone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  matriculaComissionadoGdf?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.dataPosse != null && o.dataPosse !== '')
  @IsISO8601({ strict: true }, { message: 'Data de posse inválida (use o formato ISO: AAAA-MM-DD).' })
  dataPosse?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.equipe !== null)
  @IsString()
  @MaxLength(50)
  equipe?: string | null;

  @IsNotEmpty({ message: 'A função é obrigatória.' })
  @IsInt()
  funcaoId: number;

  /** Semana ISO par vs ímpar no expediente 12×36 (função com preset correspondente). */
  @IsOptional()
  @ValidateIf((o) => o.expediente12x36Fase != null)
  @IsIn(['PAR', 'IMPAR'])
  expediente12x36Fase?: 'PAR' | 'IMPAR' | null;

  @IsOptional()
  @ValidateIf((o) => o.sexo != null && o.sexo !== '')
  @IsIn(['MASCULINO', 'FEMININO'], { message: 'Sexo inválido.' })
  sexo?: 'MASCULINO' | 'FEMININO' | null;

  @IsOptional()
  @ValidateIf((o) => o.dataAdmissao != null && o.dataAdmissao !== '')
  @IsISO8601({ strict: true }, { message: 'Data de admissão inválida (use AAAA-MM-DD).' })
  dataAdmissao?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.cep != null && String(o.cep).replace(/\D/g, '').length > 0)
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(CEP_REGEX, { message: 'CEP deve conter exatamente 8 dígitos.' })
  cep?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  logradouro?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  complemento?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.estado != null && String(o.estado).trim() !== '')
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(UF_REGEX, { message: 'Estado (UF) inválido.' })
  estado?: string | null;

  @IsOptional()
  @IsBoolean()
  enderecoSemCep?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  contatoEmergenciaNome?: string | null;

  @IsOptional()
  @ValidateIf(
    (o) => o.contatoEmergenciaTelefone != null && String(o.contatoEmergenciaTelefone).replace(/\D/g, '').length > 0,
  )
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\D/g, '') : value))
  @IsString()
  @Matches(TELEFONE_REGEX, {
    message: 'Telefone de emergência deve conter exatamente 11 dígitos.',
  })
  contatoEmergenciaTelefone?: string | null;

  @IsOptional()
  @ValidateIf((o) => o.quantidadeDependentes != null)
  @IsInt()
  @Min(0)
  @Max(6)
  quantidadeDependentes?: number | null;

  @IsOptional()
  @IsString()
  fotoUrl?: string | null;

  @IsOptional()
  @Type(() => PolicialDependenteDto)
  dependentes?: PolicialDependenteDto[];

  @IsOptional()
  @ValidateIf((o) => o.doadorOrgaos != null)
  @IsBoolean()
  doadorOrgaos?: boolean | null;

  @IsOptional()
  @ValidateIf((o) => o.categoriaCnh != null && o.categoriaCnh !== '' && !o.cnhNaoHabilitado)
  @IsIn(['A', 'AB', 'B', 'C', 'D', 'E'], { message: 'Categoria CNH inválida.' })
  categoriaCnh?: 'A' | 'AB' | 'B' | 'C' | 'D' | 'E' | null;

  @IsOptional()
  @IsBoolean()
  cnhNaoHabilitado?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(255, { each: true })
  nivelSuperiorEm?: string[] | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  cursosCivisMilitares?: string[] | null;
}
