import { useState, useMemo, useEffect } from 'react';
import type { Usuario, Policial, Equipe, Afastamento } from '../../types';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import { Close as CloseIcon, Print as PrintIcon } from '@mui/icons-material';
import { api } from '../../api';
import { useEscalaParametros } from '../../hooks/useEscalaParametros';
import { formatEquipeLabel } from '../../constants';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';
import { formatNome, formatMatricula } from '../../utils/dateUtils';
import { sortPorPatenteENome } from '../../utils/sortPoliciais';
import { imprimirListaPoliciaisCalendarioModal } from '../../utils/calendarioModalPrint';

interface CalendarioSectionProps {
  currentUser: Usuario;
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = [
  { valor: 0, nome: 'Janeiro' },
  { valor: 1, nome: 'Fevereiro' },
  { valor: 2, nome: 'Março' },
  { valor: 3, nome: 'Abril' },
  { valor: 4, nome: 'Maio' },
  { valor: 5, nome: 'Junho' },
  { valor: 6, nome: 'Julho' },
  { valor: 7, nome: 'Agosto' },
  { valor: 8, nome: 'Setembro' },
  { valor: 9, nome: 'Outubro' },
  { valor: 10, nome: 'Novembro' },
  { valor: 11, nome: 'Dezembro' },
];

export function CalendarioSection({ currentUser: _currentUser }: CalendarioSectionProps) {
  const { parsed: escala } = useEscalaParametros();
  const now = new Date();
  const anoAtual = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  const mesAtual = now.getMonth();
  
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState<number>(mesAtual);
  const [tabAtiva, setTabAtiva] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [policiaisModal, setPoliciaisModal] = useState<Policial[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [funcaoMotoristaId, setFuncaoMotoristaId] = useState<number | null>(null);

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

  // Gerar dias do mês selecionado
  const diasDoMes = useMemo(() => {
    const primeiroDia = new Date(anoSelecionado, mesSelecionado, 1);
    const ultimoDia = new Date(anoSelecionado, mesSelecionado + 1, 0);
    const diasNoMes = ultimoDia.getDate();
    const diaSemanaInicio = primeiroDia.getDay(); // 0 = Domingo, 1 = Segunda, etc.

    const dias: (number | null)[] = [];
    
    // Adicionar células vazias para os dias antes do primeiro dia do mês
    for (let i = 0; i < diaSemanaInicio; i++) {
      dias.push(null);
    }
    
    // Adicionar os dias do mês
    for (let dia = 1; dia <= diasNoMes; dia++) {
      dias.push(dia);
    }
    
    return dias;
  }, [anoSelecionado, mesSelecionado]);

  // Verificar se é hoje
  const isHoje = (dia: number | null) => {
    if (dia === null) return false;
    const hoje = new Date();
    return (
      dia === hoje.getDate() &&
      mesSelecionado === hoje.getMonth() &&
      anoSelecionado === hoje.getFullYear()
    );
  };

  // Calcular qual equipe está de serviço em um determinado dia e horário
  const calcularEquipeServico = (ano: number, mes: number, dia: number, periodo: 'dia' | 'noite'): { equipe: Equipe; nome: string } | null => {
    const dataAtual = new Date(ano, mes, dia);
    const dataInicio = escala.dataInicioEquipes;
    const sequencia = escala.sequenciaEquipes;
    const n = sequencia.length;
    if (n === 0) return null;

    // Calcular diferença em dias desde o início da escala
    const diffTime = dataAtual.getTime() - dataInicio.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Se a data for anterior a 1 de janeiro de 2026, retornar null
    const dataMinima = new Date(2026, 0, 1); // 1 de janeiro de 2026
    if (dataAtual.getTime() < dataMinima.getTime()) {
      return null;
    }

    // Para o período do dia (07h-19h), a sequência é: D → E → B → A → C
    // Para o período da noite (19h-07h), a sequência é: C → D → E → B → A
    // A noite está sempre 1 posição atrás do dia na sequência circular
    // Para datas anteriores ao dia 20, usar módulo negativo para calcular retroativamente
    
    if (periodo === 'dia') {
      // Sequência do dia: D, E, B, A, C, D, E, B, A, C...
      // Cada ciclo completo tem 5 turnos (5 dias)
      // Usar módulo com tratamento para números negativos
      const posicaoNaSequencia = ((diffDays % n) + n) % n;
      const equipe = sequencia[posicaoNaSequencia];
      return { equipe, nome: equipe };
    } else {
      // Sequência da noite: C, D, E, B, A, C, D, E, B, A...
      // A noite está 1 posição atrás do dia: se o dia é posição 0 (D), a noite é posição 4 (C)
      // Se o dia é posição 1 (E), a noite é posição 0 (D)
      const posicaoDia = ((diffDays % n) + n) % n;
      const posicaoNoite = (posicaoDia - 1 + n) % n; // -1 + n para garantir valor positivo
      const equipe = sequencia[posicaoNoite];
      return { equipe, nome: equipe };
    }
  };

  // Obter informações das equipes para um dia específico
  const getEquipesDia = (dia: number | null) => {
    if (dia === null) return null;
    
    const equipeDia = calcularEquipeServico(anoSelecionado, mesSelecionado, dia, 'dia');
    const equipeNoite = calcularEquipeServico(anoSelecionado, mesSelecionado, dia, 'noite');
    
    return {
      dia: equipeDia,
      noite: equipeNoite,
    };
  };

  // Afastamento de 1 dia = somente esse dia, de 0h às 23:59. Não se considera o dia seguinte.
  // Função helper para filtrar afastamentos que estão ativos em uma data específica
  const filtrarAfastamentosNaData = (afastamentos: Afastamento[], data: Date) => {
    const dataStr = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    const [ano, mes, dia] = dataStr.split('-').map(Number);
    const dataTimestamp = new Date(ano, mes - 1, dia).getTime();
    
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
      
      // Um afastamento está ativo na data se ela está entre o início e o fim (ou não tem fim)
      const comecaAntesOuDurante = afInicioTimestamp <= dataTimestamp;
      const terminaDepoisOuDurante = afFimTimestamp === null || afFimTimestamp >= dataTimestamp;
      
      return comecaAntesOuDurante && terminaDepoisOuDurante;
    });
  };

