import type { AfastamentoStatus, Equipe, PolicialStatus } from '../types';

export type TabKey = 'dashboard' | 'afastamentos' | 'colaboradores' | 'equipe' | 'usuarios' | 'relatorios';

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'dashboard', label: 'Afastamentos do mês' },
  { key: 'afastamentos', label: 'Gerenciar afastamentos' },
  { key: 'colaboradores', label: 'Cadastrar Policial' },
  { key: 'equipe', label: 'Mostrar Efetivo do COPOM' },
  { key: 'usuarios', label: 'Cadastrar usuários' },
  { key: 'relatorios', label: 'Relatórios' },
];

export const STATUS_LABEL: Record<AfastamentoStatus, string> = {
  ATIVO: 'Ativo',
  ENCERRADO: 'Encerrado',
};

export const POLICIAL_STATUS_OPTIONS: { value: PolicialStatus; label: string }[] = [
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'DESIGNADO', label: 'Designado' },
  { value: 'COMISSIONADO', label: 'Comissionado' },
  { value: 'PTTC', label: 'PTTC' },
];

export const EQUIPE_OPTIONS: { value: Equipe; label: string }[] = [
  { value: 'A', label: 'Equipe A' },
  { value: 'B', label: 'Equipe B' },
  { value: 'C', label: 'Equipe C' },
  { value: 'D', label: 'Equipe D' },
  { value: 'E', label: 'Equipe E' },
];

export const PERGUNTAS_SEGURANCA = [
  'Qual o nome da sua mãe?',
  'Qual o nome do seu pai?',
  'Qual o nome do seu primeiro animal de estimação?',
  'Qual o nome da cidade onde você nasceu?',
  'Qual o nome da sua escola primária?',
  'Qual o nome do seu melhor amigo de infância?',
  'Qual o nome do seu primeiro professor?',
  'Qual o apelido que você tinha na infância?',
  'Qual o nome da sua primeira rua?',
  'Qual o nome do seu primeiro emprego?',
];

export const EQUIPE_FONETICA: Record<Equipe, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  SEM_EQUIPE: 'Sem Equipe',
};
