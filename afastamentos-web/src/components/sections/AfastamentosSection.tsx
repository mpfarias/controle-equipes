import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../api';
import type {
  Afastamento,
  Policial,
  MotivoAfastamentoOption,
  Usuario,
  TrocaServicoAtivaListaItem,
} from '../../types';
import {
  STATUS_LABEL,
  POLICIAL_STATUS_OPTIONS,
  formatEquipeLabel,
  type PreencherCadastroAfastamentoInput,
} from '../../constants';
import { calcularDiasEntreDatas, formatDate, formatPeriodo, formatNome, formatMatricula } from '../../utils/dateUtils';
import { sortPorPatenteENome, sortAfastamentosPorPatenteENome } from '../../utils/sortPoliciais';
import { createNormalizedInputHandler, handleKeyDownNormalized } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import { theme } from '../../constants/theme';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import {
  Alert,
  Autocomplete,
  TextField,
  Button,
  Checkbox,
  Box,
  Typography,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Paper,
  Chip,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import WorkIcon from '@mui/icons-material/Work';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  extrairTextoPdf,
  montarPreviewImportacaoPdf,
  normalizarTextoComparacao,
  parsearLinhasTabelaAfastamentosPdf,
  type PdfPreviewLinha,
} from '../../utils/afastamentosPdfImport';

/** `true` para voltar a exibir o botão &quot;Testar leitura do PDF&quot; na aba Cadastrar. */
const EXIBIR_BOTAO_TESTE_PDF = false;

/** Lista `anos` em ordem decrescente (ex.: 2026, 2025, …) — retorna o próximo mais antigo ou o próprio `referencia`. */
function exercicioAnteriorNaLista(anos: number[], referencia: number): number {
  const i = anos.indexOf(referencia);
  if (i === -1) return anos[0] ?? referencia;
  return i < anos.length - 1 ? anos[i + 1]! : referencia;
}

/** Se o exercício não estiver na lista (ex.: dado legado), usa `fallback` ou o mais recente da lista. */
function clampAnoListaPrevisao(ano: number, lista: number[], fallback: number): number {
  if (lista.length === 0) return ano;
  if (lista.includes(ano)) return ano;
  if (lista.includes(fallback)) return fallback;
  return lista[0]!;
}

/** Mensagens da API em `assertPolicialSemAfastamentoSobreposto` (afastamentos.service.ts). */
function isApiErroSobreposicaoPeriodoPolicial(message: string): boolean {
  return (
    message.includes('Já existe um registro de afastamento para este policial') ||
    message.includes(
      'Já existe um afastamento ativo para este policial no mesmo período e com o mesmo número de processo (SEI)',
    ) ||
    message.includes(
      'Já existe um afastamento ativo para este policial que cobre parte ou a totalidade deste período',
    )
  );
}

/** Previsão suficiente para lançar gozo: mês definido, ou exercício anterior cadastrado só com ano (sem mês na previsão). O afastamento continua exigindo data início e fim. */
function policialTemPrevisaoFeriasParaGozo(p: Policial): boolean {
  if (p.mesPrevisaoFerias != null && !p.previsaoFeriasSomenteAno) return true;
  return Boolean(p.previsaoFeriasSomenteAno && p.anoPrevisaoFerias != null);
}

/** Quem e quando o afastamento foi desativado (campos novos ou fallback legado). */
function dadosDesativacaoAfastamento(af: Afastamento): { por: string | null; em: string | null } {
  const por = af.desativadoPorNome?.trim() || af.updatedByName?.trim() || null;
  const emRaw = af.desativadoEm || af.updatedAt;
  const em = emRaw ? new Date(emRaw).toLocaleString('pt-BR') : null;
  return { por, em };
}

/** Tooltip do ícone de desativar quando o registro já está desativado (inclui auditoria). */
function tituloTooltipAfastamentoDesativado(af: Afastamento): string {
  const { por, em } = dadosDesativacaoAfastamento(af);
  if (por && em) return `Afastamento desativado por ${por} em ${em}.`;
  if (por) return `Afastamento desativado por ${por}.`;
  if (em) return `Afastamento desativado em ${em}.`;
  return 'Afastamento desativado.';
}

/** Texto do tooltip do ícone de desativar conforme a situação do registro. */
function tituloIconeDesativarAfastamento(af: Afastamento): string {
  if (af.status === 'ATIVO') return 'Desativar afastamento';
  if (af.status === 'ENCERRADO') {
    return 'Afastamento encerrado automaticamente ao fim do período cadastrado.';
  }
  if (af.status === 'DESATIVADO') {
    return tituloTooltipAfastamentoDesativado(af);
  }
  return 'Desativar afastamento';
}

const formFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.95rem',
    '& fieldset': { borderColor: 'var(--border-soft)' },
    '&:hover fieldset': { borderColor: 'var(--border-soft)' },
    '&.Mui-focused fieldset': {
      borderColor: 'var(--accent-muted)',
      boxShadow: '0 0 0 3px rgba(107, 155, 196, 0.2)',
    },
    '& input, & textarea': { padding: '10px 12px' },
  },
};

interface AfastamentosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  permissoes?: PermissoesPorTela | null;
  /** Preencher formulário ao montar (ex.: policial + motivo Férias vindo do alerta do dashboard). Consumida ao ser aplicada. */
  initialCadastro?: PreencherCadastroAfastamentoInput | null;
  onPreencherCadastroConsumed?: () => void;
}