  // Escala 24×72 (motorista de dia): qual equipe (A, B, C ou D) está de serviço em um determinado dia
  const getEquipeMotoristasDia = (ano: number, mes: number, dia: number): Equipe | null => {
    const dataAtual = new Date(ano, mes, dia);
    const dataMinima = new Date(2026, 0, 1);
    if (dataAtual.getTime() < dataMinima.getTime()) return null;
    const seq = escala.sequenciaMotoristas;
    const nm = seq.length;
    if (nm === 0) return null;
    const diffTime = dataAtual.getTime() - escala.dataInicioMotoristas.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return null;
    return seq[diffDays % nm];
  };

  useEffect(() => {
    const carregarFuncaoMotorista = async () => {
      try {
        const funcoes = await api.listFuncoes();
        const funcoesAtivas = funcoes.filter((f) => f.ativo !== false);
        const funcaoMotorista = funcoesAtivas.find((f) =>
          f.nome.toUpperCase().includes('MOTORISTA DE DIA')
        );
        if (funcaoMotorista) setFuncaoMotoristaId(funcaoMotorista.id);
      } catch (error) {
        console.error('Erro ao carregar função Motorista:', error);
      }
    };
    void carregarFuncaoMotorista();
  }, []);

  // Abrir modal com motoristas de dia escalados conforme a equipe do dia na escala 24×72
  const handleMotoristasClick = async (dia: number) => {
    setModalOpen(true);
    setLoadingModal(true);
    const dataAtual = new Date(anoSelecionado, mesSelecionado, dia);
    const dataStr = `${String(dia).padStart(2, '0')}/${String(mesSelecionado + 1).padStart(2, '0')}/${anoSelecionado}`;
    setModalTitle(`Motoristas (${ESCALA_MOTORISTA_DIA}) — ${dataStr}`);

    try {
      const equipeDia = getEquipeMotoristasDia(anoSelecionado, mesSelecionado, dia);
      if (!equipeDia || !funcaoMotoristaId) {
        setPoliciaisModal([]);
        return;
      }

      const data = await api.listPoliciaisPaginated({
        page: 1,
        pageSize: 1000,
        equipe: equipeDia,
        funcaoId: funcaoMotoristaId,
        includeAfastamentos: false,
        includeRestricoes: false,
      });
      const todosMotoristas = data.Policiales.filter((p) => p.status !== 'DESATIVADO');

      const dataInicioBusca = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const afastamentos = await api.listAfastamentos({
        dataInicio: dataInicioBusca,
        dataFim: dataInicioBusca,
        includePolicialFuncao: false,
      });
      const afastamentosAtivos = filtrarAfastamentosNaData(afastamentos, dataAtual);
      const idsAfastados = new Set(afastamentosAtivos.map((af) => af.policialId));
      const motoristasDisponiveis = todosMotoristas.filter((p) => !idsAfastados.has(p.id));

      setModalTitle(`Motoristas (${ESCALA_MOTORISTA_DIA}) — Equipe ${formatEquipeLabel(equipeDia)} — ${dataStr}`);
      setPoliciaisModal(sortPorPatenteENome(motoristasDisponiveis));
    } catch (error) {
      console.error('Erro ao carregar motoristas:', error);
      setPoliciaisModal([]);
    } finally {
      setLoadingModal(false);
    }
  };

