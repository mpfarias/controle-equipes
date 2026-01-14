import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type {
  Afastamento,
  Colaborador,
  MotivoAfastamentoOption,
  Usuario,
} from '../../types';
import { STATUS_LABEL } from '../../constants';
import { calcularDiasEntreDatas, formatDate, formatPeriodo } from '../../utils/dateUtils';
import type { ConfirmConfig } from '../common/ConfirmDialog';

interface AfastamentosSectionProps {
  currentUser: Usuario;
  openConfirm: (config: ConfirmConfig) => void;
}

export function AfastamentosSection({
  currentUser,
  openConfirm,
}: AfastamentosSectionProps) {
  const initialForm = {
    colaboradorId: '',
    motivoId: 0,
    descricao: '',
    dataInicio: '',
    dataFim: '',
  };

  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [conflitosModal, setConflitosModal] = useState<{
    open: boolean;
    conflitos: Afastamento[];
    dataVerificada: string;
  }>({
    open: false,
    conflitos: [],
    dataVerificada: '',
  });
  const [validacaoDiasModal, setValidacaoDiasModal] = useState<{
    open: boolean;
    tipo: 'ferias' | 'abono';
    diasUsados: number;
    diasRestantes: number;
    diasSolicitados: number;
    colaboradorNome: string;
    ultrapassa: boolean;
  }>({
    open: false,
    tipo: 'ferias',
    diasUsados: 0,
    diasRestantes: 0,
    diasSolicitados: 0,
    colaboradorNome: '',
    ultrapassa: false,
  });

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [afastamentosData, colaboradoresData, motivosData] = await Promise.all([
        api.listAfastamentos(),
        api.listColaboradores(),
        api.listMotivos(),
      ]);
      
      setMotivos(motivosData);
      
      const equipeAtual = currentUser.equipe;
      
      // Filtrar colaboradores por equipe (se houver equipe definida)
      const colaboradoresFiltrados = equipeAtual
        ? colaboradoresData.filter((colaborador) => 
            colaborador.equipe && colaborador.equipe === equipeAtual
          )
        : colaboradoresData;
      
      // Filtrar afastamentos apenas da equipe do usuário logado
      const afastamentosFiltrados = equipeAtual
        ? afastamentosData.filter((afastamento) => {
            const colaboradorEquipe = afastamento.colaborador?.equipe;
            // Incluir apenas se o colaborador tiver equipe e corresponder à  equipe do usuário
            return colaboradorEquipe && colaboradorEquipe === equipeAtual;
          })
        : afastamentosData;
      
      setAfastamentos(afastamentosFiltrados);
      setColaboradores(colaboradoresFiltrados);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Não foi possível carregar os dados.',
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser.equipe]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  // Função calcularDiasEntreDatas importada de utils/dateUtils

  // Função para calcular dias usados no ano para um motivo específico
  const calcularDiasUsadosNoAno = useCallback((
    colaboradorId: number,
    motivoId: number,
    ano: number,
  ): number => {
    const afastamentosDoAno = afastamentos.filter((afastamento) => {
      if (afastamento.colaboradorId !== colaboradorId || afastamento.motivoId !== motivoId) {
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
    const dataInicio1 = new Date(inicio1);
    const dataFim1 = fim1 ? new Date(fim1) : null;
    const dataInicio2 = new Date(inicio2);
    const dataFim2 = fim2 ? new Date(fim2) : null;

    // Normalizar para comparar apenas a data (sem hora)
    dataInicio1.setHours(0, 0, 0, 0);
    if (dataFim1) dataFim1.setHours(0, 0, 0, 0);
    dataInicio2.setHours(0, 0, 0, 0);
    if (dataFim2) dataFim2.setHours(0, 0, 0, 0);

    // Verificar sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
    // Período 1: [inicio1, fim1] - o policial está de férias até o dia fim1 (inclusive)
    // Período 2: [inicio2, fim2] - o policial estaria de férias a partir do dia inicio2 (inclusive)
    // Sobreposição se: inicio1 < fim2 && inicio2 < fim1
    // (usar < em vez de <= porque se um termina em X e outro começa em X, não há sobreposição - são adjacentes)
    if (dataFim1 && dataFim2) {
      // Ambos têm data fim
      const condicao1 = dataInicio1.getTime() < dataFim2.getTime();
      const condicao2 = dataInicio2.getTime() < dataFim1.getTime();
      const haSobreposicaoBasica = condicao1 && condicao2;

      // Se não há sobreposição básica, verificar se são adjacentes (um termina em X, outro começa em X)
      // Adjacentes não são considerados sobrepostos
      if (!haSobreposicaoBasica) {
        const saoAdjacentes1 = dataInicio2.getTime() === dataFim1.getTime(); // Período 2 começa quando período 1 termina
        const saoAdjacentes2 = dataInicio1.getTime() === dataFim2.getTime(); // Período 1 começa quando período 2 termina
        
        // Se são adjacentes, não há sobreposição
        return !(saoAdjacentes1 || saoAdjacentes2);
      }

      // Há sobreposição básica
      return true;
    } else if (dataFim1 && !dataFim2) {
      // Período 1 tem fim, período 2 não tem fim
      return dataInicio2.getTime() <= dataFim1.getTime();
    } else if (!dataFim1 && dataFim2) {
      // Período 1 não tem fim, período 2 tem fim
      return dataInicio1.getTime() <= dataFim2.getTime();
    } else {
      // Ambos não têm fim - sempre há sobreposição
      return true;
    }
  }, []);

  // Função para verificar conflitos em todo o intervalo de dias (excluindo o próprio policial)
  const verificarConflitos = useCallback((dataInicio: string, dataFim?: string | null, colaboradorIdExcluir?: number): Afastamento[] => {
    if (!dataInicio) {
      return [];
    }

    // Verificar todos os afastamentos ativos que se sobrepõem com o período informado
    // Excluindo o próprio policial que está sendo cadastrado
    const conflitos = afastamentos.filter((afastamento) => {
      // Excluir o próprio policial
      if (colaboradorIdExcluir && afastamento.colaboradorId === colaboradorIdExcluir) {
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
        colaboradorId: Number(form.colaboradorId),
        motivoId: form.motivoId,
        descricao: form.descricao.trim() || undefined,
        dataInicio: form.dataInicio,
        dataFim: form.dataFim || undefined,
      });
      // Resetar form mantendo motivoId padrão
      const feriasMotivo = motivos.find((m) => m.nome === 'Férias');
      const motivoIdPadrao = feriasMotivo?.id || 0;
      setForm({
        colaboradorId: '',
        motivoId: motivoIdPadrao,
        descricao: '',
        dataInicio: '',
        dataFim: '',
      });
      setSuccess('Afastamento cadastrado com sucesso.');
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

    if (!form.colaboradorId) {
      setError('Selecione um policial.');
      return;
    }

    if (!form.motivoId || form.motivoId === 0) {
      setError('Selecione um motivo do afastamento.');
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
    const colaboradorId = Number(form.colaboradorId);
    const afastamentosDoMesmoPolicial = afastamentos.filter(
      (afastamento) =>
        afastamento.colaboradorId === colaboradorId &&
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
    const conflitos = verificarConflitos(form.dataInicio, form.dataFim || null, colaboradorId);
    
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
      const colaboradorId = Number(form.colaboradorId);
      const colaborador = colaboradores.find((c) => c.id === colaboradorId);
      
      if (!colaborador) {
        setError('Colaborador não encontrado.');
        return;
      }

      const dataInicio = new Date(form.dataInicio);
      const ano = dataInicio.getFullYear();
      const diasSolicitados = calcularDiasEntreDatas(form.dataInicio, form.dataFim || undefined);
      
      if (!form.dataFim) {
        setError('Para férias e abono, é necessário informar a data de término.');
        return;
      }

      // Validar sobreposição de férias (não pode ter férias sobrepostas)
      if (motivoNome === 'Férias') {
        const motivoFeriasId = motivos.find((m) => m.nome === 'Férias')?.id;
        if (motivoFeriasId) {
          const fériasExistentes = afastamentos.filter(
            (afastamento) =>
              afastamento.colaboradorId === colaboradorId &&
              afastamento.motivoId === motivoFeriasId &&
              afastamento.status === 'ATIVO',
          );

        for (const feriasExistente of fériasExistentes) {
          // Verificar se há sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
          // Período novo: [form.dataInicio, form.dataFim]
          // Período existente: [feriasExistente.dataInicio, feriasExistente.dataFim]
          // Sobreposição se: novoInicio <= existenteFim && existenteInicio <= novoFim
          
          // Criar datas de forma segura (usando formato ISO para evitar problemas de timezone)
          // Extrair apenas a parte da data (YYYY-MM-DD) de strings ISO
          const extrairDataStr = (dataStr: string): string => {
            if (!dataStr) return '';
            // Se já está no formato YYYY-MM-DD, retornar direto
            if (dataStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
              return dataStr;
            }
            // Se está no formato ISO, extrair a parte da data
            return dataStr.split('T')[0];
          };

          const novoInicioStr = form.dataInicio;
          const novoFimStr = form.dataFim || null;
          const existenteInicioStr = extrairDataStr(feriasExistente.dataInicio);
          const existenteFimStr = feriasExistente.dataFim 
            ? extrairDataStr(feriasExistente.dataFim) 
            : null;

          // Comparar strings de data diretamente (formato YYYY-MM-DD)
          // Strings no formato YYYY-MM-DD podem ser comparadas diretamente
          let haSobreposicao = false;
          
          if (novoFimStr && existenteFimStr) {
            // Ambos têm data fim
            // Sobreposição se há pelo menos um dia em comum
            // Períodos consecutivos (um termina no dia X, outro começa no dia X+1) NÃO se sobrepõem
            // Strings no formato YYYY-MM-DD podem ser comparadas diretamente
            
            // Verificar sobreposição: períodos se sobrepõem se há pelo menos um dia em comum
            // Período existente: [existenteInicio, existenteFim] - o policial está de férias até o dia existenteFim (inclusive)
            // Período novo: [novoInicio, novoFim] - o policial estaria de férias a partir do dia novoInicio (inclusive)
            // Sobreposição se: novoInicio < existenteFim && existenteInicio < novoFim
            // (usar < em vez de <= porque se um termina em X e outro começa em X, não há sobreposição - são adjacentes)
            
            const condicao1 = novoInicioStr < existenteFimStr;
            const condicao2 = existenteInicioStr < novoFimStr;
            const haSobreposicaoBasica = condicao1 && condicao2;
            
            // Se não há sobreposição básica, verificar se são adjacentes (um termina em X, outro começa em X)
            // Adjacentes não são considerados sobrepostos
            if (!haSobreposicaoBasica) {
              const saoAdjacentes1 = novoInicioStr === existenteFimStr; // Novo começa quando existente termina
              const saoAdjacentes2 = existenteInicioStr === novoFimStr; // Existente começa quando novo termina
              
              // Se são adjacentes, não há sobreposição
              haSobreposicao = !(saoAdjacentes1 || saoAdjacentes2);
            } else {
              // Há sobreposição básica
              haSobreposicao = true;
            }
          } else if (novoFimStr && !existenteFimStr) {
            // Novo tem fim, existente não tem fim (sem fim = infinito)
            // Sobreposição se: existenteInicio <= novoFim
            haSobreposicao = existenteInicioStr <= novoFimStr;
          } else if (!novoFimStr && existenteFimStr) {
            // Novo não tem fim (infinito), existente tem fim
            // Sobreposição se: novoInicio <= existenteFim
            haSobreposicao = novoInicioStr <= existenteFimStr;
          } else {
            // Ambos não têm fim - sempre há sobreposição
            haSobreposicao = true;
          }

          if (haSobreposicao) {
            setError(
              'Policial já em usufruto de férias no período selecionado. Alterar a data.',
            );
            return;
          }
        }
        }
      }

      const diasUsados = calcularDiasUsadosNoAno(colaboradorId, form.motivoId, ano);
      const limiteDias = motivoNome === 'Férias' ? 30 : 5;
      const diasRestantes = limiteDias - diasUsados;
      const totalAposCadastro = diasUsados + diasSolicitados;
      const ultrapassa = totalAposCadastro > limiteDias;

      // Validar se o período solicitado ultrapassa o limite
      if (diasSolicitados > limiteDias) {
        setValidacaoDiasModal({
          open: true,
          tipo: motivoNome === 'Férias' ? 'ferias' : 'abono',
          diasUsados,
          diasRestantes,
          diasSolicitados,
          colaboradorNome: colaborador.nome,
          ultrapassa: true,
        });
        return;
      }

      // Mostrar modal informativo mesmo se não ultrapassar
      setValidacaoDiasModal({
        open: true,
          tipo: motivoNome === 'Férias' ? 'ferias' : 'abono',
        diasUsados,
        diasRestantes,
        diasSolicitados,
        colaboradorNome: colaborador.nome,
        ultrapassa: ultrapassa,
      });
      return;
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

  const handleConfirmarValidacaoDias = async () => {
    if (validacaoDiasModal.ultrapassa) {
      // Se ultrapassa, não permite cadastrar
      setValidacaoDiasModal({
        open: false,
        tipo: 'ferias',
        diasUsados: 0,
        diasRestantes: 0,
        diasSolicitados: 0,
        colaboradorNome: '',
        ultrapassa: false,
      });
      return;
    }

    // Se não ultrapassa, fecha o modal e continua com a submissão
    setValidacaoDiasModal({
      open: false,
      tipo: 'ferias',
      diasUsados: 0,
      diasRestantes: 0,
      diasSolicitados: 0,
      colaboradorNome: '',
      ultrapassa: false,
    });

    // Verificar conflitos novamente antes de submeter (caso algo tenha mudado)
    const colaboradorId = Number(form.colaboradorId);
    const conflitos = verificarConflitos(form.dataInicio, form.dataFim || null, colaboradorId);
    
    if (conflitos.length > 0) {
      // Mostrar modal de conflitos
      setConflitosModal({
        open: true,
        conflitos,
        dataVerificada: form.dataFim ? `${form.dataInicio} e ${form.dataFim}` : form.dataInicio,
      });
      return;
    }

    // Se não houver conflitos, submeter normalmente
    await submeterAfastamento();
  };

  const handleCancelarValidacaoDias = () => {
    setValidacaoDiasModal({
      open: false,
      tipo: 'ferias',
      diasUsados: 0,
      diasRestantes: 0,
      diasSolicitados: 0,
      colaboradorNome: '',
      ultrapassa: false,
    });
  };

  const handleDelete = (afastamento: Afastamento) => {
    openConfirm({
      title: 'Remover afastamento',
      message: `Deseja remover o afastamento "${afastamento.motivo.nome}" do policial ${afastamento.colaborador.nome}?`,
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

  const colaboradoresOrdenados = useMemo(
    () =>
      [...colaboradores].sort((a, b) =>
        a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
      ),
    [colaboradores],
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
    const [year, month] = selectedMonth.split('-').map(Number);

    const filtradoPorMes = !selectedMonth || Number.isNaN(year) || Number.isNaN(month)
      ? afastamentos
      : afastamentos.filter((afastamento) => {
          return periodoSobrepoeMes(
            afastamento.dataInicio,
            afastamento.dataFim,
            year,
            month,
          );
        });

    const filtradoPorMotivo =
      motivoFiltro
        ? filtradoPorMes.filter((afastamento) => afastamento.motivo.nome === motivoFiltro)
        : filtradoPorMes;

    if (!normalizedSearch) {
      return filtradoPorMotivo;
    }

    return filtradoPorMotivo.filter((afastamento) =>
      afastamento.colaborador.nome.includes(normalizedSearch),
    );
  }, [afastamentos, motivoFiltro, normalizedSearch, selectedMonth, periodoSobrepoeMes]);

  const descricaoPeriodo = useMemo(() => {
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
  }, [selectedMonth]);

  return (
    <section>
      <div>
        <h2>Afastamentos</h2>
        <p>Registre e acompanhe os afastamentos ativos e concluídos.</p>
      </div>

      {error && <div className="feedback error">{error}</div>}
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
          <label>
            Policial
            <select
              value={form.colaboradorId}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  colaboradorId: event.target.value,
                }))
              }
              required
            >
              <option value="">Selecione</option>
              {colaboradoresOrdenados.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nome} - {colaborador.matricula}
                </option>
              ))}
            </select>
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
              {motivos.map((motivo) => (
                <option key={motivo.id} value={motivo.id}>
                  {motivo.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
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
            {motivos.map((motivo) => (
              <option key={motivo.id} value={motivo.nome}>
                {motivo.nome}
              </option>
            ))}
          </select>
          <input
            type="month"
            className="search-input"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
          <span className="badge badge-muted">{descricaoPeriodo}</span>
        </div>
        {loading ? (
          <p className="empty-state">Carregando afastamentos...</p>
        ) : afastamentosFiltrados.length === 0 ? (
          <p className="empty-state">
            {selectedMonth
              ? 'Nenhum afastamento registrado neste mês.'
              : 'Nenhum afastamento cadastrado.'}
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Policial</th>
                <th>Motivo</th>
                <th>Período</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {afastamentosFiltrados.map((afastamento) => (
                <tr key={afastamento.id}>
                  <td>
                    <div>{afastamento.colaborador.nome}</div>
                    <small>{afastamento.colaborador.matricula}</small>
                  </td>
                  <td>
                    <div>{afastamento.motivo.nome}</div>
                    {afastamento.descricao && (
                      <small>{afastamento.descricao}</small>
                    )}
                  </td>
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
          <div className="modal" style={{ maxWidth: '600px' }}>
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
                    <th>Motivo</th>
                    <th>Período</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {conflitosModal.conflitos.map((afastamento) => (
                    <tr key={afastamento.id}>
                      <td>
                        <div>{afastamento.colaborador.nome}</div>
                        <small>{afastamento.colaborador.matricula}</small>
                      </td>
                      <td>
                        <div>{afastamento.motivo.nome}</div>
                        {afastamento.descricao && (
                          <small>{afastamento.descricao}</small>
                        )}
                      </td>
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

      {/* Modal de Validação de Dias (Férias/Abono) */}
      {validacaoDiasModal.open && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h3>
              {validacaoDiasModal.tipo === 'ferias' ? 'Validação de Férias' : 'Validação de Abono'}
            </h3>
            {validacaoDiasModal.ultrapassa ? (
              <>
                <div className="feedback error" style={{ marginBottom: '16px' }}>
                  <strong>Período inválido!</strong>
                  <p style={{ margin: '8px 0 0', fontSize: '0.9rem' }}>
                    O período informado de <strong>{validacaoDiasModal.diasSolicitados} dias</strong> ultrapassa o limite de{' '}
                    <strong>{validacaoDiasModal.tipo === 'ferias' ? '30 dias' : '5 dias'}</strong> por ano.
                  </p>
                </div>
                <p style={{ marginBottom: '16px', color: '#475569' }}>
                  <strong>{validacaoDiasModal.colaboradorNome}</strong> já usufruiu{' '}
                  <strong>{validacaoDiasModal.diasUsados} dias</strong> de{' '}
                  {validacaoDiasModal.tipo === 'ferias' ? 'férias' : 'abono'} no ano, restando apenas{' '}
                  <strong>{validacaoDiasModal.diasRestantes} dias</strong>.
                </p>
              </>
            ) : (
              <p style={{ marginBottom: '16px', color: '#475569' }}>
                <strong>{validacaoDiasModal.colaboradorNome}</strong> já usufruiu{' '}
                <strong>{validacaoDiasModal.diasUsados} dias</strong> de{' '}
                {validacaoDiasModal.tipo === 'ferias' ? 'férias' : 'abono'} no ano, restando apenas{' '}
                <strong>{validacaoDiasModal.diasRestantes} dias</strong>.
              </p>
            )}
            <p style={{ marginBottom: '16px', color: '#64748b', fontSize: '0.9rem' }}>
              Período solicitado: <strong>{validacaoDiasModal.diasSolicitados} dias</strong>
            </p>
            {!validacaoDiasModal.ultrapassa && (
              <p style={{ marginBottom: '16px', color: '#166534', fontSize: '0.9rem' }}>
                Após este cadastro, restarão{' '}
                <strong>{validacaoDiasModal.diasRestantes - validacaoDiasModal.diasSolicitados} dias</strong>.
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelarValidacaoDias}
                disabled={submitting}
              >
                {validacaoDiasModal.ultrapassa ? 'Fechar' : 'Cancelar'}
              </button>
              {!validacaoDiasModal.ultrapassa && (
                <button
                  type="button"
                  className="primary"
                  onClick={handleConfirmarValidacaoDias}
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Confirmar e continuar'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
