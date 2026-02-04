import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type {
  Afastamento,
  Policial,
  MotivoAfastamentoOption,
  Usuario,
} from '../../types';
import { STATUS_LABEL, POLICIAL_STATUS_OPTIONS, formatEquipeLabel } from '../../constants';
import { calcularDiasEntreDatas, formatDate, formatPeriodo, formatNome } from '../../utils/dateUtils';
import { createNormalizedInputHandler, handleKeyDownNormalized } from '../../utils/inputUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canEdit, canExcluir, canDesativar } from '../../utils/permissions';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { Autocomplete, TextField, Button, Checkbox, Box, Typography, Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, IconButton, Paper, Chip, Tooltip } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import BadgeIcon from '@mui/icons-material/Badge';
import GroupsIcon from '@mui/icons-material/Groups';
import WorkIcon from '@mui/icons-material/Work';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import BlockIcon from '@mui/icons-material/Block';
import DeleteIcon from '@mui/icons-material/Delete';

interface AfastamentosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
  onChanged?: () => void;
  permissoes?: PermissoesPorTela | null;
}

export function AfastamentosSection({
  currentUser,
  openConfirm,
  onChanged,
  permissoes,
}: AfastamentosSectionProps) {
  const initialForm = {
    policialId: '',
    motivoId: 0,
    seiNumero: '',
    descricao: '',
    dataInicio: '',
    dataFim: '',
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
  const [calcularPeriodo, setCalcularPeriodo] = useState<boolean>(false);
  const [quantidadeDias, setQuantidadeDias] = useState<string>('');
  const [tabAtiva, setTabAtiva] = useState<number>(0);
  const [dataFimFocada, setDataFimFocada] = useState(false);
  
  // Estados para paginação na aba "Previsão de férias"
  const [paginaAtualPrevisao, setPaginaAtualPrevisao] = useState(1);
  const [itensPorPaginaPrevisao, setItensPorPaginaPrevisao] = useState(20);
  const [totalPoliciaisPrevisao, setTotalPoliciaisPrevisao] = useState(0);
  const [totalPaginasPrevisao, setTotalPaginasPrevisao] = useState(1);
  const [policiaisPrevisao, setPoliciaisPrevisao] = useState<Policial[]>([]);
  const [loadingPrevisao, setLoadingPrevisao] = useState(false);
  const [searchTermPrevisao, setSearchTermPrevisao] = useState('');
  const [modalPolicialOpen, setModalPolicialOpen] = useState(false);
  const [policialSelecionado, setPolicialSelecionado] = useState<Policial | null>(null);
  const [modalMesPrevisaoOpen, setModalMesPrevisaoOpen] = useState(false);
  const [policialParaMesPrevisao, setPolicialParaMesPrevisao] = useState<Policial | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string>('');
  const [salvandoMesPrevisao, setSalvandoMesPrevisao] = useState(false);
  const [documentoSei, setDocumentoSei] = useState<string>('');

  const [editAfastamentoModal, setEditAfastamentoModal] = useState<{
    open: boolean;
    afastamento: Afastamento | null;
    motivoId: number;
    seiNumero: string;
    descricao: string;
    dataInicio: string;
    dataFim: string;
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
    calcularPeriodo: false,
    quantidadeDias: '',
    error: null,
    loading: false,
  });

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

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Carregar policiais para a aba "Previsão de férias"
  const carregarPoliciaisPrevisao = useCallback(async (page: number, pageSize: number) => {
    try {
      setLoadingPrevisao(true);
      const nivelNome = currentUser.nivel?.nome;
      const usuarioPodeVerTodos =
        nivelNome === 'ADMINISTRADOR' ||
        nivelNome === 'SAD' ||
        nivelNome === 'COMANDO' ||
        currentUser.isAdmin === true;
      
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page,
        pageSize,
        includeAfastamentos: false,
        includeRestricoes: false,
      };
      const busca = searchTermPrevisao.trim();
      if (busca) {
        params.search = busca;
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
  }, [currentUser, searchTermPrevisao]);

  useEffect(() => {
    if (tabAtiva === 1) {
      void carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao);
    }
  }, [tabAtiva, paginaAtualPrevisao, itensPorPaginaPrevisao, carregarPoliciaisPrevisao]);

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
    ano: number,
  ): number => {
    const afastamentosDoAno = afastamentos.filter((afastamento) => {
      if (afastamento.policialId !== policialId || afastamento.motivoId !== motivoId) {
        return false;
      }
      const dataInicio = new Date(afastamento.dataInicio);
      return dataInicio.getFullYear() === ano;
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

      await api.createAfastamento({
        policialId: Number(form.policialId),
        motivoId: form.motivoId,
        seiNumero: form.seiNumero.trim(),
        descricao: descricaoFinal || undefined,
        dataInicio: form.dataInicio,
        dataFim: dataFimFinal || undefined,
      });
      setSuccess('Afastamento cadastrado com sucesso.');
      
      // Resetar form mantendo motivoId padrão
      const feriasMotivo = motivos.find((m) => m.nome === 'Férias');
      const motivoIdPadrao = feriasMotivo?.id || 0;
      setForm({
        policialId: '',
        motivoId: motivoIdPadrao,
        seiNumero: '',
        descricao: '',
        dataInicio: '',
        dataFim: '',
      });
      setMotivoOutroTexto('');
      
      await carregarDados();
      onChanged?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar o afastamento.',
      );
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

      const message =
        `Confirme os dados do afastamento:\n\n` +
        `Policial: ${policial?.nome ?? '—'}${policial?.matricula ? ` (${policial.matricula})` : ''}\n` +
        `Motivo: ${motivoNome}\n` +
        `Período: ${periodoDescricao}\n` +
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
        afastamento.policialId === policialId &&
        afastamento.status === 'ATIVO',
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
        setError(
          `Este policial já possui um afastamento ativo no período selecionado (${formatNome(afastamentoExistente.motivo.nome)} de ${formatDate(afastamentoExistente.dataInicio)} até ${formatDate(afastamentoExistente.dataFim)}). Por favor, altere as datas.`,
        );
        return;
      }
    }

    // SEGUNDO: Verificar conflitos de afastamentos de OUTROS policiais no intervalo de dias
    const conflitos = verificarConflitos(form.dataInicio, dataFimParaValidacao || null, policialId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos informando sobre outros policiais afastados
      setConflitosModal({
        open: true,
        conflitos,
        dataVerificada: dataFimParaValidacao ? `${form.dataInicio} e ${dataFimParaValidacao}` : form.dataInicio,
      });
      return;
    }

    // Validar se férias não pode ser antes da data atual
    if (motivoNome === 'Férias') {
      // Verificar se o policial tem previsão de férias cadastrada
      const policialSelecionado = policiais.find((p) => p.id.toString() === form.policialId);
      if (!policialSelecionado) {
        setError('Selecione um policial.');
        return;
      }
      if (policialSelecionado.mesPrevisaoFerias == null) {
        setError('Não é possível cadastrar férias para um policial que não possui mês de previsão de férias definido. É necessário cadastrar o mês de previsão de férias antes de registrar o afastamento.');
        return;
      }
      
      const dataInicio = new Date(form.dataInicio);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      dataInicio.setHours(0, 0, 0, 0);
      
      if (dataInicio < hoje) {
        setError('A data de início das férias não pode ser anterior à data atual.');
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
            form.dataFim || null,
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

      const dataInicio = new Date(form.dataInicio);
      const ano = dataInicio.getFullYear();
      
      // Calcular dias solicitados
      let diasSolicitados = 0;
      if (calcularPeriodo && quantidadeDias) {
        diasSolicitados = parseInt(quantidadeDias, 10);
      } else {
        diasSolicitados = calcularDiasEntreDatas(form.dataInicio, form.dataFim || undefined);
      }
      const diasUsados = calcularDiasUsadosNoAno(policialId, form.motivoId, ano);
      const limiteDias = motivoNome === 'Férias' ? 30 : 5;
      const totalAposCadastro = diasUsados + diasSolicitados;

      // Validar se o período solicitado ultrapassa o limite individual
      if (diasSolicitados > limiteDias) {
        setError(
          `O período de ${motivoNome} não pode ser superior a ${limiteDias} dias. Período informado: ${diasSolicitados} dias.`,
        );
        return;
      }

      // Validar se a soma ultrapassa o limite anual
      if (totalAposCadastro > limiteDias) {
        const diasRestantes = limiteDias - diasUsados;
        setError(
          `O policial já usufruiu ${diasUsados} dias de ${motivoNome} no ano, restando apenas ${diasRestantes} dias. O período solicitado de ${diasSolicitados} dias ultrapassa o limite anual de ${limiteDias} dias.`,
        );
        return;
      }
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

    abrirConfirmacaoCadastro(dataFimParaValidacao || null);
  };

  const handleCancelarConflito = () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
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
    const { afastamento, motivoId, seiNumero, descricao, dataInicio, dataFim, calcularPeriodo, quantidadeDias } = editAfastamentoModal;
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
    try {
      setEditAfastamentoModal((prev) => ({ ...prev, loading: true, error: null }));
      await api.updateAfastamento(afastamento.id, {
        motivoId,
        seiNumero: seiNumero.trim(),
        descricao: descricao.trim() || undefined,
        dataInicio,
        dataFim: dataFimToSend,
      });
      setSuccess('Afastamento atualizado com sucesso.');
      handleCloseEditAfastamentoModal();
      await carregarDados();
      onChanged?.();
    } catch (err) {
      setEditAfastamentoModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Não foi possível atualizar o afastamento.',
      }));
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
  // caso contrário, ordem normal por nome (como vem do banco)
  const policiaisOrdenados = useMemo(() => {
    const ordenarPorNome = (a: Policial, b: Policial) =>
      a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    if (motivoEhFerias) {
      const comPrevisao = policiais.filter((p) => p.mesPrevisaoFerias != null);
      const semPrevisao = policiais.filter((p) => p.mesPrevisaoFerias == null);
      return [
        ...comPrevisao.sort(ordenarPorNome),
        ...semPrevisao.sort(ordenarPorNome),
      ];
    }
    return [...policiais].sort(ordenarPorNome);
  }, [policiais, motivoEhFerias]);

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
    if (!normalizedSearch) {
      return filtradoPorMotivoOutro;
    }

    return filtradoPorMotivoOutro.filter((afastamento) =>
      afastamento.policial.nome.includes(normalizedSearch),
    );
  }, [afastamentos, motivoFiltro, motivoFiltroOutro, normalizedSearch, selectedMonth, dataInicioFiltro, dataFimFiltro, periodoSobrepoeMes]);

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
        <form onSubmit={handleSubmit}>
        <div className="grid two-columns">
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Policial
            <Autocomplete
              options={policiaisOrdenados}
              getOptionLabel={(option) =>
                motivoEhFerias && option.mesPrevisaoFerias == null
                  ? `${option.nome} - ${option.matricula} (sem previsão de férias)`
                  : `${option.nome} - ${option.matricula}`
              }
              getOptionDisabled={(option) =>
                motivoEhFerias ? option.mesPrevisaoFerias == null : false
              }
              value={policiaisOrdenados.find(c => c.id.toString() === form.policialId) || null}
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      padding: '0 !important',
                      minHeight: 'auto',
                      height: 'auto',
                      '& fieldset': {
                        borderColor: '#cbd5f5',
                      },
                      '&:hover fieldset': {
                        borderColor: '#cbd5f5',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#1d4ed8',
                        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.2)',
                      },
                      '& input': {
                        padding: '10px 12px !important',
                        height: 'auto',
                      },
                      '& .MuiAutocomplete-endAdornment': {
                        top: '50%',
                        transform: 'translateY(-50%)',
                        right: '8px',
                      },
                    },
                  }}
                />
              )}
              filterOptions={(options, { inputValue }) => {
                const searchTerm = inputValue.toLowerCase();
                return options.filter(
                  (option) =>
                    option.nome.toLowerCase().includes(searchTerm) ||
                    option.matricula.toLowerCase().includes(searchTerm)
                );
              }}
              noOptionsText="Nenhum policial encontrado"
              isOptionEqualToValue={(option, value) => option.id === value.id}
              sx={{
                '& .MuiAutocomplete-root': {
                  height: 'auto',
                },
                '& .MuiAutocomplete-inputRoot': {
                  padding: '0 !important',
                  height: 'auto',
                  minHeight: 'auto',
                },
              }}
            />
          </label>
          <label>
            Motivo
            <select
              value={form.motivoId || ''}
              onChange={(event) => {
                const motivoId = Number(event.target.value);
                const motivoSelecionado = motivos.find((motivo) => motivo.id === motivoId);
                const motivoNome = motivoSelecionado?.nome?.toLowerCase() ?? '';
                const motivoEhOutro = motivoNome === 'outro' || motivoNome === 'outros';
                const motivoEhFerias = motivoNome === 'férias';
                
                if (!motivoEhOutro) {
                  setMotivoOutroTexto('');
                }
                
                // Se mudou para "Férias" e há um policial selecionado, verificar se tem previsão
                if (motivoEhFerias && form.policialId) {
                  const policialSelecionado = policiais.find((p) => p.id.toString() === form.policialId);
                  if (policialSelecionado && policialSelecionado.mesPrevisaoFerias == null) {
                    // Limpar a seleção do policial e mostrar aviso
                    setForm((prev) => ({
                      ...prev,
                      motivoId,
                      policialId: '',
                    }));
                    setError('Para cadastrar férias, o policial deve ter mês de previsão de férias definido. Selecione um policial com previsão de férias cadastrada.');
                    return;
                  }
                }
                
                setForm((prev) => ({
                  ...prev,
                  motivoId,
                }));
              }}
              required
            >
              <option value="">Selecione</option>
              {motivosOrdenados.map((motivo) => (
                <option key={motivo.id} value={motivo.id}>
                  {formatNome(motivo.nome)}
                </option>
              ))}
            </select>
          </label>
          {(() => {
            const motivoSelecionado = motivos.find((motivo) => motivo.id === form.motivoId);
            const motivoNome = motivoSelecionado?.nome?.toLowerCase() ?? '';
            const motivoEhOutro = motivoNome === 'outro' || motivoNome === 'outros';
            if (!motivoEhOutro) {
              return null;
            }
            return (
              <label>
                Especifique o motivo
                <input
                  value={motivoOutroTexto}
                  onChange={createNormalizedInputHandler(setMotivoOutroTexto)}
                  onKeyDown={handleKeyDownNormalized}
                  placeholder="Descreva o motivo"
                  required
                />
              </label>
            );
          })()}
        </div>
        <label>
          SEI nº
          <input
            inputMode="numeric"
            pattern="\d*"
            value={form.seiNumero}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                seiNumero: event.target.value.replace(/\D/g, ''),
              }))
            }
            placeholder="Somente números"
            required
          />
        </label>
        <label>
          Descrição (opcional)
          <textarea
            rows={3}
            value={form.descricao}
            onChange={(event) => {
              const normalized = event.target.value.toLowerCase().charAt(0).toUpperCase() + event.target.value.toLowerCase().slice(1);
              setForm((prev) => ({ ...prev, descricao: normalized }));
            }}
            onKeyDown={handleKeyDownNormalized}
            placeholder="Detalhes adicionais..."
          />
        </label>
        <div className="grid two-columns">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label>
              Data de início
              <input
                type="date"
                value={form.dataInicio}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, dataInicio: event.target.value }));
                  // Resetar o estado de foco quando a data de início mudar para permitir pré-seleção novamente
                  if (!form.dataFim) {
                    setDataFimFocada(false);
                  }
                }}
                required
              />
            </label>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 1 }}>
              <Checkbox
                checked={calcularPeriodo}
                onChange={(event) => setCalcularPeriodo(event.target.checked)}
                size="small"
              />
              <span style={{ fontSize: '0.95rem' }}>Calcular período</span>
            </Box>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label>
                  {calcularPeriodo ? 'Insira a quantidade de dias' : 'Data de término'}
                  {calcularPeriodo ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="\d*"
                      min="1"
                      value={quantidadeDias}
                      onChange={(event) => {
                        const value = event.target.value.replace(/\D/g, '');
                        setQuantidadeDias(value);
                      }}
                      placeholder="Digite o número de dias"
                    />
                  ) : (
                    <input
                      type="date"
                      value={form.dataFim}
                      min={form.dataInicio || undefined}
                      onChange={(event) => {
                        setForm((prev) => ({ ...prev, dataFim: event.target.value }));
                        setDataFimFocada(true);
                      }}
                      onFocus={(event) => {
                        // Quando o campo recebe foco e não tem valor, pré-selecionar a data de início
                        if (!form.dataFim && form.dataInicio && !dataFimFocada) {
                          const input = event.currentTarget;
                          // Definir o valor diretamente no input para que o calendário abra com essa data pré-selecionada
                          input.value = form.dataInicio;
                          setForm((prev) => ({ ...prev, dataFim: prev.dataInicio }));
                          setDataFimFocada(true);
                        }
                      }}
                    />
                  )}
                </label>
              </div>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  setForm((prev) => ({ ...prev, dataInicio: '', dataFim: '' }));
                  setQuantidadeDias('');
                  setCalcularPeriodo(false);
                  setDataFimFocada(false);
                }}
                sx={{
                  textTransform: 'none',
                  mt: '20px',
                  height: '40px',
                }}
              >
                Limpar
              </Button>
            </div>
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
          </div>
        </div>
        <div className="form-actions">
          <button className="primary" type="submit" disabled={submitting}>
            {submitting ? 'Salvando...' : 'Cadastrar afastamento'}
          </button>
        </div>
      </form>

      <div>
        <div className="section-header">
          <h3>Lista de afastamentos</h3>
        </div>
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
            {dataInicioFiltro || dataFimFiltro || selectedMonth
              ? 'Nenhum afastamento encontrado no período selecionado.'
              : 'Nenhum afastamento cadastrado.'}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Policial</th>
                <th>Motivo</th>
                <th>SEI nº</th>
                <th>Período</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {afastamentosFiltrados.map((afastamento) => (
                <tr key={afastamento.id}>
                  <td>
                    <div>{afastamento.policial.nome}</div>
                    <small>{afastamento.policial.matricula}</small>
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
                  <td style={{ verticalAlign: 'middle' }}>
                    <span className="badge">
                      {STATUS_LABEL[afastamento.status]}
                    </span>
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
                              borderColor: 'primary.main',
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
                        <Tooltip title={afastamento.status === 'ENCERRADO' ? 'Afastamento já está desativado' : 'Desativar afastamento'}>
                          <span>
                            <IconButton
                              size="small"
                              color="warning"
                              onClick={() => {
                                openConfirm({
                                  title: 'Desativar afastamento',
                                  message: `Deseja desativar o afastamento "${formatNome(afastamento.motivo.nome)}" do policial ${afastamento.policial.nome}? O afastamento será marcado como encerrado.`,
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
                              disabled={afastamento.status === 'ENCERRADO'}
                              sx={{
                                border: '1px solid',
                                borderColor: 'warning.main',
                                '&:hover': {
                                  backgroundColor: 'warning.light',
                                  color: 'white',
                                },
                                opacity: afastamento.status === 'ENCERRADO' ? 0.5 : 1,
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
                                backgroundColor: 'error.light',
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
        )}
      </div>
        </>
      )}

      {tabAtiva === 1 && (
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3 }}>
            Previsão de férias {new Date().getFullYear()}
          </Typography>

          {/* Controles de lista */}
          <div className="list-controls" style={{ marginBottom: '16px' }}>
            <input
              className="search-input"
              value={searchTermPrevisao}
              onChange={(event) => setSearchTermPrevisao(event.target.value.toUpperCase())}
              placeholder="Pesquisar por nome ou matrícula"
            />
            <button
              className="ghost"
              type="button"
              onClick={() => void carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao)}
            >
              Atualizar lista
            </button>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Itens por página:</span>
              <select
                value={itensPorPaginaPrevisao}
                onChange={(event) => {
                  setItensPorPaginaPrevisao(Number(event.target.value));
                  setPaginaAtualPrevisao(1);
                }}
                style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #d1d5db' }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          {/* Contador de Registros */}
          <div style={{ 
            marginBottom: '16px', 
            fontSize: '0.9rem', 
            color: '#64748b',
            padding: '8px 12px',
            backgroundColor: '#f8f9fa',
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
                  {policiaisPrevisao.map((policial) => (
                    <tr key={policial.id}>
                      <td>
                        <div>
                          <button
                            type="button"
                            onClick={() => {
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
                        {policial.mesPrevisaoFerias ? (
                          <span>
                            {new Date(2000, policial.mesPrevisaoFerias - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                          </span>
                        ) : (
                          <span style={{ color: '#64748b', fontStyle: 'italic' }}>Não definido</span>
                        )}
                      </td>
                      <td>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Tooltip title={
                            policial.feriasReprogramadas 
                              ? 'Férias já foram reprogramadas' 
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
                                  setMesSelecionado(policial.mesPrevisaoFerias ? String(policial.mesPrevisaoFerias) : '');
                                  if (policial.feriasConfirmadas) {
                                    // Se for reprogramação, limpar o campo SEI e abrir a modal
                                    setDocumentoSei('');
                                  }
                                  setModalMesPrevisaoOpen(true);
                                }}
                                disabled={policial.feriasReprogramadas && policial.feriasConfirmadas}
                                sx={{
                                  border: '1px solid',
                                  borderColor: policial.feriasReprogramadas 
                                    ? 'grey.400' 
                                    : policial.feriasConfirmadas 
                                      ? 'warning.main' 
                                      : 'primary.main',
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
                                ) : policial.mesPrevisaoFerias ? (
                                  <EditIcon fontSize="small" />
                                ) : (
                                  <AddCircleOutlineIcon fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                          {policial.mesPrevisaoFerias && !policial.feriasConfirmadas && (
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
                                        await api.updatePolicial(policial.id, {
                                          feriasConfirmadas: true,
                                        });
                                        setSuccess('Férias confirmadas com sucesso.');
                                        await carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao);
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
                  ))}
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
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    border: '1px solid #e9ecef'
                  }}>
                    <div style={{ fontSize: '0.9rem', color: '#64748b' }}>
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
                      <span style={{ padding: '0 12px', fontSize: '0.9rem', color: '#374151' }}>
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
            <div style={{ margin: '8px 0 16px', padding: '12px', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#475569' }}>
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
                        <small>{afastamento.policial.matricula}</small>
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
            <p style={{ marginTop: '16px', color: '#64748b', fontSize: '0.9rem' }}>
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

      {/* Modal com informações do policial */}
      <Dialog
        open={modalPolicialOpen}
        onClose={() => setModalPolicialOpen(false)}
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              onClick={() => setModalPolicialOpen(false)}
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
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <PersonIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Nome
                  </Typography>
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 500, color: '#1e293b', ml: 4.5 }}>
                  {policialSelecionado.nome}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <BadgeIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Matrícula
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b', ml: 4.5, fontSize: '1.1rem' }}>
                  {policialSelecionado.matricula}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <BadgeIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
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
                      backgroundColor: '#e0e7ff',
                      color: '#4338ca',
                    }}
                  />
                </Box>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <GroupsIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Equipe
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b', ml: 4.5, fontSize: '1.1rem' }}>
                  {formatEquipeLabel(policialSelecionado.equipe)}
                </Typography>
              </Paper>

              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <WorkIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Função
                  </Typography>
                </Box>
                <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b', ml: 4.5, fontSize: '1.1rem' }}>
                  {policialSelecionado.funcao?.nome || '-'}
                </Typography>
              </Paper>

              {/* Informações de Férias */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  backgroundColor: '#f8f9fa',
                  borderRadius: 2,
                  border: '1px solid #e9ecef',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                  <CalendarTodayIcon sx={{ color: '#667eea', fontSize: 20 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#64748b', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 0.5 }}>
                    Previsão de Férias
                  </Typography>
                </Box>
                <Box sx={{ ml: 4.5 }}>
                  {policialSelecionado.mesPrevisaoFerias ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {/* Mês atual (ou original se não foi reprogramado) */}
                      <Box>
                        <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                          {policialSelecionado.feriasReprogramadas ? 'Mês Atual (Reprogramado)' : 'Mês Previsto'}
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: '#1e293b', fontSize: '1.1rem' }}>
                          {new Date(2000, policialSelecionado.mesPrevisaoFerias - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                          {policialSelecionado.anoPrevisaoFerias && ` de ${policialSelecionado.anoPrevisaoFerias}`}
                        </Typography>
                      </Box>
                      
                      {/* Mês original (se foi reprogramado) */}
                      {policialSelecionado.feriasReprogramadas && policialSelecionado.mesPrevisaoFeriasOriginal && (
                        <Box>
                          <Typography variant="body2" sx={{ color: '#64748b', mb: 0.5, fontSize: '0.75rem', fontWeight: 600 }}>
                            Mês Original (Antes da Reprogramação)
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, color: '#92400e', fontSize: '1.1rem' }}>
                            {new Date(2000, policialSelecionado.mesPrevisaoFeriasOriginal - 1).toLocaleDateString('pt-BR', { month: 'long' })}
                            {policialSelecionado.anoPrevisaoFeriasOriginal && ` de ${policialSelecionado.anoPrevisaoFeriasOriginal}`}
                          </Typography>
                        </Box>
                      )}
                      
                      {/* Chips de status */}
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mt: 0.5 }}>
                        {policialSelecionado.feriasConfirmadas && (
                          <Chip
                            label="Férias Confirmadas"
                            size="small"
                            sx={{
                              fontWeight: 500,
                              backgroundColor: '#d1fae5',
                              color: '#065f46',
                              width: 'fit-content',
                            }}
                            icon={<CheckCircleIcon sx={{ fontSize: 16, color: '#065f46' }} />}
                          />
                        )}
                        {policialSelecionado.feriasReprogramadas && (
                          <Chip
                            label="Férias Reprogramadas"
                            size="small"
                            sx={{
                              fontWeight: 500,
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              width: 'fit-content',
                            }}
                            icon={<CalendarTodayIcon sx={{ fontSize: 16, color: '#92400e' }} />}
                          />
                        )}
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body1" sx={{ fontWeight: 500, color: '#64748b', fontStyle: 'italic', fontSize: '1.1rem' }}>
                      Não definido
                    </Typography>
                  )}
                </Box>
              </Paper>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e9ecef' }}>
          <Button
            onClick={() => setModalPolicialOpen(false)}
            variant="contained"
            sx={{
              textTransform: 'none',
              borderRadius: 1.5,
              px: 3,
              py: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                  <Typography variant="subtitle2" sx={{ mb: 0.5, color: '#64748b', fontWeight: 600 }}>
                    Policial
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {editAfastamentoModal.afastamento.policial.nome} - {editAfastamentoModal.afastamento.policial.matricula}
                  </Typography>
                </Box>

                {editAfastamentoModal.error && (
                  <Box
                    sx={{
                      p: 1.5,
                      backgroundColor: '#fef2f2',
                      borderRadius: 1,
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
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
                  onChange={(e) =>
                    setEditAfastamentoModal((prev) => ({
                      ...prev,
                      motivoId: Number(e.target.value),
                      error: null,
                    }))
                  }
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            py: 2.5,
            px: 3,
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {policialParaMesPrevisao?.feriasConfirmadas 
                ? 'Reprogramar Férias' 
                : policialParaMesPrevisao?.mesPrevisaoFerias 
                  ? 'Alterar Mês Previsto de Férias' 
                  : 'Inserir Mês Previsto de Férias'}
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
                <Typography variant="subtitle2" sx={{ mb: 1, color: '#64748b', fontWeight: 600 }}>
                  Policial
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  {policialParaMesPrevisao.nome} - {policialParaMesPrevisao.matricula}
                </Typography>
              </Box>
              
              <Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                    Ano:{' '}
                    <strong>
                      {policialParaMesPrevisao?.anoPrevisaoFerias ?? new Date().getFullYear()}
                    </strong>
                  </Typography>
                </Box>
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
                    <option value="" disabled>
                      Selecione o mês
                    </option>
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
                {/* Campo Documento SEI obrigatório apenas para reprogramação */}
                {policialParaMesPrevisao.feriasConfirmadas && (
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
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e9ecef' }}>
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
              if (!policialParaMesPrevisao || !mesSelecionado) {
                setError('Por favor, selecione o mês.');
                return;
              }

              // Validação do campo SEI para reprogramação
              if (policialParaMesPrevisao.feriasConfirmadas && !documentoSei.trim()) {
                setError('Por favor, informe o Documento SEI.');
                return;
              }

              const anoAtual = policialParaMesPrevisao.anoPrevisaoFerias ?? new Date().getFullYear();
              const meses = [
                'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
              ];
              const mesNome = meses[parseInt(mesSelecionado, 10) - 1];

              const isReprogramacao = policialParaMesPrevisao.feriasConfirmadas;
              const mensagemConfirmacao = isReprogramacao
                ? `Deseja reprogramar as férias de ${policialParaMesPrevisao.nome} (${policialParaMesPrevisao.matricula})?\n\nMês: ${mesNome} de ${anoAtual}\nDocumento SEI: ${documentoSei}`
                : `Deseja definir o mês previsto de férias para ${policialParaMesPrevisao.nome} (${policialParaMesPrevisao.matricula})?\n\nMês: ${mesNome} de ${anoAtual}`;

              openConfirm({
                title: isReprogramacao ? 'Confirmar reprogramação de férias' : 'Confirmar mês previsto de férias',
                message: mensagemConfirmacao,
                confirmLabel: 'Confirmar',
                onConfirm: async () => {
                  try {
                    setSalvandoMesPrevisao(true);
                    setError(null);
                    
                    await api.updatePolicial(policialParaMesPrevisao.id, {
                      mesPrevisaoFerias: parseInt(mesSelecionado, 10),
                      anoPrevisaoFerias: anoAtual,
                    });

                    setSuccess(isReprogramacao ? 'Férias reprogramadas com sucesso.' : 'Mês previsto de férias salvo com sucesso.');
                    setModalMesPrevisaoOpen(false);
                    setDocumentoSei('');
                    await carregarPoliciaisPrevisao(paginaAtualPrevisao, itensPorPaginaPrevisao);
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5568d3 0%, #6a4190 100%)',
              },
            }}
            disabled={salvandoMesPrevisao || !mesSelecionado || (policialParaMesPrevisao?.feriasConfirmadas && !documentoSei.trim())}
          >
            {salvandoMesPrevisao ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

    </section>
  );
}
