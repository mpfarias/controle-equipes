import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type {
  Afastamento,
  Policial,
  MotivoAfastamentoOption,
  Usuario,
} from '../../types';
import { STATUS_LABEL, EQUIPE_FONETICA } from '../../constants';
import { calcularDiasEntreDatas, formatDate, formatPeriodo } from '../../utils/dateUtils';
import type { ConfirmConfig } from '../common/ConfirmDialog';
import { Autocomplete, TextField, Button } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

interface AfastamentosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
}

export function AfastamentosSection({
  currentUser,
  openConfirm,
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
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');
  const [conflitosModal, setConflitosModal] = useState<{
    open: boolean;
    conflitos: Afastamento[];
    dataVerificada: string;
  }>({
    open: false,
    conflitos: [],
    dataVerificada: '',
  });

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
      await api.createAfastamento({
        policialId: Number(form.policialId),
        motivoId: form.motivoId,
        seiNumero: form.seiNumero.trim(),
        descricao: form.descricao.trim() || undefined,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim || undefined,
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
      
      await carregarDados();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar o afastamento.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [form, currentUser.id, motivos, carregarDados]);

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

    if (!form.dataInicio) {
      setError('Informe a data de início.');
      return;
    }

    // PRIMEIRO: Verificar se o próprio policial já tem afastamento no período
    const policialId = Number(form.policialId);
    const afastamentosDoMesmoPolicial = afastamentos.filter(
      (afastamento) =>
        afastamento.policialId === policialId &&
        afastamento.status === 'ATIVO',
    );

    // Verificar se algum afastamento do mesmo policial se sobrepõe com o período informado
    for (const afastamentoExistente of afastamentosDoMesmoPolicial) {
      const haSobreposicao = periodosSobrepostos(
        form.dataInicio,
        form.dataFim || null,
        afastamentoExistente.dataInicio,
        afastamentoExistente.dataFim || null,
      );

      if (haSobreposicao) {
        setError(
          `Este policial já possui um afastamento ativo no período selecionado (${afastamentoExistente.motivo.nome} de ${formatDate(afastamentoExistente.dataInicio)} até ${formatDate(afastamentoExistente.dataFim)}). Por favor, altere as datas.`,
        );
        return;
      }
    }

    // SEGUNDO: Verificar conflitos de afastamentos de OUTROS policiais no intervalo de dias
    const conflitos = verificarConflitos(form.dataInicio, form.dataFim || null, policialId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos informando sobre outros policiais afastados
      setConflitosModal({
        open: true,
        conflitos,
        dataVerificada: form.dataFim ? `${form.dataInicio} e ${form.dataFim}` : form.dataInicio,
      });
      return;
    }

    // Validar se férias não pode ser antes da data atual
    if (motivoNome === 'Férias') {
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
      if (!form.dataFim) {
        setError('Para férias e abono, é necessário informar a data de término.');
        return;
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
      const diasSolicitados = calcularDiasEntreDatas(form.dataInicio, form.dataFim || undefined);
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

    // Se não houver conflitos e validações passaram, submeter normalmente
    await submeterAfastamento();
  };

  const handleConfirmarConflito = async () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
    await submeterAfastamento();
  };

  const handleCancelarConflito = () => {
    setConflitosModal({ open: false, conflitos: [], dataVerificada: '' });
  };


  const handleDelete = (afastamento: Afastamento) => {
    openConfirm({
      title: 'Remover afastamento',
      message: `Deseja remover o afastamento "${afastamento.motivo.nome}" do policial ${afastamento.policial.nome}?`,
      confirmLabel: 'Remover',
      onConfirm: async () => {
        try {
          setError(null);
          await api.removeAfastamento(afastamento.id);
          setSuccess('Afastamento removido.');
          await carregarDados();
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

  const policiaisOrdenados = useMemo(
    () =>
      [...policiais].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [policiais],
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

    // Filtrar por busca de nome
    if (!normalizedSearch) {
      return filtradoPorMotivo;
    }

    return filtradoPorMotivo.filter((afastamento) =>
      afastamento.policial.nome.includes(normalizedSearch),
    );
  }, [afastamentos, motivoFiltro, normalizedSearch, selectedMonth, dataInicioFiltro, dataFimFiltro, periodoSobrepoeMes]);

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
        <p>Registre e acompanhe os afastamentos ativos e concluídos.</p>
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

      <form onSubmit={handleSubmit}>
        <div className="grid two-columns">
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            Policial
            <Autocomplete
              options={policiaisOrdenados}
              getOptionLabel={(option) => `${option.nome} - ${option.matricula}`}
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
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  motivoId: Number(event.target.value),
                }))
              }
              required
            >
              <option value="">Selecione</option>
              {motivosOrdenados.map((motivo) => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.nome}
                </option>
              ))}
            </select>
          </label>
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
            onChange={(event) =>
              setForm((prev) => ({ ...prev, descricao: event.target.value }))
            }
            placeholder="Detalhes adicionais..."
          />
        </label>
        <div className="grid two-columns">
          <label>
            Data de início
            <input
              type="date"
              value={form.dataInicio}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dataInicio: event.target.value }))
              }
              required
            />
          </label>
          <label>
            Data de término
            <input
              type="date"
              value={form.dataFim}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dataFim: event.target.value }))
              }
            />
          </label>
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
            onChange={(event) => setMotivoFiltro(event.target.value)}
          >
            <option value="">Todos os motivos</option>
            {motivosOrdenados.map((motivo) => (
              <option key={motivo.id} value={motivo.nome}>
                {motivo.nome}
              </option>
            ))}
          </select>
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
            }}
            placeholder="Data fim"
            title="Data fim do período"
            min={dataInicioFiltro || undefined}
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
                    <div>{afastamento.motivo.nome}</div>
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
                  <td className="actions">
                    <button
                      className="danger"
                      type="button"
                      onClick={() => handleDelete(afastamento)}
                    >
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
                        {afastamento.policial.equipe 
                          ? `${EQUIPE_FONETICA[afastamento.policial.equipe]} (${afastamento.policial.equipe})`
                          : '-'}
                      </td>
                      <td>
                        <div>{afastamento.motivo.nome}</div>
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

    </section>
  );
}
