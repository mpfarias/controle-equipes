import type {
  CreatePolicialInput,
  Policial,
  PolicialCategoriaCnh,
  PolicialDependenteCondicao,
  PolicialSexo,
  PolicialStatus,
} from '../types';

export type PolicialDependenteForm = {
  nome: string;
  condicao: PolicialDependenteCondicao | '';
  condicaoOutros: string;
};
import {
  cepToDigits,
  maskCep,
  maskTelefoneEmergencia,
  telefoneEmergenciaToDigits,
  validarEmail,
  validarTelefoneEmergencia,
} from './inputUtils';
import { toDateInputValue } from './dateUtils';

export type DoadorOrgaosForm = '' | 'SIM' | 'NAO';

export type PolicialCamposComplementaresForm = {
  email: string;
  sexo: PolicialSexo | '';
  dataAdmissao: string;
  cep: string;
  logradouro: string;
  complemento: string;
  cidade: string;
  estado: string;
  enderecoSemCep: boolean;
  contatoEmergenciaNome: string;
  contatoEmergenciaTelefone: string;
  quantidadeDependentes: number | '';
  dependentes: PolicialDependenteForm[];
  doadorOrgaos: DoadorOrgaosForm;
  categoriaCnh: PolicialCategoriaCnh | '';
  cnhNaoHabilitado: boolean;
  nivelSuperiorEm: string[];
  nivelSuperiorEmInput: string;
  cursosCivisMilitares: string[];
  cursosCivisMilitaresInput: string;
};

export type PolicialCamposComplementaresErrors = Partial<
  Record<keyof PolicialCamposComplementaresForm, string | null>
>;

export const EMPTY_DEPENDENTE: PolicialDependenteForm = {
  nome: '',
  condicao: '',
  condicaoOutros: '',
};

export const INITIAL_POLICIAL_CAMPOS_COMPLEMENTARES: PolicialCamposComplementaresForm = {
  email: '',
  sexo: '',
  dataAdmissao: '',
  cep: '',
  logradouro: '',
  complemento: '',
  cidade: '',
  estado: '',
  enderecoSemCep: false,
  contatoEmergenciaNome: '',
  contatoEmergenciaTelefone: '',
  quantidadeDependentes: '',
  dependentes: [],
  doadorOrgaos: '',
  categoriaCnh: '',
  cnhNaoHabilitado: false,
  nivelSuperiorEm: [],
  nivelSuperiorEmInput: '',
  cursosCivisMilitares: [],
  cursosCivisMilitaresInput: '',
};

function parseCondicao(value: unknown): PolicialDependenteCondicao | '' {
  if (value === 'CONJUGE' || value === 'FILHO' || value === 'OUTROS') return value;
  return '';
}

function dependentesFromPolicial(policial: Policial, quantidade: number): PolicialDependenteForm[] {
  if (quantidade <= 0) return [];
  const arr = policial.dependentes ?? [];
  return Array.from({ length: quantidade }, (_, i) => {
    const item = arr[i];
    return {
      nome: item?.nome?.trim() ?? '',
      condicao: parseCondicao(item?.condicao),
      condicaoOutros: item?.condicaoOutros?.trim() ?? '',
    };
  });
}

function parseFormacaoListaFromPolicial(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }
  return [];
}

export function policialToCamposComplementares(policial: Policial): PolicialCamposComplementaresForm {
  const qtd =
    policial.quantidadeDependentes != null && policial.quantidadeDependentes >= 0
      ? policial.quantidadeDependentes
      : '';
  const qtdNum = qtd === '' ? 0 : qtd;

  return {
    email: policial.email?.trim() ?? '',
    sexo:
      policial.sexo === 'MASCULINO' || policial.sexo === 'FEMININO' ? policial.sexo : '',
    dataAdmissao: toDateInputValue(policial.dataAdmissao),
    cep: policial.cep ? maskCep(policial.cep) : '',
    logradouro: policial.logradouro?.trim() ?? '',
    complemento: policial.complemento?.trim() ?? '',
    cidade: policial.cidade?.trim() ?? '',
    estado: policial.estado?.trim().toUpperCase() ?? '',
    enderecoSemCep: Boolean(policial.enderecoSemCep),
    contatoEmergenciaNome: policial.contatoEmergenciaNome?.trim() ?? '',
    contatoEmergenciaTelefone: policial.contatoEmergenciaTelefone
      ? maskTelefoneEmergencia(policial.contatoEmergenciaTelefone.replace(/\D/g, ''))
      : '',
    quantidadeDependentes: qtd,
    dependentes: dependentesFromPolicial(policial, qtdNum),
    doadorOrgaos:
      policial.doadorOrgaos === true ? 'SIM' : policial.doadorOrgaos === false ? 'NAO' : '',
    categoriaCnh: policial.categoriaCnh ?? '',
    cnhNaoHabilitado: Boolean(policial.cnhNaoHabilitado),
    nivelSuperiorEm: parseFormacaoListaFromPolicial(policial.nivelSuperiorEm),
    nivelSuperiorEmInput: '',
    cursosCivisMilitares: parseFormacaoListaFromPolicial(policial.cursosCivisMilitares),
    cursosCivisMilitaresInput: '',
  };
}

