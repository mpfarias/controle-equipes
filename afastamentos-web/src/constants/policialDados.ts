/** Unidades federativas do Brasil (sigla). */
import type { PolicialCategoriaCnh, PolicialDependenteCondicao } from '../types';

export const UFS_BRASIL: { sigla: string; nome: string }[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
];

export function labelSexoPolicial(sexo: 'MASCULINO' | 'FEMININO' | null | undefined): string {
  if (sexo === 'MASCULINO') return 'Masculino';
  if (sexo === 'FEMININO') return 'Feminino';
  return 'Campo não preenchido';
}

export const CONDICOES_DEPENDENTE: { value: PolicialDependenteCondicao; label: string }[] = [
  { value: 'CONJUGE', label: 'Cônjuge' },
  { value: 'FILHO', label: 'Filho' },
  { value: 'OUTROS', label: 'Outros' },
];

export function labelCondicaoDependente(
  condicao: PolicialDependenteCondicao | null | undefined,
  condicaoOutros?: string | null,
): string {
  if (condicao === 'CONJUGE') return 'Cônjuge';
  if (condicao === 'FILHO') return 'Filho';
  if (condicao === 'OUTROS') return condicaoOutros?.trim() ? `Outros (${condicaoOutros.trim()})` : 'Outros';
  return 'Campo não preenchido';
}

export const CATEGORIAS_CNH: PolicialCategoriaCnh[] = ['A', 'AB', 'B', 'C', 'D', 'E'];

/** Opções do radio «Dependentes»: 0–5 numéricos; 6 = «6 ou mais». */
export const OPCOES_QUANTIDADE_DEPENDENTES: { value: number; label: string }[] = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3' },
  { value: 4, label: '4' },
  { value: 5, label: '5' },
  { value: 6, label: '6 ou mais' },
];

export function labelQuantidadeDependentes(qtd: number | null | undefined): string {
  if (qtd == null) return 'Campo não preenchido';
  if (qtd === 6) return '6 ou mais';
  return String(qtd);
}

export function labelDoadorOrgaos(valor: boolean | null | undefined): string {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return 'Campo não preenchido';
}

export function labelCategoriaCnh(
  categoria: PolicialCategoriaCnh | null | undefined,
  naoHabilitado?: boolean,
): string {
  if (naoHabilitado) return 'Não habilitado';
  if (categoria) return categoria;
  return 'Campo não preenchido';
}
