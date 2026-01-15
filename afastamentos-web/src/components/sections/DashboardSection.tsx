import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../api';
import type { Afastamento, MotivoAfastamentoOption, Usuario } from '../../types';
import { STATUS_LABEL, POLICIAL_STATUS_OPTIONS } from '../../constants';
import { formatPeriodo } from '../../utils/dateUtils';

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

  const afastamentosFiltrados = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toUpperCase();
 
    const [year, month] = selectedMonth.split('-').map(Number);
 
    const filtradoPorMes =
      Number.isNaN(year) || Number.isNaN(month)
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
      afastamento.policial.nome.includes(normalizedSearch),
    );
  }, [afastamentos, searchTerm, motivoFiltro, selectedMonth, periodoSobrepoeMes]);

  const descricaoPeriodo = useMemo(() => {
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
  }, [selectedMonth]);

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
          type="month"
          className="search-input"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
        />
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
        <p className="empty-state">Nenhum afastamento encontrado para o período.</p>
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
                  <span className="badge badge-muted">
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