export function resizeDependentes(current: PolicialDependenteForm[], quantidade: number): PolicialDependenteForm[] {
  if (quantidade <= 0) return [];
  return Array.from({ length: quantidade }, (_, i) => current[i] ?? { ...EMPTY_DEPENDENTE });
}

export function validarCamposComplementares(
  values: PolicialCamposComplementaresForm,
  status: PolicialStatus,
): PolicialCamposComplementaresErrors {
  const errors: PolicialCamposComplementaresErrors = {};
  const email = values.email.trim();
  if (email && !validarEmail(email)) {
    errors.email = 'E-mail inválido.';
  }
  if (!values.sexo) {
    errors.sexo = 'Selecione o sexo.';
  }
  if (status !== 'COMISSIONADO' && !values.dataAdmissao.trim()) {
    errors.dataAdmissao = 'Informe a data de admissão.';
  }
  if (!values.enderecoSemCep) {
    const cepDigits = cepToDigits(values.cep);
    if (cepDigits.length > 0 && cepDigits.length !== 8) {
      errors.cep = 'CEP deve conter 8 dígitos.';
    }
  }
  const telEmerg = values.contatoEmergenciaTelefone.trim();
  if (telEmerg && !validarTelefoneEmergencia(telEmerg)) {
    errors.contatoEmergenciaTelefone = 'Telefone deve conter 11 dígitos no formato (xx)x xxxx-xxxx.';
  }
  return errors;
}

export function camposComplementaresParaApi(
  values: PolicialCamposComplementaresForm,
  status: PolicialStatus,
): Pick<
  CreatePolicialInput,
  | 'email'
  | 'sexo'
  | 'dataAdmissao'
  | 'cep'
  | 'logradouro'
  | 'complemento'
  | 'cidade'
  | 'estado'
  | 'enderecoSemCep'
  | 'contatoEmergenciaNome'
  | 'contatoEmergenciaTelefone'
  | 'quantidadeDependentes'
  | 'dependentes'
  | 'doadorOrgaos'
  | 'categoriaCnh'
  | 'cnhNaoHabilitado'
  | 'nivelSuperiorEm'
  | 'cursosCivisMilitares'
> {
  const email = values.email.trim();
  const cepDigits = cepToDigits(values.cep);
  const telEmergDigits = telefoneEmergenciaToDigits(values.contatoEmergenciaTelefone);
  const qtd = values.quantidadeDependentes === '' ? null : values.quantidadeDependentes;
  const qtdNum = qtd ?? 0;

  return {
    email: email || null,
    sexo: values.sexo || null,
    dataAdmissao:
      status !== 'COMISSIONADO' && values.dataAdmissao.trim() ? values.dataAdmissao.trim() : null,
    enderecoSemCep: values.enderecoSemCep,
    cep: values.enderecoSemCep ? null : cepDigits.length === 8 ? cepDigits : null,
    logradouro: values.logradouro.trim() || null,
    complemento: values.complemento.trim() || null,
    cidade: values.cidade.trim() || null,
    estado: values.estado.trim().toUpperCase() || null,
    contatoEmergenciaNome: values.contatoEmergenciaNome.trim() || null,
    contatoEmergenciaTelefone: telEmergDigits.length === 11 ? telEmergDigits : null,
    quantidadeDependentes: qtd,
    dependentes: resizeDependentes(values.dependentes, qtdNum).map((dep) => ({
      nome: dep.nome.trim() || null,
      condicao: dep.condicao || null,
      condicaoOutros:
        dep.condicao === 'OUTROS' ? dep.condicaoOutros.trim() || null : null,
    })),
    doadorOrgaos:
      values.doadorOrgaos === 'SIM' ? true : values.doadorOrgaos === 'NAO' ? false : null,
    categoriaCnh: values.cnhNaoHabilitado ? null : values.categoriaCnh || null,
    cnhNaoHabilitado: values.cnhNaoHabilitado,
    nivelSuperiorEm: values.nivelSuperiorEm.length > 0 ? values.nivelSuperiorEm : null,
    cursosCivisMilitares:
      values.cursosCivisMilitares.length > 0 ? values.cursosCivisMilitares : null,
  };
}

export function temErrosCamposComplementares(errors: PolicialCamposComplementaresErrors): boolean {
  return Object.values(errors).some((v) => v != null && v !== '');
}