  // Função para abrir modal com policiais da equipe
  const handleEquipeClick = async (equipe: Equipe, periodo: 'dia' | 'noite', dia: number) => {
    setModalOpen(true);
    setLoadingModal(true);
    setModalTitle(`Equipe ${formatEquipeLabel(equipe)} - ${periodo === 'dia' ? 'Dia' : 'Noite'} (${dia}/${mesSelecionado + 1}/${anoSelecionado})`);
    
    try {
      // Buscar policiais da equipe
      const params: Parameters<typeof api.listPoliciaisPaginated>[0] = {
        page: 1,
        pageSize: 1000,
        equipe: equipe,
        includeAfastamentos: false,
        includeRestricoes: false,
      };

      const data = await api.listPoliciaisPaginated(params);
      const todosPoliciais = data.Policiales.filter((p) => p.status !== 'DESATIVADO');
      // Motoristas de dia: apenas na escala 24×72; excluir da escala 12×24 (Dia/Noite das equipes)
      const policiaisEscalaDiaNoite = funcaoMotoristaId
        ? todosPoliciais.filter((p) => p.funcaoId !== funcaoMotoristaId)
        : todosPoliciais;

      // Afastamento de 1 dia = somente esse dia, de 0h às 23:59. Não se considera o dia seguinte.
      const dataAtual = new Date(anoSelecionado, mesSelecionado, dia);
      const dataInicioBusca = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const dataFimBusca = dataInicioBusca;

      const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
        dataInicio: dataInicioBusca,
        dataFim: dataFimBusca,
        includePolicialFuncao: false,
      };

      const afastamentos = await api.listAfastamentos(afastamentosParams);

      // Quem está afastado neste dia (0h-23:59) não aparece na lista, tanto no turno dia quanto no turno noite
      const afastamentosAtivos = filtrarAfastamentosNaData(afastamentos, dataAtual);
      const idsAfastados = new Set(afastamentosAtivos.map((af) => af.policialId));

      // Filtrar apenas os policiais disponíveis (não afastados), já sem motoristas
      const policiaisDisponiveis = policiaisEscalaDiaNoite.filter((p) => !idsAfastados.has(p.id));

      setPoliciaisModal(sortPorPatenteENome(policiaisDisponiveis));
    } catch (error) {
      console.error('Erro ao carregar policiais da equipe:', error);
      setPoliciaisModal([]);
    } finally {
      setLoadingModal(false);
    }
  };

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Calendário das Equipes</h2>
        </div>
      </div>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
        <Tabs value={tabAtiva} onChange={(_, newValue) => setTabAtiva(newValue)}>
          <Tab label="Equipes" />
          <Tab label={`Motoristas (${ESCALA_MOTORISTA_DIA})`} />
        </Tabs>
      </Box>

      <Box sx={{ p: 3, width: '100%', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Seletores de mês e ano */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <FormControl sx={{ minWidth: 120 }}>
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
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel id="mes-select-label">Mês</InputLabel>
            <Select
              labelId="mes-select-label"
              id="mes-select"
              value={mesSelecionado}
              label="Mês"
              onChange={(e) => setMesSelecionado(Number(e.target.value))}
            >
              {MESES.map((mes) => (
                <MenuItem key={mes.valor} value={mes.valor}>
                  {mes.nome}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Calendário - Tab Equipes */}
        {tabAtiva === 0 && (
        <Paper sx={{ p: 2 }}>
          {/* Cabeçalho com nome do mês e ano */}
          <Typography 
            variant="h5" 
            sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}
          >
            {MESES[mesSelecionado].nome} {anoSelecionado}
          </Typography>

          {/* Dias da semana */}
          <Grid container spacing={0.5} sx={{ mb: 1 }}>
            {DIAS_SEMANA.map((dia) => (
              <Grid size={{ xs: 12 / 7 }} key={dia}>
                <Paper
                  sx={{
                    p: 1.5,
                    textAlign: 'center',
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {dia}
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Dias do mês — escala 12×24 (equipes) */}
          <Grid container spacing={0.5}>
            {diasDoMes.map((dia, index) => {
              const equipes = getEquipesDia(dia);
              
              return (
                <Grid size={{ xs: 12 / 7 }} key={`dia-${index}`}>
                  <Paper
                    sx={{
                      p: 0,
                      minHeight: '120px',
                      height: '100%',
                      backgroundColor: dia === null ? 'transparent' : 'var(--card-bg)',
                      border: dia === null ? 'none' : '1px solid var(--border-soft)',
                      cursor: dia === null ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': dia !== null ? {
                        backgroundColor: 'rgba(0,0,0,0.1)',
                        borderColor: 'var(--accent-muted)',
                      } : {},
                      ...(isHoje(dia) && {
                        border: '2px solid var(--accent-muted)',
                        backgroundColor: 'var(--alert-info-bg)',
                      }),
                    }}
                  >
                    {dia !== null && (
                      <>
                        {/* Número do dia */}
                        <Box sx={{ p: 1, pb: 0.5, flexShrink: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: isHoje(dia) ? 700 : 500,
                              color: isHoje(dia) ? 'var(--accent-muted)' : 'var(--text-primary)',
                              lineHeight: 1.2,
                              margin: 0,
                            }}
                          >
                            {dia}
                          </Typography>
                        </Box>

                        {/* Divisão diagonal e equipes */}
                        {equipes && (
                          <Box
                            sx={{
                              position: 'relative',
                              width: '100%',
                              flex: 1,
                              minHeight: 0,
                            }}
                          >
                            {/* Linha diagonal */}
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                '&::before': {
                                  content: '""',
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  background: 'linear-gradient(to bottom right, transparent 0%, transparent 48%, rgba(255,255,255,0.4) 49%, rgba(255,255,255,0.4) 51%, transparent 52%, transparent 100%)',
                                  pointerEvents: 'none',
                                },
                              }}
                            />
                            
                            {/* Equipe do dia (canto superior esquerdo) */}
                            {equipes.dia && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '50%',
                                  height: '50%',
                                  backgroundColor: 'rgba(74, 107, 139, 0.4)', // Azul suave para dia
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  p: 0.5,
                                  gap: 0.25,
                                  boxSizing: 'border-box',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (equipes.dia) {
                                      handleEquipeClick(equipes.dia.equipe, 'dia', dia);
                                    }
                                  }}
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    color: '#E8EEF4',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: '#fff',
                                    },
                                  }}
                                >
                                  {equipes.dia.nome}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: 'var(--alert-info-text)',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                  }}
                                >
                                  Dia
                                </Typography>
                              </Box>
                            )}
                            
                            {/* Equipe da noite (canto inferior direito) */}
                            {equipes.noite && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 0,
                                  right: 0,
                                  width: '50%',
                                  height: '50%',
                                  backgroundColor: 'rgba(139, 115, 74, 0.4)', // Âmbar suave para noite
                                  display: 'flex',
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  p: 0.5,
                                  gap: 0.25,
                                  boxSizing: 'border-box',
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (equipes.noite) {
                                      handleEquipeClick(equipes.noite.equipe, 'noite', dia);
                                    }
                                  }}
                                  sx={{
                                    fontWeight: 600,
                                    fontSize: '0.7rem',
                                    color: '#E8EEF4',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: '#fff',
                                    },
                                  }}
                                >
                                  {equipes.noite.nome}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: 'var(--alert-warning-text)',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                  }}
                                >
                                  Noite
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        )}
                      </>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
        )}

        {/* Calendário — aba Motoristas (escala 24×72, motorista de dia) */}
        {tabAtiva === 1 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h5" sx={{ mb: 2, textAlign: 'center', fontWeight: 600 }}>
            {MESES[mesSelecionado].nome} {anoSelecionado}
          </Typography>
          {anoSelecionado < 2026 ? (
            <Typography variant="body2" sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>
              A escala {ESCALA_MOTORISTA_DIA} (motorista de dia) começa em janeiro de 2026. Selecione 2026 ou um ano
              posterior.
            </Typography>
          ) : (
            <>
              <Grid container spacing={0.5} sx={{ mb: 1 }}>
                {DIAS_SEMANA.map((dia) => (
                  <Grid size={{ xs: 12 / 7 }} key={dia}>
                    <Paper sx={{ p: 1.5, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.15)', fontWeight: 600, fontSize: '0.875rem' }}>
                      {dia}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
              <Grid container spacing={0.5}>
                {diasDoMes.map((dia, index) => {
                  const equipeMotoristas = dia !== null ? getEquipeMotoristasDia(anoSelecionado, mesSelecionado, dia) : null;
                  const podeClicar = dia !== null && equipeMotoristas !== null;
                  return (
                    <Grid size={{ xs: 12 / 7 }} key={`motoristas-dia-${index}`}>
                      <Paper
                        sx={{
                          p: 1,
                          minHeight: '90px',
                          height: '100%',
                          backgroundColor: dia === null ? 'transparent' : 'var(--card-bg)',
                          border: dia === null ? 'none' : '1px solid var(--border-soft)',
                          cursor: podeClicar ? 'pointer' : 'default',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.5,
                          '&:hover': podeClicar ? { backgroundColor: 'rgba(0,0,0,0.1)', borderColor: 'var(--accent-muted)' } : {},
                          ...(dia !== null && isHoje(dia) && { border: '2px solid var(--accent-muted)', backgroundColor: 'var(--alert-info-bg)' }),
                        }}
                        onClick={() => {
                          if (podeClicar) handleMotoristasClick(dia);
                        }}
                      >
                        {dia !== null && (
                          <>
                            <Typography variant="body2" sx={{ fontWeight: isHoje(dia) ? 700 : 500, color: isHoje(dia) ? 'var(--accent-muted)' : 'var(--text-primary)' }}>
                              {dia}
                            </Typography>
                            {equipeMotoristas !== null ? (
                              <Typography
                                variant="h6"
                                sx={{
                                  fontWeight: 700,
                                  color: 'var(--alert-success-text)',
                                  fontSize: '1.25rem',
                                }}
                              >
                                Equipe {equipeMotoristas}
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>—</Typography>
                            )}
                          </>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Paper>
        )}
      </Box>

      {/* Modal de Policiais da Equipe */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
            pr: 1,
          }}
        >
          <Typography component="span" variant="h6" sx={{ flex: '1 1 200px', minWidth: 0, fontWeight: 600 }}>
            {modalTitle}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
            {!loadingModal && policiaisModal.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={() => {
                  if (!imprimirListaPoliciaisCalendarioModal(modalTitle, policiaisModal)) {
                    window.alert('Não foi possível abrir a janela de impressão. Permita pop-ups para este site.');
                  }
                }}
              >
                Imprimir lista
              </Button>
            )}
            <IconButton aria-label="Fechar" onClick={() => setModalOpen(false)} color="inherit">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {loadingModal ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : policiaisModal.length === 0 ? (
            <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
              Nenhum policial encontrado nesta equipe.
            </Typography>
          ) : (
            <List>
              {policiaisModal.map((policial) => (
                <ListItem key={policial.id}>
                  <ListItemText
                    primary={policial.nome}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mt: 0.5 }}>
                        <Typography variant="caption" component="span" color="text.secondary">
                          Matrícula: {formatMatricula(policial.matricula)}
                        </Typography>
                        {policial.status && (
                          <Chip
                            label={policial.status}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.65rem',
                              ...(policial.status === 'ATIVO' && {
                                backgroundColor: 'var(--alert-success-bg)',
                                color: 'var(--alert-success-text)',
                              }),
                              ...(policial.status === 'DESIGNADO' && {
                                backgroundColor: 'var(--alert-warning-bg)',
                                color: 'var(--alert-warning-text)',
                              }),
                              ...(policial.status === 'COMISSIONADO' && {
                                backgroundColor: 'var(--alert-error-bg)',
                                color: 'var(--error)',
                              }),
                              ...(policial.status === 'PTTC' && {
                                backgroundColor: 'var(--alert-info-bg)',
                                color: 'var(--accent-muted)',
                              }),
                            }}
                          />
                        )}
                        {policial.funcao && (
                          <Typography variant="caption" component="span" color="text.secondary">
                            {formatNome(policial.funcao.nome)}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
