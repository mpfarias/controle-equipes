import { useEffect, useState, useMemo } from 'react';
import type { Usuario, Policial, Afastamento, Equipe } from '../../types';
import type { TabKey } from '../../constants';
import { 
  Box, 
  Paper, 
  Typography, 
  Grid, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton, 
  List, 
  ListItem, 
  ListItemText,
  Chip
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../api';
import { EQUIPE_FONETICA } from '../../constants';

interface DashboardHomeSectionProps {
  currentUser: Usuario;
  onTabChange?: (tab: TabKey) => void; // Mantido para compatibilidade, mas não usado no momento
  refreshKeyPoliciais?: number;
  refreshKeyAfastamentos?: number;
}

export function DashboardHomeSection({
  currentUser,
  refreshKeyPoliciais = 0,
  refreshKeyAfastamentos = 0,
}: DashboardHomeSectionProps) {
  const [totalPoliciaisAfastados, setTotalPoliciaisAfastados] = useState<number | null>(null);
  const [totalPoliciaisCadastrados, setTotalPoliciaisCadastrados] = useState<number | null>(null);
  const [totalFerias, setTotalFerias] = useState<number | null>(null);
  const [totalAbono, setTotalAbono] = useState<number | null>(null);
  const [expedienteData, setExpedienteData] = useState<{
    total: number;
    afastados: number;
    disponiveis: number;
  } | null>(null);
  const [policiaisPorEquipe, setPoliciaisPorEquipe] = useState<Record<string, {
    total: number;
    afastados: number;
    disponiveis: number;
  }>>({});
  const [loadingAfastamentos, setLoadingAfastamentos] = useState(false);
  const [loadingPoliciais, setLoadingPoliciais] = useState(false);
  const [loadingExpediente, setLoadingExpediente] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'policiais' | 'afastamentos'>('policiais');
  const [policiaisModal, setPoliciaisModal] = useState<Policial[]>([]);
  const [afastamentosModal, setAfastamentosModal] = useState<Afastamento[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

  // Verificar se o usuário pode ver todos os afastamentos (ADMINISTRADOR, COMANDO, SAD)
  const usuarioPodeVerTodos = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'COMANDO' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  useEffect(() => {
    const carregarAfastamentosMes = async () => {
      try {
        setLoadingAfastamentos(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth(); // 0-11 (Janeiro = 0)
        
        const primeiroDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        // Para pegar o último dia do mês: new Date(year, month+1, 0) retorna o último dia do mês
        const ultimoDia = new Date(year, month + 1, 0);
        const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;
        
        const params: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(params);
        
        // Contar policiais únicos
        const policiaisUnicos = new Set(afastamentos.map((af) => af.policialId));
        setTotalPoliciaisAfastados(policiaisUnicos.size);
        
        // Contar férias
        const ferias = afastamentos.filter((af) => af.motivo?.nome?.toLowerCase() === 'férias');
        setTotalFerias(ferias.length);
        
        // Contar abono
        const abono = afastamentos.filter((af) => af.motivo?.nome?.toLowerCase() === 'abono');
        setTotalAbono(abono.length);
        
        // Buscar total de policiais por equipe PRIMEIRO para ter os dados atualizados
        const equipes = ['A', 'B', 'C', 'D', 'E'];
        const dadosPorEquipe: Record<string, {
          total: number;
          afastados: number;
          disponiveis: number;
        }> = {};
        
        // Buscar todos os policiais por equipe para garantir dados atualizados
        for (const equipe of equipes) {
          try {
            // Buscar todos os policiais da equipe (ATIVO, DESIGNADO, COMISSIONADO, PTTC)
            // Não incluir DESATIVADO
            const dataEquipe = await api.listPoliciaisPaginated({
              page: 1,
              pageSize: 1000, // Buscar todos para garantir dados atualizados
              includeAfastamentos: false,
              includeRestricoes: false,
              equipe: equipe,
              // Não passar status para incluir todos exceto DESATIVADO
              // O backend deve filtrar automaticamente ou vamos filtrar manualmente
            });
            
            // Filtrar para excluir DESATIVADOS manualmente
            // Incluir ATIVO, DESIGNADO, COMISSIONADO, PTTC (todos exceto DESATIVADO)
            const policiaisAtivos = dataEquipe.Policiales.filter(p => p.status !== 'DESATIVADO');
            const totalEquipe = policiaisAtivos.length;
            
            // Criar um Set com os IDs dos policiais ativos da equipe
            const idsPoliciaisEquipe = new Set(policiaisAtivos.map(p => p.id));
            
            // Debug: verificar dados retornados
            console.log(`Equipe ${equipe}:`, {
              totalNoBanco: dataEquipe.total,
              totalFiltrado: totalEquipe,
              policiaisRetornados: dataEquipe.Policiales.length,
              policiaisAtivos: policiaisAtivos.length,
              idsPoliciais: Array.from(idsPoliciaisEquipe),
              statusDetalhes: dataEquipe.Policiales.map(p => ({ 
                id: p.id, 
                nome: p.nome, 
                matricula: p.matricula, 
                equipe: p.equipe,
                status: p.status 
              })),
            });
            
            // Debug: verificar dados retornados
            console.log(`Equipe ${equipe}:`, {
              total: totalEquipe,
              policiaisRetornados: dataEquipe.Policiales.length,
              idsPoliciais: Array.from(idsPoliciaisEquipe),
              nomesPoliciais: dataEquipe.Policiales.map(p => ({ id: p.id, nome: p.nome, matricula: p.matricula, equipe: p.equipe })),
            });
            
            // Contar policiais únicos afastados dessa equipe
            const policiaisUnicosAfastados = new Set(
              afastamentos
                .filter((af) => idsPoliciaisEquipe.has(af.policialId))
                .map((af) => af.policialId)
            );
            
            const afastadosEquipeCount = policiaisUnicosAfastados.size;
            const disponiveisEquipe = Math.max(0, totalEquipe - afastadosEquipeCount);
            
            // Debug: verificar afastados
            console.log(`Equipe ${equipe} - Afastados:`, {
              totalAfastamentos: afastamentos.filter((af) => idsPoliciaisEquipe.has(af.policialId)).length,
              policiaisUnicosAfastados: Array.from(policiaisUnicosAfastados),
            });
            
            dadosPorEquipe[equipe] = {
              total: totalEquipe,
              afastados: afastadosEquipeCount,
              disponiveis: disponiveisEquipe,
            };
          } catch (error) {
            console.error(`Erro ao carregar policiais da equipe ${equipe}:`, error);
            dadosPorEquipe[equipe] = {
              total: 0,
              afastados: 0,
              disponiveis: 0,
            };
          }
        }
        
        setPoliciaisPorEquipe(dadosPorEquipe);
        
        // Debug: log dos afastamentos retornados
        console.log('Dashboard - Afastamentos do mês:', {
          totalAfastamentos: afastamentos.length,
          totalPoliciaisUnicos: policiaisUnicos.size,
          totalFerias: ferias.length,
          totalAbono: abono.length,
          dadosPorEquipe,
          periodo: `${primeiroDia} até ${ultimoDiaStr}`,
          policiaisIds: Array.from(policiaisUnicos),
        });
      } catch (error) {
        console.error('Erro ao carregar afastamentos do mês:', error);
        setTotalPoliciaisAfastados(0);
      } finally {
        setLoadingAfastamentos(false);
      }
    };

    void carregarAfastamentosMes();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyAfastamentos]);

  // Carregar total de policiais cadastrados
  useEffect(() => {
    const carregarTotalPoliciais = async () => {
      try {
        setLoadingPoliciais(true);
        const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
          page: 1,
          pageSize: 1000, // Buscar todos para poder filtrar DESATIVADOS
          includeAfastamentos: false,
          includeRestricoes: false,
          // Não passar status para incluir todos
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const data = await api.listPoliciaisPaginated(params);
        // Filtrar para excluir DESATIVADOS (incluir ATIVO, DESIGNADO, COMISSIONADO, PTTC)
        const policiaisAtivos = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
        setTotalPoliciaisCadastrados(policiaisAtivos.length);
      } catch (error) {
        console.error('Erro ao carregar total de policiais:', error);
        setTotalPoliciaisCadastrados(0);
      } finally {
        setLoadingPoliciais(false);
      }
    };

    void carregarTotalPoliciais();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais]);

  // Carregar policiais do Expediente Administrativo
  useEffect(() => {
    const carregarExpediente = async () => {
      try {
        setLoadingExpediente(true);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const primeiroDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(year, month + 1, 0);
        const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

        // Buscar função "EXPEDIENTE ADM"
        const funcoes = await api.listFuncoes();
        const funcaoExpediente = funcoes.find((f) => 
          f.nome.toUpperCase().includes('EXPEDIENTE ADM')
        );

        if (!funcaoExpediente) {
          console.warn('Função "EXPEDIENTE ADM" não encontrada');
          setExpedienteData({ total: 0, afastados: 0, disponiveis: 0 });
          return;
        }

        // Buscar policiais com função EXPEDIENTE ADM (incluir todos exceto DESATIVADO)
        const dataExpediente = await api.listPoliciaisPaginated({
          page: 1,
          pageSize: 1000, // Buscar todos
          includeAfastamentos: false,
          includeRestricoes: false,
          funcaoId: funcaoExpediente.id,
          // Não passar status para incluir todos exceto DESATIVADO
        });
        
        // Filtrar para excluir DESATIVADOS
        const policiaisExpedienteAtivos = dataExpediente.Policiales.filter((p) => p.status !== 'DESATIVADO');

        // Buscar afastamentos do mês para policiais do expediente
        const paramsAfastamentos: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          paramsAfastamentos.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(paramsAfastamentos);
        const idsExpediente = new Set(policiaisExpedienteAtivos.map((p) => p.id));
        const policiaisUnicosAfastados = new Set(
          afastamentos
            .filter((af) => idsExpediente.has(af.policialId))
            .map((af) => af.policialId)
        );

        const totalExpediente = policiaisExpedienteAtivos.length;
        const afastadosExpediente = policiaisUnicosAfastados.size;
        const disponiveisExpediente = Math.max(0, totalExpediente - afastadosExpediente);
        
        setExpedienteData({
          total: totalExpediente,
          afastados: afastadosExpediente,
          disponiveis: disponiveisExpediente,
        });
      } catch (error) {
        console.error('Erro ao carregar policiais do expediente:', error);
        setExpedienteData({ total: 0, afastados: 0, disponiveis: 0 });
      } finally {
        setLoadingExpediente(false);
      }
    };

    void carregarExpediente();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais, refreshKeyAfastamentos]);

  // Calcular policiais disponíveis
  const totalPoliciaisDisponiveis = useMemo(() => {
    if (totalPoliciaisCadastrados === null || totalPoliciaisAfastados === null) {
      return null;
    }
    return Math.max(0, totalPoliciaisCadastrados - totalPoliciaisAfastados);
  }, [totalPoliciaisCadastrados, totalPoliciaisAfastados]);

  // Estado para armazenar ID da função Expediente
  const [funcaoExpedienteId, setFuncaoExpedienteId] = useState<number | null>(null);

  // Carregar ID da função Expediente
  useEffect(() => {
    const carregarFuncaoExpediente = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcaoExpediente = funcoes.find((f) => 
          f.nome.toUpperCase().includes('EXPEDIENTE ADM')
        );
        if (funcaoExpediente) {
          setFuncaoExpedienteId(funcaoExpediente.id);
        }
      } catch (error) {
        console.error('Erro ao carregar função Expediente:', error);
      }
    };
    void carregarFuncaoExpediente();
  }, []);

  // Cards do dashboard
  const cards = useMemo(() => [
    {
      title: 'Afastamentos do Mês',
      description: loadingAfastamentos 
        ? 'Carregando...' 
        : 'Visualize e gerencie os afastamentos do mês atual',
      tab: 'afastamentos-mes' as TabKey,
      color: '#3b82f6',
      showCount: true,
      countValue: totalPoliciaisAfastados,
      loadingCount: loadingAfastamentos,
      filters: undefined,
    },
    {
      title: 'Policiais Disponíveis',
      description: 'Policiais disponíveis para trabalho no mês atual',
      tab: 'equipe' as TabKey,
      color: '#10b981',
      showCount: true,
      countValue: totalPoliciaisDisponiveis,
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: undefined,
    },
    {
      title: 'Férias',
      description: 'Férias cadastradas no mês atual',
      tab: 'afastamentos-mes' as TabKey,
      color: '#f59e0b',
      showCount: true,
      countValue: totalFerias,
      loadingCount: loadingAfastamentos,
      unit: 'férias',
      filters: { motivo: 'Férias' },
    },
    {
      title: 'Abono',
      description: 'Abonos cadastrados no mês atual',
      tab: 'afastamentos-mes' as TabKey,
      color: '#ec4899',
      showCount: true,
      countValue: totalAbono,
      loadingCount: loadingAfastamentos,
      unit: 'abono',
      filters: { motivo: 'Abono' },
    },
    {
      title: 'Expediente',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#06b6d4',
      showCount: false,
      isEquipe: true,
      isExpediente: true,
      loadingCount: loadingExpediente || loadingAfastamentos,
      filters: funcaoExpedienteId ? { funcaoId: funcaoExpedienteId } : undefined,
    },
    {
      title: 'Equipe Alfa',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#8b5cf6',
      showCount: false,
      isEquipe: true,
      equipe: 'A',
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: { equipe: 'A' },
    },
    {
      title: 'Equipe Bravo',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#a855f7',
      showCount: false,
      isEquipe: true,
      equipe: 'B',
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: { equipe: 'B' },
    },
    {
      title: 'Equipe Charlie',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#c084fc',
      showCount: false,
      isEquipe: true,
      equipe: 'C',
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: { equipe: 'C' },
    },
    {
      title: 'Equipe Delta',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#d8b4fe',
      showCount: false,
      isEquipe: true,
      equipe: 'D',
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: { equipe: 'D' },
    },
    {
      title: 'Equipe Echo',
      description: '',
      tab: 'equipe' as TabKey,
      color: '#e9d5ff',
      showCount: false,
      isEquipe: true,
      equipe: 'E',
      loadingCount: loadingAfastamentos || loadingPoliciais,
      filters: { equipe: 'E' },
    },
  ], [loadingAfastamentos, totalPoliciaisAfastados, totalPoliciaisDisponiveis, loadingPoliciais, totalFerias, totalAbono, policiaisPorEquipe, expedienteData, loadingExpediente, funcaoExpedienteId]);

  const handleNumberClick = async (
    card: { title: string; filters?: { equipe?: string; motivo?: string; funcaoId?: number }; isEquipe?: boolean; isExpediente?: boolean; equipe?: string },
    tipo: 'total' | 'afastados' | 'disponiveis'
  ) => {
    setModalTitle(`${card.title} - ${tipo === 'total' ? 'Total' : tipo === 'afastados' ? 'Afastados' : 'Disponíveis'}`);
    setModalOpen(true);
    setLoadingModal(true);
    setModalType('policiais');

    try {
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1000, // Buscar todos
        includeAfastamentos: false,
        includeRestricoes: false,
        // Não passar status para incluir todos exceto DESATIVADO
      };

      if (card.filters?.equipe) {
        params.equipe = card.filters.equipe as Equipe;
      }

      if (card.filters?.funcaoId) {
        params.funcaoId = card.filters.funcaoId;
      }

      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe as Equipe;
      }

      const data = await api.listPoliciaisPaginated(params);
      const todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');

      // Se for "afastados" ou "disponiveis", filtrar por afastamentos do mês
      if (tipo === 'afastados' || tipo === 'disponiveis') {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const primeiroDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(year, month + 1, 0);
        const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

        const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          afastamentosParams.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(afastamentosParams);
        const idsPoliciais = new Set(todosPoliciais.map((p) => p.id));

        // Filtrar afastamentos apenas dos policiais da equipe/expediente
        const afastadosDaEquipe = new Set(
          afastamentos
            .filter((af) => idsPoliciais.has(af.policialId))
            .map((af) => af.policialId)
        );

        if (tipo === 'afastados') {
          const policiaisAfastados = todosPoliciais.filter((p) => afastadosDaEquipe.has(p.id));
          setPoliciaisModal(policiaisAfastados);
        } else {
          // disponiveis
          const policiaisDisponiveis = todosPoliciais.filter((p) => !afastadosDaEquipe.has(p.id));
          setPoliciaisModal(policiaisDisponiveis);
        }
      } else {
        // total - mostrar todos
        setPoliciaisModal(todosPoliciais);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do modal:', error);
      setModalOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleCardClick = async (card: { title: string; filters?: { equipe?: string; motivo?: string; funcaoId?: number }; isEquipe?: boolean; isExpediente?: boolean }) => {
    setModalTitle(card.title);
    setModalOpen(true);
    setLoadingModal(true);

    try {
      if (card.filters?.motivo) {
        // Card de motivo (Férias, Abono) - buscar afastamentos
        setModalType('afastamentos');
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        const primeiroDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(year, month + 1, 0);
        const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

        const params: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(params);
        const filtrados = afastamentos.filter((af) => 
          af.motivo?.nome?.toLowerCase() === card.filters!.motivo!.toLowerCase()
        );
        setAfastamentosModal(filtrados);
      } else if (card.title === 'Policiais Disponíveis') {
        // Card "Policiais Disponíveis" - buscar policiais que não estão afastados no mês
        setModalType('policiais');
        
        // Buscar todos os policiais (exceto DESATIVADOS)
        const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
          page: 1,
          pageSize: 1000, // Buscar todos
          includeAfastamentos: false,
          includeRestricoes: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe as Equipe;
        }

        const data = await api.listPoliciaisPaginated(params);
        const todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');

        // Buscar afastamentos do mês atual
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const primeiroDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const ultimoDia = new Date(year, month + 1, 0);
        const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;

        const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          afastamentosParams.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(afastamentosParams);
        const idsAfastados = new Set(afastamentos.map((af) => af.policialId));

        // Filtrar apenas os policiais que NÃO estão afastados
        const policiaisDisponiveis = todosPoliciais.filter((p) => !idsAfastados.has(p.id));
        setPoliciaisModal(policiaisDisponiveis);
      } else if (card.filters?.equipe || card.filters?.funcaoId) {
        // Card de equipe ou expediente - buscar policiais
        setModalType('policiais');
        const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
          page: 1,
          pageSize: 1000, // Buscar todos
          includeAfastamentos: false,
          includeRestricoes: false,
          // Não passar status para incluir todos exceto DESATIVADO
        };

        if (card.filters.equipe) {
          params.equipe = card.filters.equipe as Equipe;
        }

        if (card.filters.funcaoId) {
          params.funcaoId = card.filters.funcaoId;
        }

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe as Equipe;
        }

        const data = await api.listPoliciaisPaginated(params);
        
        // Filtrar apenas para excluir DESATIVADOS (incluir ATIVO, DESIGNADO, COMISSIONADO, PTTC)
        // Mostrar TODOS os policiais, independente de estarem afastados ou não
        const todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
        setPoliciaisModal(todosPoliciais);
      } else {
        // Cards sem filtro específico - não fazer nada por enquanto
        setModalOpen(false);
      }
    } catch (error) {
      console.error('Erro ao carregar dados do modal:', error);
      setModalOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Dashboard</h2>
          <p className="subtitle">
            Bem-vindo, {currentUser.nome} ({currentUser.matricula})
          </p>
        </div>
      </div>

      <Box sx={{ p: 3, width: '100%' }}>
        <Grid container spacing={3}>
          {cards.map((card, index) => (
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={`card-${card.title}-${index}`}>
              <Paper
                elevation={2}
                sx={{
                  p: 3,
                  height: '100%',
                  cursor: (card as any).isEquipe || (card as any).isExpediente ? 'default' : 'pointer',
                  transition: 'all 0.3s ease',
                  borderLeft: `4px solid ${card.color}`,
                  '&:hover': {
                    elevation: (card as any).isEquipe || (card as any).isExpediente ? 2 : 4,
                    transform: (card as any).isEquipe || (card as any).isExpediente ? 'none' : 'translateY(-4px)',
                    boxShadow: (card as any).isEquipe || (card as any).isExpediente ? 2 : 4,
                  },
                }}
                onClick={(e) => {
                  // Só permite clique se não for card de equipe ou expediente
                  if (!(card as any).isEquipe && !(card as any).isExpediente) {
                    handleCardClick(card);
                  } else {
                    // Para cards de equipe/expediente, prevenir propagação
                    e.stopPropagation();
                  }
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 1,
                    fontWeight: 600,
                    color: card.color,
                  }}
                >
                  {card.title}
                </Typography>
                {card.showCount && (
                  <Box sx={{ mb: 1, minHeight: '60px', display: 'flex', alignItems: 'center', gap: 1 }}>
                    {card.loadingCount ? (
                      <CircularProgress size={40} sx={{ color: card.color }} />
                    ) : card.countValue !== null ? (
                      <>
                        <Typography
                          variant="h3"
                          sx={{
                            fontWeight: 700,
                            color: card.color,
                            fontSize: '3rem',
                            lineHeight: 1,
                          }}
                        >
                          {card.countValue}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: 'text.secondary',
                            fontSize: '0.875rem',
                            alignSelf: 'flex-end',
                            pb: 0.5,
                          }}
                        >
                          {card.unit 
                            ? (card.unit === 'férias' 
                                ? 'férias' 
                                : card.countValue === 1 
                                  ? card.unit 
                                  : `${card.unit}s`)
                            : (card.countValue === 1 ? 'policial' : 'policiais')}
                        </Typography>
                      </>
                    ) : null}
                  </Box>
                )}
                {((card as any).isEquipe && (card as any).equipe) || (card as any).isExpediente ? (
                  <Box sx={{ mb: 1, minHeight: '60px' }}>
                    {(card as any).loadingCount ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60px' }}>
                        <CircularProgress size={40} sx={{ color: card.color }} />
                      </Box>
                    ) : (() => {
                      if ((card as any).isExpediente) {
                        if (expedienteData) {
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'baseline', 
                                  gap: 0.5,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.8 }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNumberClick(card, 'total');
                                }}
                              >
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  Total:
                                </Typography>
                                <Typography 
                                  variant="h4" 
                                  sx={{ 
                                    fontWeight: 700, 
                                    color: card.color, 
                                    fontSize: '2rem'
                                  }}
                                >
                                  {expedienteData.total}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  policiais
                                </Typography>
                              </Box>
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'baseline', 
                                  gap: 0.5,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.8 }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNumberClick(card, 'afastados');
                                }}
                              >
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  Afastados:
                                </Typography>
                                <Typography 
                                  variant="h5" 
                                  sx={{ 
                                    fontWeight: 700, 
                                    color: '#ef4444', 
                                    fontSize: '1.75rem'
                                  }}
                                >
                                  {expedienteData.afastados}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  policiais
                                </Typography>
                              </Box>
                              <Box 
                                sx={{ 
                                  display: 'flex', 
                                  alignItems: 'baseline', 
                                  gap: 0.5,
                                  cursor: 'pointer',
                                  '&:hover': { opacity: 0.8 }
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleNumberClick(card, 'disponiveis');
                                }}
                              >
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  Disponíveis:
                                </Typography>
                                <Typography 
                                  variant="h5" 
                                  sx={{ 
                                    fontWeight: 700, 
                                    color: '#10b981', 
                                    fontSize: '1.75rem'
                                  }}
                                >
                                  {expedienteData.disponiveis}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                  policiais
                                </Typography>
                              </Box>
                            </Box>
                          );
                        } else {
                          return (
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                              Carregando...
                            </Typography>
                          );
                        }
                      } else if ((card as any).equipe && policiaisPorEquipe[(card as any).equipe]) {
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'baseline', 
                                gap: 0.5,
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNumberClick(card, 'total');
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Total:
                              </Typography>
                              <Typography 
                                variant="h4" 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: card.color, 
                                  fontSize: '2rem'
                                }}
                              >
                                {policiaisPorEquipe[(card as any).equipe].total}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                policiais
                              </Typography>
                            </Box>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'baseline', 
                                gap: 0.5,
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNumberClick(card, 'afastados');
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Afastados:
                              </Typography>
                              <Typography 
                                variant="h5" 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: '#ef4444', 
                                  fontSize: '1.75rem'
                                }}
                              >
                                {policiaisPorEquipe[(card as any).equipe].afastados}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                policiais
                              </Typography>
                            </Box>
                            <Box 
                              sx={{ 
                                display: 'flex', 
                                alignItems: 'baseline', 
                                gap: 0.5,
                                cursor: 'pointer',
                                '&:hover': { opacity: 0.8 }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNumberClick(card, 'disponiveis');
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Disponíveis:
                              </Typography>
                              <Typography 
                                variant="h5" 
                                sx={{ 
                                  fontWeight: 700, 
                                  color: '#10b981', 
                                  fontSize: '1.75rem'
                                }}
                              >
                                {policiaisPorEquipe[(card as any).equipe].disponiveis}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                policiais
                              </Typography>
                            </Box>
                          </Box>
                        );
                      } else {
                        return (
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Carregando...
                          </Typography>
                        );
                      }
                    })()}
                  </Box>
                ) : null}
                {card.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {card.description}
                  </Typography>
                )}
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Modal com lista de policiais/afastamentos */}
      <Dialog 
        open={modalOpen} 
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { maxHeight: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">{modalTitle}</Typography>
          <IconButton onClick={() => setModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingModal ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <CircularProgress />
            </Box>
          ) : modalType === 'policiais' ? (
            <List>
              {policiaisModal.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Nenhum policial encontrado.
                </Typography>
              ) : (
                policiaisModal.map((policial) => (
                  <ListItem key={policial.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight={500}>
                            {policial.nome}
                          </Typography>
                          <Chip 
                            label={
                              policial.status === 'ATIVO' ? 'Ativo' :
                              policial.status === 'COMISSIONADO' ? 'Comissionado' :
                              policial.status === 'DESIGNADO' ? 'Designado' :
                              policial.status === 'PTTC' ? 'PTTC' : 'Desativado'
                            }
                            size="small"
                            sx={{
                              backgroundColor: 
                                policial.status === 'ATIVO' ? '#dcfce7' :
                                policial.status === 'COMISSIONADO' ? '#fee2e2' :
                                policial.status === 'DESIGNADO' ? '#fef9c3' :
                                policial.status === 'PTTC' ? '#dbeafe' : '#fee2e2',
                              color: 
                                policial.status === 'ATIVO' ? '#166534' :
                                policial.status === 'COMISSIONADO' ? '#991b1b' :
                                policial.status === 'DESIGNADO' ? '#92400e' :
                                policial.status === 'PTTC' ? '#1d4ed8' : '#991b1b',
                            }}
                          />
                          {policial.equipe && policial.equipe !== 'SEM_EQUIPE' && (
                            <Chip 
                              label={`Equipe ${policial.equipe} - ${EQUIPE_FONETICA[policial.equipe]}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            Matrícula: {policial.matricula}
                          </Typography>
                          {policial.funcao && (
                            <Typography variant="body2" color="text.secondary">
                              Função: {policial.funcao.nome}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          ) : (
            <List>
              {afastamentosModal.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Nenhum afastamento encontrado.
                </Typography>
              ) : (
                afastamentosModal.map((afastamento) => (
                  <ListItem key={afastamento.id} divider>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" fontWeight={500}>
                            {afastamento.policial.nome}
                          </Typography>
                          <Chip 
                            label={afastamento.motivo.nome} 
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            Matrícula: {afastamento.policial.matricula}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Período: {new Date(afastamento.dataInicio).toLocaleDateString('pt-BR')} 
                            {afastamento.dataFim ? ` até ${new Date(afastamento.dataFim).toLocaleDateString('pt-BR')}` : ' (sem data fim)'}
                          </Typography>
                          {afastamento.policial.equipe && afastamento.policial.equipe !== 'SEM_EQUIPE' && (
                            <Typography variant="body2" color="text.secondary">
                              Equipe: {afastamento.policial.equipe} - {EQUIPE_FONETICA[afastamento.policial.equipe]}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
