import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type { Afastamento, MotivoAfastamentoOption, Usuario } from '../../types';
import { STATUS_LABEL, POLICIAL_STATUS_OPTIONS } from '../../constants';
import { formatPeriodo, formatDate } from '../../utils/dateUtils';
import { Button } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';

interface DashboardSectionProps {
  currentUser: Usuario;
}

export function DashboardSection({ currentUser }: DashboardSectionProps) {
  const [afastamentos, setAfastamentos] = useState<Afastamento[]>([]);
  const [motivos, setMotivos] = useState<MotivoAfastamentoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [motivoFiltro, setMotivoFiltro] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [dataInicioFiltro, setDataInicioFiltro] = useState<string>('');
  const [dataFimFiltro, setDataFimFiltro] = useState<string>('');

  const getPolicialStatusClass = (status: Afastamento['policial']['status']) => {
    switch (status) {
      case 'ATIVO':
        return 'badge policial-status-ativo';
      case 'COMISSIONADO':
        return 'badge policial-status-comissionado';
      case 'DESIGNADO':
        return 'badge policial-status-designado';
      case 'PTTC':
        return 'badge policial-status-pttc';
      case 'DESATIVADO':
        return 'badge policial-status-desativado';
      default:
        return 'badge badge-muted';
    }
  };

  // Verificar se o usuário pode ver todos os afastamentos (ADMINISTRADOR, COMANDO, SAD)
  const usuarioPodeVerTodos = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'COMANDO' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  const carregarAfastamentos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.listAfastamentos();
      
      let filtrados = data;
      
      // Se o usuário não for ADMINISTRADOR, COMANDO ou SAD, filtrar apenas pela equipe
      if (!usuarioPodeVerTodos) {
        const equipeAtual = currentUser.equipe;
        filtrados = equipeAtual
          ? data.filter((afastamento) => {
              const policialEquipe = afastamento.policial?.equipe;
              // Incluir apenas se o policial tiver equipe e corresponder à equipe do usuário
              return policialEquipe && policialEquipe === equipeAtual;
            })
          : data;
      }
      // Se for ADMINISTRADOR, COMANDO ou SAD, mostrar todos os registros (sem filtro)
      
      setAfastamentos(filtrados);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível carregar os afastamentos.',
      );
    } finally {
      setLoading(false);
    }
    }, [currentUser.equipe, usuarioPodeVerTodos]);

  useEffect(() => {
    void carregarAfastamentos();
    void (async () => {
      try {
        const motivosData = await api.listMotivos();
        setMotivos(motivosData);
      } catch (err) {
        // Silenciosamente falha
      }
    })();
  }, [carregarAfastamentos]);

  // Função para verificar se um período de afastamento se sobrepõe com um mês específico
  const periodoSobrepoeMes = useCallback((
    dataInicio: string,
    dataFim: string | null | undefined,
    year: number,
    month: number,
  ): boolean => {
    // Calcular primeiro e último dia do mês
    const primeiroDiaMes = new Date(year, month - 1, 1);
    const ultimoDiaMes = new Date(year, month, 0, 23, 59, 59); // Último dia do mês

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

  // Função auxiliar para converter string de data em Date local
  const converterDataLocal = useCallback((dataStr: string): Date => {
    // Extrair apenas YYYY-MM-DD da string (pode vir como ISO com ou sem tempo)
    const dataParte = dataStr.split('T')[0].split(' ')[0];
    const [year, month, day] = dataParte.split('-').map(Number);
    // Criar data local (sem problemas de timezone)
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }, []);

  const afastamentosFiltrados = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toUpperCase();
    let resultado = afastamentos;

    // PRIMEIRO: Filtrar por intervalo de datas (tem prioridade ABSOLUTA sobre o filtro por mês)
    // CRÍTICO: Verificar se pelo menos um está preenchido
    const temFiltroDeDatas = (dataInicioFiltro && dataInicioFiltro.trim() !== '') || 
                             (dataFimFiltro && dataFimFiltro.trim() !== '');
    
    // IMPORTANTE: Quando há filtro de datas, selectedMonth DEVE ser ignorado completamente
    if (temFiltroDeDatas) {
      resultado = resultado.filter((afastamento) => {
        // Converter datas do afastamento para Date local
        const inicioAfastamento = converterDataLocal(afastamento.dataInicio);
        let fimAfastamento: Date | null = null;
        if (afastamento.dataFim) {
          // Converter a data fim para Date local
          // Quando a API retorna "2026-03-18T00:00:00.000Z", isso significa
          // que o período vai até o final do dia 17/03 (não inclui o dia 18)
          // Então, extraímos a data "2026-03-18", subtraímos 1 dia (fica 17/03)
          // e ajustamos para 23:59:59.999 para representar o último momento do dia 17
          const dataFimStr = afastamento.dataFim.split('T')[0]; // "2026-03-18"
          const [year, month, day] = dataFimStr.split('-').map(Number);
          fimAfastamento = new Date(year, month - 1, day, 23, 59, 59, 999);
          
          // Como a data veio como início do dia seguinte (18/03 00:00), 
          // precisamos subtrair 1 dia para representar o fim do dia anterior (17/03 23:59:59)
          fimAfastamento.setDate(fimAfastamento.getDate() - 1);
        }

        // Se ambos os filtros estão preenchidos, verificar sobreposição
        const inicioPreenchido = dataInicioFiltro && dataInicioFiltro.trim() !== '';
        const fimPreenchido = dataFimFiltro && dataFimFiltro.trim() !== '';
        
        if (inicioPreenchido && fimPreenchido) {
          const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
          const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
          
          // Validar que as datas foram parseadas corretamente
          if (Number.isNaN(yearInicio) || Number.isNaN(monthInicio) || Number.isNaN(dayInicio) ||
              Number.isNaN(yearFim) || Number.isNaN(monthFim) || Number.isNaN(dayFim)) {
            return false; // Data inválida, não incluir
          }
          
          const filtroInicio = new Date(yearInicio, monthInicio - 1, dayInicio, 0, 0, 0, 0);
          const filtroFim = new Date(yearFim, monthFim - 1, dayFim, 23, 59, 59, 999);

          if (fimAfastamento) {
            // PERÍODO COM FIM: Dois períodos se sobrepõem se há pelo menos um dia em comum
            // Extrair apenas a data (dia) para comparar, ignorando horas
            const fimAfastamentoDia = new Date(fimAfastamento.getFullYear(), fimAfastamento.getMonth(), fimAfastamento.getDate());
            const filtroInicioDia = new Date(filtroInicio.getFullYear(), filtroInicio.getMonth(), filtroInicio.getDate());
            const inicioAfastamentoDia = new Date(inicioAfastamento.getFullYear(), inicioAfastamento.getMonth(), inicioAfastamento.getDate());
            const filtroFimDia = new Date(filtroFim.getFullYear(), filtroFim.getMonth(), filtroFim.getDate());
            
            // Dois períodos [a, b] e [c, d] se sobrepõem se: a <= d && c <= b
            // Ou seja: inicioAfastamento <= filtroFim && filtroInicio <= fimAfastamento
            
            // Se o dia final do afastamento é ANTES do dia inicial do filtro, não há sobreposição
            // (ex: afastamento termina em 17/03, filtro começa em 18/03 → não há sobreposição)
            if (fimAfastamentoDia < filtroInicioDia) {
              return false;
            }
            
            // Se o dia inicial do afastamento é DEPOIS do dia final do filtro, não há sobreposição
            // (ex: afastamento começa em 26/03, filtro termina em 25/03 → não há sobreposição)
            if (inicioAfastamentoDia > filtroFimDia) {
              return false;
            }
            
            // Se chegou aqui, há sobreposição (há pelo menos um dia em comum)
            return true;
          } else {
            // PERÍODO SEM FIM: Se começa antes ou durante o filtro, há sobreposição
            return inicioAfastamento.getTime() <= filtroFim.getTime();
          }
        } else if (inicioPreenchido) {
          // Apenas início preenchido
          const [yearInicio, monthInicio, dayInicio] = dataInicioFiltro.split('-').map(Number);
          if (Number.isNaN(yearInicio) || Number.isNaN(monthInicio) || Number.isNaN(dayInicio)) {
            return false;
          }
          const filtroInicio = new Date(yearInicio, monthInicio - 1, dayInicio, 0, 0, 0, 0);
          if (fimAfastamento) {
            // Incluir se começa após o filtro OU se já está em andamento na data do filtro
            return inicioAfastamento.getTime() >= filtroInicio.getTime() || 
                   fimAfastamento.getTime() >= filtroInicio.getTime();
          } else {
            // Sem fim: incluir se começa após ou na data do filtro
            return inicioAfastamento.getTime() >= filtroInicio.getTime();
          }
        } else if (fimPreenchido) {
          // Apenas fim preenchido
          const [yearFim, monthFim, dayFim] = dataFimFiltro.split('-').map(Number);
          if (Number.isNaN(yearFim) || Number.isNaN(monthFim) || Number.isNaN(dayFim)) {
            return false;
          }
          const filtroFim = new Date(yearFim, monthFim - 1, dayFim, 23, 59, 59, 999);
          if (fimAfastamento) {
            // Incluir se termina antes ou na data fim OU se começa antes ou na data fim
            return fimAfastamento.getTime() <= filtroFim.getTime() || 
                   inicioAfastamento.getTime() <= filtroFim.getTime();
          } else {
            // Sem fim: incluir se começa antes ou na data fim
            return inicioAfastamento.getTime() <= filtroFim.getTime();
          }
        }

        return false;
      });
    }
    
    // SEGUNDO: Se NÃO há filtro de datas, aplicar filtro por mês
    // IMPORTANTE: Este bloco só executa se temFiltroDeDatas for FALSE
    if (!temFiltroDeDatas && selectedMonth && selectedMonth.trim() !== '') {
      const [year, month] = selectedMonth.split('-').map(Number);
      if (!Number.isNaN(year) && !Number.isNaN(month) && month >= 1 && month <= 12) {
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

    // TERCEIRO: Filtrar por motivo
    if (motivoFiltro && motivoFiltro.trim() !== '') {
      resultado = resultado.filter((afastamento) => afastamento.motivo.nome === motivoFiltro);
    }

    // QUARTO: Filtrar por busca de nome
    if (normalizedSearch) {
      resultado = resultado.filter((afastamento) =>
        afastamento.policial.nome.toUpperCase().includes(normalizedSearch),
      );
    }

    return resultado;
  }, [afastamentos, searchTerm, motivoFiltro, selectedMonth, dataInicioFiltro, dataFimFiltro, periodoSobrepoeMes, converterDataLocal]);

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
      const agora = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(agora);
    }

    const [year, month] = selectedMonth.split('-').map(Number);

    if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) {
      const agora = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(agora);
    }

    const dataReferencia = new Date(year, month - 1, 1);

    if (Number.isNaN(dataReferencia.getTime())) {
      const agora = new Date();
      return new Intl.DateTimeFormat('pt-BR', {
        month: 'long',
        year: 'numeric',
      }).format(agora);
    }

    return new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
    }).format(dataReferencia);
  }, [selectedMonth, dataInicioFiltro, dataFimFiltro]);

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Afastamentos do mês</h2>
          <p className="subtitle">Período: {descricaoPeriodo}</p>
        </div>
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
          type="date"
          className="search-input"
          value={dataInicioFiltro}
          onChange={(event) => {
            const novoValor = event.target.value;
            setDataInicioFiltro(novoValor);
            // CRÍTICO: Limpar filtro por mês quando usar intervalo de datas
            // Forçar limpeza imediata para evitar conflitos
            setSelectedMonth('');
          }}
          placeholder="Data início"
          title="Data início do período"
        />
        <input
          type="date"
          className="search-input"
          value={dataFimFiltro}
          onChange={(event) => {
            const novoValor = event.target.value;
            setDataFimFiltro(novoValor);
            // CRÍTICO: Limpar filtro por mês quando usar intervalo de datas
            // Forçar limpeza imediata para evitar conflitos
            setSelectedMonth('');
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
        {(dataInicioFiltro || dataFimFiltro) && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => {
              setDataInicioFiltro('');
              setDataFimFiltro('');
              // Restaurar selectedMonth para o mês atual quando limpar datas
              const now = new Date();
              setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
            }}
            title="Limpar filtro de intervalo de datas"
            sx={{
              whiteSpace: 'nowrap',
              textTransform: 'none',
              minWidth: 'auto',
            }}
          >
            Limpar Datas
          </Button>
        )}
        {selectedMonth && (() => {
          const now = new Date();
          const mesAtual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          return selectedMonth !== mesAtual;
        })() && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<ClearIcon />}
            onClick={() => {
              const now = new Date();
              setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
            }}
            title="Voltar para o mês atual"
            sx={{
              whiteSpace: 'nowrap',
              textTransform: 'none',
              minWidth: 'auto',
            }}
          >
            Mês Atual
          </Button>
        )}
        <button className="ghost" type="button" onClick={() => void carregarAfastamentos()}>
          Atualizar lista
        </button>
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

      {loading ? (
        <p className="empty-state">Carregando afastamentos...</p>
      ) : afastamentosFiltrados.length === 0 ? (
        <p className="empty-state">
          {dataInicioFiltro || dataFimFiltro || selectedMonth
            ? 'Nenhum afastamento encontrado no período selecionado.'
            : 'Nenhum afastamento encontrado para o período.'}
        </p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Policial</th>
              <th>Status do Policial</th>
              <th>Motivo</th>
              <th>Período</th>
              <th>Status do Afastamento</th>
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
                  <span className={getPolicialStatusClass(afastamento.policial.status)}>
                    {
                      POLICIAL_STATUS_OPTIONS.find(
                        (option) => option.value === afastamento.policial.status,
                      )?.label ?? afastamento.policial.status
                    }
                  </span>
                </td>
                <td>
                  <div>{afastamento.motivo.nome}</div>
                  {afastamento.descricao && <small>{afastamento.descricao}</small>}
                </td>
                <td>
                  {formatPeriodo(afastamento.dataInicio, afastamento.dataFim)}
                </td>
                <td>
                  <span className="badge">{STATUS_LABEL[afastamento.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