export function AfastamentosSection({
  currentUser,
  openConfirm,
  onChanged,
  permissoes,
  initialCadastro,
  onPreencherCadastroConsumed,
}: AfastamentosSectionProps) {
  const initialForm = {
    policialId: '',
    motivoId: 0,
    seiNumero: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    /** Vazio = mesmo ano da data de início (gozo). Valor numérico como string = exercício da cota. */
    anoExercicioFerias: '' as string,
  };

  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [policiais, setPoliciais] = useState<Policial[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [motivoOutroTexto, setMotivoOutroTexto] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [motivoFiltroOutro, setMotivoFiltroOutro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');
  const [dataFimFiltroFocada, setDataFimFiltroFocada] = useState(false);
  const [conflitosModal, setConflitosModal] = useState<{
    open: boolean;
    conflitos: Afastamento[];
    dataVerificada: string;
  }>({
    open: false,
    conflitos: [],
    dataVerificada: '',
  });
  const [trocaConflitoModal, setTrocaConflitoModal] = useState<{
    open: boolean;
    policialNome: string;
    dataServico: string;
  }>({
    open: false,
    policialNome: '',
    dataServico: '',
  });
  const [trocaConflitoCiente, setTrocaConflitoCiente] = useState(false);
  // Para a confirmação final do cadastro após o usuário marcar o checkbox "Ciente".
  const [trocaConflitoDataFimParaValidacao, setTrocaConflitoDataFimParaValidacao] = useState<string | null>(null);
  /** Mesmo policial com outro afastamento ativo no período (bloqueia cadastro/edição). */
  const [periodoMismoPolicialModal, setPeriodoMismoPolicialModal] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: '' });
  const [calcularPeriodo, setCalcularPeriodo] = useState<boolean>(false);
  const [quantidadeDias, setQuantidadeDias] = useState<string>('');
  const [tabAtiva, setTabAtiva] = useState<number>(0);
  /** Sub-abas da lista na tela "Cadastrar afastamento". */
  const [abaListaAfastamentos, setAbaListaAfastamentos] = useState<'ativos' | 'encerrados'>('ativos');
  const [dataFimFocada, setDataFimFocada] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(20);

  const pdfImportInputRef = useRef<HTMLInputElement | null>(null);
  const [pdfImportModalOpen, setPdfImportModalOpen] = useState(false);
  const [pdfImportLoading, setPdfImportLoading] = useState(false);
  const [pdfImportErro, setPdfImportErro] = useState<string | null>(null);
  /** Resultado completo do teste de leitura (todas as linhas interpretadas). */
  const [pdfPreviewCompleto, setPdfPreviewCompleto] = useState<PdfPreviewLinha[]>([]);
  const [pdfLinhasBrutasTotal, setPdfLinhasBrutasTotal] = useState(0);
  const [pdfTextoAmostra, setPdfTextoAmostra] = useState<string | null>(null);
  const [pdfNomeArquivo, setPdfNomeArquivo] = useState<string | null>(null);
  const [pdfLeituraFiltro, setPdfLeituraFiltro] = useState<'atestado' | 'todas'>('atestado');

  /** Cadastro de gozo (afastamento “Férias”): até 6 anos, nunca antes de 2021. */
  const ANO_EXERCICIO_FERIAS_MINIMO = 2021;
  /**
   * Previsão de férias: inclui exercícios antigos para quem ainda tem direito vencido e não usufruído.
   * (O cadastro de gozo acima mantém a janela curta; aqui a lista é só para planejamento/registro de previsão.)
   */
  const ANO_PREVISAO_FERIAS_MINIMO = 1985;
  /** Quantos anos para trás a partir do ano civil atual entram na lista (além do piso). */
  const ANOS_RETROATIVOS_PREVISAO_FERIAS = 50;
  const anoCivilAtual = new Date().getFullYear();
  const anosExercicioFeriasOpcoes = useMemo(() => {
    const fim = anoCivilAtual;
    const inicio = Math.max(ANO_EXERCICIO_FERIAS_MINIMO, fim - 5);
    const anos: number[] = [];
    for (let y = fim; y >= inicio; y -= 1) {
      anos.push(y);
    }
    return anos;
  }, [anoCivilAtual]);

  const anosPrevisaoFeriasOpcoes = useMemo(() => {
    const fim = anoCivilAtual;
    const inicio = Math.max(ANO_PREVISAO_FERIAS_MINIMO, fim - ANOS_RETROATIVOS_PREVISAO_FERIAS);
    const anos: number[] = [];
    for (let y = fim; y >= inicio; y -= 1) {
      anos.push(y);
    }
    return anos;
  }, [anoCivilAtual]);

  // Preencher formulário de cadastro quando vier initialCadastro (ex.: "Marcar férias agora" no modal do dashboard)
  useEffect(() => {
    if (!initialCadastro || motivos.length === 0) return;
    const motivoFerias = motivos.find((m) => m.nome?.toLowerCase() === 'férias');
    if (!motivoFerias) return;
    setTabAtiva(0);
    const inicioLista = Math.max(ANO_EXERCICIO_FERIAS_MINIMO, anoCivilAtual - 5);
    const anoExInformado = initialCadastro.anoExercicioFerias;
    const anoExValidoNaLista =
      anoExInformado != null &&
      anoExInformado >= inicioLista &&
      anoExInformado <= anoCivilAtual;
    setForm((prev) => ({
      ...prev,
      policialId: String(initialCadastro.policialId),
      motivoId: motivoFerias.id,
      anoExercicioFerias: anoExValidoNaLista ? String(anoExInformado) : '',
    }));
    onPreencherCadastroConsumed?.();
  }, [initialCadastro, motivos, onPreencherCadastroConsumed, anoCivilAtual]);

  // Estados para paginação na aba "Previsão de férias"
  const [paginaAtualPrevisao, setPaginaAtualPrevisao] = useState(1);
  const [itensPorPaginaPrevisao, setItensPorPaginaPrevisao] = useState(20);
  const [totalPoliciaisPrevisao, setTotalPoliciaisPrevisao] = useState(0);
  const [totalPaginasPrevisao, setTotalPaginasPrevisao] = useState(1);
  const [policiaisPrevisao, setPoliciaisPrevisao] = useState<Policial[]>([]);
  const [loadingPrevisao, setLoadingPrevisao] = useState(false);
  const [searchTermPrevisao, setSearchTermPrevisao] = useState('');
  const [mesFiltroPrevisao, setMesFiltroPrevisao] = useState<number | ''>('');
  /** Exercício da previsão na aba (lista, filtro por mês, 1/12 e gravação quando ainda não há registro). */
  const [anoFiltroPrevisao, setAnoFiltroPrevisao] = useState<number>(() => new Date().getFullYear());
  const [modalPolicialOpen, setModalPolicialOpen] = useState(false);
  const [policialSelecionado, setPolicialSelecionado] = useState<Policial | null>(null);
  const policialInfoModalIdRef = useRef<number | null>(null);
  const [policialModalDetalheLoading, setPolicialModalDetalheLoading] = useState(false);
  const [modalMesPrevisaoOpen, setModalMesPrevisaoOpen] = useState(false);
  const [policialParaMesPrevisao, setPolicialParaMesPrevisao] = useState<Policial | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  /** Exercício editado no modal de previsão (independe do filtro da aba quando o usuário escolhe outro ano). */
  const [anoModalPrevisao, setAnoModalPrevisao] = useState<number>(() => new Date().getFullYear());
  const [salvandoMesPrevisao, setSalvandoMesPrevisao] = useState(false);
  const [documentoSei, setDocumentoSei] = useState<string>('');

  /** Exercício do registro de férias refletido na linha (feriasAno / filtro da aba). */
  const exercicioListaNaPrevisaoModal = useMemo(() => {
    if (!policialParaMesPrevisao) return anoFiltroPrevisao;
    return policialParaMesPrevisao.anoPrevisaoFerias ?? anoFiltroPrevisao;
  }, [policialParaMesPrevisao, anoFiltroPrevisao]);

  /**
   * Reprogramar só se estiver editando o mesmo exercício que já está confirmado na lista.
   * Abrir “outro período” (outro ano) não pode cair em tela de reprogramação só porque o ano atual está confirmado.
   */
  const emModoReprogramacaoPrevisaoModal = useMemo(
    () =>
      !!policialParaMesPrevisao?.feriasConfirmadas &&
      anoModalPrevisao === exercicioListaNaPrevisaoModal,
    [
      policialParaMesPrevisao?.feriasConfirmadas,
      policialParaMesPrevisao,
      anoModalPrevisao,
      exercicioListaNaPrevisaoModal,
    ],
  );

  // Excesso 1/12: efetivo total, limite por mês, totais por mês e meses em excesso
  const [excessoDados, setExcessoDados] = useState<{
    efetivoTotal: number;
    limitePorMes: number;
    porMes: { mes: number; nome: string; total: number }[];
    mesesEmExcesso: { mes: number; nome: string; total: number }[];
  } | null>(null);
  const [loadingExcesso, setLoadingExcesso] = useState(false);
  const [modalExcessoMesOpen, setModalExcessoMesOpen] = useState(false);
  const [excessoMesSelecionado, setExcessoMesSelecionado] = useState<{ mes: number; nome: string } | null>(null);
  const [policiaisExcessoMes, setPoliciaisExcessoMes] = useState<Policial[]>([]);
  const [loadingPoliciaisExcesso, setLoadingPoliciaisExcesso] = useState(false);
  /**
   * Menor e maior `ano` em FeriasPolicial (global). Só o máximo como piso do select impedia escolher
   * exercícios antigos e o clamp jogava o filtro de volta ao ano mais alto após salvar (ex.: 2024 → 2027).
   */
  const [extremosAnosPrevisaoFerias, setExtremosAnosPrevisaoFerias] = useState<{
    min: number | null;
    max: number | null;
  }>({ min: null, max: null });
  /** Uma vez: ao abrir a aba pela primeira vez, sugere o exercício mais recente com previsão. */
  const previsaoAnoInicialJaSugeridoRef = useRef(false);

  const anosSelectFiltroPrevisao = useMemo(() => {
    const civil = anoCivilAtual;
    const minDb = extremosAnosPrevisaoFerias.min;
    const maxDb = extremosAnosPrevisaoFerias.max;
    const minY = minDb != null ? Math.min(minDb, civil) : civil;
    const maxY = Math.max(civil + 1, maxDb ?? civil);
    const lo = Math.min(minY, maxY);
    const hi = Math.max(minY, maxY);
    const anos: number[] = [];
    for (let y = hi; y >= lo; y -= 1) {
      anos.push(y);
    }
    return anos;
  }, [anoCivilAtual, extremosAnosPrevisaoFerias.min, extremosAnosPrevisaoFerias.max]);

  const [editAfastamentoModal, setEditAfastamentoModal] = useState<{
    open: boolean;
    afastamento: Afastamento | null;
    motivoId: number;
    seiNumero: string;
    descricao: string;
    dataInicio: string;
    dataFim: string;
    anoExercicioFerias: string;
    calcularPeriodo: boolean;
    quantidadeDias: string;
    error: string | null;
    loading: boolean;
  }>({
    open: false,
    afastamento: null,
    motivoId: 0,
    seiNumero: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
    anoExercicioFerias: '',
    calcularPeriodo: false,
    quantidadeDias: '',
    error: null,
    loading: false,
  });

  const [detalhesAfastamentoModal, setDetalhesAfastamentoModal] = useState<{
    open: boolean;
    afastamento: Afastamento | null;
  }>({
    open: false,
    afastamento: null,
  });

  useEffect(() => {
    if (!anosSelectFiltroPrevisao.length) return;
    if (!anosSelectFiltroPrevisao.includes(anoFiltroPrevisao)) {
      setAnoFiltroPrevisao(anosSelectFiltroPrevisao[0] ?? anoCivilAtual);
    }
  }, [anosSelectFiltroPrevisao, anoFiltroPrevisao, anoCivilAtual]);

  const handleOpenDetalhesAfastamento = (afastamento: Afastamento) => {
    setDetalhesAfastamentoModal({ open: true, afastamento });
  };

  const handleCloseDetalhesAfastamento = () => {
    setDetalhesAfastamentoModal({ open: false, afastamento: null });
  };

  // Calcular dias automaticamente quando as datas são selecionadas
  const diasCalculados = useMemo(() => {
    if (!calcularPeriodo && form.dataInicio && form.dataFim) {
      return calcularDiasEntreDatas(form.dataInicio, form.dataFim);
    }
    return null;
  }, [calcularPeriodo, form.dataInicio, form.dataFim]);

  // Calcular data de término quando "Calcular período" estiver marcado
  const dataTerminoCalculada = useMemo(() => {
    if (calcularPeriodo && form.dataInicio && quantidadeDias) {
      const dias = parseInt(quantidadeDias, 10);
      if (!isNaN(dias) && dias > 0) {
        // Criar data a partir da string YYYY-MM-DD
        const [year, month, day] = form.dataInicio.split('-').map(Number);
        const dataInicio = new Date(year, month - 1, day);
        // Adicionar dias (subtrair 1 porque o primeiro dia já conta)
        dataInicio.setDate(dataInicio.getDate() + dias - 1);
        // Formatar como DD/MM/YYYY
        const dayFormatted = String(dataInicio.getDate()).padStart(2, '0');
        const monthFormatted = String(dataInicio.getMonth() + 1).padStart(2, '0');
        const yearFormatted = dataInicio.getFullYear();
        return `${dayFormatted}/${monthFormatted}/${yearFormatted}`;
      }
    }
    return null;
  }, [calcularPeriodo, form.dataInicio, quantidadeDias]);

  // Ordenar motivos alfabeticamente, com "Outro" sempre no final
  const motivosOrdenados = useMemo(() => {
    const outros = motivos.filter((m) => 
      m.nome.toLowerCase() === 'outro' || m.nome.toLowerCase() === 'outros'
    );
    const outrosDemais = motivos.filter((m) => 
      m.nome.toLowerCase() !== 'outro' && m.nome.toLowerCase() !== 'outros'
    );
    
    return [
      ...outrosDemais.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' })),
      ...outros,
    ];
  }, [motivos]);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const nivelUsuario = currentUser.nivel?.nome;
      const equipeAtual = currentUser.equipe;
      const params: Parameters<typeof api.listAfastamentos>[0] = {};
      if (nivelUsuario === 'OPERAÇÕES' && equipeAtual) {
        params.equipe = equipeAtual;
      }

      const [afastamentosData, policiaisData, motivosData] = await Promise.all([
        api.listAfastamentos(params),
        api.listPoliciais({ includeAfastamentos: false, includeRestricoes: false }),
        api.listMotivos(),
      ]);
      
      setMotivos(motivosData);
      
      // equipeAtual e nivelUsuario já definidos acima
      
      // Filtrar policiais para exibição na lista: 
      // - Nível OPERAÇÕES: apenas da equipe do usuário
      // - Outros níveis: todos os policiais
      const policiaisFiltrados = (nivelUsuario === 'OPERAÇÕES' && equipeAtual)
        ? policiaisData.filter((policial) => 
            policial.equipe && policial.equipe === equipeAtual
          )
        : policiaisData;
      
      // Filtrar afastamentos para exibição na tabela:
      // - Nível OPERAÇÕES: apenas da equipe do usuário
      // - Outros níveis: todos os afastamentos
      const afastamentosFiltrados = (nivelUsuario === 'OPERAÇÕES' && equipeAtual)
        ? afastamentosData.filter((afastamento) => {
            const policialEquipe = afastamento.policial?.equipe;
            // Incluir apenas se o policial tiver equipe e corresponder à equipe do usuário
            return policialEquipe && policialEquipe === equipeAtual;
          })
        : afastamentosData;
      
      setAfastamentos(afastamentosFiltrados);
      setPoliciais(policiaisFiltrados);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser.equipe, currentUser.nivel?.nome]);

  /**
   * Após salvar previsão/confirmação de férias na aba Previsão, atualiza o mesmo policial na lista do cadastro
   * de afastamento — sem isso, o Autocomplete ainda enxerga `mesPrevisaoFerias` antigo até F5.
   */
  const aplicarPolicialAtualizadoNoEstadoCadastro = useCallback(
    (atualizado: Policial) => {
      let merged = false;
      setPoliciais((prev) => {
        const idx = prev.findIndex((p) => p.id === atualizado.id);
        if (idx === -1) return prev;
        merged = true;
        const copy = [...prev];
        copy[idx] = atualizado;
        return copy;
      });
      if (!merged) {
        void carregarDados();
      }
      setPolicialSelecionado((prev) => (prev?.id === atualizado.id ? atualizado : prev));
    },
    [carregarDados],
  );

  useEffect(() => {
    if (!modalPolicialOpen) {
      policialInfoModalIdRef.current = null;
      setPolicialModalDetalheLoading(false);
      return;
    }
    const id = policialInfoModalIdRef.current;
    if (id == null) return;
    let cancelled = false;
    setPolicialModalDetalheLoading(true);
    void (async () => {
      try {
        const full = await api.getPolicial(id);
        if (!cancelled) {
          setPolicialSelecionado(full);
          aplicarPolicialAtualizadoNoEstadoCadastro(full);
        }
      } catch {
        if (!cancelled) {
          setError('Não foi possível carregar os dados completos do policial.');
        }
      } finally {
        if (!cancelled) setPolicialModalDetalheLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modalPolicialOpen, aplicarPolicialAtualizadoNoEstadoCadastro]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Carregar policiais para a aba "Previsão de férias"
  const carregarPoliciaisPrevisao = useCallback(
    async (
      page: number,
      pageSize: number,
      opts?: { feriasAnoOverride?: number },
    ) => {
    try {
      setLoadingPrevisao(true);
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;

      const anoListagem = opts?.feriasAnoOverride ?? anoFiltroPrevisao;
      
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page,
        pageSize,
        includeAfastamentos: false,
        includeRestricoes: false,
        feriasAno: anoListagem,
      };
      const busca = searchTermPrevisao.trim();
      if (busca) {
        params.search = busca;
      }
      if (mesFiltroPrevisao !== '' && mesFiltroPrevisao >= 1 && mesFiltroPrevisao <= 12) {
        params.mesPrevisaoFerias = mesFiltroPrevisao;
        params.anoPrevisaoFerias = anoListagem;
      }
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      }
      
      const data = await api.listPoliciaisPaginated(params);
      setPoliciaisPrevisao(data.Policiales);
      const totalPages = Math.max(1, data.totalPages);
      setTotalPoliciaisPrevisao(data.total);
      setTotalPaginasPrevisao(totalPages);
      if (page > totalPages) {
        setPaginaAtualPrevisao(totalPages);
      }
    } catch (err) {
      console.error('Erro ao carregar policiais para previsão:', err);
    } finally {
      setLoadingPrevisao(false);
    }
  },
  [currentUser, searchTermPrevisao, mesFiltroPrevisao, anoFiltroPrevisao],
  );

  useEffect(() => {
    if (tabAtiva === 1) {
      void carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao);
    }
  }, [tabAtiva, paginaAtualPrevisao, itensPorPaginaPrevisao, carregarPoliciaisPrevisao]);

  // Carregar dados para "Excesso de policiais" (1/12 do efetivo) quando estiver na aba Previsão de férias
  useEffect(() => {
    if (tabAtiva !== 1) return;
    const nivelNome = currentUser.nivel?.nome;
    const usuarioPodeVerTodos =
      nivelNome === 'ADMINISTRADOR' ||
      nivelNome === 'SAD' ||
      nivelNome === 'COMANDO' ||
      currentUser.isAdmin === true;
    const equipeParam = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
    const anoRef = anoFiltroPrevisao;
    const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const carregarExcesso = async () => {
      setLoadingExcesso(true);
      try {
        /** Efetivo para 1/12: exclui DESATIVADO e COMISSIONADO (comissionados não entram no limite). */
        const baseParams: Parameters<typeof api.listPoliciaisPaginated>[0] = {
          page: 1,
          pageSize: 1,
          includeAfastamentos: false,
          includeRestricoes: false,
          feriasAno: anoRef,
          excluirComissionadosParaLimiteFerias: true,
        };
        if (equipeParam) baseParams.equipe = equipeParam;
        const resEfetivo = await api.listPoliciaisPaginated(baseParams);
        const efetivoTotal = resEfetivo.totalDisponiveis ?? resEfetivo.total ?? 0;
        const limitePorMes = Math.floor(efetivoTotal / 12);

        const porMes: { mes: number; nome: string; total: number }[] = [];
        await Promise.all(
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(async (mes) => {
            const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
              page: 1,
              pageSize: 1,
              includeAfastamentos: false,
              includeRestricoes: false,
              feriasAno: anoRef,
              mesPrevisaoFerias: mes,
              anoPrevisaoFerias: anoRef,
              excluirComissionadosParaLimiteFerias: true,
            };
            if (equipeParam) params.equipe = equipeParam;
            const res = await api.listPoliciaisPaginated(params);
            porMes.push({ mes, nome: nomesMeses[mes - 1], total: res.total });
          })
        );
        porMes.sort((a, b) => a.mes - b.mes);
        const mesesEmExcesso = porMes.filter((m) => m.total > limitePorMes);
        setExcessoDados({ efetivoTotal, limitePorMes, porMes, mesesEmExcesso });
      } catch (err) {
        console.error('Erro ao carregar dados de excesso 1/12:', err);
        setExcessoDados(null);
      } finally {
        setLoadingExcesso(false);
      }
    };
    void carregarExcesso();
  }, [tabAtiva, currentUser, anoFiltroPrevisao]);

  const abrirModalExcessoMes = useCallback(
    async (mes: number, nome: string) => {
      setExcessoMesSelecionado({ mes, nome });
      setModalExcessoMesOpen(true);
      setPoliciaisExcessoMes([]);
      setLoadingPoliciaisExcesso(true);
      try {
        const nivelNome = currentUser.nivel?.nome;
        const usuarioPodeVerTodos =
          nivelNome === 'ADMINISTRADOR' ||
          nivelNome === 'SAD' ||
          nivelNome === 'COMANDO' ||
          currentUser.isAdmin === true;
        const equipeParam = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
        const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
          page: 1,
          pageSize: 500,
          includeAfastamentos: false,
          includeRestricoes: false,
          feriasAno: anoFiltroPrevisao,
          mesPrevisaoFerias: mes,
          anoPrevisaoFerias: anoFiltroPrevisao,
          excluirComissionadosParaLimiteFerias: true,
        };
        if (equipeParam) params.equipe = equipeParam;
        const res = await api.listPoliciaisPaginated(params);
        setPoliciaisExcessoMes(res.Policiales ?? []);
      } catch (err) {
        console.error('Erro ao carregar policiais do mês:', err);
      } finally {
        setLoadingPoliciaisExcesso(false);
      }
    },
    [currentUser, anoFiltroPrevisao]
  );

  const mesesPrevisao = [
    { valor: '' as const, nome: 'Todos os meses' },
    { valor: 1, nome: 'Janeiro' },
    { valor: 2, nome: 'Fevereiro' },
    { valor: 3, nome: 'Março' },
    { valor: 4, nome: 'Abril' },
    { valor: 5, nome: 'Maio' },
    { valor: 6, nome: 'Junho' },
    { valor: 7, nome: 'Julho' },
    { valor: 8, nome: 'Agosto' },
    { valor: 9, nome: 'Setembro' },
    { valor: 10, nome: 'Outubro' },
    { valor: 11, nome: 'Novembro' },
    { valor: 12, nome: 'Dezembro' },
  ];

  useEffect(() => {
    if (tabAtiva !== 1) return;
    void (async () => {
      try {
        const { ano, anoMinimo } = await api.getUltimoAnoPrevisaoFerias();
        setExtremosAnosPrevisaoFerias({ min: anoMinimo, max: ano });
        if (!previsaoAnoInicialJaSugeridoRef.current && ano != null) {
          previsaoAnoInicialJaSugeridoRef.current = true;
          setAnoFiltroPrevisao(ano);
        }
      } catch {
        /* mantém extremos anteriores / ano já escolhido */
      }
    })();
  }, [tabAtiva]);

  const abrirModalPrevisaoOutroPeriodo = useCallback(
    async (policial: Policial) => {
      setPolicialParaMesPrevisao(policial);
      setMesSelecionado('');
      setDocumentoSei('');
      let refAno = anoFiltroPrevisao;
      try {
        const { ano } = await api.getUltimoAnoPrevisaoFerias({ policialId: policial.id });
        if (ano != null) refAno = ano;
      } catch {
        /* usa filtro da aba */
      }
      setAnoModalPrevisao(
        exercicioAnteriorNaLista(
          anosPrevisaoFeriasOpcoes,
          clampAnoListaPrevisao(refAno, anosPrevisaoFeriasOpcoes, anoFiltroPrevisao),
        ),
      );
      setModalMesPrevisaoOpen(true);
    },
    [anoFiltroPrevisao, anosPrevisaoFeriasOpcoes],
  );

  useEffect(() => {
    if (tabAtiva === 1) {
      setPaginaAtualPrevisao(1);
    } else {
      setSearchTermPrevisao('');
    }
  }, [searchTermPrevisao, tabAtiva]);

  // Função calcularDiasEntreDatas importada de utils/dateUtils

  // Função para calcular dias usados no ano para um motivo específico
  const calcularDiasUsadosNoAno = useCallback((
    policialId: number,
    motivoId: number,
    anoReferencia: number,
    opts?: { porExercicioFerias?: boolean },
  ): number => {
    const porExercicio = opts?.porExercicioFerias ?? false;
    const afastamentosDoAno = afastamentos.filter((afastamento) => {
      if (afastamento.status === 'DESATIVADO') {
        return false;
      }
      if (afastamento.policialId !== policialId || afastamento.motivoId !== motivoId) {
        return false;
      }
      if (porExercicio) {
        const y =
          afastamento.anoExercicioFerias ?? new Date(afastamento.dataInicio).getFullYear();
        return y === anoReferencia;
      }
      const dataInicio = new Date(afastamento.dataInicio);
      return dataInicio.getFullYear() === anoReferencia;
    });

    let totalDias = 0;
    for (const afastamento of afastamentosDoAno) {
      const dias = calcularDiasEntreDatas(
        afastamento.dataInicio,
        afastamento.dataFim || undefined,
      );
      totalDias += dias;
    }

    return totalDias;
  }, [afastamentos]);


  // Função para verificar se dois períodos se sobrepõem
  const periodosSobrepostos = useCallback((
    inicio1: string,
    fim1: string | null | undefined,
    inicio2: string,
    fim2: string | null | undefined,
  ): boolean => {
    if (!fim1 || !fim2) {
      // Se algum período não tem fim, tratar separadamente
      if (fim1 && !fim2) {
        // Período 1 tem fim, período 2 não tem fim
        const dataInicio2 = new Date(inicio2);
        const dataFim1 = new Date(fim1);
        dataInicio2.setHours(0, 0, 0, 0);
        dataFim1.setHours(0, 0, 0, 0);
        return dataInicio2.getTime() <= dataFim1.getTime();
      } else if (!fim1 && fim2) {
        // Período 1 não tem fim, período 2 tem fim
        const dataInicio1 = new Date(inicio1);
        const dataFim2 = new Date(fim2);
        dataInicio1.setHours(0, 0, 0, 0);
        dataFim2.setHours(0, 0, 0, 0);
        return dataInicio1.getTime() <= dataFim2.getTime();
      } else {
        // Ambos não têm fim - sempre há sobreposição
        return true;
      }
    }

    // Ambos têm data fim - normalizar para comparar apenas a data (sem hora)
    const dataInicio1 = new Date(inicio1);
    const dataFim1 = new Date(fim1);
    const dataInicio2 = new Date(inicio2);
    const dataFim2 = new Date(fim2);

    // Normalizar para meia-noite (00:00:00) para evitar problemas de timezone
    dataInicio1.setHours(0, 0, 0, 0);
    dataFim1.setHours(0, 0, 0, 0);
    dataInicio2.setHours(0, 0, 0, 0);
    dataFim2.setHours(0, 0, 0, 0);

    // Extrair apenas a parte da data (YYYY-MM-DD) para comparação mais segura
    const getDateOnly = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const inicio1Str = getDateOnly(dataInicio1);
    const fim1Str = getDateOnly(dataFim1);
    const inicio2Str = getDateOnly(dataInicio2);
    const fim2Str = getDateOnly(dataFim2);

    // Primeiro, verificar se claramente não se sobrepõem (um termina antes do outro começar)
    // Comparação de strings YYYY-MM-DD funciona perfeitamente
    if (fim1Str < inicio2Str || fim2Str < inicio1Str) {
      return false; // Períodos não se sobrepõem - um termina antes do outro começar
    }

    // Verificar se são adjacentes (um termina em X, outro começa em X+1)
    // Períodos adjacentes NÃO se sobrepõem
    // Se período 1 termina em 22/01 e período 2 começa em 23/01, são adjacentes
    const dataFim1Obj = new Date(fim1Str);
    dataFim1Obj.setDate(dataFim1Obj.getDate() + 1); // Adicionar 1 dia
    const fim1MaisUmDia = getDateOnly(dataFim1Obj);
    
    const dataFim2Obj = new Date(fim2Str);
    dataFim2Obj.setDate(dataFim2Obj.getDate() + 1); // Adicionar 1 dia
    const fim2MaisUmDia = getDateOnly(dataFim2Obj);

    if (inicio2Str === fim1MaisUmDia || inicio1Str === fim2MaisUmDia) {
      return false; // Períodos adjacentes não se sobrepõem
    }
    
    // Se chegou aqui, há sobreposição
    // Verificar sobreposição: dois intervalos [a, b] e [c, d] se sobrepõem se: a <= d && c <= b
    // Usando comparação de strings de data (YYYY-MM-DD) que é mais confiável
    const condicao1 = inicio1Str <= fim2Str;
    const condicao2 = inicio2Str <= fim1Str;
    
    return condicao1 && condicao2;
  }, []);

  // Função para verificar conflitos em todo o intervalo de dias (excluindo o próprio policial)
  const verificarConflitos = useCallback((dataInicio: string, dataFim?: string | null, policialIdExcluir?: number): Afastamento[] => {
    if (!dataInicio) {
      return [];
    }

    // Verificar todos os afastamentos ativos que se sobrepõem com o período informado
    // Excluindo o próprio policial que está sendo cadastrado
    const conflitos = afastamentos.filter((afastamento) => {
      if (afastamento.status !== 'ATIVO') {
        return false;
      }
      // Excluir o próprio policial
      if (policialIdExcluir && afastamento.policialId === policialIdExcluir) {
        return false;
      }

      // Verificar se o período do afastamento existente se sobrepõe com o período informado
      return periodosSobrepostos(
        dataInicio,
        dataFim || null,
        afastamento.dataInicio,
        afastamento.dataFim || null,
      );
    });

    return conflitos;
  }, [afastamentos, periodosSobrepostos]);

  const verificarConflitoTrocaServico = useCallback(
    async (policialId: number, dataInicio: string, dataFim?: string | null): Promise<{
      policialNome: string;
      dataServico: string;
    } | null> => {
      const fim = dataFim || dataInicio;
      if (!dataInicio || !fim) return null;

      // O endpoint retorna apenas trocas ativas (mas inclui os campos dataServicoA/B e restauradoA/B).
      const trocas: TrocaServicoAtivaListaItem[] = await api.listTrocasServicoAtivas();

      const matches: { policialNome: string; dataServico: string }[] = [];
      for (const t of trocas) {
        if (t.status === 'CONCLUIDA') continue;
        if (
          t.policialA.id === policialId &&
          !t.restauradoA &&
          t.dataServicoA >= dataInicio &&
          t.dataServicoA <= fim
        ) {
          matches.push({ policialNome: t.policialA.nome, dataServico: t.dataServicoA });
        }
        if (
          t.policialB.id === policialId &&
          !t.restauradoB &&
          t.dataServicoB >= dataInicio &&
          t.dataServicoB <= fim
        ) {
          matches.push({ policialNome: t.policialB.nome, dataServico: t.dataServicoB });
        }
      }

      if (matches.length === 0) return null;
      // Selecionar a primeira data (ordem cronológica) para exibir no alerta.
      matches.sort((a, b) => a.dataServico.localeCompare(b.dataServico));
      return matches[0] ?? null;
    },
    [],
  );

  const submeterAfastamento = useCallback(async () => {
    try {
      setSubmitting(true);
      
      // Se calcularPeriodo estiver marcado, calcular dataFim baseada na quantidade de dias
      let dataFimFinal = form.dataFim;
      if (calcularPeriodo && form.dataInicio && quantidadeDias) {
        const dias = parseInt(quantidadeDias, 10);
        if (!isNaN(dias) && dias > 0) {
          // Criar data a partir da string YYYY-MM-DD (mesma lógica do useMemo)
          const [year, month, day] = form.dataInicio.split('-').map(Number);
          const dataInicio = new Date(year, month - 1, day);
          // Adicionar dias (subtrair 1 porque o primeiro dia já conta)
          dataInicio.setDate(dataInicio.getDate() + dias - 1);
          // Formatar como YYYY-MM-DD
          const yearFormatted = dataInicio.getFullYear();
          const monthFormatted = String(dataInicio.getMonth() + 1).padStart(2, '0');
          const dayFormatted = String(dataInicio.getDate()).padStart(2, '0');
          dataFimFinal = `${yearFormatted}-${monthFormatted}-${dayFormatted}`;
        }
      }
      
      const motivoSelecionado = motivos.find((m) => m.id === form.motivoId);
      const motivoNome = motivoSelecionado?.nome?.toLowerCase() ?? '';
      const motivoEhOutro = motivoNome === 'outro' || motivoNome === 'outros';
      const outroTexto = motivoEhOutro ? motivoOutroTexto.trim() : '';
      const descricaoBase = form.descricao.trim();
      const descricaoFinal = outroTexto
        ? descricaoBase
          ? `${outroTexto} - ${descricaoBase}`
          : outroTexto
        : descricaoBase;

      const motivoRow = motivos.find((m) => m.id === form.motivoId);
      const cadastroEhFerias = motivoRow?.nome === 'Férias';
      const anoExNum =
        cadastroEhFerias && form.anoExercicioFerias !== ''
          ? parseInt(form.anoExercicioFerias, 10)
          : undefined;
      const anoExValido = anoExNum !== undefined && !Number.isNaN(anoExNum);

      await api.createAfastamento({
        policialId: Number(form.policialId),
        motivoId: form.motivoId,
        seiNumero: form.seiNumero.trim(),
        descricao: descricaoFinal || undefined,
        dataInicio: form.dataInicio,
        dataFim: dataFimFinal || undefined,
        ...(cadastroEhFerias && anoExValido ? { anoExercicioFerias: anoExNum } : {}),
      });
      setSuccess('Afastamento cadastrado com sucesso.');
      setForm(initialForm);
      setCalcularPeriodo(false);
      setQuantidadeDias('');
      setMotivoOutroTexto('');
      
      await carregarDados();
      onChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isApiErroSobreposicaoPeriodoPolicial(msg)) {
        setPeriodoMismoPolicialModal({ open: true, message: msg });
      } else {
        setError(msg || 'Não foi possível criar o afastamento.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [form, calcularPeriodo, quantidadeDias, motivos, motivoOutroTexto, carregarDados, onChanged]);

  const abrirConfirmacaoCadastro = useCallback(
    (dataFimParaValidacao: string | null) => {
      const policialId = Number(form.policialId);
      const policial = policiais.find((p) => p.id === policialId);
      const motivoSelecionado = motivos.find((m) => m.id === form.motivoId);
      const motivoNomeBase = motivoSelecionado?.nome ?? '';
      const motivoNomeLower = motivoNomeBase.toLowerCase();
      const motivoEhOutro = motivoNomeLower === 'outro' || motivoNomeLower === 'outros';
      const motivoNome = motivoEhOutro && motivoOutroTexto.trim()
        ? `${motivoNomeBase} - ${motivoOutroTexto.trim()}`
        : motivoNomeBase;

      const periodoDescricao = dataFimParaValidacao
        ? formatPeriodo(form.dataInicio, dataFimParaValidacao)
        : formatDate(form.dataInicio);

      const seiNumero = form.seiNumero.trim();
      const exercicioLinha =
        motivoNomeLower === 'férias' && form.anoExercicioFerias !== ''
          ? `Exercício (cota): ${form.anoExercicioFerias}\n`
          : motivoNomeLower === 'férias'
            ? `Exercício (cota): mesmo ano do início do gozo\n`
            : '';

      const message =
        `Confirme os dados do afastamento:\n\n` +
        `Policial: ${policial?.nome ?? '—'}${policial?.matricula ? ` (${policial.matricula})` : ''}\n` +
        `Motivo: ${motivoNome}\n` +
        `Período: ${periodoDescricao}\n` +
        exercicioLinha +
        `SEI nº: ${seiNumero}`;

      openConfirm({
        title: 'Confirmar cadastro de afastamento',
        message,
        confirmLabel: 'Cadastrar afastamento',
        onConfirm: async () => {
          await submeterAfastamento();
        },
      });
    },
    [form, policiais, motivos, motivoOutroTexto, openConfirm, submeterAfastamento],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
      setError(null);
      setSuccess(null);

    if (!form.policialId) {
      setError('Selecione um policial.');
      return;
    }

    if (!form.motivoId || form.motivoId === 0) {
      setError('Selecione um motivo do afastamento.');
      return;
    }

    if (!form.seiNumero.trim()) {
      setError('Informe o SEI nº.');
      return;
    }

    // Buscar o motivo selecionado
    const motivoSelecionado = motivos.find((m) => m.id === form.motivoId);
    if (!motivoSelecionado) {
      setError('Motivo selecionado não encontrado.');
      return;
    }
    const motivoNome = motivoSelecionado.nome;
    const motivoEhOutro =
      motivoNome.toLowerCase() === 'outro' || motivoNome.toLowerCase() === 'outros';
    if (motivoEhOutro && !motivoOutroTexto.trim()) {
      setError('Informe o motivo quando selecionar "Outro".');
      return;
    }

    if (!form.dataInicio) {
      setError('Informe a data de início.');
      return;
    }

    // PRIMEIRO: Verificar se o próprio policial já tem afastamento no período
    const policialId = Number(form.policialId);
    
    // Calcular dataFim para validação (se calcularPeriodo estiver marcado)
    let dataFimParaValidacao = form.dataFim;
    if (calcularPeriodo && form.dataInicio && quantidadeDias) {
      const dias = parseInt(quantidadeDias, 10);
      if (!isNaN(dias) && dias > 0) {
        // Criar data a partir da string YYYY-MM-DD (mesma lógica do useMemo)
        const [year, month, day] = form.dataInicio.split('-').map(Number);
        const dataInicio = new Date(year, month - 1, day);
        // Adicionar dias (subtrair 1 porque o primeiro dia já conta)
        dataInicio.setDate(dataInicio.getDate() + dias - 1);
        const yearFormatted = dataInicio.getFullYear();
        const monthFormatted = String(dataInicio.getMonth() + 1).padStart(2, '0');
        const dayFormatted = String(dataInicio.getDate()).padStart(2, '0');
        dataFimParaValidacao = `${yearFormatted}-${monthFormatted}-${dayFormatted}`;
      }
    }
    
    const afastamentosDoMesmoPolicial = afastamentos.filter(
      (afastamento) =>
        afastamento.policialId === policialId && afastamento.status !== 'DESATIVADO',
    );

    // Verificar se algum afastamento do mesmo policial se sobrepõe com o período informado
    for (const afastamentoExistente of afastamentosDoMesmoPolicial) {
      const haSobreposicao = periodosSobrepostos(
        form.dataInicio,
        dataFimParaValidacao || null,
        afastamentoExistente.dataInicio,
        afastamentoExistente.dataFim || null,
      );

      if (haSobreposicao) {
        const statusLabel =
          STATUS_LABEL[afastamentoExistente.status] ?? afastamentoExistente.status;
        setPeriodoMismoPolicialModal({
          open: true,
          message:
            'Não é possível cadastrar este afastamento: já existe registro para este policial que se sobrepõe ao período informado (inclui ativos e encerrados pelo fim do período; desativações manuais não bloqueiam).\n\n' +
            `Registro existente: ${formatNome(afastamentoExistente.motivo.nome)}\n` +
            `Situação: ${statusLabel}\n` +
            `Período: ${formatDate(afastamentoExistente.dataInicio)} até ${afastamentoExistente.dataFim ? formatDate(afastamentoExistente.dataFim) : 'em aberto'}\n` +
            `SEI nº: ${afastamentoExistente.seiNumero}`,
        });
        return;
      }
    }

    // SEGUNDO: Verificar conflitos de afastamentos de OUTROS policiais no intervalo de dias
    const conflitos = verificarConflitos(form.dataInicio, dataFimParaValidacao || null, policialId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos informando sobre outros policiais afastados (ordenado por patente e nome)
      setConflitosModal({
        open: true,
        conflitos: sortAfastamentosPorPatenteENome(conflitos),
        dataVerificada: dataFimParaValidacao ? `${form.dataInicio} e ${dataFimParaValidacao}` : form.dataInicio,
      });
      return;
    }

    // Permitir cadastrar férias em período anterior à data atual (regra alterada)
    if (motivoNome === 'Férias') {
      // Verificar se o policial tem previsão de férias cadastrada
      const policialSelecionado = policiais.find((p) => p.id.toString() === form.policialId);
      if (!policialSelecionado) {
        setError('Selecione um policial.');
        return;
      }
      if (!policialTemPrevisaoFeriasParaGozo(policialSelecionado)) {
        setError(
          'Não é possível cadastrar férias sem previsão de férias para o exercício. Cadastre a previsão na aba Previsão de férias (para exercícios anteriores basta informar o ano; no gozo informe data de início e data de término).',
        );
        return;
      }
    }

    // Validar férias e abono
    if (motivoNome === 'Férias' || motivoNome === 'Abono') {
      // Se calcularPeriodo estiver marcado, validar quantidadeDias
      if (calcularPeriodo) {
        if (!quantidadeDias || parseInt(quantidadeDias, 10) <= 0) {
          setError('Para férias e abono, é necessário informar a quantidade de dias.');
          return;
        }
      } else {
        if (!form.dataFim) {
          setError('Para férias e abono, é necessário informar a data de término.');
          return;
        }
      }

      const policialId = Number(form.policialId);

      // Validar sobreposição de férias (não pode ter férias sobrepostas)
      if (motivoNome === 'Férias') {
        const motivoFeriasId = motivos.find((m) => m.nome === 'Férias')?.id;
        if (motivoFeriasId) {
          const fériasExistentes = afastamentos.filter(
            (afastamento) =>
              afastamento.policialId === policialId &&
              afastamento.motivoId === motivoFeriasId &&
              afastamento.status === 'ATIVO',
          );

        for (const feriasExistente of fériasExistentes) {
          // Usar a mesma função periodosSobrepostos que já está validada e funcionando
          const haSobreposicao = periodosSobrepostos(
            form.dataInicio,
            dataFimParaValidacao || null,
            feriasExistente.dataInicio,
            feriasExistente.dataFim || null,
          );

          if (haSobreposicao) {
            setError(
              'Policial já em usufruto de férias no período selecionado. Alterar a data.',
            );
            return;
          }
        }
        }
      }

      const anoGozo = new Date(form.dataInicio).getFullYear();
      const anoRef =
        motivoNome === 'Férias'
          ? form.anoExercicioFerias !== ''
            ? parseInt(form.anoExercicioFerias, 10)
            : anoGozo
          : anoGozo;

      if (motivoNome === 'Férias' && form.anoExercicioFerias !== '' && Number.isNaN(anoRef)) {
        setError('Selecione um ano de exercício válido ou deixe o padrão (mesmo ano do gozo).');
        return;
      }
      if (motivoNome === 'Férias' && form.anoExercicioFerias !== '' && anoRef > anoGozo) {
        setError('O ano de exercício não pode ser posterior ao ano da data de início do gozo.');
        return;
      }

      // Calcular dias solicitados
      let diasSolicitados = 0;
      if (calcularPeriodo && quantidadeDias) {
        diasSolicitados = parseInt(quantidadeDias, 10);
      } else {
        diasSolicitados = calcularDiasEntreDatas(form.dataInicio, form.dataFim || undefined);
      }
      const diasUsados = calcularDiasUsadosNoAno(policialId, form.motivoId, anoRef, {
        porExercicioFerias: motivoNome === 'Férias',
      });
      const limiteDias = motivoNome === 'Férias' ? 30 : 5;
      const totalAposCadastro = diasUsados + diasSolicitados;

      // Validar se o período solicitado ultrapassa o limite individual
      if (diasSolicitados > limiteDias) {
        setError(
          `O período de ${motivoNome} não pode ser superior a ${limiteDias} dias. Período informado: ${diasSolicitados} dias.`,
        );
        return;
      }

      // Validar se a soma ultrapassa o limite por exercício (férias) ou ano civil (abono)
      if (totalAposCadastro > limiteDias) {
        const diasRestantes = limiteDias - diasUsados;
        const rotuloPrazo = motivoNome === 'Férias' ? `no exercício de ${anoRef}` : 'no ano';
        setError(
          `O policial já usufruiu ${diasUsados} dias de ${motivoNome} ${rotuloPrazo}, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite de ${limiteDias} dias.`,
        );
        return;
      }
    }

    // Se não houver conflitos e validações passaram, verificar choque com troca de serviço
    try {
      const conflitoTroca = await verificarConflitoTrocaServico(policialId, form.dataInicio, dataFimParaValidacao || null);
      if (conflitoTroca) {
        setTrocaConflitoModal({
          open: true,
          policialNome: conflitoTroca.policialNome,
          dataServico: conflitoTroca.dataServico,
        });
        setTrocaConflitoCiente(false);
        setTrocaConflitoDataFimParaValidacao(dataFimParaValidacao || null);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao verificar conflito com troca de serviço.');
      return;
    }

    // Se não houver conflitos e validações passaram, abrir confirmação antes de cadastrar
    abrirConfirmacaoCadastro(dataFimParaValidacao || null);
  };

  const handleConfirmarConflito = async () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });

    // Recalcular dataFim para confirmação, usando mesma lógica de validação
    let dataFimParaValidacao = form.dataFim;
    if (calcularPeriodo && form.dataInicio && quantidadeDias) {
      const dias = parseInt(quantidadeDias, 10);
      if (!isNaN(dias) && dias > 0) {
        const [year, month, day] = form.dataInicio.split('-').map(Number);
        const dataInicio = new Date(year, month - 1, day);
        dataInicio.setDate(dataInicio.getDate() + dias - 1);
        const yearFormatted = dataInicio.getFullYear();
        const monthFormatted = String(dataInicio.getMonth() + 1).padStart(2, '0');
        const dayFormatted = String(dataInicio.getDate()).padStart(2, '0');
        dataFimParaValidacao = `${yearFormatted}-${monthFormatted}-${dayFormatted}`;
      }
    }

    // Antes de confirmar, verificar choque com troca de serviço
    try {
      const policialId = Number(form.policialId);
      const conflitoTroca = await verificarConflitoTrocaServico(policialId, form.dataInicio, dataFimParaValidacao || null);
      if (conflitoTroca) {
        setTrocaConflitoModal({
          open: true,
          policialNome: conflitoTroca.policialNome,
          dataServico: conflitoTroca.dataServico,
        });
        setTrocaConflitoCiente(false);
        setTrocaConflitoDataFimParaValidacao(dataFimParaValidacao || null);
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao verificar conflito com troca de serviço.');
      return;
    }

    abrirConfirmacaoCadastro(dataFimParaValidacao || null);
  };

  const handleCancelarConflito = () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
  };

  const handleCancelarTrocaConflito = () => {
    setTrocaConflitoModal({ open: false, policialNome: '', dataServico: '' });
    setTrocaConflitoCiente(false);
    setTrocaConflitoDataFimParaValidacao(null);
  };

  const handleOkTrocaConflito = () => {
    if (!trocaConflitoCiente) return;
    setTrocaConflitoModal({ open: false, policialNome: '', dataServico: '' });
    setTrocaConflitoCiente(false);
    abrirConfirmacaoCadastro(trocaConflitoDataFimParaValidacao || null);
  };

  const handleOpenEditAfastamento = (afastamento: Afastamento) => {
    const dataInicioStr = afastamento.dataInicio.includes('T')
      ? afastamento.dataInicio.slice(0, 10)
      : afastamento.dataInicio;
    const dataFimStr = afastamento.dataFim
      ? (afastamento.dataFim.includes('T') ? afastamento.dataFim.slice(0, 10) : afastamento.dataFim)
      : '';
    setEditAfastamentoModal({
      open: true,
      afastamento,
      motivoId: afastamento.motivoId,
      seiNumero: afastamento.seiNumero,
      descricao: afastamento.descricao ?? '',
      dataInicio: dataInicioStr,
      dataFim: dataFimStr,
      anoExercicioFerias:
        afastamento.motivo?.nome === 'Férias' && afastamento.anoExercicioFerias != null
          ? String(afastamento.anoExercicioFerias)
          : '',
      calcularPeriodo: false,
      quantidadeDias: '',
      error: null,
      loading: false,
    });
  };

  const handleCloseEditAfastamentoModal = () => {
    setEditAfastamentoModal({
      open: false,
      afastamento: null,
      motivoId: 0,
      seiNumero: '',
      descricao: '',
      dataInicio: '',
      dataFim: '',
      anoExercicioFerias: '',
      calcularPeriodo: false,
      quantidadeDias: '',
      error: null,
      loading: false,
    });
  };

  // Data de término calculada na modal de edição (quando "Calcular período" está marcado)
  const dataTerminoCalculadaEdit = useMemo(() => {
    const { dataInicio, quantidadeDias, calcularPeriodo } = editAfastamentoModal;
    if (!calcularPeriodo || !dataInicio || !quantidadeDias) return null;
    const dias = parseInt(quantidadeDias, 10);
    if (isNaN(dias) || dias < 1) return null;
    const [year, month, day] = dataInicio.split('-').map(Number);
    const dataInicioDate = new Date(year, month - 1, day);
    dataInicioDate.setDate(dataInicioDate.getDate() + dias - 1);
    return `${String(dataInicioDate.getFullYear())}-${String(dataInicioDate.getMonth() + 1).padStart(2, '0')}-${String(dataInicioDate.getDate()).padStart(2, '0')}`;
  }, [editAfastamentoModal.dataInicio, editAfastamentoModal.quantidadeDias, editAfastamentoModal.calcularPeriodo]);

  const handleSubmitEditAfastamento = async (e: React.FormEvent) => {
    e.preventDefault();
    const {
      afastamento,
      motivoId,
      seiNumero,
      descricao,
      dataInicio,
      dataFim,
      calcularPeriodo,
      anoExercicioFerias,
    } = editAfastamentoModal;
    if (!afastamento) return;
    if (!motivoId || !seiNumero.trim()) {
      setEditAfastamentoModal((prev) => ({
        ...prev,
        error: 'Informe o motivo e o SEI nº.',
      }));
      return;
    }
    const dataFimToSend = calcularPeriodo && dataTerminoCalculadaEdit
      ? dataTerminoCalculadaEdit
      : (dataFim.trim() || undefined);
    const motivoEdicao = motivos.find((m) => m.id === motivoId);
    const editEhFerias = motivoEdicao?.nome === 'Férias';

    try {
      setEditAfastamentoModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.updateAfastamento(afastamento.id, {
        motivoId,
        seiNumero: seiNumero.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio,
        dataFim: dataFimToSend,
        ...(editEhFerias
          ? {
              anoExercicioFerias:
                anoExercicioFerias !== '' ? parseInt(anoExercicioFerias, 10) : null,
            }
          : {}),
      });
      setSuccess('Afastamento atualizado com sucesso.');
      handleCloseEditAfastamentoModal();
      await carregarDados();
      onChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isApiErroSobreposicaoPeriodoPolicial(msg)) {
        setEditAfastamentoModal((prev) => ({ ...prev, loading: false, error: null }));
        setPeriodoMismoPolicialModal({ open: true, message: msg });
      } else {
        setEditAfastamentoModal((prev) => ({
          ...prev,
          loading: false,
          error: msg || 'Não foi possível atualizar o afastamento.',
        }));
      }
    }
  };

  const handleDelete = (afastamento: Afastamento) => {
    openConfirm({
      title: 'Remover afastamento',
      message: `Deseja remover o afastamento "${formatNome(afastamento.motivo.nome)}" do policial ${afastamento.policial.nome}?`,
      confirmLabel: 'Remover',
      onConfirm: async () => {
        try {
          setError(null);
          await api.removeAfastamento(afastamento.id);
          setSuccess('Afastamento removido.');
          await carregarDados();
          onChanged?.();
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : 'Não foi possível remover o afastamento.',
          );
        }
      },
    });
  };

  // Desabilitar policiais sem previsão de férias somente quando o motivo selecionado for "Férias"
  const motivoEhFerias = useMemo(
    () => Boolean(motivos.find((m) => m.id === form.motivoId)?.nome === 'Férias'),
    [form.motivoId, motivos],
  );

  // Policiais para o select de cadastro: com previsão de férias no topo somente quando motivo for "Férias";
  // ordenação por patente e nome
  const policiaisOrdenados = useMemo(() => {
    if (motivoEhFerias) {
      const comPrevisao = policiais.filter(policialTemPrevisaoFeriasParaGozo);
      const semPrevisao = policiais.filter((p) => !policialTemPrevisaoFeriasParaGozo(p));
      return [
        ...sortPorPatenteENome(comPrevisao),
        ...sortPorPatenteENome(semPrevisao),
      ];
    }
    return sortPorPatenteENome(policiais);
  }, [policiais, motivoEhFerias]);

  const motivoDispensaMedica = useMemo(
    () =>
      motivos.find(
        (m) => normalizarTextoComparacao(m.nome) === normalizarTextoComparacao('Dispensa médica'),
      ),
    [motivos],
  );

  const pdfLinhasExibidas = useMemo(() => {
    if (pdfLeituraFiltro === 'todas') return pdfPreviewCompleto;
    return pdfPreviewCompleto.filter((p) => p.filtroAtestado);
  }, [pdfPreviewCompleto, pdfLeituraFiltro]);

  const pdfLeituraResumo = useMemo(() => {
    const all = pdfPreviewCompleto;
    const comAtestado = all.filter((p) => p.filtroAtestado);
    const ok = all.filter((p) => p.status === 'ok').length;
    const aviso = all.filter((p) => p.status === 'aviso').length;
    const erro = all.filter((p) => p.status === 'erro').length;
    return {
      totalInterpretadas: all.length,
      comObsAtestado: comAtestado.length,
      ok,
      aviso,
      erro,
    };
  }, [pdfPreviewCompleto]);

  const handlePdfImportSelecionado = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setPdfImportLoading(true);
      setPdfImportErro(null);
      setPdfTextoAmostra(null);
      setPdfNomeArquivo(file.name);
      setPdfLeituraFiltro('atestado');
      try {
        const buf = await file.arrayBuffer();
        const texto = await extrairTextoPdf(buf);
        setPdfTextoAmostra(texto.length > 2500 ? `${texto.slice(0, 2500)}…` : texto);
        const bruto = parsearLinhasTabelaAfastamentosPdf(texto);
        setPdfLinhasBrutasTotal(bruto.length);
        const preview = montarPreviewImportacaoPdf(
          bruto,
          policiais.map((p) => ({ id: p.id, nome: p.nome, matricula: p.matricula })),
          motivoDispensaMedica?.nome ?? null,
        );
        setPdfPreviewCompleto(preview);
        setPdfImportModalOpen(true);
      } catch (err) {
        setPdfImportErro(err instanceof Error ? err.message : 'Falha ao ler o PDF.');
      } finally {
        setPdfImportLoading(false);
      }
    },
    [policiais, motivoDispensaMedica],
  );

  const normalizedSearch = searchTerm.trim().toUpperCase();

  // Função para verificar se um período de afastamento se sobrepõe com um mês específico
  const periodoSobrepoeMes = useCallback((
    dataInicio: string,
    dataFim: string | null | undefined,
    year: number,
    month: number,
  ): boolean => {
    // Calcular primeiro e último dia do mês
    const primeiroDiaMes = new Date(year, month - 1, 1);
    const ultimoDiaMes = new Date(year, month, 0, 23, 59, 59); // àšltimo dia do mês

    // Normalizar datas
    primeiroDiaMes.setHours(0, 0, 0, 0);
    ultimoDiaMes.setHours(23, 59, 59, 999);

    const inicioAfastamento = new Date(dataInicio);
    inicioAfastamento.setHours(0, 0, 0, 0);

    const fimAfastamento = dataFim ? new Date(dataFim) : null;
    if (fimAfastamento) {
      fimAfastamento.setHours(23, 59, 59, 999);
    }

    // Verificar sobreposição:
    // O período se sobrepõe se:
    // - O início do afastamento está dentro do mês, OU
    // - O fim do afastamento está dentro do mês, OU
    // - O afastamento engloba todo o mês (início antes e fim depois)
    if (fimAfastamento) {
      // Afastamento com data fim: verifica se há sobreposição
      return (
        (inicioAfastamento <= ultimoDiaMes && fimAfastamento >= primeiroDiaMes)
      );
    } else {
      // Afastamento sem data fim: verifica se começa antes ou durante o mês
      return inicioAfastamento <= ultimoDiaMes;
    }
  }, []);

  const afastamentosFiltrados = useMemo(() => {
    let resultado = afastamentos;

    // Filtrar por intervalo de datas (tem prioridade sobre o filtro por mês)
    if (dataInicioFiltro || dataFimFiltro) {
      resultado = resultado.filter((afastamento) => {
        const inicioAfastamento = new Date(afastamento.dataInicio);
        const fimAfastamento = afastamento.dataFim ? new Date(afastamento.dataFim) : null;

        // Normalizar datas para comparação (apenas dia, mês, ano)
        inicioAfastamento.setHours(0, 0, 0, 0);
        if (fimAfastamento) {
          fimAfastamento.setHours(0, 0, 0, 0);
        }

        if (dataInicioFiltro && dataFimFiltro) {
          // Criar datas locais a partir de YYYY-MM-DD para evitar problemas de timezone
          const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
          const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
          const filtroInicio = new Date(yearInicio, monthInicio - 1, dayInicio, 0, 0, 0, 0);
          const filtroFim = new Date(yearFim, monthFim - 1, dayFim, 23, 59, 59, 999); // Fim do dia para incluir o último dia completo

          // Verificar se há sobreposição entre o período do afastamento e o filtro
          // Dois períodos [a, b] e [c, d] se sobrepõem se: a <= d && c <= b
          if (fimAfastamento) {
            // Afastamento tem fim: verificar sobreposição normal
            const temSobreposicao = inicioAfastamento.getTime() <= filtroFim.getTime() && 
                                   filtroInicio.getTime() <= fimAfastamento.getTime();
            return temSobreposicao;
          } else {
            // Afastamento sem fim: verificar se começa antes ou durante o período do filtro
            return inicioAfastamento.getTime() <= filtroFim.getTime();
          }
        } else if (dataInicioFiltro) {
          // Apenas início: afastamento deve começar a partir dessa data
          const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
          const filtroInicio = new Date(yearInicio, monthInicio - 1, dayInicio, 0, 0, 0, 0);
          return inicioAfastamento.getTime() >= filtroInicio.getTime() || (fimAfastamento && fimAfastamento.getTime() >= filtroInicio.getTime());
        } else if (dataFimFiltro) {
          // Apenas fim: afastamento deve terminar até essa data ou não ter fim
          // Incluir TODO o último dia (23:59:59.999)
          const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
          const filtroFim = new Date(yearFim, monthFim - 1, dayFim, 23, 59, 59, 999);
          if (fimAfastamento) {
            return fimAfastamento.getTime() <= filtroFim.getTime() || inicioAfastamento.getTime() <= filtroFim.getTime();
          } else {
            return inicioAfastamento.getTime() <= filtroFim.getTime();
          }
        }

        return true;
      });
    } else {
      // Se não há filtro por intervalo de datas, usar o filtro por mês
      const [year, month] = selectedMonth.split('-').map(Number);
      if (selectedMonth && !Number.isNaN(year) && !Number.isNaN(month)) {
        resultado = resultado.filter((afastamento) => {
          return periodoSobrepoeMes(
            afastamento.dataInicio,
            afastamento.dataFim,
            year,
            month,
          );
        });
      }
    }

    // Filtrar por motivo
    const filtradoPorMotivo = motivoFiltro
      ? resultado.filter((afastamento) => afastamento.motivo.nome === motivoFiltro)
      : resultado;

    const motivoFiltroLower = motivoFiltro.toLowerCase();
    const motivoFiltroEhOutro = motivoFiltroLower === 'outro' || motivoFiltroLower === 'outros';
    const termoOutroFiltro = motivoFiltroOutro.trim().toUpperCase();
    const filtradoPorMotivoOutro = motivoFiltroEhOutro && termoOutroFiltro
      ? filtradoPorMotivo.filter((afastamento) =>
          (afastamento.descricao ?? '').toUpperCase().includes(termoOutroFiltro),
        )
      : filtradoPorMotivo;

    // Filtrar por busca de nome
    const filtradoFinal = normalizedSearch
      ? filtradoPorMotivoOutro.filter((afastamento) =>
          afastamento.policial.nome.includes(normalizedSearch),
        )
      : filtradoPorMotivoOutro;

    // Ordenar por patente e nome do policial
    const ordenado = sortAfastamentosPorPatenteENome(filtradoFinal);
    if (abaListaAfastamentos === 'ativos') {
      return ordenado.filter((a) => a.status === 'ATIVO');
    }
    return ordenado.filter((a) => a.status === 'ENCERRADO' || a.status === 'DESATIVADO');
  }, [
    afastamentos,
    abaListaAfastamentos,
    motivoFiltro,
    motivoFiltroOutro,
    normalizedSearch,
    selectedMonth,
    dataInicioFiltro,
    dataFimFiltro,
    periodoSobrepoeMes,
  ]);

  const totalPaginas = useMemo(
    () => Math.max(1, Math.ceil(afastamentosFiltrados.length / itensPorPagina)),
    [afastamentosFiltrados.length, itensPorPagina],
  );

  const afastamentosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina;
    return afastamentosFiltrados.slice(inicio, inicio + itensPorPagina);
  }, [afastamentosFiltrados, paginaAtual, itensPorPagina]);

  const registroInicio = afastamentosFiltrados.length === 0 ? 0 : ((paginaAtual - 1) * itensPorPagina) + 1;
  const registroFim = afastamentosFiltrados.length === 0 ? 0 : Math.min(paginaAtual * itensPorPagina, afastamentosFiltrados.length);

  useEffect(() => {
    if (paginaAtual > totalPaginas && totalPaginas > 0) {
      setPaginaAtual(totalPaginas);
    }
  }, [paginaAtual, totalPaginas]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [motivoFiltro, motivoFiltroOutro, searchTerm, selectedMonth, dataInicioFiltro, dataFimFiltro, abaListaAfastamentos]);

  const descricaoPeriodo = useMemo(() => {
    // Prioridade para intervalo de datas
    if (dataInicioFiltro || dataFimFiltro) {
      if (dataInicioFiltro && dataFimFiltro) {
        // Criar datas locais para formatação correta
        const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
        const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
        const dataInicio = new Date(yearInicio, monthInicio - 1, dayInicio);
        const dataFim = new Date(yearFim, monthFim - 1, dayFim);
        return `${formatDate(dataInicio.toISOString())} a ${formatDate(dataFim.toISOString())}`;
      } else if (dataInicioFiltro) {
        const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
        const dataInicio = new Date(yearInicio, monthInicio - 1, dayInicio);
        return `A partir de ${formatDate(dataInicio.toISOString())}`;
      } else if (dataFimFiltro) {
        const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
        const dataFim = new Date(yearFim, monthFim - 1, dayFim);
        return `Até ${formatDate(dataFim.toISOString())}`;
      }
    }

    // Se não há filtro por intervalo, usar o filtro por mês
    if (!selectedMonth) {
      return 'Todos os períodos';
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    if (Number.isNaN(year) || Number.isNaN(month)) {
      return 'Todos os períodos';
    }

    if (month < 1 || month > 12) {
      return 'Todos os períodos';
    }

    const dataReferencia = new Date(year, month - 1, 1);

    if (Number.isNaN(dataReferencia.getTime())) {
      return 'Todos os períodos';
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(dataReferencia);
  }, [selectedMonth, dataInicioFiltro, dataFimFiltro]);

  return (
    <section>
      <div>
        <h2>Afastamentos</h2>
        
      </div>

      {error && (
        <div className="feedback error">
          {error}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setError(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}
      {success && (
        <div className="feedback success">
          {success}
          <button
            type="button"
            className="feedback-close"
            onClick={() => setSuccess(null)}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabAtiva} onChange={(_, newValue) => setTabAtiva(newValue)}>
          <Tab label="Cadastrar afastamento" />
          <Tab label="Previsão de férias" />
        </Tabs>
      </Box>

      {tabAtiva === 0 && (
        <>
        {EXIBIR_BOTAO_TESTE_PDF ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <input
              ref={pdfImportInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: 'none' }}
              onChange={handlePdfImportSelecionado}
            />
            <Button
              type="button"
              variant="outlined"
              size="small"
              disabled={pdfImportLoading || policiais.length === 0 || motivos.length === 0}
              onClick={() => pdfImportInputRef.current?.click()}
            >
              {pdfImportLoading ? 'Lendo PDF…' : 'Testar leitura do PDF'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 640 }}>
              Interpreta o arquivo e abre um relatório de conferência. Nada é gravado no banco. Você pode filtrar só
              linhas com OBS &quot;Atestado&quot; (mapeadas para &quot;Dispensa médica&quot;) ou ver todas as linhas lidas.
            </Typography>
          </Box>
        ) : null}
        <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Policial
            </Typography>
            <Autocomplete
              options={policiaisOrdenados}
              getOptionLabel={(option) => {
                if (!motivoEhFerias) return `${option.nome} - ${formatMatricula(option.matricula)}`;
                if (option.previsaoFeriasSomenteAno && option.anoPrevisaoFerias != null) {
                  return `${option.nome} - ${formatMatricula(option.matricula)} (previsão: exercício ${option.anoPrevisaoFerias} — mês opcional)`;
                }
                if (!policialTemPrevisaoFeriasParaGozo(option)) {
                  return `${option.nome} - ${formatMatricula(option.matricula)} (sem previsão de férias)`;
                }
                return `${option.nome} - ${formatMatricula(option.matricula)}`;
              }}
              getOptionDisabled={(option) =>
                motivoEhFerias ? !policialTemPrevisaoFeriasParaGozo(option) : false
              }
              value={policiaisOrdenados.find((c) => c.id.toString() === form.policialId) || null}
              onChange={(_event, newValue) => {
                setForm((prev) => ({
                  ...prev,
                  policialId: newValue ? newValue.id.toString() : '',
                }));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Digite o nome ou matrícula para buscar"
                required={!form.policialId}
                size="small"
                sx={formFieldSx}
              />
            )}
            filterOptions={(options, { inputValue }) => {
              const term = inputValue.toLowerCase();
              return options.filter(
                (o) =>
                  o.nome.toLowerCase().includes(term) ||
                  o.matricula.toLowerCase().includes(term)
              );
            }}
            noOptionsText="Nenhum policial encontrado"
            isOptionEqualToValue={(option, value) => option.id === value.id}
            sx={{ '& .MuiAutocomplete-root': { height: 'auto' } }}
          />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography component="label" htmlFor="motivo-select" sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>
              Motivo
            </Typography>
            <FormControl fullWidth required size="small" variant="outlined" sx={formFieldSx}>
              <Select
                id="motivo-select"
                value={form.motivoId || ''}
                displayEmpty
              renderValue={(v) => {
                if (!v) return 'Selecione';
                const m = motivosOrdenados.find((mot) => mot.id === v);
                return m ? formatNome(m.nome) : 'Selecione';
              }}
              onChange={(event) => {
                const motivoId = Number(event.target.value);
                const motivoSelecionado = motivos.find((motivo) => motivo.id === motivoId);
                const motivoNome = motivoSelecionado?.nome?.toLowerCase() ?? '';
                const motivoEhOutro = motivoNome === 'outro' || motivoNome === 'outros';
                const motivoEhFerias = motivoNome === 'férias';
                
                if (!motivoEhOutro) {
                  setMotivoOutroTexto('');
                }
                
                if (motivoEhFerias && form.policialId) {
                  const policialSelecionado = policiais.find((p) => p.id.toString() === form.policialId);
                  if (policialSelecionado && !policialTemPrevisaoFeriasParaGozo(policialSelecionado)) {
                    setForm((prev) => ({
                      ...prev,
                      motivoId,
                      policialId: '',
                      anoExercicioFerias: '',
                    }));
                    setError(
                      'Para cadastrar férias, o policial precisa ter previsão de férias cadastrada para o exercício (na aba Previsão de férias).',
                    );
                    return;
                  }
                }
                
                setForm((prev) => ({
                  ...prev,
                  motivoId,
                  anoExercicioFerias: motivoEhFerias ? prev.anoExercicioFerias : '',
                }));
              }}
              MenuProps={{ sx: { zIndex: 1500 } }}
            >
              <MenuItem value="">
                <em>Selecione</em>
              </MenuItem>
              {motivosOrdenados.map((motivo) => (
                <MenuItem key={motivo.id} value={motivo.id}>
                  {formatNome(motivo.nome)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          </Box>
          {(() => {
            const motivoSelecionado = motivos.find((motivo) => motivo.id === form.motivoId);
            const motivoNome = motivoSelecionado?.nome?.toLowerCase() ?? '';
            const motivoEhOutro = motivoNome === 'outro' || motivoNome === 'outros';
            if (!motivoEhOutro) return null;
            return (
              <TextField
                label="Especifique o motivo"
                value={motivoOutroTexto}
                onChange={createNormalizedInputHandler(setMotivoOutroTexto)}
                slotProps={{
                  input: {
                    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                      handleKeyDownNormalized(e),
                  },
                }}
                placeholder="Descreva o motivo"
                required
                fullWidth
                size="small"
                variant="outlined"
                sx={{ gridColumn: { md: '1 / -1' }, ...formFieldSx }}
              />
            );
          })()}
        </Box>
        <TextField
          label="SEI nº"
          value={form.seiNumero}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, seiNumero: e.target.value.replace(/\D/g, '') }))
          }
          placeholder="Somente números"
          required
          fullWidth
          size="small"
          variant="outlined"
          inputProps={{ inputMode: 'numeric', pattern: '\\d*' }}
          sx={formFieldSx}
        />
        <TextField
          label="Descrição (opcional)"
          value={form.descricao}
          onChange={(e) => {
            const v = e.target.value;
            const normalized = v.toLowerCase().charAt(0).toUpperCase() + v.toLowerCase().slice(1);
            setForm((prev) => ({ ...prev, descricao: normalized }));
          }}
          slotProps={{
            input: {
              onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) =>
                handleKeyDownNormalized(e),
            },
          }}
          placeholder="Detalhes adicionais..."
          fullWidth
          size="small"
          variant="outlined"
          multiline
          rows={3}
          sx={formFieldSx}
        />
        <Box
          sx={{
            display: 'grid',
            gap: 2,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr auto' },
            alignItems: 'end',
          }}
        >
          <TextField
            label="Data de início"
            type="date"
            value={form.dataInicio}
            onChange={(e) => {
              setForm((prev) => ({ ...prev, dataInicio: e.target.value }));
              if (!form.dataFim) setDataFimFocada(false);
            }}
            required
            fullWidth
            size="small"
            variant="outlined"
            InputLabelProps={{ shrink: true }}
            sx={formFieldSx}
          />
          <TextField
            label={calcularPeriodo ? 'Quantidade de dias' : 'Data de término'}
            type={calcularPeriodo ? 'number' : 'date'}
            value={calcularPeriodo ? quantidadeDias : form.dataFim}
            onChange={
              calcularPeriodo
                ? (e) => setQuantidadeDias(e.target.value.replace(/\D/g, ''))
                : (e) => {
                    setForm((prev) => ({ ...prev, dataFim: e.target.value }));
                    setDataFimFocada(true);
                  }
            }
            onFocus={
              !calcularPeriodo
                ? (e) => {
                    if (!form.dataFim && form.dataInicio && !dataFimFocada) {
                      (e.target as HTMLInputElement).value = form.dataInicio;
                      setForm((prev) => ({ ...prev, dataFim: prev.dataInicio }));
                      setDataFimFocada(true);
                    }
                  }
                : undefined
            }
            placeholder={calcularPeriodo ? 'Nº de dias' : undefined}
            fullWidth
            size="small"
            variant="outlined"
            inputProps={
              calcularPeriodo
                ? { min: 1, inputMode: 'numeric' }
                : { min: form.dataInicio || undefined }
            }
            InputLabelProps={!calcularPeriodo ? { shrink: true } : undefined}
            required={!calcularPeriodo}
            sx={formFieldSx}
          />
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setForm((prev) => ({ ...prev, dataInicio: '', dataFim: '', anoExercicioFerias: '' }));
              setQuantidadeDias('');
              setCalcularPeriodo(false);
              setDataFimFocada(false);
            }}
            sx={{
              textTransform: 'none',
              height: 40,
              minWidth: 90,
            }}
          >
            Limpar
          </Button>
        </Box>
        {motivoEhFerias && (
          <FormControl fullWidth size="small" variant="outlined" sx={formFieldSx}>
            <InputLabel id="ano-exercicio-ferias-label" shrink>
              Exercício
            </InputLabel>
            <Select
              labelId="ano-exercicio-ferias-label"
              label="Exercício"
              displayEmpty
              value={form.anoExercicioFerias}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  anoExercicioFerias: e.target.value as string,
                }))
              }
              notched
              renderValue={(v) =>
                v === '' ? 'Mesmo ano do início do gozo (padrão)' : String(v)
              }
            >
              <MenuItem value="">
                <em>Mesmo ano do início do gozo (padrão)</em>
              </MenuItem>
              {anosExercicioFeriasOpcoes.map((y) => (
                <MenuItem key={y} value={String(y)}>
                  {y}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              Opções: ano atual e os cinco anteriores (até 6 anos), nunca antes de 2021 — ao virar o ano, o mais
              antigo some da lista. Para acúmulo, escolha o exercício com previsão cadastrada. Padrão: mesmo ano do
              início do gozo.
            </Typography>
          </FormControl>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              checked={calcularPeriodo}
              onChange={(e) => setCalcularPeriodo(e.target.checked)}
              size="small"
            />
            <Typography component="span" sx={{ fontSize: '0.95rem' }}>
              Calcular período
            </Typography>
          </Box>
          {calcularPeriodo && dataTerminoCalculada && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  color: 'text.secondary', 
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}
              >
                Data de término: {dataTerminoCalculada}
              </Typography>
            )}
            {!calcularPeriodo && diasCalculados !== null && (
              <Typography 
                variant="body2" 
                sx={{ 
                  mt: 1, 
                  color: 'text.secondary', 
                  fontSize: '0.875rem',
                  fontStyle: 'italic'
                }}
              >
                Período: {diasCalculados} {diasCalculados === 1 ? 'dia' : 'dias'}
              </Typography>
            )}
        </Box>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
          <Button
            type="submit"
            variant="contained"
            disabled={submitting}
            sx={{
              textTransform: 'none',
              bgcolor: 'var(--sentinela-blue)',
              '&:hover': { bgcolor: 'var(--sentinela-blue)', opacity: 0.9 },
            }}
          >
            {submitting ? 'Salvando...' : 'Cadastrar afastamento'}
          </Button>
        </Box>
      </form>

      <div>
        <div className="section-header">
          <h3>Lista de afastamentos</h3>
        </div>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={abaListaAfastamentos}
            onChange={(_, v) => {
              setAbaListaAfastamentos(v);
              setPaginaAtual(1);
            }}
            sx={{ '& .MuiTab-root': { textTransform: 'none', fontWeight: 600 } }}
          >
            <Tab label="Ativos" value="ativos" />
            <Tab label="Encerrados/desativados" value="encerrados" />
          </Tabs>
        </Box>
        <div className="list-controls">
          <input
            className="search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value.toUpperCase())}
            placeholder="Pesquisar por nome"
          />
          <select
            className="search-input"
            value={motivoFiltro}
            onChange={(event) => {
              const valor = event.target.value;
              setMotivoFiltro(valor);
              const motivoLower = valor.toLowerCase();
              if (motivoLower !== 'outro' && motivoLower !== 'outros') {
                setMotivoFiltroOutro('');
              }
            }}
          >
            <option value="">Todos os motivos</option>
            {motivosOrdenados.map((motivo) => (
              <option key={motivo.id} value={motivo.nome}>
                {formatNome(motivo.nome)}
              </option>
            ))}
          </select>
          {(motivoFiltro.toLowerCase() === 'outro' || motivoFiltro.toLowerCase() === 'outros') && (
            <input
              className="search-input"
              value={motivoFiltroOutro}
              onChange={(event) => setMotivoFiltroOutro(event.target.value.toUpperCase())}
              placeholder="Informe o motivo (outro)"
            />
          )}
          <input
            type="date"
            className="search-input"
            value={dataInicioFiltro}
            onChange={(event) => {
              setDataInicioFiltro(event.target.value);
              // Limpar filtro por mês quando usar intervalo de datas
              if (event.target.value) {
                setSelectedMonth('');
              }
              // Resetar o estado de foco quando a data de início mudar para permitir pré-seleção novamente
              if (!dataFimFiltro) {
                setDataFimFiltroFocada(false);
              }
            }}
            placeholder="Data início"
            title="Data início do período"
          />
          <input
            type="date"
            className="search-input"
            value={dataFimFiltro}
            onChange={(event) => {
              setDataFimFiltro(event.target.value);
              // Limpar filtro por mês quando usar intervalo de datas
              if (event.target.value) {
                setSelectedMonth('');
              }
              setDataFimFiltroFocada(true);
            }}
            placeholder="Data fim"
            title="Data fim do período"
            min={dataInicioFiltro || undefined}
            onFocus={(event) => {
              // Quando o campo recebe foco e não tem valor, pré-selecionar a data de início
              if (!dataFimFiltro && dataInicioFiltro && !dataFimFiltroFocada) {
                const input = event.currentTarget;
                // Definir o valor diretamente no input para que o calendário abra com essa data pré-selecionada
                input.value = dataInicioFiltro;
                setDataFimFiltro(dataInicioFiltro);
                setDataFimFiltroFocada(true);
              }
            }}
          />
          <input
            type="month"
            className="search-input"
            value={selectedMonth}
            onChange={(event) => {
              setSelectedMonth(event.target.value);
              // Limpar intervalo de datas quando usar filtro por mês
              if (event.target.value) {
                setDataInicioFiltro('');
                setDataFimFiltro('');
                setDataFimFiltroFocada(false);
              }
            }}
            title="Filtrar por mês"
          />
          <span className="badge badge-muted">{descricaoPeriodo}</span>
          <select
            value={itensPorPagina}
            onChange={(e) => {
              setItensPorPagina(Number(e.target.value));
              setPaginaAtual(1);
            }}
            className="search-input"
            style={{ maxWidth: '140px' }}
            aria-label="Itens por página"
          >
            <option value={10}>10 / página</option>
            <option value={20}>20 / página</option>
            <option value={50}>50 / página</option>
            <option value={100}>100 / página</option>
          </select>
          {(dataInicioFiltro || dataFimFiltro || selectedMonth) && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<ClearIcon />}
              onClick={() => {
                setDataInicioFiltro('');
                setDataFimFiltro('');
                setSelectedMonth('');
                setDataFimFiltroFocada(false);
              }}
              title="Limpar todos os filtros de período"
              sx={{
                whiteSpace: 'nowrap',
                textTransform: 'none',
                minWidth: 'auto',
              }}
            >
              Limpar
            </Button>
          )}
        </div>
        {loading ? (
          <p className="empty-state">Carregando afastamentos...</p>
        ) : afastamentosFiltrados.length === 0 ? (
          <p className="empty-state">
            {abaListaAfastamentos === 'ativos'
              ? dataInicioFiltro || dataFimFiltro || selectedMonth
                ? 'Nenhum afastamento ativo encontrado no período selecionado.'
                : 'Nenhum afastamento ativo.'
              : dataInicioFiltro || dataFimFiltro || selectedMonth
                ? 'Nenhum afastamento encerrado ou desativado encontrado no período selecionado.'
                : 'Nenhum afastamento encerrado ou desativado.'}
          </p>
        ) : (
          <>
          <table className="table">
            <thead>
              <tr>
                <th>Policial</th>
                <th>Matrícula</th>
                <th>Motivo</th>
                <th>SEI nº</th>
                <th>Período</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {afastamentosPaginados.map((afastamento) => (
                <tr key={afastamento.id}>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleOpenDetalhesAfastamento(afastamento)}
                      title="Clique para ver detalhes do afastamento"
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        margin: 0,
                        color: 'var(--accent-muted)',
                        cursor: 'pointer',
                        fontWeight: 600,
                        textAlign: 'left',
                      }}
                    >
                      {afastamento.policial.nome}
                    </button>
                  </td>
                  <td>{formatMatricula(afastamento.policial.matricula)}</td>
                  <td>
                    <div>{formatNome(afastamento.motivo.nome)}</div>
                    {afastamento.motivo.nome === 'Férias' &&
                      afastamento.anoExercicioFerias != null && (
                        <Chip
                          size="small"
                          label={`Exercício ${afastamento.anoExercicioFerias}`}
                          sx={{ mt: 0.5, height: 22, fontSize: '0.7rem' }}
                        />
                      )}
                  </td>
                  <td>{afastamento.seiNumero}</td>
                  <td>
                    {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                  </td>
                  <td style={{ verticalAlign: 'middle' }}>
                    <span className="badge">{STATUS_LABEL[afastamento.status]}</span>
                  </td>
                  <td className="actions" style={{ verticalAlign: 'middle' }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                      {canEdit(permissoes, 'afastamentos') && (
                        <Tooltip title="Editar afastamento">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenEditAfastamento(afastamento)}
                            sx={{
                              border: '1px solid',
                              borderColor: 'var(--accent-muted)',
                              '&:hover': {
                                backgroundColor: 'primary.light',
                                color: 'white',
                              },
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {canDesativar(permissoes, 'afastamentos') && (
                        <Tooltip title={tituloIconeDesativarAfastamento(afastamento)}>
                          <span>
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => {
                                openConfirm({
                                  title: 'Desativar afastamento',
                                  message: `Deseja desativar o afastamento "${formatNome(afastamento.motivo.nome)}" do policial ${afastamento.policial.nome}? O afastamento será marcado como desativado.`,
                                  confirmLabel: 'Desativar',
                                  onConfirm: async () => {
                                    try {
                                      setError(null);
                                      await api.desativarAfastamento(afastamento.id);
                                      setSuccess('Afastamento desativado com sucesso.');
                                      await carregarDados();
                                      onChanged?.();
                                    } catch (err) {
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : 'Não foi possível desativar o afastamento.',
                                      );
                                    }
                                  },
                                });
                              }}
                              disabled={afastamento.status !== 'ATIVO'}
                              sx={{
                                border: '1px solid',
                                borderColor: 'warning.main',
                                '&:hover': {
                                  backgroundColor: 'warning.light',
                                  color: 'white',
                                },
                                opacity: afastamento.status !== 'ATIVO' ? 0.5 : 1,
                              }}
                            >
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      )}
                      {canExcluir(permissoes, 'afastamentos') && (
                        <Tooltip title="Remover afastamento">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(afastamento)}
                            sx={{
                              border: '1px solid',
                              borderColor: 'error.main',
                              '&:hover': {
                                backgroundColor: theme.alertErrorBg,
                                color: 'white',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPaginas > 1 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '16px',
                padding: '12px',
                backgroundColor: 'rgba(0,0,0,0.15)',
                borderRadius: '8px',
                border: '1px solid var(--border-soft)',
              }}
            >
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Mostrando {registroInicio} a {registroFim} de {afastamentosFiltrados.length} registro(s)
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  style={{ padding: '6px 12px' }}
                >
                  ««
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPaginaAtual((prev) => Math.max(1, prev - 1))}
                  disabled={paginaAtual === 1}
                  style={{ padding: '6px 12px' }}
                >
                  ‹ Anterior
                </button>
                <span style={{ padding: '0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPaginaAtual((prev) => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaAtual === totalPaginas}
                  style={{ padding: '6px 12px' }}
                >
                  Próxima ›
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  style={{ padding: '6px 12px' }}
                >
                  »»
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </div>

      {/* Modal Detalhes do afastamento */}
      <Dialog
        open={detalhesAfastamentoModal.open}
        onClose={handleCloseDetalhesAfastamento}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
            color: 'white',
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Detalhes do afastamento
            </Typography>
            <IconButton
              onClick={handleCloseDetalhesAfastamento}
              size="small"
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {detalhesAfastamentoModal.afastamento && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Policial
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {detalhesAfastamentoModal.afastamento.policial.nome}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  Matrícula: {formatMatricula(detalhesAfastamentoModal.afastamento.policial.matricula)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  Equipe: {formatEquipeLabel(detalhesAfastamentoModal.afastamento.policial.equipe)}
                </Typography>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                  Função: {detalhesAfastamentoModal.afastamento.policial.funcao?.nome ?? '—'}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Motivo
                </Typography>
                <Typography variant="body1">
                  {formatNome(detalhesAfastamentoModal.afastamento.motivo.nome)}
                </Typography>
              </Box>

              {detalhesAfastamentoModal.afastamento.motivo.nome === 'Férias' && (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Exercício (cota)
                  </Typography>
                  <Typography variant="body1">
                    {detalhesAfastamentoModal.afastamento.anoExercicioFerias != null
                      ? detalhesAfastamentoModal.afastamento.anoExercicioFerias
                      : `Mesmo ano do gozo (${new Date(
                          detalhesAfastamentoModal.afastamento.dataInicio.includes('T')
                            ? detalhesAfastamentoModal.afastamento.dataInicio.slice(0, 10)
                            : detalhesAfastamentoModal.afastamento.dataInicio,
                        ).getFullYear()})`}
                  </Typography>
                </Box>
              )}

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    SEI nº
                  </Typography>
                  <Typography variant="body1">
                    {detalhesAfastamentoModal.afastamento.seiNumero}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Status
                  </Typography>
                  <Chip
                    label={STATUS_LABEL[detalhesAfastamentoModal.afastamento.status]}
                    size="small"
                    sx={{ fontWeight: 700 }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Período
                </Typography>
                <Typography variant="body1">
                  {formatPeriodo(
                    detalhesAfastamentoModal.afastamento.dataInicio,
                    detalhesAfastamentoModal.afastamento.dataFim,
                  )}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Observação
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {(detalhesAfastamentoModal.afastamento.descricao ?? '').trim() || '—'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-soft)' }}>
          <Button onClick={handleCloseDetalhesAfastamento} variant="contained">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
        </>
      )}

      {tabAtiva === 1 && (
        <Box sx={{ p: 3 }}>
          {/* Excesso de policiais (1/12 do efetivo) */}
          <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
            Excesso de policiais
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Distribuição por mês e limite 1/12 do efetivo referentes ao ano {anoFiltroPrevisao}.
          </Typography>
          {loadingExcesso ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Carregando...
            </Typography>
          ) : excessoDados && excessoDados.mesesEmExcesso.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {excessoDados.mesesEmExcesso.map((m) => (
                <Alert
                  key={m.mes}
                  severity="warning"
                  onClick={() => abrirModalExcessoMes(m.mes, m.nome)}
                  sx={{
                    cursor: 'pointer',
                    flex: '1 1 auto',
                    minWidth: 200,
                    '&:hover': { opacity: 0.9 },
                  }}
                >
                  <strong>{m.nome}</strong>: {m.total} policiais com férias programadas (limite 1/12: {excessoDados.limitePorMes})
                </Alert>
              ))}
            </Box>
          ) : excessoDados ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Nenhum mês com excesso. Limite por mês: {excessoDados.limitePorMes} (1/12 do efetivo total de {excessoDados.efetivoTotal}).
            </Typography>
          ) : null}

          <Typography variant="h6" sx={{ mb: 0.5 }}>
            Previsão de férias — exercício {anoFiltroPrevisao}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O seletor de ano cobre do menor ao maior exercício com previsão cadastrada, mais o próximo ano civil para
            planejamento. Na primeira visita, o filtro sugere o exercício mais recente; ao voltar à aba, seu ano
            escolhido é mantido e a lista de anos é atualizada.
            (se houver). O botão + usa o último ano cadastrado para aquele policial para sugerir o exercício anterior.
          </Typography>

          {/* Controles de lista */}
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 2,
              mb: 2,
            }}
          >
            <TextField
              size="small"
              placeholder="Pesquisar por nome ou matrícula"
              value={searchTermPrevisao}
              onChange={(e) => setSearchTermPrevisao(e.target.value.toUpperCase())}
              sx={{ minWidth: 220 }}
            />
            <TextField
              select
              size="small"
              label="Ano da previsão"
              value={String(anoFiltroPrevisao)}
              onChange={(e) => {
                setAnoFiltroPrevisao(Number(e.target.value));
                setPaginaAtualPrevisao(1);
              }}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 130 }}
            >
              {anosSelectFiltroPrevisao.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </TextField>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="previsao-mes-label">Mês</InputLabel>
              <Select
                labelId="previsao-mes-label"
                label="Mês"
                value={mesFiltroPrevisao === '' ? '' : mesFiltroPrevisao}
                onChange={(e) => {
                  const v = String(e.target.value ?? '');
                  setMesFiltroPrevisao(v === '' ? '' : Number(v));
                  setPaginaAtualPrevisao(1);
                }}
              >
                {mesesPrevisao.map((m) => (
                  <MenuItem key={m.valor === '' ? 'todos' : m.valor} value={m.valor === '' ? '' : m.valor}>
                    {m.nome}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Button
              variant="outlined"
              size="medium"
              onClick={() => void carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao)}
              sx={{ ml: 'auto' }}
            >
              Atualizar lista
            </Button>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel id="previsao-itens-label">Itens por página</InputLabel>
              <Select
                labelId="previsao-itens-label"
                label="Itens por página"
                value={itensPorPaginaPrevisao}
                onChange={(e) => {
                  setItensPorPaginaPrevisao(Number(e.target.value));
                  setPaginaAtualPrevisao(1);
                }}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={30}>30</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Contador de Registros */}
          <div style={{ 
            marginBottom: '16px', 
            fontSize: '0.9rem', 
            color: 'var(--text-secondary)',
            padding: '8px 12px',
            backgroundColor: 'rgba(0,0,0,0.15)',
            borderRadius: '6px'
          }}>
            {loadingPrevisao ? (
              'Carregando...'
            ) : (
              <>
                {totalPoliciaisPrevisao === 0 ? (
                  'Nenhum policial encontrado'
                ) : (
                  `Total: ${totalPoliciaisPrevisao} policial(is)`
                )}
              </>
            )}
          </div>

          {/* Tabela de Policiais */}
          {loadingPrevisao ? (
            <p className="empty-state">Carregando policiais...</p>
          ) : policiaisPrevisao.length === 0 ? (
            <p className="empty-state">Nenhum policial encontrado.</p>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Mês Previsto</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {policiaisPrevisao.map((policial) => {
                    const desativado = policial.status === 'DESATIVADO';
                    return (
                    <tr key={policial.id}>
                      <td>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
                              policialInfoModalIdRef.current = policial.id;
                              setPolicialSelecionado(policial);
                              setModalPolicialOpen(true);
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'inherit',
                              cursor: 'pointer',
                              padding: 0,
                              fontSize: 'inherit',
                              fontFamily: 'inherit',
                              textAlign: 'left',
                            }}
                          >
                            {policial.nome}
                          </button>
                        </div>
                      </td>
                      <td>
                        {policial.previsaoFeriasSomenteAno && policial.anoPrevisaoFerias != null ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Exercício {policial.anoPrevisaoFerias}
                            </Typography>
                            <Chip
                              label="Só exercício (mês opcional)"
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.7rem',
                                backgroundColor: 'rgba(107, 155, 196, 0.2)',
                                color: 'var(--text-primary)',
                              }}
                            />
                          </Box>
                        ) : policial.mesPrevisaoFerias ? (
                          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0.5 }}>
                            <span>
                              {new Date(2000, policial.mesPrevisaoFerias - 1).toLocaleDateString('pt-BR', {
                                month: 'long',
                              })}
                              {policial.anoPrevisaoFerias != null && ` de ${policial.anoPrevisaoFerias}`}
                            </span>
                            {policial.feriasReprogramadas && (
                              <>
                                <Chip
                                  label="Reprogramado"
                                  size="small"
                                  sx={{
                                    height: 22,
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    backgroundColor: 'var(--alert-warning-bg)',
                                    color: 'var(--alert-warning-text)',
                                  }}
                                />
                                {policial.mesPrevisaoFeriasOriginal != null && (
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ display: 'block', lineHeight: 1.35, maxWidth: 220 }}
                                  >
                                    Mês original:{' '}
                                    {new Date(2000, policial.mesPrevisaoFeriasOriginal - 1).toLocaleDateString('pt-BR', {
                                      month: 'long',
                                    })}
                                    {(() => {
                                      const a =
                                        policial.anoPrevisaoFeriasOriginal ?? policial.anoPrevisaoFerias;
                                      return a != null ? ` de ${a}` : '';
                                    })()}
                                  </Typography>
                                )}
                              </>
                            )}
                          </Box>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Não definido</span>
                        )}
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Tooltip title={
                            desativado
                              ? 'Policiais desativados não podem ter previsão de férias alterada.'
                              : policial.feriasReprogramadas
                              ? 'Férias já foram reprogramadas'
                              : policial.previsaoFeriasSomenteAno
                                ? 'Ajustar previsão do exercício'
                              : policial.mesPrevisaoFerias
                                ? (policial.feriasConfirmadas ? 'Reprogramar férias' : 'Alterar mês')
                                : 'Inserir mês'
                          }>
                            <span>
                              <IconButton
                                size="small"
                                color={policial.feriasConfirmadas ? 'warning' : 'primary'}
                                onClick={() => {
                                  setPolicialParaMesPrevisao(policial);
                                  setAnoModalPrevisao(
                                    clampAnoListaPrevisao(
                                      policial.anoPrevisaoFerias ?? anoFiltroPrevisao,
                                      anosPrevisaoFeriasOpcoes,
                                      anoFiltroPrevisao,
                                    ),
                                  );
                                  setMesSelecionado(policial.mesPrevisaoFerias ? String(policial.mesPrevisaoFerias) : '');
                                  if (policial.feriasConfirmadas) {
                                    // Se for reprogramação, limpar o campo SEI e abrir a modal
                                    setDocumentoSei('');
                                  }
                                  setModalMesPrevisaoOpen(true);
                                }}
                                disabled={desativado || (policial.feriasReprogramadas && policial.feriasConfirmadas)}
                                sx={{
                                  border: '1px solid',
                                  borderColor: policial.feriasReprogramadas 
                                    ? 'grey.400' 
                                    : policial.feriasConfirmadas 
                                      ? 'warning.main' 
                                      : 'var(--accent-muted)',
                                  '&:hover': {
                                    backgroundColor: policial.feriasReprogramadas 
                                      ? 'transparent' 
                                      : policial.feriasConfirmadas 
                                        ? 'warning.light' 
                                        : 'primary.light',
                                    color: policial.feriasReprogramadas ? 'inherit' : 'white',
                                  },
                                  opacity: policial.feriasReprogramadas ? 0.5 : 1,
                                }}
                              >
                                {policial.feriasConfirmadas ? (
                                  <CalendarTodayIcon fontSize="small" />
                                ) : policial.mesPrevisaoFerias || policial.previsaoFeriasSomenteAno ? (
                                  <EditIcon fontSize="small" />
                                ) : (
                                  <AddCircleOutlineIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          {!desativado && (
                            <Tooltip title="Previsão em outro exercício (anos anteriores, ex.: férias vencidas não usufruídas). Não altera a previsão já confirmada deste ano.">
                              <span>
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  onClick={() => void abrirModalPrevisaoOutroPeriodo(policial)}
                                  sx={{
                                    border: '1px solid',
                                    borderColor: 'secondary.main',
                                  }}
                                >
                                  <AddIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                          {policial.mesPrevisaoFerias &&
                            !policial.previsaoFeriasSomenteAno &&
                            !policial.feriasConfirmadas &&
                            !desativado && (
                            <Tooltip title="Confirmar férias">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => {
                                  const meses = [
                                    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                                    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
                                  ];
                                  const mesNome = meses[policial.mesPrevisaoFerias! - 1];
                                  
                                  openConfirm({
                                    title: 'Confirmar férias',
                                    message: `Deseja confirmar as férias de ${policial.nome} para o mês de ${mesNome}?`,
                                    confirmLabel: 'Confirmar',
                                    onConfirm: async () => {
                                      try {
                                        setError(null);
                                        const atualizado = await api.updatePolicial(policial.id, {
                                          feriasConfirmadas: true,
                                          anoPrevisaoFerias:
                                            policial.anoPrevisaoFerias ?? anoFiltroPrevisao,
                                        });
                                        aplicarPolicialAtualizadoNoEstadoCadastro(atualizado);
                                        setSuccess('Férias confirmadas com sucesso.');
                                        await carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao);
                                        onChanged?.();
                                      } catch (err) {
                                        setError(
                                          err instanceof Error
                                            ? err.message
                                            : 'Não foi possível confirmar as férias.',
                                        );
                                      }
                                    },
                                  });
                                }}
                                sx={{
                                  border: '1px solid',
                                  borderColor: 'success.main',
                                  '&:hover': {
                                    backgroundColor: 'success.light',
                                    color: 'white',
                                  },
                                }}
                              >
                                <CheckCircleIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>

              {/* Controles de Paginação */}
              {totalPaginasPrevisao > 1 && (() => {
                const registroInicio = totalPoliciaisPrevisao === 0 ? 0 : ((paginaAtualPrevisao - 1) * itensPorPaginaPrevisao) + 1;
                const registroFim = totalPoliciaisPrevisao === 0 ? 0 : Math.min(paginaAtualPrevisao * itensPorPaginaPrevisao, totalPoliciaisPrevisao);
                
                return (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginTop: '16px',
                    padding: '12px',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft)'
                  }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      Mostrando {registroInicio} a {registroFim} de {totalPoliciaisPrevisao} registro(s)
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPaginaAtualPrevisao(1)}
                        disabled={paginaAtualPrevisao === 1}
                        style={{ padding: '6px 12px' }}
                      >
                        ««
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPaginaAtualPrevisao((prev) => Math.max(1, prev - 1))}
                        disabled={paginaAtualPrevisao === 1}
                        style={{ padding: '6px 12px' }}
                      >
                        ‹ Anterior
                      </button>
                      <span style={{ padding: '0 12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        Página {paginaAtualPrevisao} de {totalPaginasPrevisao}
                      </span>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPaginaAtualPrevisao((prev) => Math.min(totalPaginasPrevisao, prev + 1))}
                        disabled={paginaAtualPrevisao === totalPaginasPrevisao}
                        style={{ padding: '6px 12px' }}
                      >
                        Próxima ›
                      </button>
                      <button
                        type="button"
                        className="ghost"
                        onClick={() => setPaginaAtualPrevisao(totalPaginasPrevisao)}
                        disabled={paginaAtualPrevisao === totalPaginasPrevisao}
                        style={{ padding: '6px 12px' }}
                      >
                        »»
                      </button>
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          {/* Modal: lista de policiais do mês em excesso */}
          <Dialog
            open={modalExcessoMesOpen}
            onClose={() => setModalExcessoMesOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>
              Policiais com férias programadas em {excessoMesSelecionado?.nome ?? ''}
            </DialogTitle>
            <DialogContent>
              {loadingPoliciaisExcesso ? (
                <Typography variant="body2" color="text.secondary">
                  Carregando...
                </Typography>
              ) : policiaisExcessoMes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhum policial encontrado.
                </Typography>
              ) : (
                <List dense>
                  {policiaisExcessoMes.map((p) => (
                    <ListItem key={p.id}>
                      <ListItemText
                        primary={(p.nome ?? '').toUpperCase()}
                        secondary={formatMatricula(p.matricula)}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setModalExcessoMesOpen(false)} variant="outlined">
                Fechar
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* Modal de Conflitos de Afastamento */}
      {conflitosModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '1000px' }}>
            <h3>Conflito de Afastamentos</h3>
            <p>
              Existem {conflitosModal.conflitos.length} policial(is) já afastado(s) no período selecionado:
            </p>
            <div style={{ margin: '8px 0 16px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: '6px', color: 'var(--text-secondary)' }}>
              <strong>Período do novo afastamento:</strong>
              <div style={{ marginTop: '4px' }}>
                {formatPeriodo(form.dataInicio, form.dataFim || null)}
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto', marginBottom: '16px' }}>
              <table className="table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>Policial</th>
                    <th>Função</th>
                    <th>Equipe</th>
                    <th>Motivo</th>
                    <th>SEI nº</th>
                    <th>Período</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitosModal.conflitos.map((afastamento) => (
                    <tr key={afastamento.id}>
                      <td>
                        <div>{afastamento.policial.nome}</div>
                        <small>{formatMatricula(afastamento.policial.matricula)}</small>
                      </td>
                      <td>
                        {afastamento.policial.funcao?.nome || '-'}
                      </td>
                      <td>
                        {(() => {
                          const equipeLabel = formatEquipeLabel(afastamento.policial.equipe);
                          return equipeLabel === '—'
                            ? '—'
                            : `${equipeLabel} (${afastamento.policial.equipe})`;
                        })()}
                      </td>
                      <td>
                        <div>{formatNome(afastamento.motivo.nome)}</div>
                        {afastamento.descricao && (
                          <small>{afastamento.descricao}</small>
                        )}
                      </td>
                      <td>{afastamento.seiNumero}</td>
                      <td>
                        {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                      </td>
                      <td>
                        <span className="badge">
                          {STATUS_LABEL[afastamento.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Deseja cadastrar o afastamento mesmo assim?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelarConflito}
                disabled={submitting}
              >
                Não
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmarConflito}
                disabled={submitting}
              >
                {submitting ? 'Salvando...' : 'Sim'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de choque entre afastamento e troca de serviço */}
      <Dialog open={trocaConflitoModal.open} onClose={handleCancelarTrocaConflito} maxWidth="sm" fullWidth>
        <DialogTitle>Conflito de troca de serviço</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            O policial <strong>"{trocaConflitoModal.policialNome}"</strong> está com uma troca de serviço cadastrada na
            data <strong>"{trocaConflitoModal.dataServico ? formatDate(trocaConflitoModal.dataServico) : ''}"</strong>.
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Período do afastamento: <strong>{formatPeriodo(form.dataInicio, trocaConflitoDataFimParaValidacao || null)}</strong>
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <Checkbox
              checked={trocaConflitoCiente}
              onChange={(e) => setTrocaConflitoCiente(e.target.checked)}
              size="small"
            />
            <Typography variant="body2">Ciente</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={handleCancelarTrocaConflito}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={handleOkTrocaConflito} disabled={!trocaConflitoCiente || submitting}>
            OK
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={periodoMismoPolicialModal.open}
        onClose={() => setPeriodoMismoPolicialModal({ open: false, message: '' })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Conflito de período</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
            {periodoMismoPolicialModal.message}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Ajuste as datas, exclua o registro incorreto no sistema ou corrija o existente antes de tentar novamente.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setPeriodoMismoPolicialModal({ open: false, message: '' })}>
            Entendi
          </Button>
        </DialogActions>
      </Dialog>

      {/* Teste de leitura do PDF (sem persistência) */}
      <Dialog
        open={pdfImportModalOpen}
        onClose={() => {
          setPdfImportModalOpen(false);
          setPdfImportErro(null);
          setPdfPreviewCompleto([]);
          setPdfNomeArquivo(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>Teste de leitura do PDF</DialogTitle>
        <DialogContent>
          {pdfNomeArquivo ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Arquivo: <strong>{pdfNomeArquivo}</strong>
            </Typography>
          ) : null}
          {pdfImportErro && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {pdfImportErro}
            </Alert>
          )}
          {!motivoDispensaMedica && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Não foi encontrado o motivo &quot;Dispensa médica&quot; na lista de motivos. Cadastre-o para validar o
              mapeamento no próximo passo.
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={pdfLeituraFiltro}
              onChange={(_, v: 'atestado' | 'todas' | null) => {
                if (v) setPdfLeituraFiltro(v);
              }}
              sx={{
                '& .MuiToggleButtonGroup-grouped': {
                  border: `1px solid ${theme.borderSoft}`,
                  '&:not(:first-of-type)': {
                    borderLeft: `1px solid ${theme.borderSoft}`,
                  },
                },
                '& .MuiToggleButton-root': {
                  py: 0.75,
                  px: 1.25,
                  textTransform: 'none',
                  color: theme.textPrimary,
                  bgcolor: theme.cardBg,
                  '&:hover': {
                    bgcolor: theme.bgMain,
                    color: theme.textPrimary,
                  },
                  '&.Mui-selected': {
                    color: theme.textPrimary,
                    bgcolor: theme.sentinelaBlue,
                    borderColor: `${theme.accentMuted} !important`,
                    '&:hover': {
                      bgcolor: theme.sentinelaNavy,
                      color: theme.textPrimary,
                    },
                  },
                },
              }}
            >
              <ToggleButton value="atestado">Só &quot;Atestado&quot; (dispensa médica)</ToggleButton>
              <ToggleButton value="todas">Todas as linhas interpretadas</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Linhas brutas extraídas da tabela: <strong>{pdfLinhasBrutasTotal}</strong>. Registros interpretados:{' '}
            <strong>{pdfLeituraResumo.totalInterpretadas}</strong>. Com OBS &quot;Atestado&quot;:{' '}
            <strong>{pdfLeituraResumo.comObsAtestado}</strong>. Correspondência (todas):{' '}
            <Chip size="small" component="span" label={`OK ${pdfLeituraResumo.ok}`} color="success" sx={{ ml: 0.5 }} />{' '}
            <Chip size="small" component="span" label={`Aviso ${pdfLeituraResumo.aviso}`} color="warning" />{' '}
            <Chip size="small" component="span" label={`Erro ${pdfLeituraResumo.erro}`} color="error" />
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
            Exibindo <strong>{pdfLinhasExibidas.length}</strong> linha(s){' '}
            {pdfLeituraFiltro === 'atestado' ? '(filtro Atestado)' : '(sem filtro de OBS)'}. O policial do
            cadastro é identificado <strong>somente pela MAT (PDF)</strong> (igualdade exata dos dígitos).
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Linha</TableCell>
                  <TableCell>MAT (PDF)</TableCell>
                  <TableCell>Início</TableCell>
                  <TableCell>Término</TableCell>
                  <TableCell>SEI</TableCell>
                  <TableCell>OBS</TableCell>
                  <TableCell>Motivo mapeado</TableCell>
                  <TableCell>Policial (sistema)</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pdfLinhasExibidas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant="body2" color="text.secondary">
                        {pdfLeituraFiltro === 'atestado'
                          ? 'Nenhuma linha com "Atestado" na OBS neste filtro. Troque para "Todas as linhas interpretadas" ou verifique o PDF e o trecho de texto abaixo.'
                          : 'Nenhum registro foi interpretado a partir do PDF. Verifique o arquivo ou o trecho de texto abaixo.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pdfLinhasExibidas.map((row, idx) => (
                    <TableRow key={`pdf-prev-${idx}-${row.linhaTexto}`} hover>
                      <TableCell>{row.linhaTexto}</TableCell>
                      <TableCell>{row.matriculaPdf ?? '—'}</TableCell>
                      <TableCell>{row.dataInicioIso ? formatDate(row.dataInicioIso) : '—'}</TableCell>
                      <TableCell>{row.dataFimIso ? formatDate(row.dataFimIso) : '—'}</TableCell>
                      <TableCell>{row.seiNumero || '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }} title={row.obsOriginal}>
                        {row.obsOriginal}
                      </TableCell>
                      <TableCell>{row.filtroAtestado ? row.motivoMapeadoNome : '—'}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }}>
                        {row.policialNome ? `${row.policialNome} (id ${row.policialId})` : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status === 'ok' ? 'OK' : row.status === 'aviso' ? 'Aviso' : 'Erro'}
                          color={row.status === 'ok' ? 'success' : row.status === 'aviso' ? 'warning' : 'error'}
                        />
                        {row.mensagem ? (
                          <Typography variant="caption" display="block" color="text.secondary">
                            {row.mensagem}
                          </Typography>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {pdfTextoAmostra ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Trecho do texto extraído do PDF (para conferência)
              </Typography>
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  display: 'block',
                  p: 1.5,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 240,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                }}
              >
                {pdfTextoAmostra}
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => {
              setPdfImportModalOpen(false);
              setPdfImportErro(null);
              setPdfPreviewCompleto([]);
              setPdfNomeArquivo(null);
            }}
            sx={{
              borderColor: theme.borderSoft,
              color: theme.textPrimary,
              '&:hover': {
                borderColor: theme.accentMuted,
                bgcolor: 'rgba(107, 155, 196, 0.12)',
                color: theme.textPrimary,
              },
            }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal com informações do policial */}
      <Dialog
        open={modalPolicialOpen}
        onClose={() => {
          policialInfoModalIdRef.current = null;
          setModalPolicialOpen(false);
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
            color: 'white',
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <PersonIcon sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Informações do Policial
              </Typography>
            </Box>
            <IconButton
              onClick={() => {
                policialInfoModalIdRef.current = null;
                setModalPolicialOpen(false);
              }}
              size="small"
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {policialSelecionado && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <PersonIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Nome
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 500, color: 'var(--text-primary)', ml: 4.5 }}>
                  {policialSelecionado.nome}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <BadgeIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Matrícula
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-primary)', ml: 4.5, fontSize: '1.1rem' }}>
                  {formatMatricula(policialSelecionado.matricula)}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <BadgeIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Status
                  </Typography>
                </Box>
                <Box sx={{ ml: 4.5 }}>
                  <Chip
                    label={POLICIAL_STATUS_OPTIONS.find(
                      (option) => option.value === policialSelecionado.status,
                    )?.label ?? policialSelecionado.status}
                    sx={{
                      fontWeight: 500,
                      backgroundColor: 'var(--alert-info-bg)',
                      color: 'var(--alert-info-text)',
                    }}
                  />
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <GroupsIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Equipe
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-primary)', ml: 4.5, fontSize: '1.1rem' }}>
                  {formatEquipeLabel(policialSelecionado.equipe)}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <WorkIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Função
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-primary)', ml: 4.5, fontSize: '1.1rem' }}>
                  {policialSelecionado.funcao?.nome || '-'}
                </Typography>
              </Paper>

              {/* Informações de Férias */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: 'rgba(0,0,0,0.15)',
                  borderRadius: 2,
                  border: '1px solid var(--border-soft)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <CalendarTodayIcon sx={{ color: 'var(--accent-muted)', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Previsão de Férias
                  </Typography>
                </Box>
                <Box sx={{ ml: 4.5 }}>
                  {policialModalDetalheLoading ? (
                    <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                      Carregando previsões…
                    </Typography>
                  ) : policialSelecionado.previsoesFeriasPorExercicio &&
                    policialSelecionado.previsoesFeriasPorExercicio.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {policialSelecionado.previsoesFeriasPorExercicio.map((prev) => (
                        <Box
                          key={prev.ano}
                          sx={{
                            pl: 1.5,
                            borderLeft: '3px solid var(--accent-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 1,
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 1,
                              flexWrap: 'wrap',
                            }}
                          >
                            <Typography variant="caption" sx={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                              Exercício {prev.ano}
                            </Typography>
                            {canEdit(permissoes, 'afastamentos') && prev.ano < anoCivilAtual ? (
                              prev.podeExcluirPrevisaoAnterior === false ? (
                                <Tooltip title="Não é possível excluir: já existe afastamento de férias ativo para este exercício.">
                                  <span>
                                    <IconButton size="small" disabled aria-label="Excluir previsão indisponível">
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              ) : (
                                <Tooltip title="Excluir previsão deste exercício (só períodos anteriores ao ano civil, sem gozo cadastrado)">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    aria-label={`Excluir previsão do exercício ${prev.ano}`}
                                    onClick={() => {
                                      const pid = policialSelecionado.id;
                                      openConfirm({
                                        title: 'Excluir previsão de férias',
                                        message: `Remover a previsão do exercício de ${prev.ano}?\n\nSó é permitido para exercícios anteriores ao ano civil e quando não houver afastamento de férias ativo vinculado a essa cota.`,
                                        confirmLabel: 'Excluir',
                                        onConfirm: async () => {
                                          try {
                                            setError(null);
                                            const atualizado = await api.deletePrevisaoFeriasExercicio(pid, prev.ano);
                                            setPolicialSelecionado(atualizado);
                                            aplicarPolicialAtualizadoNoEstadoCadastro(atualizado);
                                            await carregarPoliciaisPrevisao(
                                              paginaAtualPrevisao,
                                              itensPorPaginaPrevisao,
                                            );
                                            setSuccess(`Previsão do exercício ${prev.ano} removida.`);
                                            onChanged?.();
                                          } catch (err) {
                                            setError(
                                              err instanceof Error
                                                ? err.message
                                                : 'Não foi possível excluir a previsão.',
                                            );
                                          }
                                        },
                                      });
                                    }}
                                  >
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )
                            ) : null}
                          </Box>
                          {prev.semMesDefinido ? (
                            <>
                              <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1.05rem' }}>
                                Previsão só com o ano (sem mês)
                              </Typography>
                              <Chip
                                label="Período de gozo no cadastro de férias"
                                size="small"
                                sx={{ width: 'fit-content', backgroundColor: 'rgba(107, 155, 196, 0.2)' }}
                              />
                            </>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box>
                                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.25, fontSize: '0.75rem', fontWeight: 600 }}>
                                  {prev.reprogramada ? 'Mês atual (reprogramado)' : 'Mês previsto'}
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '1.05rem' }}>
                                  {prev.mes != null
                                    ? `${new Date(2000, prev.mes - 1).toLocaleDateString('pt-BR', { month: 'long' })} de ${prev.ano}`
                                    : '—'}
                                </Typography>
                              </Box>
                              {prev.reprogramada && prev.mesOriginal != null && (
                                <Box>
                                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.25, fontSize: '0.75rem', fontWeight: 600 }}>
                                    Mês original
                                  </Typography>
                                  <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--alert-warning-text)', fontSize: '1.05rem' }}>
                                    {new Date(2000, prev.mesOriginal - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                                    {prev.anoOriginal != null ? ` de ${prev.anoOriginal}` : ''}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {prev.confirmada && (
                              <Chip
                                label="Férias confirmadas"
                                size="small"
                                sx={{
                                  fontWeight: 500,
                                  backgroundColor: 'var(--alert-success-bg)',
                                  color: 'var(--alert-success-text)',
                                  width: 'fit-content',
                                }}
                                icon={<CheckCircleIcon sx={{ fontSize: 16, color: 'var(--alert-success-text)' }} />}
                              />
                            )}
                            {prev.reprogramada && (
                              <Chip
                                label="Férias reprogramadas"
                                size="small"
                                sx={{
                                  fontWeight: 500,
                                  backgroundColor: 'var(--alert-warning-bg)',
                                  color: 'var(--alert-warning-text)',
                                  width: 'fit-content',
                                }}
                                icon={<CalendarTodayIcon sx={{ fontSize: 16, color: 'var(--alert-warning-text)' }} />}
                              />
                            )}
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  ) : policialSelecionado.previsoesFeriasPorExercicio &&
                    policialSelecionado.previsoesFeriasPorExercicio.length === 0 ? (
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '1.1rem' }}>
                      Não definido
                    </Typography>
                  ) : policialSelecionado.previsaoFeriasSomenteAno && policialSelecionado.anoPrevisaoFerias != null ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                        Exercício (mês a definir)
                      </Typography>
                      <Typography variant="body1" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                        {policialSelecionado.anoPrevisaoFerias}
                      </Typography>
                      <Chip
                        label="Só exercício na previsão — no gozo informe início e fim"
                        size="small"
                        sx={{ width: 'fit-content', backgroundColor: 'rgba(107, 155, 196, 0.2)' }}
                      />
                    </Box>
                  ) : policialSelecionado.mesPrevisaoFerias ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          {policialSelecionado.feriasReprogramadas ? 'Mês Atual (Reprogramado)' : 'Mês Previsto'}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '1.1rem' }}>
                          {new Date(2000, policialSelecionado.mesPrevisaoFerias - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                          {policialSelecionado.anoPrevisaoFerias && ` de ${policialSelecionado.anoPrevisaoFerias}`}
                        </Typography>
                      </Box>
                      {policialSelecionado.feriasReprogramadas && policialSelecionado.mesPrevisaoFeriasOriginal && (
                        <Box>
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                            Mês Original (Antes da Reprogramação)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--alert-warning-text)', fontSize: '1.1rem' }}>
                            {new Date(2000, policialSelecionado.mesPrevisaoFeriasOriginal - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                            {policialSelecionado.anoPrevisaoFeriasOriginal && ` de ${policialSelecionado.anoPrevisaoFeriasOriginal}`}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                        {policialSelecionado.feriasConfirmadas && (
                          <Chip
                            label="Férias Confirmadas"
                            size="small"
                            sx={{
                              fontWeight: 500,
                              backgroundColor: 'var(--alert-success-bg)',
                              color: 'var(--alert-success-text)',
                              width: 'fit-content',
                            }}
                            icon={<CheckCircleIcon sx={{ fontSize: 16, color: 'var(--alert-success-text)' }} />}
                          />
                        )}
                        {policialSelecionado.feriasReprogramadas && (
                          <Chip
                            label="Férias Reprogramadas"
                            size="small"
                            sx={{
                              fontWeight: 500,
                              backgroundColor: 'var(--alert-warning-bg)',
                              color: 'var(--alert-warning-text)',
                              width: 'fit-content',
                            }}
                            icon={<CalendarTodayIcon sx={{ fontSize: 16, color: 'var(--alert-warning-text)' }} />}
                          />
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body1" sx={{ fontWeight: 500, color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '1.1rem' }}>
                      Não definido
                    </Typography>
                  )}
                  {policialSelecionado.status !== 'DESATIVADO' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        const p = policialSelecionado;
                        setModalPolicialOpen(false);
                        void abrirModalPrevisaoOutroPeriodo(p);
                      }}
                      sx={{ mt: 2, textTransform: 'none', alignSelf: 'flex-start' }}
                    >
                      {policialSelecionado.feriasConfirmadas
                        ? 'Previsão em outro exercício (ex.: férias vencidas)'
                        : 'Adicionar outro período (outro ano)'}
                    </Button>
                  )}
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-soft)' }}>
          <Button
            onClick={() => {
              policialInfoModalIdRef.current = null;
              setModalPolicialOpen(false);
            }}
            variant="contained"
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              px: 3,
              py: 1,
              background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, var(--accent-muted) 0%, var(--sentinela-blue) 100%)`,
              },
            }}
          >
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal Editar afastamento */}
      <Dialog
        open={editAfastamentoModal.open}
        onClose={handleCloseEditAfastamentoModal}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
            color: 'white',
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Editar afastamento
            </Typography>
            <IconButton
              onClick={handleCloseEditAfastamentoModal}
              size="small"
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {editAfastamentoModal.afastamento && (
            <form onSubmit={handleSubmitEditAfastamento}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: 'var(--text-secondary)', fontWeight: 600 }}>
                    Policial
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {editAfastamentoModal.afastamento.policial.nome} - {formatMatricula(editAfastamentoModal.afastamento.policial.matricula)}
                  </Typography>
                </Box>

                {editAfastamentoModal.error && (
                  <Box
                    sx={{
                      p: 1.5,
                      backgroundColor: 'var(--alert-error-bg)',
                      borderRadius: 1,
                      border: '1px solid rgba(214,69,69,0.4)',
                      color: 'var(--error)',
                      fontSize: '0.875rem',
                    }}
                  >
                    {editAfastamentoModal.error}
                  </Box>
                )}

                <TextField
                  select
                  label="Motivo *"
                  value={editAfastamentoModal.motivoId || ''}
                  onChange={(e) => {
                    const newId = Number(e.target.value);
                    const nomeMot = motivos.find((m) => m.id === newId)?.nome;
                    setEditAfastamentoModal((prev) => ({
                      ...prev,
                      motivoId: newId,
                      anoExercicioFerias: nomeMot === 'Férias' ? prev.anoExercicioFerias : '',
                      error: null,
                    }));
                  }}
                  fullWidth
                  required
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  disabled={editAfastamentoModal.loading}
                  sx={{ '& .MuiSelect-select': { padding: '14px 14px' } }}
                >
                  <option value="" disabled>Selecione o motivo</option>
                  {motivosOrdenados.map((motivo) => (
                    <option key={motivo.id} value={motivo.id}>
                      {formatNome(motivo.nome)}
                    </option>
                  ))}
                </TextField>

                {motivos.find((m) => m.id === editAfastamentoModal.motivoId)?.nome === 'Férias' && (
                  <TextField
                    select
                    label="Exercício"
                    value={editAfastamentoModal.anoExercicioFerias}
                    onChange={(e) =>
                      setEditAfastamentoModal((prev) => ({
                        ...prev,
                        anoExercicioFerias: e.target.value,
                        error: null,
                      }))
                    }
                    fullWidth
                    helperText="Até 6 anos (atual até atual−5), mín. 2021. Padrão: mesmo ano do gozo. Acúmulo: previsão naquele exercício."
                    SelectProps={{ native: true }}
                    InputLabelProps={{ shrink: true }}
                    disabled={editAfastamentoModal.loading}
                    sx={{ '& .MuiSelect-select': { padding: '14px 14px' } }}
                  >
                    <option value="">Mesmo ano do gozo (padrão)</option>
                    {anosExercicioFeriasOpcoes.map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                      </option>
                    ))}
                  </TextField>
                )}

                <TextField
                  label="SEI nº *"
                  value={editAfastamentoModal.seiNumero}
                  onChange={(e) =>
                    setEditAfastamentoModal((prev) => ({
                      ...prev,
                      seiNumero: e.target.value.replace(/\D/g, ''),
                      error: null,
                    }))
                  }
                  fullWidth
                  required
                  inputProps={{ maxLength: 20, inputMode: 'numeric', pattern: '[0-9]*' }}
                  disabled={editAfastamentoModal.loading}
                />

                <TextField
                  label="Descrição"
                  value={editAfastamentoModal.descricao}
                  onChange={(e) =>
                    setEditAfastamentoModal((prev) => ({
                      ...prev,
                      descricao: e.target.value,
                      error: null,
                    }))
                  }
                  fullWidth
                  multiline
                  rows={2}
                  disabled={editAfastamentoModal.loading}
                />

                <TextField
                  label="Data de início *"
                  type="date"
                  value={editAfastamentoModal.dataInicio}
                  onChange={(e) =>
                    setEditAfastamentoModal((prev) => ({
                      ...prev,
                      dataInicio: e.target.value,
                      error: null,
                    }))
                  }
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  disabled={editAfastamentoModal.loading}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Checkbox
                    checked={editAfastamentoModal.calcularPeriodo}
                    onChange={(e) =>
                      setEditAfastamentoModal((prev) => ({
                        ...prev,
                        calcularPeriodo: e.target.checked,
                        quantidadeDias: e.target.checked ? prev.quantidadeDias : '',
                        error: null,
                      }))
                    }
                    size="small"
                    disabled={editAfastamentoModal.loading}
                  />
                  <Typography variant="body2" sx={{ fontSize: '0.95rem' }}>
                    Calcular período
                  </Typography>
                </Box>

                {editAfastamentoModal.calcularPeriodo ? (
                  <>
                    <TextField
                      label="Quantidade de dias"
                      type="number"
                      inputProps={{ min: 1, inputMode: 'numeric', pattern: '[0-9]*' }}
                      value={editAfastamentoModal.quantidadeDias}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '');
                        setEditAfastamentoModal((prev) => ({
                          ...prev,
                          quantidadeDias: value,
                          error: null,
                        }));
                      }}
                      fullWidth
                      placeholder="Digite o número de dias"
                      disabled={editAfastamentoModal.loading}
                    />
                    {dataTerminoCalculadaEdit && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', fontStyle: 'italic' }}>
                        Data de término: {new Date(dataTerminoCalculadaEdit + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </Typography>
                    )}
                  </>
                ) : (
                  <TextField
                    label="Data de término"
                    type="date"
                    value={editAfastamentoModal.dataFim}
                    onChange={(e) =>
                      setEditAfastamentoModal((prev) => ({
                        ...prev,
                        dataFim: e.target.value,
                        error: null,
                      }))
                    }
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: editAfastamentoModal.dataInicio || undefined }}
                    disabled={editAfastamentoModal.loading}
                  />
                )}
              </Box>
              <DialogActions sx={{ px: 0, pt: 2, pb: 0 }}>
                <Button
                  onClick={handleCloseEditAfastamentoModal}
                  disabled={editAfastamentoModal.loading}
                  color="inherit"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={editAfastamentoModal.loading}
                >
                  {editAfastamentoModal.loading ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogActions>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal para inserir/alterar mês previsto de férias */}
      <Dialog
        open={modalMesPrevisaoOpen}
        onClose={() => setModalMesPrevisaoOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
            color: 'white',
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {policialParaMesPrevisao
                ? emModoReprogramacaoPrevisaoModal
                  ? 'Reprogramar Férias'
                  : anoModalPrevisao < anoCivilAtual
                    ? 'Previsão de férias (exercício anterior)'
                    : policialParaMesPrevisao.mesPrevisaoFerias != null &&
                        anoModalPrevisao === exercicioListaNaPrevisaoModal
                      ? 'Alterar Mês Previsto de Férias'
                      : 'Inserir Mês Previsto de Férias'
                : ''}
            </Typography>
            <IconButton
              onClick={() => {
                setModalMesPrevisaoOpen(false);
                setDocumentoSei('');
              }}
              size="small"
              sx={{
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 3 }}>
          {policialParaMesPrevisao && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'var(--text-secondary)', fontWeight: 600 }}>
                  Policial
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {policialParaMesPrevisao.nome} - {formatMatricula(policialParaMesPrevisao.matricula)}
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
                  Exercício da previsão
                </Typography>
                {emModoReprogramacaoPrevisaoModal ? (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {policialParaMesPrevisao.anoPrevisaoFerias ?? anoFiltroPrevisao}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, fontWeight: 400 }}>
                        (reprogramação só neste exercício)
                      </Typography>
                    </Typography>
                    {(() => {
                      const anos = anosPrevisaoFeriasOpcoes;
                      const ex = policialParaMesPrevisao.anoPrevisaoFerias ?? anoFiltroPrevisao;
                      const clamped = clampAnoListaPrevisao(ex, anos, anoFiltroPrevisao);
                      const temExercicioAnterior = anos.some((y) => y < clamped);
                      if (!temExercicioAnterior) return null;
                      return (
                        <>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => {
                              const idx = anos.indexOf(clamped);
                              const porLista =
                                idx >= 0 && idx < anos.length - 1 ? anos[idx + 1]! : anos.find((y) => y < clamped);
                              const novoAno = porLista ?? clamped;
                              setAnoModalPrevisao(novoAno);
                              setMesSelecionado('');
                              setDocumentoSei('');
                            }}
                            sx={{ mt: 1.5, textTransform: 'none', alignSelf: 'flex-start' }}
                          >
                            Cadastrar previsão em outro exercício (férias vencidas)
                          </Button>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, maxWidth: 420 }}>
                            Para direitos de exercícios anteriores ainda não usufruídos, registre a previsão nesse ano antes de
                            marcar o gozo em férias. Esta ação não substitui a reprogramação acima.
                          </Typography>
                        </>
                      );
                    })()}
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 1, mb: 2 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Ano do exercício *"
                      value={String(anoModalPrevisao)}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setAnoModalPrevisao(v);
                        if (!emModoReprogramacaoPrevisaoModal && v < anoCivilAtual) {
                          setMesSelecionado('');
                        }
                      }}
                      SelectProps={{ native: true }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ flex: '1 1 200px', minWidth: 160, maxWidth: 280 }}
                    >
                      {anosPrevisaoFeriasOpcoes.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </TextField>
                    <Tooltip title="Adicionar outro período: pula para o exercício anterior (mais antigo) e limpa o mês para você escolher">
                      <span>
                        <IconButton
                          color="primary"
                          onClick={() => {
                            const anos = anosPrevisaoFeriasOpcoes;
                            const anterior = exercicioAnteriorNaLista(anos, anoModalPrevisao);
                            if (anterior !== anoModalPrevisao) {
                              setAnoModalPrevisao(anterior);
                              setMesSelecionado('');
                            }
                          }}
                          disabled={(() => {
                            const i = anosPrevisaoFeriasOpcoes.indexOf(anoModalPrevisao);
                            return i < 0 || i >= anosPrevisaoFeriasOpcoes.length - 1;
                          })()}
                          sx={{ border: '1px solid', borderColor: 'primary.main', mt: 0.25 }}
                          aria-label="Adicionar previsão em outro exercício"
                        >
                          <AddIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mt: -0.5 }}>
                      Escolha o ano ou use + para o exercício imediatamente anterior (útil para férias vencidas). O filtro da aba
                      não muda até você salvar com outro ano.
                    </Typography>
                  </Box>
                )}
                {emModoReprogramacaoPrevisaoModal || anoModalPrevisao >= anoCivilAtual ? (
                  <Box>
                    <TextField
                      select
                      label="Mês *"
                      value={mesSelecionado || ''}
                      onChange={(e) => setMesSelecionado(e.target.value)}
                      fullWidth
                      required
                      SelectProps={{
                        native: true,
                      }}
                      InputLabelProps={{
                        shrink: true,
                      }}
                      sx={{
                        '& .MuiSelect-select': {
                          padding: '14px 14px',
                        },
                      }}
                    >
                      <option value="">Selecione o mês</option>
                      {[
                        { value: '1', label: 'Janeiro' },
                        { value: '2', label: 'Fevereiro' },
                        { value: '3', label: 'Março' },
                        { value: '4', label: 'Abril' },
                        { value: '5', label: 'Maio' },
                        { value: '6', label: 'Junho' },
                        { value: '7', label: 'Julho' },
                        { value: '8', label: 'Agosto' },
                        { value: '9', label: 'Setembro' },
                        { value: '10', label: 'Outubro' },
                        { value: '11', label: 'Novembro' },
                        { value: '12', label: 'Dezembro' },
                      ].map((mes) => (
                        <option key={mes.value} value={mes.value}>
                          {mes.label}
                        </option>
                      ))}
                    </TextField>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                    Para exercícios anteriores ao ano civil não há mês de previsão: registre apenas o ano do exercício.
                    As datas de início e fim do gozo são informadas no cadastro de afastamento (Férias).
                  </Typography>
                )}
                {/* Campo Documento SEI obrigatório apenas para reprogramação do mesmo exercício confirmado */}
                {emModoReprogramacaoPrevisaoModal && (
                  <Box sx={{ mt: 2 }}>
                    <TextField
                      label="Documento SEI *"
                      type="number"
                      value={documentoSei}
                      onChange={(e) => setDocumentoSei(e.target.value)}
                      fullWidth
                      required
                      placeholder="Digite o número do documento SEI"
                      InputLabelProps={{
                        shrink: true,
                      }}
                      sx={{
                        '& .MuiInputBase-input': {
                          padding: '14px 14px',
                        },
                      }}
                    />
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid var(--border-soft)' }}>
          <Button
            onClick={() => {
              setModalMesPrevisaoOpen(false);
              setDocumentoSei('');
            }}
            variant="outlined"
            sx={{ textTransform: 'none' }}
            disabled={salvandoMesPrevisao}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (!policialParaMesPrevisao) {
                return;
              }

              if (policialParaMesPrevisao.status === 'DESATIVADO') {
                setError('Policiais desativados não podem ter previsão de férias alterada.');
                return;
              }

              // Validação do campo SEI para reprogramação (mesmo exercício já confirmado)
              if (emModoReprogramacaoPrevisaoModal && !documentoSei.trim()) {
                setError('Por favor, informe o Documento SEI.');
                return;
              }

              const anoExercicioPrevisao = emModoReprogramacaoPrevisaoModal
                ? (policialParaMesPrevisao.anoPrevisaoFerias ?? anoFiltroPrevisao)
                : anoModalPrevisao;

              const gravaSomenteAnoExercicioAnterior =
                !emModoReprogramacaoPrevisaoModal && anoExercicioPrevisao < anoCivilAtual;

              if (!mesSelecionado && !gravaSomenteAnoExercicioAnterior) {
                setError('Por favor, selecione o mês.');
                return;
              }

              const meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
              ];
              const mesNome = mesSelecionado ? meses[parseInt(mesSelecionado, 10) - 1] : null;

              const isReprogramacao = emModoReprogramacaoPrevisaoModal;
              const mensagemConfirmacao = isReprogramacao
                ? `Deseja reprogramar as férias de ${policialParaMesPrevisao.nome} (${policialParaMesPrevisao.matricula})?\n\nMês: ${mesNome} de ${anoExercicioPrevisao}\nDocumento SEI: ${documentoSei}`
                : gravaSomenteAnoExercicioAnterior
                  ? `Registrar previsão do exercício ${anoExercicioPrevisao} (sem mês de previsão) para ${policialParaMesPrevisao.nome} (${policialParaMesPrevisao.matricula})?\n\nO período de gozo será informado com data de início e fim no cadastro de férias.`
                  : `Deseja definir o mês previsto de férias para ${policialParaMesPrevisao.nome} (${policialParaMesPrevisao.matricula})?\n\nMês: ${mesNome} de ${anoExercicioPrevisao}`;

              openConfirm({
                title: isReprogramacao
                  ? 'Confirmar reprogramação de férias'
                  : gravaSomenteAnoExercicioAnterior
                    ? 'Confirmar previsão do exercício'
                    : 'Confirmar mês previsto de férias',
                message: mensagemConfirmacao,
                confirmLabel: 'Confirmar',
                onConfirm: async () => {
                  try {
                    setSalvandoMesPrevisao(true);
                    setError(null);

                    const atualizado = await api.updatePolicial(
                      policialParaMesPrevisao.id,
                      gravaSomenteAnoExercicioAnterior
                        ? {
                            anoPrevisaoFerias: anoExercicioPrevisao,
                            somenteAnoPrevisaoFerias: true,
                          }
                        : {
                            mesPrevisaoFerias: parseInt(mesSelecionado, 10),
                            anoPrevisaoFerias: anoExercicioPrevisao,
                          },
                    );
                    aplicarPolicialAtualizadoNoEstadoCadastro(atualizado);

                    try {
                      const ext = await api.getUltimoAnoPrevisaoFerias();
                      setExtremosAnosPrevisaoFerias({ min: ext.anoMinimo, max: ext.ano });
                    } catch {
                      /* mantém extremos; clamp pode corrigir na próxima abertura */
                    }

                    setSuccess(
                      isReprogramacao
                        ? 'Férias reprogramadas com sucesso.'
                        : gravaSomenteAnoExercicioAnterior
                          ? 'Previsão do exercício salva. No cadastro de férias informe data de início e data de término.'
                          : 'Mês previsto de férias salvo com sucesso.',
                    );
                    setModalMesPrevisaoOpen(false);
                    setDocumentoSei('');
                    /** Filtro mês + API filtram a lista; sem limpar, o policial pode sumir da grade após mudar o mês. */
                    setMesFiltroPrevisao('');
                    const mudouAnoNaLista = anoExercicioPrevisao !== anoFiltroPrevisao;
                    setAnoFiltroPrevisao(anoExercicioPrevisao);
                    if (mudouAnoNaLista) {
                      setPaginaAtualPrevisao(1);
                    }
                    await carregarPoliciaisPrevisao(
                      mudouAnoNaLista ? 1 : paginaAtualPrevisao,
                      itensPorPaginaPrevisao,
                      mudouAnoNaLista ? { feriasAnoOverride: anoExercicioPrevisao } : undefined,
                    );
                    onChanged?.();
                  } catch (err) {
                    setError(
                      err instanceof Error
                        ? err.message
                        : 'Não foi possível salvar o mês previsto de férias.',
                    );
                  } finally {
                    setSalvandoMesPrevisao(false);
                  }
                },
              });
            }}
            variant="contained"
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              px: 3,
              py: 1,
              background: `linear-gradient(135deg, ${theme.accentMuted} 0%, ${theme.sentinelaBlue} 100%)`,
              '&:hover': {
                background: `linear-gradient(135deg, var(--accent-muted) 0%, var(--sentinela-blue) 100%)`,
              },
            }}
            disabled={
              salvandoMesPrevisao ||
              policialParaMesPrevisao?.status === 'DESATIVADO' ||
              (emModoReprogramacaoPrevisaoModal && !documentoSei.trim()) ||
              (!mesSelecionado &&
                (emModoReprogramacaoPrevisaoModal ||
                  anoModalPrevisao >= anoCivilAtual))
            }
          >
            {salvandoMesPrevisao ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

    </section>
  );
}
