import { useEffect, useState, useMemo } from 'react';
import type { Usuario, Policial, Afastamento, Equipe } from '../../types';
import type { TabKey } from '../../constants';
import { 
  Alert,
  Box, 
  Button,
  Card,
  CardContent,
  Paper, 
  Typography, 
  Grid, 
  CircularProgress, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  IconButton, 
  Link,
  List, 
  ListItem, 
  ListItemText,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  alpha
} from '@mui/material';
import { Close as CloseIcon, Groups, MilitaryTech, EventBusy, PersonSearch, BeachAccess, WbSunny, DirectionsCar, Diversity1, BusinessCenter } from '@mui/icons-material';
import { api } from '../../api';
import { formatEquipeLabel } from '../../constants';
import { formatNome, formatMatricula } from '../../utils/dateUtils';
import { comparePorPatenteENome, sortPorPatenteENome, sortAfastamentosPorPatenteENome } from '../../utils/sortPoliciais';

interface DashboardHomeSectionProps {
  currentUser: Usuario;
  onTabChange?: (tab: TabKey, options?: { preencherCadastro?: { policialId: number; motivoNome: string } }) => void;
  refreshKeyPoliciais?: number;
  refreshKeyAfastamentos?: number;
}

export function DashboardHomeSection({
  currentUser,
  onTabChange,
  refreshKeyPoliciais = 0,
  refreshKeyAfastamentos = 0,
}: DashboardHomeSectionProps) {
  const [totalPoliciaisAfastados, setTotalPoliciaisAfastados] = useState<number | null>(null);
  const [totalPoliciaisCadastrados, setTotalPoliciaisCadastrados] = useState<number | null>(null);
  const [efetivoPorStatus, setEfetivoPorStatus] = useState<Record<string, number>>({
    ATIVO: 0,
    PTTC: 0,
    DESIGNADO: 0,
    COMISSIONADO: 0,
  });
  const [efetivoPorPosto, setEfetivoPorPosto] = useState<Record<string, number>>({
    oficiais: 0,
    pracas: 0,
    civis: 0,
    outros: 0,
  });
  const [totalFerias, setTotalFerias] = useState<number | null>(null);
  const [totalAbono, setTotalAbono] = useState<number | null>(null);
  const [expedienteData, setExpedienteData] = useState<{
    total: number;
    afastados: number;
    disponiveis: number;
  } | null>(null);
  const [motoristasData, setMotoristasData] = useState<{
    total: number;
    afastados: number;
    disponiveis: number;
  } | null>(null);
  const [copomMulherData, setCopomMulherData] = useState<{
    total: number;
    afastados: number;
    disponiveis: number;
  } | null>(null);
  const [policiaisPorEquipe, setPoliciaisPorEquipe] = useState<Record<string, {
    total: number;
    afastados: number;
    disponiveis: number;
  }>>(() => {
    // Inicializar todas as equipes com zero para evitar "Carregando..."
    const inicial: Record<string, { total: number; afastados: number; disponiveis: number }> = {};
    ['A', 'B', 'C', 'D', 'E'].forEach(equipe => {
      inicial[equipe] = { total: 0, afastados: 0, disponiveis: 0 };
    });
    return inicial;
  });
  const [loadingAfastamentos, setLoadingAfastamentos] = useState(false);
  const [loadingPoliciais, setLoadingPoliciais] = useState(false);
  const [loadingExpediente, setLoadingExpediente] = useState(false);
  const [loadingMotoristas, setLoadingMotoristas] = useState(false);
  const [loadingCopomMulher, setLoadingCopomMulher] = useState(false);
  const [funcoesCopomMulherIds, setFuncoesCopomMulherIds] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'policiais' | 'afastamentos' | 'afastamentosPorMotivo'>('policiais');
  const [policiaisModal, setPoliciaisModal] = useState<Policial[]>([]);
  const [afastamentosModal, setAfastamentosModal] = useState<Afastamento[]>([]);
  const [afastamentosPorMotivoModal, setAfastamentosPorMotivoModal] = useState<{ motivo: string; count: number; porcentagem: number }[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  // Aba ativa na modal "Afastamentos do Mês" (Por motivo | Do Efetivo Total)
  const [afastamentosMesModalTab, setAfastamentosMesModalTab] = useState<0 | 1>(0);
  // Lista completa de afastamentos do mês (para aba "Por afastamento" e cálculo do efetivo)
  const [afastamentosMesCompletos, setAfastamentosMesCompletos] = useState<Afastamento[]>([]);
  // Policiais com férias programadas (mês atual/próximo) sem afastamento de Férias cadastrado
  const [feriasProgramadasSemAfastamento, setFeriasProgramadasSemAfastamento] = useState<Policial[] | null>(null);
  const [modalVerPoliciaisOpen, setModalVerPoliciaisOpen] = useState(false);
  // Policiais com férias programadas em meses anteriores (atrasadas) sem afastamento
  const [feriasAtrasadasSemAfastamento, setFeriasAtrasadasSemAfastamento] = useState<Policial[] | null>(null);
  const [modalVerPoliciaisAtrasadosOpen, setModalVerPoliciaisAtrasadosOpen] = useState(false);
  // Modal Efetivo por Posto - lista de policiais por categoria
  const [modalPostoOpen, setModalPostoOpen] = useState(false);
  const [modalPostoTipo, setModalPostoTipo] = useState<'oficiais' | 'pracas' | 'civil' | 'civis' | 'outros' | null>(null);
  const [modalPostoPoliciais, setModalPostoPoliciais] = useState<Policial[]>([]);
  const [loadingModalPosto, setLoadingModalPosto] = useState(false);
  // Modal Efetivo do COPOM - lista de policiais por status (Ativos, PTTC, Designados, Comissionados)
  const [modalStatusOpen, setModalStatusOpen] = useState(false);
  const [modalStatusTipo, setModalStatusTipo] = useState<'ATIVO' | 'PTTC' | 'DESIGNADO' | 'COMISSIONADO' | null>(null);
  const [modalStatusPoliciais, setModalStatusPoliciais] = useState<Policial[]>([]);
  const [loadingModalStatus, setLoadingModalStatus] = useState(false);

  // Estados para ano e mês selecionados
  const now = new Date();
  const anoAtual = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  const mesAtual = now.getMonth() + 1; // 1-12
  
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState<number>(mesAtual);

  // Verificar se o usuário pode ver todos os afastamentos (ADMINISTRADOR, COMANDO, SAD)
  const usuarioPodeVerTodos = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    return nivelNome === 'ADMINISTRADOR' || nivelNome === 'COMANDO' || nivelNome === 'SAD' || currentUser.isAdmin === true;
  }, [currentUser]);

  // Verificar se o usuário é do nível Cpmulher
  const usuarioEhCpmulher = useMemo(() => {
    const nivelNome = currentUser.nivel?.nome;
    const nivelNomeUpper = nivelNome?.toUpperCase();
    return nivelNomeUpper === 'CPMULHER' || nivelNomeUpper === 'COPOM MULHER' || nivelNomeUpper === 'COPOMULHER';
  }, [currentUser]);

  // Função helper para calcular primeiro e último dia do mês selecionado
  const getMesRange = (ano: number, mes: number) => {
    const primeiroDia = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const ultimoDia = new Date(ano, mes, 0);
    const ultimoDiaStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;
    return { primeiroDia, ultimoDiaStr, year: ano, month: mes - 1 }; // month - 1 porque Date usa 0-11
  };

  // Função helper para obter o range de datas do mês selecionado
  const getDataRange = () => {
    return getMesRange(anoSelecionado, mesSelecionado);
  };

  // Função helper para filtrar afastamentos que estão ativos durante o período selecionado (mês ou ano)
  const filtrarAfastamentosNoMes = (afastamentos: Afastamento[], primeiroDia: string, ultimoDiaStr: string) => {
    // Criar datas do início e fim do mês usando apenas ano, mês e dia (sem horas)
    const [anoInicio, mesInicio, diaInicio] = primeiroDia.split('-').map(Number);
    const primeiroDiaTimestamp = new Date(anoInicio, mesInicio - 1, diaInicio).getTime();
    
    const [anoFim, mesFim, diaFim] = ultimoDiaStr.split('-').map(Number);
    const ultimoDiaTimestamp = new Date(anoFim, mesFim - 1, diaFim, 23, 59, 59, 999).getTime();
    
    return afastamentos.filter((af) => {
      // Converter dataInicio para timestamp
      const afInicioStr = typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0];
      const [anoAfInicio, mesAfInicio, diaAfInicio] = afInicioStr.split('-').map(Number);
      const afInicioTimestamp = new Date(anoAfInicio, mesAfInicio - 1, diaAfInicio).getTime();
      
      // Converter dataFim para timestamp (se existir)
      let afFimTimestamp: number | null = null;
      if (af.dataFim) {
        const afFimStr = typeof af.dataFim === 'string' ? af.dataFim.split('T')[0] : new Date(af.dataFim).toISOString().split('T')[0];
        const [anoAfFim, mesAfFim, diaAfFim] = afFimStr.split('-').map(Number);
        afFimTimestamp = new Date(anoAfFim, mesAfFim - 1, diaAfFim, 23, 59, 59, 999).getTime();
      }
      
      // Um afastamento está ativo no mês se ele se sobrepõe ao período do mês
      // Para se sobrepor: início do afastamento <= fim do mês E (fim do afastamento >= início do mês OU não tem fim)
      const comecaAntesOuDurante = afInicioTimestamp <= ultimoDiaTimestamp;
      const terminaDepoisOuDurante = afFimTimestamp === null || afFimTimestamp >= primeiroDiaTimestamp;
      
      const estaAtivo = comecaAntesOuDurante && terminaDepoisOuDurante;
      
      return estaAtivo;
    });
  };

  // Gerar lista de anos (a partir de 2026 até 5 anos no futuro)
  const anosDisponiveis = useMemo(() => {
    const anos: number[] = [];
    const anoMinimo = 2026;
    const hoje = new Date();
    const anoMaximo = Math.max(anoMinimo, hoje.getFullYear() + 5);
    
    for (let ano = anoMinimo; ano <= anoMaximo; ano++) {
      anos.push(ano);
    }
    
    return anos;
  }, []);

  // Lista de meses
  const mesesDisponiveis = useMemo(() => {
    return [
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
  }, []);

  useEffect(() => {
    const carregarAfastamentosMes = async () => {
      try {
        setLoadingAfastamentos(true);
        const { primeiroDia, ultimoDiaStr } = getDataRange();
        
        // Buscar afastamentos com um intervalo maior para pegar todos que podem se sobrepor ao mês
        // A API retorna afastamentos que começam antes ou durante o período e terminam depois ou durante
        // Mas precisamos filtrar para garantir que estão realmente ativos no mês
        const params: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(params);
        
        // Se for Cpmulher, filtrar afastamentos apenas de policiais com as funções permitidas
        let afastamentosFiltrados = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          // Buscar todos os policiais com as funções permitidas
          const todosPoliciaisCpmulher: Policial[] = [];
          for (const funcaoId of funcoesCopomMulherIds) {
            const dataPoliciais = await api.listPoliciaisPaginated({
              page: 1,
              pageSize: 1000,
              includeAfastamentos: false,
              includeRestricoes: false,
              funcaoId: funcaoId,
            });
            todosPoliciaisCpmulher.push(...dataPoliciais.Policiales);
          }
          
          // Remover duplicatas e criar Set de IDs
          const idsPoliciaisCpmulher = new Set(
            Array.from(new Map(todosPoliciaisCpmulher.map(p => [p.id, p])).values())
              .filter((p) => p.status !== 'DESATIVADO')
              .map((p) => p.id)
          );
          
          // Filtrar afastamentos apenas dos policiais permitidos
          afastamentosFiltrados = afastamentos.filter((af) => idsPoliciaisCpmulher.has(af.policialId));
        }
        
        // Filtrar afastamentos que realmente estão ativos durante o mês selecionado
        const afastamentosNoMes = filtrarAfastamentosNoMes(afastamentosFiltrados, primeiroDia, ultimoDiaStr);
        
        // Debug: verificar se há afastamentos sendo filtrados incorretamente
        const afastamentosForaDoMes = afastamentos.filter((af) => {
          const afInicioStr = typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0];
          const [anoAfInicio, mesAfInicio] = afInicioStr.split('-').map(Number);
          const mesSelecionadoNum = mesSelecionado;
          const anoSelecionadoNum = anoSelecionado;
          
          // Se o afastamento começa em um mês diferente do selecionado, verificar se está sendo incluído incorretamente
          return (mesAfInicio !== mesSelecionadoNum || anoAfInicio !== anoSelecionadoNum) && 
                 afastamentosNoMes.some(af2 => af2.id === af.id);
        });
        
        if (afastamentosForaDoMes.length > 0) {
          console.warn('Afastamentos de outros meses sendo incluídos:', {
            mesSelecionado: `${mesSelecionado}/${anoSelecionado}`,
            afastamentos: afastamentosForaDoMes.map(af => ({
              id: af.id,
              inicio: typeof af.dataInicio === 'string' ? af.dataInicio.split('T')[0] : new Date(af.dataInicio).toISOString().split('T')[0],
              fim: af.dataFim ? (typeof af.dataFim === 'string' ? af.dataFim.split('T')[0] : new Date(af.dataFim).toISOString().split('T')[0]) : null,
              policialId: af.policialId
            }))
          });
        }
        
        // Contar policiais únicos
        const policiaisUnicos = new Set(afastamentosNoMes.map((af) => af.policialId));
        setTotalPoliciaisAfastados(policiaisUnicos.size);
        
        // Contar férias
        const ferias = afastamentosNoMes.filter((af) => af.motivo?.nome?.toLowerCase() === 'férias');
        setTotalFerias(ferias.length);
        
        // Contar abono
        const abono = afastamentosNoMes.filter((af) => af.motivo?.nome?.toLowerCase() === 'abono');
        setTotalAbono(abono.length);
        
        // Buscar função MOTORISTA DE DIA para excluir dos cálculos das equipes
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoMotorista = funcoesAtivas.find((f) => 
          f.nome.toUpperCase().includes('MOTORISTA DE DIA')
        );
        const funcaoMotoristaId = funcaoMotorista?.id;
        
        // Buscar total de policiais por equipe PRIMEIRO para ter os dados atualizados
        // Se o usuário não pode ver todos, carregar apenas a equipe dele
        // EXCEÇÃO: Se for Cpmulher, carregar todas as equipes (pois os policiais do COPOM Mulher podem estar em qualquer equipe)
        const equipesParaCarregar = (usuarioPodeVerTodos || usuarioEhCpmulher)
          ? ['A', 'B', 'C', 'D', 'E']
          : (currentUser.equipe ? [currentUser.equipe] : []);
        
        const dadosPorEquipe: Record<string, {
          total: number;
          afastados: number;
          disponiveis: number;
        }> = {};
        
        // SEMPRE inicializar todas as equipes com zero primeiro
        // Isso garante que o objeto tenha todas as chaves, evitando "Carregando..."
        ['A', 'B', 'C', 'D', 'E'].forEach(equipe => {
          dadosPorEquipe[equipe] = {
            total: 0,
            afastados: 0,
            disponiveis: 0,
          };
        });
        
        // Buscar todos os policiais por equipe para garantir dados atualizados
        for (const equipe of equipesParaCarregar) {
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
            let policiaisAtivos = dataEquipe.Policiales.filter(p => p.status !== 'DESATIVADO');
            
            // Excluir motoristas das equipes
            if (funcaoMotoristaId) {
              policiaisAtivos = policiaisAtivos.filter(p => p.funcaoId !== funcaoMotoristaId);
            }
            
            // Se for Cpmulher, filtrar apenas policiais com as funções permitidas (Analista e Telefonista 190 - Auxiliar)
            if (usuarioEhCpmulher) {
              if (funcoesCopomMulherIds.length === 0) {
                // Se ainda não temos os IDs das funções, não mostrar nenhum policial
                policiaisAtivos = [];
              } else {
                policiaisAtivos = policiaisAtivos.filter((p) => 
                  p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
                );
              }
            }
            
            const totalEquipe = policiaisAtivos.length;
            
            // Criar um Set com os IDs dos policiais ativos da equipe
            const idsPoliciaisEquipe = new Set(policiaisAtivos.map(p => p.id));
            
            // Filtrar afastamentos que realmente estão ativos durante o mês selecionado
            const afastamentosNoMesEquipe = filtrarAfastamentosNoMes(afastamentos, primeiroDia, ultimoDiaStr);
            
            // Contar policiais únicos afastados dessa equipe
            const policiaisUnicosAfastados = new Set(
              afastamentosNoMesEquipe
                .filter((af) => idsPoliciaisEquipe.has(af.policialId))
                .map((af) => af.policialId)
            );
            
            const afastadosEquipeCount = policiaisUnicosAfastados.size;
            const disponiveisEquipe = Math.max(0, totalEquipe - afastadosEquipeCount);
            
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
      } catch (error) {
        console.error('Erro ao carregar afastamentos do mês:', error);
        setTotalPoliciaisAfastados(0);
      } finally {
        setLoadingAfastamentos(false);
      }
    };

    void carregarAfastamentosMes();
  }, [currentUser.equipe, usuarioPodeVerTodos, usuarioEhCpmulher, funcoesCopomMulherIds, refreshKeyAfastamentos, anoSelecionado, mesSelecionado]);

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
        // status pode vir como string ou objeto { nome: string }
        const statusNome = (p: Policial) => (typeof p.status === 'object' && p.status && 'nome' in p.status) ? (p.status as { nome: string }).nome : String(p.status ?? '');
        let policiaisAtivos = data.Policiales.filter((p) => statusNome(p) !== 'DESATIVADO');
        
        // Se for Cpmulher, filtrar apenas policiais com as funções permitidas
        // Se não houver funções configuradas ainda, aguardar até que sejam carregadas
        if (usuarioEhCpmulher) {
          if (funcoesCopomMulherIds.length === 0) {
            // Aguardar até que as funções sejam carregadas
            setTotalPoliciaisCadastrados(0);
            setEfetivoPorStatus({ ATIVO: 0, PTTC: 0, DESIGNADO: 0, COMISSIONADO: 0 });
            setEfetivoPorPosto({ oficiais: 0, pracas: 0, civis: 0, outros: 0 });
            return;
          }
          policiaisAtivos = policiaisAtivos.filter((p) => 
            p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
          );
        }
        
        setTotalPoliciaisCadastrados(policiaisAtivos.length);

        // Contar por status (Ativos, PTTC, Designados, Comissionados)
        const counts: Record<string, number> = { ATIVO: 0, PTTC: 0, DESIGNADO: 0, COMISSIONADO: 0 };
        for (const p of policiaisAtivos) {
          const s = statusNome(p);
          if (s in counts) counts[s]++;
        }
        setEfetivoPorStatus(counts);

        // Contar por posto/graduação - endpoint dedicado no backend
        const equipeParaPosto = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
        const postosData = await api.getEfetivoPorPosto(equipeParaPosto);
        setEfetivoPorPosto({
          oficiais: postosData.oficiais,
          pracas: postosData.pracas,
          civis: postosData.civis,
          outros: postosData.outros,
        });
      } catch (error) {
        console.error('Erro ao carregar total de policiais:', error);
        setTotalPoliciaisCadastrados(0);
        setEfetivoPorStatus({ ATIVO: 0, PTTC: 0, DESIGNADO: 0, COMISSIONADO: 0 });
        setEfetivoPorPosto({ oficiais: 0, pracas: 0, civis: 0, outros: 0 });
      } finally {
        setLoadingPoliciais(false);
      }
    };

    void carregarTotalPoliciais();
  }, [currentUser.equipe, usuarioPodeVerTodos, usuarioEhCpmulher, funcoesCopomMulherIds, refreshKeyPoliciais]);

  // Carregar policiais do Expediente Administrativo
  useEffect(() => {
    const carregarExpediente = async () => {
      try {
        setLoadingExpediente(true);
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        // Buscar função "EXPEDIENTE ADM"
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoExpediente = funcoesAtivas.find((f) => 
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
        
        // Se for Cpmulher, filtrar apenas afastamentos de policiais com as funções permitidas
        let afastamentosFiltrados = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          const idsPoliciaisPermitidos = new Set(
            policiaisExpedienteAtivos
              .filter((p) => p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId))
              .map((p) => p.id)
          );
          afastamentosFiltrados = afastamentos.filter((af) => idsPoliciaisPermitidos.has(af.policialId));
          
          // Filtrar também os policiais do expediente
          const policiaisExpedienteFiltrados = policiaisExpedienteAtivos.filter((p) => 
            p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
          );
          const idsExpediente = new Set(policiaisExpedienteFiltrados.map((p) => p.id));
          const policiaisUnicosAfastados = new Set(
            afastamentosFiltrados
              .filter((af) => idsExpediente.has(af.policialId))
              .map((af) => af.policialId)
          );
          
          const totalExpediente = policiaisExpedienteFiltrados.length;
          const afastadosExpediente = policiaisUnicosAfastados.size;
          const disponiveisExpediente = Math.max(0, totalExpediente - afastadosExpediente);
          
          setExpedienteData({
            total: totalExpediente,
            afastados: afastadosExpediente,
            disponiveis: disponiveisExpediente,
          });
          return;
        }
        
        const idsExpediente = new Set(policiaisExpedienteAtivos.map((p) => p.id));
        const policiaisUnicosAfastados = new Set(
          afastamentosFiltrados
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
  }, [currentUser.equipe, usuarioPodeVerTodos, usuarioEhCpmulher, funcoesCopomMulherIds, refreshKeyPoliciais, refreshKeyAfastamentos, anoSelecionado, mesSelecionado]);

  // Carregar policiais Motoristas de Dia
  useEffect(() => {
    const carregarMotoristas = async () => {
      try {
        setLoadingMotoristas(true);
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        // Buscar função "MOTORISTA DE DIA"
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoMotorista = funcoesAtivas.find((f) => 
          f.nome.toUpperCase().includes('MOTORISTA DE DIA')
        );

        if (!funcaoMotorista) {
          console.warn('Função "MOTORISTA DE DIA" não encontrada');
          setMotoristasData({ total: 0, afastados: 0, disponiveis: 0 });
          return;
        }

        // Buscar policiais com função MOTORISTA DE DIA (incluir todos exceto DESATIVADO)
        const dataMotoristas = await api.listPoliciaisPaginated({
          page: 1,
          pageSize: 1000, // Buscar todos
          includeAfastamentos: false,
          includeRestricoes: false,
          funcaoId: funcaoMotorista.id,
          // Não passar status para incluir todos exceto DESATIVADO
        });
        
        // Filtrar para excluir DESATIVADOS
        const policiaisMotoristasAtivos = dataMotoristas.Policiales.filter((p) => p.status !== 'DESATIVADO');

        // Buscar afastamentos do mês para motoristas
        const paramsAfastamentos: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          paramsAfastamentos.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(paramsAfastamentos);
        
        // Se for Cpmulher, filtrar apenas afastamentos de policiais com as funções permitidas
        let afastamentosFiltrados = afastamentos;
        let policiaisMotoristasFiltrados = policiaisMotoristasAtivos;
        
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          // Filtrar apenas motoristas que também têm as funções permitidas (intersecção)
          policiaisMotoristasFiltrados = policiaisMotoristasAtivos.filter((p) => 
            p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
          );
          
          const idsMotoristas = new Set(policiaisMotoristasFiltrados.map((p) => p.id));
          afastamentosFiltrados = afastamentos.filter((af) => idsMotoristas.has(af.policialId));
        }
        
        const afastamentosNoMesMotoristas = filtrarAfastamentosNoMes(afastamentosFiltrados, primeiroDia, ultimoDiaStr);
        const idsMotoristas = new Set(policiaisMotoristasFiltrados.map((p) => p.id));
        const policiaisUnicosAfastados = new Set(
          afastamentosNoMesMotoristas
            .filter((af) => idsMotoristas.has(af.policialId))
            .map((af) => af.policialId)
        );

        const totalMotoristas = policiaisMotoristasFiltrados.length;
        const afastadosMotoristas = policiaisUnicosAfastados.size;
        const disponiveisMotoristas = Math.max(0, totalMotoristas - afastadosMotoristas);
        
        setMotoristasData({
          total: totalMotoristas,
          afastados: afastadosMotoristas,
          disponiveis: disponiveisMotoristas,
        });
      } catch (error) {
        console.error('Erro ao carregar motoristas:', error);
        setMotoristasData({ total: 0, afastados: 0, disponiveis: 0 });
      } finally {
        setLoadingMotoristas(false);
      }
    };

    void carregarMotoristas();
  }, [currentUser.equipe, usuarioPodeVerTodos, usuarioEhCpmulher, funcoesCopomMulherIds, refreshKeyPoliciais, refreshKeyAfastamentos, anoSelecionado, mesSelecionado]);

  // Carregar policiais COPOM Mulher (ANALISTA e TELEFONISTA 190 - AUXILIAR)
  useEffect(() => {
    const carregarCopomMulher = async () => {
      // Aguardar até que os IDs das funções estejam disponíveis
      if (funcoesCopomMulherIds.length === 0) {
        setCopomMulherData({ total: 0, afastados: 0, disponiveis: 0 });
        setLoadingCopomMulher(false);
        return;
      }
      
      try {
        setLoadingCopomMulher(true);
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        // Buscar policiais com qualquer uma das funções
        const todosPoliciaisCopomMulher: Policial[] = [];
        for (const funcaoId of funcoesCopomMulherIds) {
          const data = await api.listPoliciaisPaginated({
            page: 1,
            pageSize: 1000,
            includeAfastamentos: false,
            includeRestricoes: false,
            funcaoId: funcaoId,
          });
          todosPoliciaisCopomMulher.push(...data.Policiales);
        }

        // Remover duplicatas (policiais que podem ter múltiplas funções)
        const policiaisUnicos = Array.from(
          new Map(todosPoliciaisCopomMulher.map(p => [p.id, p])).values()
        );

        // Filtrar para excluir DESATIVADOS
        const policiaisCopomMulherAtivos = policiaisUnicos.filter((p) => p.status !== 'DESATIVADO');
        
        // Buscar afastamentos do mês para policiais do COPOM Mulher
        // O cartão COPOM Mulher sempre mostra todos os policiais com essas funções,
        // independente da equipe do usuário
        const paramsAfastamentos: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        const afastamentos = await api.listAfastamentos(paramsAfastamentos);
        const afastamentosNoMesCopomMulher = filtrarAfastamentosNoMes(afastamentos, primeiroDia, ultimoDiaStr);
        const idsCopomMulher = new Set(policiaisCopomMulherAtivos.map((p) => p.id));
        const policiaisUnicosAfastados = new Set(
          afastamentosNoMesCopomMulher
            .filter((af) => idsCopomMulher.has(af.policialId))
            .map((af) => af.policialId)
        );

        const totalCopomMulher = policiaisCopomMulherAtivos.length;
        const afastadosCopomMulher = policiaisUnicosAfastados.size;
        const disponiveisCopomMulher = Math.max(0, totalCopomMulher - afastadosCopomMulher);
        
        const dadosCopomMulher = {
          total: totalCopomMulher,
          afastados: afastadosCopomMulher,
          disponiveis: disponiveisCopomMulher,
        };
        
        setCopomMulherData(dadosCopomMulher);
      } catch (error) {
        console.error('Erro ao carregar COPOM Mulher:', error);
        setCopomMulherData({ total: 0, afastados: 0, disponiveis: 0 });
      } finally {
        setLoadingCopomMulher(false);
      }
    };

    void carregarCopomMulher();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais, refreshKeyAfastamentos, funcoesCopomMulherIds, anoSelecionado, mesSelecionado]);

  // Calcular policiais disponíveis
  const totalPoliciaisDisponiveis = useMemo(() => {
    if (totalPoliciaisCadastrados === null || totalPoliciaisAfastados === null) {
      return null;
    }
    return Math.max(0, totalPoliciaisCadastrados - totalPoliciaisAfastados);
  }, [totalPoliciaisCadastrados, totalPoliciaisAfastados]);

  // Estado para armazenar ID da função Expediente
  const [funcaoExpedienteId, setFuncaoExpedienteId] = useState<number | null>(null);
  // Estado para armazenar ID da função Motorista
  const [funcaoMotoristaId, setFuncaoMotoristaId] = useState<number | null>(null);

  // Carregar ID da função Expediente
  useEffect(() => {
    const carregarFuncaoExpediente = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoExpediente = funcoesAtivas.find((f) => 
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

  // Carregar ID da função Motorista de Dia
  useEffect(() => {
    const carregarFuncaoMotorista = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoMotorista = funcoesAtivas.find((f) => 
          f.nome.toUpperCase().includes('MOTORISTA DE DIA')
        );
        if (funcaoMotorista) {
          setFuncaoMotoristaId(funcaoMotorista.id);
        }
      } catch (error) {
        console.error('Erro ao carregar função Motorista:', error);
      }
    };
    void carregarFuncaoMotorista();
  }, []);

  // Carregar IDs das funções COPOM Mulher
  useEffect(() => {
    const carregarFuncoesCopomMulher = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        
        // Buscar função ANALISTA (busca exata primeiro, depois busca parcial)
        const funcaoAnalista = funcoesAtivas.find((f) => {
          const nomeUpper = f.nome.toUpperCase().trim();
          return nomeUpper === 'ANALISTA';
        }) || funcoesAtivas.find((f) => {
          const nomeUpper = f.nome.toUpperCase().trim();
          return nomeUpper.includes('ANALISTA') && !nomeUpper.includes('SUPERVISOR');
        });
        
        // Buscar função TELEFONISTA 190 - AUXILIAR (deve conter "TELEFONISTA", "190" E "AUXILIAR")
        const funcaoTelefonista = funcoesAtivas.find((f) => {
          const nomeUpper = f.nome.toUpperCase().trim();
          return nomeUpper.includes('TELEFONISTA') && 
                 nomeUpper.includes('190') && 
                 nomeUpper.includes('AUXILIAR');
        });
        
        const ids: number[] = [];
        if (funcaoAnalista) ids.push(funcaoAnalista.id);
        if (funcaoTelefonista) ids.push(funcaoTelefonista.id);
        setFuncoesCopomMulherIds(ids);
      } catch (error) {
        console.error('Erro ao carregar funções COPOM Mulher:', error);
      }
    };
    void carregarFuncoesCopomMulher();
  }, []);

  // Carregar policiais com férias programadas (mês atual e próximo) sem afastamento de Férias cadastrado
  useEffect(() => {
    const carregar = async () => {
      try {
        const equipe = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
        const lista = await api.getPoliciaisComFeriasProgramadasSemAfastamento(equipe);
        setFeriasProgramadasSemAfastamento(lista);
      } catch (error) {
        console.error('Erro ao carregar policiais com férias programadas sem afastamento:', error);
        setFeriasProgramadasSemAfastamento([]);
      }
    };
    void carregar();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais, refreshKeyAfastamentos]);

  // Carregar policiais com férias programadas em meses anteriores (atrasadas) sem afastamento
  useEffect(() => {
    const carregar = async () => {
      try {
        const equipe = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
        const lista = await api.getPoliciaisComFeriasAtrasadasSemAfastamento(equipe);
        setFeriasAtrasadasSemAfastamento(lista);
      } catch (error) {
        console.error('Erro ao carregar policiais com férias atrasadas sem afastamento:', error);
        setFeriasAtrasadasSemAfastamento([]);
      }
    };
    void carregar();
  }, [currentUser.equipe, usuarioPodeVerTodos, refreshKeyPoliciais, refreshKeyAfastamentos]);

  // Cards do dashboard
  const cards = useMemo(() => {
    const todosCards = [
      {
        title: 'Efetivo do COPOM',
        description: '',
        tab: 'equipe' as TabKey,
        color: '#6366f1',
        showCount: false,
        isEquipe: true,
        isEfetivo: true,
        loadingCount: loadingPoliciais,
        filters: undefined,
      },
      {
        title: 'Efetivo por Posto/Graduação',
        description: '',
        tab: 'equipe' as TabKey,
        color: '#0ea5e9',
        showCount: false,
        isEquipe: true,
        isEfetivoPosto: true,
        loadingCount: loadingPoliciais,
        filters: undefined,
      },
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
        porcentagemAfastamentos: totalPoliciaisCadastrados != null && totalPoliciaisCadastrados > 0 && totalPoliciaisAfastados != null
          ? Math.round((totalPoliciaisAfastados / totalPoliciaisCadastrados) * 1000) / 10
          : null,
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
        title: 'Equipe A',
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
        title: 'Equipe B',
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
        title: 'Equipe C',
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
        title: 'Equipe D',
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
        title: 'Equipe E',
        description: '',
        tab: 'equipe' as TabKey,
        color: '#e9d5ff',
        showCount: false,
        isEquipe: true,
        equipe: 'E',
        loadingCount: loadingAfastamentos || loadingPoliciais,
        filters: { equipe: 'E' },
      },
      {
        title: 'Motoristas',
        description: '',
        tab: 'equipe' as TabKey,
        color: '#f97316',
        showCount: false,
        isEquipe: true,
        isMotoristas: true,
        loadingCount: loadingMotoristas || loadingAfastamentos,
        filters: funcaoMotoristaId ? { funcaoId: funcaoMotoristaId } : undefined,
      },
      {
        title: 'COPOM Mulher',
        description: '',
        tab: 'equipe' as TabKey,
        color: '#ec4899',
        showCount: false,
        isEquipe: true,
        isCopomMulher: true,
        loadingCount: loadingCopomMulher || loadingAfastamentos,
        filters: funcoesCopomMulherIds.length > 0 ? { funcoesIds: funcoesCopomMulherIds } : undefined,
      },
    ];
    
    // Se for Cpmulher, ocultar os cards "Expediente" e "Motoristas"
    if (usuarioEhCpmulher) {
      return todosCards.filter(card => 
        card.title !== 'Expediente' && card.title !== 'Motoristas'
      );
    }
    
    return todosCards;
  }, [loadingAfastamentos, totalPoliciaisAfastados, totalPoliciaisCadastrados, totalPoliciaisDisponiveis, loadingPoliciais, totalFerias, totalAbono, policiaisPorEquipe, expedienteData, loadingExpediente, funcaoExpedienteId, motoristasData, loadingMotoristas, funcaoMotoristaId, copomMulherData, loadingCopomMulher, funcoesCopomMulherIds, usuarioEhCpmulher, efetivoPorStatus, efetivoPorPosto]);

  const cardsDestaque = useMemo(() =>
    cards.filter((c) => (c as { isEfetivo?: boolean; isEfetivoPosto?: boolean }).isEfetivo || (c as { isEfetivo?: boolean; isEfetivoPosto?: boolean }).isEfetivoPosto),
    [cards],
  );
  const cardsRestantes = useMemo(() =>
    cards.filter((c) => !(c as { isEfetivo?: boolean; isEfetivoPosto?: boolean }).isEfetivo && !(c as { isEfetivo?: boolean; isEfetivoPosto?: boolean }).isEfetivoPosto),
    [cards],
  );

  const handlePostoClick = async (posto: 'oficiais' | 'pracas' | 'civis' | 'outros') => {
    setModalPostoTipo(posto);
    setModalPostoOpen(true);
    setLoadingModalPosto(true);
    setModalPostoPoliciais([]);
    try {
      const equipe = !usuarioPodeVerTodos && currentUser.equipe ? currentUser.equipe : undefined;
      // Mapear chaves do frontend (plural) para o esperado pela API (singular)
      const postoApi =
        posto === 'oficiais' ? 'oficial' :
        posto === 'pracas' ? 'praca' :
        posto === 'civis' ? 'civil' : posto;
      const lista = await api.getPoliciaisPorPosto(postoApi, equipe);
      const ordenados = sortPorPatenteENome(lista);
      setModalPostoPoliciais(ordenados);
    } catch (error) {
      console.error('Erro ao carregar policiais por posto:', error);
      setModalPostoPoliciais([]);
    } finally {
      setLoadingModalPosto(false);
    }
  };

  const handleStatusClick = async (status: 'ATIVO' | 'PTTC' | 'DESIGNADO' | 'COMISSIONADO') => {
    setModalStatusTipo(status);
    setModalStatusOpen(true);
    setLoadingModalStatus(true);
    setModalStatusPoliciais([]);
    try {
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1000,
        includeAfastamentos: false,
        includeRestricoes: false,
        status,
      };
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      }
      const data = await api.listPoliciaisPaginated(params);
      let policiais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
      if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
        policiais = policiais.filter((p) => p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId));
      }
      const ordenados = sortPorPatenteENome(policiais);
      setModalStatusPoliciais(ordenados);
    } catch (error) {
      console.error('Erro ao carregar policiais por status:', error);
      setModalStatusPoliciais([]);
    } finally {
      setLoadingModalStatus(false);
    }
  };

  const handleEfetivoTotalClick = async () => {
    setModalTitle('Efetivo Total');
    setModalOpen(true);
    setLoadingModal(true);
    setModalType('policiais');
    try {
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1000,
        includeAfastamentos: false,
        includeRestricoes: false,
      };
      if (!usuarioPodeVerTodos && currentUser.equipe) {
        params.equipe = currentUser.equipe;
      }
      const data = await api.listPoliciaisPaginated(params);
      let policiais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
      if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
        policiais = policiais.filter((p) => p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId));
      }
      setPoliciaisModal(sortPorPatenteENome(policiais));
    } catch (error) {
      console.error('Erro ao carregar efetivo total:', error);
      setModalOpen(false);
    } finally {
      setLoadingModal(false);
    }
  };

  const handleNumberClick = async (
    card: { title: string; filters?: { equipe?: string; motivo?: string; funcaoId?: number; funcoesIds?: number[] }; isEquipe?: boolean; isExpediente?: boolean; isMotoristas?: boolean; isCopomMulher?: boolean; equipe?: string },
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

      // Se for COPOM Mulher, buscar policiais com múltiplas funções
      let todosPoliciais: Policial[] = [];
      if (card.filters?.funcoesIds && card.filters.funcoesIds.length > 0) {
        // Buscar policiais com qualquer uma das funções
        const todosPoliciaisTemp: Policial[] = [];
        for (const funcaoId of card.filters.funcoesIds) {
          const dataTemp = await api.listPoliciaisPaginated({
            ...params,
            funcaoId: funcaoId,
          });
          todosPoliciaisTemp.push(...dataTemp.Policiales);
        }
        // Remover duplicatas
        todosPoliciais = Array.from(
          new Map(todosPoliciaisTemp.map(p => [p.id, p])).values()
        ).filter((p) => p.status !== 'DESATIVADO');
      } else {
        const data = await api.listPoliciaisPaginated(params);
        todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
      }

      // Se for um card de equipe, excluir policiais com função MOTORISTA DE DIA
      if (card.equipe && funcaoMotoristaId) {
        todosPoliciais = todosPoliciais.filter((p) => p.funcaoId !== funcaoMotoristaId);
      }
      
      // Se for Cpmulher, filtrar apenas policiais com as funções permitidas (Analista e Telefonista 190 - Auxiliar)
      // Isso se aplica tanto para cards de equipe quanto para o card "COPOM Mulher"
      if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
        todosPoliciais = todosPoliciais.filter((p) => 
          p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
        );
      }

      // Se for "afastados" ou "disponiveis", filtrar por afastamentos do mês selecionado
      if (tipo === 'afastados' || tipo === 'disponiveis') {
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: true, // Incluir dados do policial para mostrar no modal
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          afastamentosParams.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(afastamentosParams);
        
        // Se for Cpmulher, filtrar afastamentos apenas de policiais com as funções permitidas
        // Isso se aplica tanto para cards de equipe quanto para o card "COPOM Mulher"
        let afastamentosFiltrados = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          const idsPoliciaisPermitidos = new Set(
            todosPoliciais
              .filter((p) => p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId))
              .map((p) => p.id)
          );
          afastamentosFiltrados = afastamentos.filter((af) => idsPoliciaisPermitidos.has(af.policialId));
        }
        
        const afastamentosNoMesModal = filtrarAfastamentosNoMes(afastamentosFiltrados, primeiroDia, ultimoDiaStr);
        const idsPoliciais = new Set(todosPoliciais.map((p) => p.id));

        // Filtrar afastamentos apenas dos policiais da equipe/expediente
        const afastamentosDaEquipe = afastamentosNoMesModal.filter((af) => idsPoliciais.has(af.policialId));

        if (tipo === 'afastados') {
          // Mostrar afastamentos com detalhes (motivo, datas)
          setModalType('afastamentos');
          setAfastamentosModal(sortAfastamentosPorPatenteENome(afastamentosDaEquipe));
        } else {
          // disponiveis - mostrar apenas policiais
          setModalType('policiais');
          const afastadosDaEquipe = new Set(afastamentosDaEquipe.map((af) => af.policialId));
          const policiaisDisponiveis = todosPoliciais.filter((p) => !afastadosDaEquipe.has(p.id));
          setPoliciaisModal(sortPorPatenteENome(policiaisDisponiveis));
        }
      } else {
        // total - mostrar todos
        setPoliciaisModal(sortPorPatenteENome(todosPoliciais));
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
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        const params: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(params);
        
        // Se for Cpmulher, filtrar afastamentos apenas de policiais com as funções permitidas
        let afastamentosFiltradosPorFuncao = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          // Buscar todos os policiais com as funções permitidas
          const todosPoliciaisCpmulher: Policial[] = [];
          for (const funcaoId of funcoesCopomMulherIds) {
            const dataPoliciais = await api.listPoliciaisPaginated({
              page: 1,
              pageSize: 1000,
              includeAfastamentos: false,
              includeRestricoes: false,
              funcaoId: funcaoId,
            });
            todosPoliciaisCpmulher.push(...dataPoliciais.Policiales);
          }
          
          // Remover duplicatas e criar Set de IDs
          const idsPoliciaisCpmulher = new Set(
            Array.from(new Map(todosPoliciaisCpmulher.map(p => [p.id, p])).values())
              .filter((p) => p.status !== 'DESATIVADO')
              .map((p) => p.id)
          );
          
          // Filtrar afastamentos apenas dos policiais permitidos
          afastamentosFiltradosPorFuncao = afastamentos.filter((af) => idsPoliciaisCpmulher.has(af.policialId));
        }
        
        const afastamentosNoMesMotivo = filtrarAfastamentosNoMes(afastamentosFiltradosPorFuncao, primeiroDia, ultimoDiaStr);
        const filtrados = afastamentosNoMesMotivo.filter((af) => 
          af.motivo?.nome?.toLowerCase() === card.filters!.motivo!.toLowerCase()
        );
        setAfastamentosModal(sortAfastamentosPorPatenteENome(filtrados));
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
        let todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
        
        // Se for Cpmulher, filtrar apenas policiais com as funções permitidas
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          todosPoliciais = todosPoliciais.filter((p) => 
            p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
          );
        }

        // Buscar afastamentos do mês selecionado
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          afastamentosParams.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(afastamentosParams);
        
        // Se for Cpmulher, filtrar afastamentos apenas de policiais com as funções permitidas
        let afastamentosFiltrados = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          const idsPoliciaisPermitidos = new Set(
            todosPoliciais
              .filter((p) => p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId))
              .map((p) => p.id)
          );
          afastamentosFiltrados = afastamentos.filter((af) => idsPoliciaisPermitidos.has(af.policialId));
        }
        
        const afastamentosNoMesDisponiveis = filtrarAfastamentosNoMes(afastamentosFiltrados, primeiroDia, ultimoDiaStr);
        const idsAfastados = new Set(afastamentosNoMesDisponiveis.map((af) => af.policialId));

        // Filtrar apenas os policiais que NÃO estão afastados
        const policiaisDisponiveis = todosPoliciais.filter((p) => !idsAfastados.has(p.id));
        setPoliciaisModal(sortPorPatenteENome(policiaisDisponiveis));
      } else if (card.title === 'Afastamentos do Mês') {
        // Card "Afastamentos do Mês" - abas: Por motivo, Por afastamento, Do Efetivo Total
        setModalType('afastamentosPorMotivo');
        setAfastamentosMesModalTab(0);
        const { primeiroDia, ultimoDiaStr } = getDataRange();

        const params: Parameters<typeof api.listAfastamentos>[0] = {
          dataInicio: primeiroDia,
          dataFim: ultimoDiaStr,
          includePolicialFuncao: false,
        };

        if (!usuarioPodeVerTodos && currentUser.equipe) {
          params.equipe = currentUser.equipe;
        }

        const afastamentos = await api.listAfastamentos(params);

        let afastamentosFiltradosPorFuncao = afastamentos;
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          const todosPoliciaisCpmulher: Policial[] = [];
          for (const funcaoId of funcoesCopomMulherIds) {
            const dataPoliciais = await api.listPoliciaisPaginated({
              page: 1,
              pageSize: 1000,
              includeAfastamentos: false,
              includeRestricoes: false,
              funcaoId: funcaoId,
            });
            todosPoliciaisCpmulher.push(...dataPoliciais.Policiales);
          }
          const idsPoliciaisCpmulher = new Set(
            Array.from(new Map(todosPoliciaisCpmulher.map(p => [p.id, p])).values())
              .filter((p) => p.status !== 'DESATIVADO')
              .map((p) => p.id)
          );
          afastamentosFiltradosPorFuncao = afastamentos.filter((af) => idsPoliciaisCpmulher.has(af.policialId));
        }

        const afastamentosNoMes = filtrarAfastamentosNoMes(afastamentosFiltradosPorFuncao, primeiroDia, ultimoDiaStr);
        setAfastamentosMesCompletos(afastamentosNoMes);

        const porMotivo = new Map<string, number>();
        for (const af of afastamentosNoMes) {
          const nomeMotivo = af.motivo?.nome ?? 'Outro';
          porMotivo.set(nomeMotivo, (porMotivo.get(nomeMotivo) ?? 0) + 1);
        }
        const total = afastamentosNoMes.length;
        const resumo = Array.from(porMotivo.entries())
          .map(([motivo, count]) => ({
            motivo,
            count,
            porcentagem: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.count - a.count);
        setAfastamentosPorMotivoModal(resumo);
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
        let todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
        
        // Se for Cpmulher, filtrar apenas policiais com as funções permitidas (Analista e Telefonista 190 - Auxiliar)
        // Isso se aplica tanto para cards de equipe quanto para o card "COPOM Mulher"
        if (usuarioEhCpmulher && funcoesCopomMulherIds.length > 0) {
          todosPoliciais = todosPoliciais.filter((p) => 
            p.funcaoId && funcoesCopomMulherIds.includes(p.funcaoId)
          );
        }
        
        setPoliciaisModal(sortPorPatenteENome(todosPoliciais));
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
        </div>
      </div>

      <Box sx={{ p: 3, width: '100%' }}>
        {feriasProgramadasSemAfastamento != null && feriasProgramadasSemAfastamento.length > 0 && (() => {
          const now = new Date();
          const mesAtualNum = now.getMonth() + 1;
          const proximoMesNum = mesAtualNum === 12 ? 1 : mesAtualNum + 1;
          const anoAtual = now.getFullYear();
          const anoProximo = mesAtualNum === 12 ? anoAtual + 1 : anoAtual;
          const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const nomeMesAtual = nomesMeses[mesAtualNum - 1];
          const nomeProximoMes = nomesMeses[proximoMesNum - 1];
          const ordenados = [...feriasProgramadasSemAfastamento].sort((a, b) => {
            const aMesAtual = a.anoPrevisaoFerias === anoAtual && a.mesPrevisaoFerias === mesAtualNum;
            const bMesAtual = b.anoPrevisaoFerias === anoAtual && b.mesPrevisaoFerias === mesAtualNum;
            if (aMesAtual && !bMesAtual) return -1;
            if (!aMesAtual && bMesAtual) return 1;
            return comparePorPatenteENome(a, b);
          });
          const qtdMesAtual = ordenados.filter((p) => p.anoPrevisaoFerias === anoAtual && p.mesPrevisaoFerias === mesAtualNum).length;
          const qtdProximoMes = ordenados.filter((p) => p.anoPrevisaoFerias === anoProximo && p.mesPrevisaoFerias === proximoMesNum).length;
          return (
            <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Existem policiais com férias programadas para os meses de {nomeMesAtual} e {nomeProximoMes}, mas não estão marcados.{' '}
              {onTabChange && (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => setModalVerPoliciaisOpen(true)}
                  sx={{ fontWeight: 600 }}
                >
                  Ver policiais
                </Link>
              )}
            </Alert>
            <Dialog open={modalVerPoliciaisOpen} onClose={() => setModalVerPoliciaisOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Policiais com férias programadas sem afastamento</DialogTitle>
              <DialogContent>
                <List dense>
                  {ordenados.map((p) => {
                    const nomeMesFerias = p.mesPrevisaoFerias != null
                      ? (mesesDisponiveis.find((m) => m.valor === p.mesPrevisaoFerias)?.nome ?? String(p.mesPrevisaoFerias))
                      : '—';
                    const textoFerias = p.anoPrevisaoFerias != null
                      ? `${nomeMesFerias}/${p.anoPrevisaoFerias}`
                      : nomeMesFerias;
                    return (
                    <ListItem key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <ListItemText
                        primary={(p.nome ?? '').toUpperCase()}
                        secondary={
                          <>
                            {formatMatricula(p.matricula)}
                            {p.mesPrevisaoFerias != null && (
                              <> — Férias programadas: {textoFerias}</>
                            )}
                          </>
                        }
                      />
                      {onTabChange && (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => {
                            onTabChange('afastamentos', { preencherCadastro: { policialId: p.id, motivoNome: 'Férias' } });
                            setModalVerPoliciaisOpen(false);
                          }}
                          sx={{ fontWeight: 600, flexShrink: 0 }}
                        >
                          Marcar férias agora
                        </Link>
                      )}
                    </ListItem>
                  );
                  })}
                </List>
              </DialogContent>
              <Box sx={{ px: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">
                    {nomeMesAtual}: {qtdMesAtual} policiais
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {nomeProximoMes}: {qtdProximoMes} policiais
                  </Typography>
                </Box>
                <Button onClick={() => setModalVerPoliciaisOpen(false)} variant="outlined">
                  Fechar
                </Button>
              </Box>
            </Dialog>
            </>
          );
        })()}
        {feriasAtrasadasSemAfastamento != null && feriasAtrasadasSemAfastamento.length > 0 && (() => {
          const nomesMeses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
          const mesesUnicos = Array.from(
            new Set(
              feriasAtrasadasSemAfastamento
                .filter((p) => p.mesPrevisaoFerias != null && p.anoPrevisaoFerias != null)
                .map((p) => `${p.anoPrevisaoFerias!}-${String(p.mesPrevisaoFerias!).padStart(2, '0')}`)
            )
          )
            .sort()
            .reverse()
            .map((key) => {
              const [ano, mes] = key.split('-').map(Number);
              return { ano, mes, nome: nomesMeses[mes - 1] };
            });
          const textoMeses = mesesUnicos.length === 0
            ? ''
            : mesesUnicos.map((m) => m.nome).join(' e ');
          const ordenados = [...feriasAtrasadasSemAfastamento].sort((a, b) => {
            const aVal = (a.anoPrevisaoFerias ?? 0) * 100 + (a.mesPrevisaoFerias ?? 0);
            const bVal = (b.anoPrevisaoFerias ?? 0) * 100 + (b.mesPrevisaoFerias ?? 0);
            if (bVal !== aVal) return bVal - aVal;
            return comparePorPatenteENome(a, b);
          });
          const qtdPorMes = mesesUnicos.map((m) => ({
            ...m,
            qtd: feriasAtrasadasSemAfastamento.filter(
              (p) => p.anoPrevisaoFerias === m.ano && p.mesPrevisaoFerias === m.mes
            ).length,
          }));
          return (
            <>
            <Alert severity="info" sx={{ mb: 2 }}>
              Existem policiais com férias programadas em {textoMeses}, mas não foram marcadas.{' '}
              {onTabChange && (
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => setModalVerPoliciaisAtrasadosOpen(true)}
                  sx={{ fontWeight: 600 }}
                >
                  Ver policiais
                </Link>
              )}
            </Alert>
            <Dialog open={modalVerPoliciaisAtrasadosOpen} onClose={() => setModalVerPoliciaisAtrasadosOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Policiais com férias atrasadas sem afastamento</DialogTitle>
              <DialogContent>
                <List dense>
                  {ordenados.map((p) => {
                    const nomeMesFerias = p.mesPrevisaoFerias != null
                      ? (mesesDisponiveis.find((m) => m.valor === p.mesPrevisaoFerias)?.nome ?? String(p.mesPrevisaoFerias))
                      : '—';
                    const textoFerias = p.anoPrevisaoFerias != null
                      ? `${nomeMesFerias}/${p.anoPrevisaoFerias}`
                      : nomeMesFerias;
                    return (
                    <ListItem key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <ListItemText
                        primary={(p.nome ?? '').toUpperCase()}
                        secondary={
                          <>
                            {formatMatricula(p.matricula)}
                            {p.mesPrevisaoFerias != null && (
                              <> — Férias programadas: {textoFerias}</>
                            )}
                          </>
                        }
                      />
                      {onTabChange && (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => {
                            onTabChange('afastamentos', { preencherCadastro: { policialId: p.id, motivoNome: 'Férias' } });
                            setModalVerPoliciaisAtrasadosOpen(false);
                          }}
                          sx={{ fontWeight: 600, flexShrink: 0 }}
                        >
                          Marcar férias agora
                        </Link>
                      )}
                    </ListItem>
                  );
                  })}
                </List>
              </DialogContent>
              <Box sx={{ px: 3, pb: 2, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {qtdPorMes.map((m) => (
                    <Typography key={`${m.ano}-${m.mes}`} variant="body2" color="text.secondary">
                      {m.nome}: {m.qtd} policiais
                    </Typography>
                  ))}
                </Box>
                <Button onClick={() => setModalVerPoliciaisAtrasadosOpen(false)} variant="outlined">
                  Fechar
                </Button>
              </Box>
            </Dialog>
            </>
          );
        })()}
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: 2,
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 2,
            bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
            borderRadius: 2,
            border: '1px solid',
            borderColor: (theme) => alpha(theme.palette.primary.main, 0.12),
          }}
        >
          <FormControl size="small" sx={{ minWidth: 120 }} variant="outlined">
            <InputLabel id="ano-select-label">Ano</InputLabel>
            <Select
              labelId="ano-select-label"
              id="ano-select"
              value={anoSelecionado}
              label="Ano"
              onChange={(e) => setAnoSelecionado(Number(e.target.value))}
            >
              {anosDisponiveis.map((ano) => (
                <MenuItem key={ano} value={ano}>
                  {ano}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }} variant="outlined">
            <InputLabel id="mes-select-label">Mês</InputLabel>
            <Select
              labelId="mes-select-label"
              id="mes-select"
              value={mesSelecionado}
              label="Mês"
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
            >
              {mesesDisponiveis.map((mes) => (
                <MenuItem key={mes.valor} value={mes.valor}>
                  {mes.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Paper>
        {/* Primeira linha: cards em destaque (Efetivo do COPOM e Efetivo por Posto) */}
        <Grid container spacing={3} justifyContent="center" sx={{ mb: 3 }}>
          {cardsDestaque.map((card, index) => (
            <Grid size={{ xs: 12, sm: 10, md: 5 }} key={`destaque-${card.title}-${index}`}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  cursor: (card as any).isEfetivo || (card as any).isEfetivoPosto ? 'default' : 'pointer',
                  transition: 'all 0.25s ease',
                  border: '1px solid',
                  borderColor: alpha(card.color, 0.3),
                  borderLeft: `4px solid ${card.color}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: `0 12px 40px ${alpha(card.color, 0.15)}`,
                    borderColor: alpha(card.color, 0.5),
                  },
                }}
                onClick={(e) => {
                  if (!(card as any).isEquipe && !(card as any).isExpediente && !(card as any).isMotoristas && !(card as any).isCopomMulher && !(card as any).isEfetivo && !(card as any).isEfetivoPosto) {
                    handleCardClick(card);
                  } else {
                    e.stopPropagation();
                  }
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    {(card as any).isEfetivo && <Groups sx={{ fontSize: 28, color: card.color }} />}
                    {(card as any).isEfetivoPosto && <MilitaryTech sx={{ fontSize: 28, color: card.color }} />}
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: 600,
                        color: card.color,
                        fontSize: '1.15rem',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {card.title}
                    </Typography>
                  </Box>
                {card.showCount && (
                  <Box
                    sx={{
                      mb: 1,
                      minHeight: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      alignSelf: 'flex-start',
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!(card as any).isEquipe && !(card as any).isExpediente && !(card as any).isEfetivo && !(card as any).isEfetivoPosto) {
                        handleCardClick(card);
                      }
                    }}
                  >
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
                {card.title === 'Afastamentos do Mês' && (card as { porcentagemAfastamentos?: number | null }).porcentagemAfastamentos != null && !card.loadingCount && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1 }}>
                    Porcentagem de afastamentos:{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                      {(card as { porcentagemAfastamentos: number }).porcentagemAfastamentos}%
                    </Box>
                  </Typography>
                )}
                {((card as any).isEquipe && (card as any).equipe) || (card as any).isExpediente || (card as any).isMotoristas || (card as any).isCopomMulher || (card as any).isEfetivo || (card as any).isEfetivoPosto ? (
                  <Box sx={{ mb: 1, minHeight: '60px' }}>
                    {(card as any).loadingCount ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60px' }}>
                        <CircularProgress size={40} sx={{ color: card.color }} />
                      </Box>
                    ) : (() => {
                      if ((card as any).isEfetivo) {
                        const total = totalPoliciaisCadastrados ?? 0;
                        const statusOrder = ['ATIVO', 'PTTC', 'DESIGNADO', 'COMISSIONADO'] as const;
                        const statusLabels: Record<string, string> = {
                          ATIVO: 'Ativos',
                          PTTC: 'PTTC',
                          DESIGNADO: 'Designados',
                          COMISSIONADO: 'Comissionados',
                        };
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 0.5,
                                mb: 0.5,
                                cursor: 'pointer',
                                borderRadius: 1,
                                px: 1,
                                py: 0.5,
                                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEfetivoTotalClick();
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Total:
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 700, color: card.color, fontSize: '2rem' }}>
                                {total}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {total === 1 ? 'policial' : 'policiais'}
                              </Typography>
                            </Box>
                            <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {statusOrder.map((status) => (
                                <Box
                                  key={status}
                                  component="li"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.25,
                                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStatusClick(status);
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {statusLabels[status]}:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: card.color }}>
                                    {efetivoPorStatus[status] ?? 0}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        );
                      }
                      if ((card as any).isEfetivoPosto) {
                        const totalPosto = (efetivoPorPosto.oficiais ?? 0) + (efetivoPorPosto.pracas ?? 0) + (efetivoPorPosto.civis ?? 0) + (efetivoPorPosto.outros ?? 0);
                        const totalExibir = totalPosto > 0 ? totalPosto : (totalPoliciaisCadastrados ?? 0);
                        const postosOrder = [
                          { key: 'oficiais', label: 'Oficiais' },
                          { key: 'pracas', label: 'Praças' },
                          { key: 'civis', label: 'Civis' },
                        ] as const;
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 0.5,
                                mb: 0.5,
                                cursor: 'pointer',
                                borderRadius: 1,
                                px: 1,
                                py: 0.5,
                                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEfetivoTotalClick();
                              }}
                            >
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                Total:
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 700, color: card.color, fontSize: '2rem' }}>
                                {totalExibir}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                                {totalExibir === 1 ? 'policial' : 'policiais'}
                              </Typography>
                            </Box>
                            <Box component="ul" sx={{ m: 0, pl: 2.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              {postosOrder.map(({ key, label }) => (
                                <Box
                                  key={key}
                                  component="li"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.25,
                                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePostoClick(key);
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {label}:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: card.color }}>
                                    {efetivoPorPosto[key] ?? 0}
                                  </Typography>
                                </Box>
                              ))}
                              {(efetivoPorPosto.outros ?? 0) > 0 && (
                                <Box
                                  component="li"
                                  sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    fontSize: '0.875rem',
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.25,
                                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePostoClick('outros');
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    Outros:
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600, color: card.color }}>
                                    {efetivoPorPosto.outros}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          </Box>
                        );
                      }
                      if ((card as any).isExpediente) {
                        if (expedienteData) {
                          const pctExp = expedienteData.total > 0 ? Math.round((expedienteData.afastados / expedienteData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctExp}%
                                </Box>
                              </Typography>
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
                      } else if ((card as any).isMotoristas) {
                        if (motoristasData) {
                          const pctMot = motoristasData.total > 0 ? Math.round((motoristasData.afastados / motoristasData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctMot}%
                                </Box>
                              </Typography>
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
                                  {motoristasData.total}
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
                                  {motoristasData.afastados}
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
                                  {motoristasData.disponiveis}
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
                      } else if ((card as any).isCopomMulher) {
                        if (copomMulherData) {
                          const pctCopom = copomMulherData.total > 0 ? Math.round((copomMulherData.afastados / copomMulherData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctCopom}%
                                </Box>
                              </Typography>
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
                                  {copomMulherData.total}
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
                                  {copomMulherData.afastados}
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
                                  {copomMulherData.disponiveis}
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
                      } else if ((card as any).equipe) {
                        // Verificar se os dados da equipe já estão disponíveis
                        const dadosEquipe = policiaisPorEquipe[(card as any).equipe];
                        if (dadosEquipe !== undefined) {
                          const pctEquipe = dadosEquipe.total > 0 ? Math.round((dadosEquipe.afastados / dadosEquipe.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctEquipe}%
                                </Box>
                              </Typography>
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
                                  {dadosEquipe.total}
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
                                  {dadosEquipe.afastados}
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
                                  {dadosEquipe.disponiveis}
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
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Demais cards */}
        <Grid container spacing={3}>
          {cardsRestantes.map((card, index) => {
            const CardIcon =
              card.title === 'Afastamentos do Mês' ? EventBusy :
              card.title === 'Policiais Disponíveis' ? PersonSearch :
              card.title === 'Férias' ? BeachAccess :
              card.title === 'Abono' ? WbSunny :
              (card as any).isExpediente ? BusinessCenter :
              (card as any).isMotoristas ? DirectionsCar :
              (card as any).isCopomMulher ? Diversity1 :
              Groups;
            return (
            <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={`card-${card.title}-${index}`}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  cursor: (card as any).isEquipe || (card as any).isExpediente || (card as any).isMotoristas || (card as any).isCopomMulher ? 'default' : 'pointer',
                  transition: 'all 0.25s ease',
                  border: '1px solid',
                  borderColor: alpha(card.color, 0.25),
                  borderLeft: `4px solid ${card.color}`,
                  borderRadius: 2,
                  overflow: 'hidden',
                  '&:hover': {
                    boxShadow: (card as any).isEquipe || (card as any).isExpediente || (card as any).isMotoristas || (card as any).isCopomMulher
                      ? undefined
                      : `0 8px 24px ${alpha(card.color, 0.12)}`,
                    borderColor: alpha(card.color, 0.4),
                  },
                }}
                onClick={(e) => {
                  if (!(card as any).isEquipe && !(card as any).isExpediente && !(card as any).isMotoristas && !(card as any).isCopomMulher) {
                    handleCardClick(card);
                  } else {
                    e.stopPropagation();
                  }
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <CardIcon sx={{ fontSize: 22, color: card.color, flexShrink: 0 }} />
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: card.color,
                        fontSize: '0.95rem',
                        lineHeight: 1.3,
                      }}
                    >
                      {card.title}
                    </Typography>
                  </Box>
                {card.showCount && (
                  <Box
                    sx={{
                      mb: 1,
                      minHeight: '60px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      cursor: 'pointer',
                      borderRadius: 1,
                      px: 1,
                      py: 0.5,
                      alignSelf: 'flex-start',
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!(card as any).isEquipe && !(card as any).isExpediente && !(card as any).isEfetivo && !(card as any).isEfetivoPosto) {
                        handleCardClick(card);
                      }
                    }}
                  >
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
                {card.title === 'Afastamentos do Mês' && (card as { porcentagemAfastamentos?: number | null }).porcentagemAfastamentos != null && !card.loadingCount && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1 }}>
                    Porcentagem de afastamentos:{' '}
                    <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                      {(card as { porcentagemAfastamentos: number }).porcentagemAfastamentos}%
                    </Box>
                  </Typography>
                )}
                {((card as any).isEquipe && (card as any).equipe) || (card as any).isExpediente || (card as any).isMotoristas || (card as any).isCopomMulher || (card as any).isEfetivo || (card as any).isEfetivoPosto ? (
                  <Box sx={{ mb: 1, minHeight: '60px' }}>
                    {(card as any).loadingCount ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60px' }}>
                        <CircularProgress size={40} sx={{ color: card.color }} />
                      </Box>
                    ) : (() => {
                      if ((card as any).isEquipe && (card as any).equipe) {
                        const equipe = (card as any).equipe as string;
                        const dados = policiaisPorEquipe[equipe] ?? { total: 0, afastados: 0, disponiveis: 0 };
                        const pct = dados.total > 0 ? Math.round((dados.afastados / dados.total) * 1000) / 10 : 0;
                        return (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                              Afastados:{' '}
                              <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                {pct}%
                              </Box>
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem' }}>
                              {(['total', 'afastados', 'disponiveis'] as const).map((tipo) => (
                                <Box
                                  key={tipo}
                                  sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    borderRadius: 1,
                                    px: 1,
                                    py: 0.5,
                                    '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNumberClick(card, tipo);
                                  }}
                                >
                                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                    {tipo === 'total' ? 'Total' : tipo === 'afastados' ? 'Afastados' : 'Disponíveis'}:
                                  </Typography>
                                  <Typography component="span" fontWeight={600} sx={{ color: card.color }}>
                                    {tipo === 'total' ? dados.total : tipo === 'afastados' ? dados.afastados : dados.disponiveis}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          </Box>
                        );
                      }
                      if ((card as any).isExpediente) {
                        if (expedienteData) {
                          const pctExp = expedienteData.total > 0 ? Math.round((expedienteData.afastados / expedienteData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctExp}%
                                </Box>
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem' }}>
                                {(['total', 'afastados', 'disponiveis'] as const).map((tipo) => (
                                  <Box
                                    key={tipo}
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      borderRadius: 1,
                                      px: 1,
                                      py: 0.5,
                                      '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNumberClick(card, tipo);
                                    }}
                                  >
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      {tipo === 'total' ? 'Total' : tipo === 'afastados' ? 'Afastados' : 'Disponíveis'}:
                                    </Typography>
                                    <Typography component="span" fontWeight={600} sx={{ color: card.color }}>
                                      {tipo === 'total' ? expedienteData.total : tipo === 'afastados' ? expedienteData.afastados : expedienteData.disponiveis}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          );
                        }
                      }
                      if ((card as any).isMotoristas) {
                        if (motoristasData) {
                          const pctMot = motoristasData.total > 0 ? Math.round((motoristasData.afastados / motoristasData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctMot}%
                                </Box>
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem' }}>
                                {(['total', 'afastados', 'disponiveis'] as const).map((tipo) => (
                                  <Box
                                    key={tipo}
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      borderRadius: 1,
                                      px: 1,
                                      py: 0.5,
                                      '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNumberClick(card, tipo);
                                    }}
                                  >
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      {tipo === 'total' ? 'Total' : tipo === 'afastados' ? 'Afastados' : 'Disponíveis'}:
                                    </Typography>
                                    <Typography component="span" fontWeight={600} sx={{ color: card.color }}>
                                      {tipo === 'total' ? motoristasData.total : tipo === 'afastados' ? motoristasData.afastados : motoristasData.disponiveis}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          );
                        }
                      }
                      if ((card as any).isCopomMulher) {
                        if (copomMulherData) {
                          const pctCopom = copomMulherData.total > 0 ? Math.round((copomMulherData.afastados / copomMulherData.total) * 1000) / 10 : 0;
                          return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 0.5 }}>
                                Afastados:{' '}
                                <Box component="span" sx={{ fontWeight: 700, color: card.color }}>
                                  {pctCopom}%
                                </Box>
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '0.875rem' }}>
                                {(['total', 'afastados', 'disponiveis'] as const).map((tipo) => (
                                  <Box
                                    key={tipo}
                                    sx={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      cursor: 'pointer',
                                      borderRadius: 1,
                                      px: 1,
                                      py: 0.5,
                                      '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) },
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNumberClick(card, tipo);
                                    }}
                                  >
                                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                      {tipo === 'total' ? 'Total' : tipo === 'afastados' ? 'Afastados' : 'Disponíveis'}:
                                    </Typography>
                                    <Typography component="span" fontWeight={600} sx={{ color: card.color }}>
                                      {tipo === 'total' ? copomMulherData.total : tipo === 'afastados' ? copomMulherData.afastados : copomMulherData.disponiveis}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          );
                        }
                      }
                      return (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Carregando...
                        </Typography>
                      );
                    })()}
                  </Box>
                ) : null}
                {card.description && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {card.description}
                  </Typography>
                )}
                </CardContent>
              </Card>
            </Grid>
            );
          })}
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
          {modalTitle}
          <IconButton onClick={() => setModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingModal ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <CircularProgress />
            </Box>
          ) : modalType === 'afastamentosPorMotivo' ? (
            <Box sx={{ py: 1 }}>
              {modalTitle === 'Afastamentos do Mês' ? (
                <>
                  <Tabs value={afastamentosMesModalTab} onChange={(_, v) => setAfastamentosMesModalTab(v as 0 | 1)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tab label="Por motivo" />
                    <Tab label="Do Efetivo Total" />
                  </Tabs>
                  {afastamentosMesModalTab === 0 && (
                    <>
                      {afastamentosPorMotivoModal.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                          Nenhum afastamento no mês selecionado.
                        </Typography>
                      ) : (
                        <List disablePadding>
                          {afastamentosPorMotivoModal.map((item, index) => (
                            <ListItem key={`${item.motivo}-${index}`} divider sx={{ py: 1.5 }}>
                              <ListItemText
                                primary={
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                    <Typography variant="body1" fontWeight={500}>
                                      {formatNome(item.motivo)}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                      <Typography variant="body2" color="text.secondary">
                                        {item.count} {item.count === 1 ? 'afastamento' : 'afastamentos'}
                                      </Typography>
                                      <Typography variant="body2" fontWeight={700} sx={{ color: '#3b82f6' }}>
                                        {item.porcentagem}%
                                      </Typography>
                                    </Box>
                                  </Box>
                                }
                              />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </>
                  )}
                  {afastamentosMesModalTab === 1 && (
                    <>
                      {totalPoliciaisCadastrados == null || totalPoliciaisCadastrados === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                          Efetivo total não disponível.
                        </Typography>
                      ) : (() => {
                        const policiaisUnicosAfastados = new Set(afastamentosMesCompletos.map((af) => af.policialId)).size;
                        const porcentagemEfetivoTotal = Math.round((policiaisUnicosAfastados / totalPoliciaisCadastrados) * 1000) / 10;
                        const resumoEfetivo = afastamentosPorMotivoModal.map((item) => ({
                          ...item,
                          porcentagemEfetivo: Math.round((item.count / totalPoliciaisCadastrados) * 1000) / 10,
                        }));
                        return (
                          <Box sx={{ py: 1 }}>
                            <Typography variant="body1" sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                              <strong>Efetivo total:</strong> {totalPoliciaisCadastrados} policiais ·{' '}
                              <strong>Policiais afastados no mês:</strong> {policiaisUnicosAfastados} ({porcentagemEfetivoTotal}% do efetivo total)
                            </Typography>
                            {resumoEfetivo.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                Nenhum afastamento no mês selecionado.
                              </Typography>
                            ) : (
                              <List disablePadding>
                                {resumoEfetivo.map((item, index) => (
                                  <ListItem key={`efetivo-${item.motivo}-${index}`} divider sx={{ py: 1.5 }}>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                          <Typography variant="body1" fontWeight={500}>
                                            {formatNome(item.motivo)}
                                          </Typography>
                                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                            <Typography variant="body2" color="text.secondary">
                                              {item.count} {item.count === 1 ? 'afastamento' : 'afastamentos'}
                                            </Typography>
                                            <Typography variant="body2" fontWeight={700} sx={{ color: '#3b82f6' }}>
                                              {item.porcentagemEfetivo}% do efetivo
                                            </Typography>
                                          </Box>
                                        </Box>
                                      }
                                    />
                                  </ListItem>
                                ))}
                              </List>
                            )}
                          </Box>
                        );
                      })()}
                    </>
                  )}
                </>
              ) : (
                <>
                  {afastamentosPorMotivoModal.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      Nenhum afastamento no mês selecionado.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {afastamentosPorMotivoModal.map((item, index) => (
                        <ListItem key={`${item.motivo}-${index}`} divider sx={{ py: 1.5 }}>
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                                <Typography variant="body1" fontWeight={500}>
                                  {formatNome(item.motivo)}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {item.count} {item.count === 1 ? 'afastamento' : 'afastamentos'}
                                  </Typography>
                                  <Typography variant="body2" fontWeight={700} sx={{ color: '#3b82f6' }}>
                                    {item.porcentagem}%
                                  </Typography>
                                </Box>
                              </Box>
                            }
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </>
              )}
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
                          {formatEquipeLabel(policial.equipe) !== '—' && policial.equipe && (
                            <Chip 
                              label={`Equipe ${policial.equipe}`}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                            Matrícula: {formatMatricula(policial.matricula)}
                          </Box>
                          {policial.funcao && (
                            <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                              Função: {formatNome(policial.funcao.nome)}
                            </Box>
                          )}
                        </>
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
                            label={formatNome(afastamento.motivo.nome)} 
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                            Matrícula: {formatMatricula(afastamento.policial.matricula)}
                          </Box>
                          <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                            Período: {new Date(afastamento.dataInicio).toLocaleDateString('pt-BR')} 
                            {afastamento.dataFim ? ` até ${new Date(afastamento.dataFim).toLocaleDateString('pt-BR')}` : ' (sem data fim)'}
                          </Box>
                          <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                            Equipe: {formatEquipeLabel(afastamento.policial.equipe)}
                          </Box>
                        </>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Efetivo do COPOM - lista de policiais por status */}
      <Dialog
        open={modalStatusOpen}
        onClose={() => setModalStatusOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {modalStatusTipo === 'ATIVO' ? 'Ativos' :
           modalStatusTipo === 'PTTC' ? 'PTTC' :
           modalStatusTipo === 'DESIGNADO' ? 'Designados' :
           modalStatusTipo === 'COMISSIONADO' ? 'Comissionados' : 'Efetivo do COPOM'}
          <IconButton onClick={() => setModalStatusOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingModalStatus ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {modalStatusPoliciais.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Nenhum policial encontrado.
                </Typography>
              ) : (
                modalStatusPoliciais.map((policial) => (
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
                          {formatEquipeLabel(policial.equipe) !== '—' && policial.equipe && (
                            <Chip label={`Equipe ${policial.equipe}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                            Matrícula: {formatMatricula(policial.matricula)}
                          </Box>
                          {policial.funcao && (
                            <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                              Função: {formatNome(policial.funcao.nome)}
                            </Box>
                          )}
                        </>
                      }
                    />
                  </ListItem>
                ))
              )}
            </List>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Efetivo por Posto - lista de policiais por categoria */}
      <Dialog
        open={modalPostoOpen}
        onClose={() => setModalPostoOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { maxHeight: '80vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {modalPostoTipo === 'oficiais' ? 'Oficiais' :
           modalPostoTipo === 'pracas' ? 'Praças' :
           modalPostoTipo === 'civis' ? 'Civis' :
           modalPostoTipo === 'outros' ? 'Outros' : 'Efetivo por Posto'}
          <IconButton onClick={() => setModalPostoOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingModalPosto ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
              <CircularProgress />
            </Box>
          ) : (
            <List>
              {modalPostoPoliciais.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                  Nenhum policial encontrado.
                </Typography>
              ) : (
                modalPostoPoliciais.map((policial) => (
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
                          {formatEquipeLabel(policial.equipe) !== '—' && policial.equipe && (
                            <Chip label={`Equipe ${policial.equipe}`} size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <>
                          <Box component="span" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
                            Matrícula: {formatMatricula(policial.matricula)}
                          </Box>
                          {policial.funcao && (
                            <Box component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                              Função: {formatNome(policial.funcao.nome)}
                            </Box>
                          )}
                        </>
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
