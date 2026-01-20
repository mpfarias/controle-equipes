import { useState, useMemo } from 'react';
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
  CircularProgress
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { api } from '../../api';
import { EQUIPE_FONETICA } from '../../constants';

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

// Data de início da escala: 20/01/2026 (terça-feira) com Delta de manhã
const DATA_INICIO_ESCALA = new Date(2026, 0, 20); // 20 de janeiro de 2026

// Sequência das equipes: Delta → Echo → Bravo → Alfa → Charlie → Delta
const SEQUENCIA_EQUIPES: Equipe[] = ['D', 'E', 'B', 'A', 'C'];
const SEQUENCIA_EQUIPES_NOMES = ['Delta', 'Echo', 'Bravo', 'Alfa', 'Charlie'];

export function CalendarioSection({ currentUser: _currentUser }: CalendarioSectionProps) {
  const now = new Date();
  const anoAtual = now.getFullYear() >= 2026 ? now.getFullYear() : 2026;
  const mesAtual = now.getMonth();
  
  const [anoSelecionado, setAnoSelecionado] = useState<number>(anoAtual);
  const [mesSelecionado, setMesSelecionado] = useState<number>(mesAtual);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [policiaisModal, setPoliciaisModal] = useState<Policial[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);

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
    const dataInicio = new Date(DATA_INICIO_ESCALA);
    
    // Calcular diferença em dias desde o início da escala
    const diffTime = dataAtual.getTime() - dataInicio.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Se a data for anterior a 1 de janeiro de 2026, retornar null
    const dataMinima = new Date(2026, 0, 1); // 1 de janeiro de 2026
    if (dataAtual.getTime() < dataMinima.getTime()) {
      return null;
    }

    // Para o período do dia (07h-19h), a sequência é: Delta → Echo → Bravo → Alfa → Charlie
    // Para o período da noite (19h-07h), a sequência é: Charlie → Delta → Echo → Bravo → Alfa
    // A noite está sempre 1 posição atrás do dia na sequência circular
    // Para datas anteriores ao dia 20, usar módulo negativo para calcular retroativamente
    
    if (periodo === 'dia') {
      // Sequência do dia: D, E, B, A, C, D, E, B, A, C...
      // Cada ciclo completo tem 5 turnos (5 dias)
      // Usar módulo com tratamento para números negativos
      const posicaoNaSequencia = ((diffDays % 5) + 5) % 5;
      const equipe = SEQUENCIA_EQUIPES[posicaoNaSequencia];
      const nome = SEQUENCIA_EQUIPES_NOMES[posicaoNaSequencia];
      return { equipe, nome };
    } else {
      // Sequência da noite: C, D, E, B, A, C, D, E, B, A...
      // A noite está 1 posição atrás do dia: se o dia é posição 0 (Delta), a noite é posição 4 (Charlie)
      // Se o dia é posição 1 (Echo), a noite é posição 0 (Delta)
      const posicaoDia = ((diffDays % 5) + 5) % 5;
      const posicaoNoite = (posicaoDia - 1 + 5) % 5; // -1 + 5 para garantir valor positivo
      const equipe = SEQUENCIA_EQUIPES[posicaoNoite];
      const nome = SEQUENCIA_EQUIPES_NOMES[posicaoNoite];
      return { equipe, nome };
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

  // Função para abrir modal com policiais da equipe
  const handleEquipeClick = async (equipe: Equipe, periodo: 'dia' | 'noite', dia: number) => {
    setModalOpen(true);
    setLoadingModal(true);
    setModalTitle(`Equipe ${EQUIPE_FONETICA[equipe]} - ${periodo === 'dia' ? 'Dia' : 'Noite'} (${dia}/${mesSelecionado + 1}/${anoSelecionado})`);
    
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
      
      // Buscar afastamentos do período
      // Para o período do dia: 07h-19h do dia atual
      // Para o período da noite: 19h do dia atual até 07h do dia seguinte
      const dataAtual = new Date(anoSelecionado, mesSelecionado, dia);
      let dataInicioBusca: string;
      let dataFimBusca: string;
      
      if (periodo === 'dia') {
        // Período do dia: 07h-19h do mesmo dia
        dataInicioBusca = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        dataFimBusca = dataInicioBusca;
      } else {
        // Período da noite: 19h do dia atual até 07h do dia seguinte
        dataInicioBusca = `${anoSelecionado}-${String(mesSelecionado + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        const proximoDia = new Date(anoSelecionado, mesSelecionado, dia + 1);
        dataFimBusca = `${proximoDia.getFullYear()}-${String(proximoDia.getMonth() + 1).padStart(2, '0')}-${String(proximoDia.getDate()).padStart(2, '0')}`;
      }
      
      // Buscar afastamentos que se sobrepõem ao período
      const afastamentosParams: Parameters<typeof api.listAfastamentos>[0] = {
        dataInicio: dataInicioBusca,
        dataFim: dataFimBusca,
        includePolicialFuncao: false,
      };
      
      const afastamentos = await api.listAfastamentos(afastamentosParams);
      
      // Filtrar afastamentos que estão realmente ativos na data/período
      const afastamentosAtivos = filtrarAfastamentosNaData(afastamentos, dataAtual);
      const idsAfastados = new Set(afastamentosAtivos.map((af) => af.policialId));
      
      // Filtrar apenas os policiais disponíveis (não afastados)
      const policiaisDisponiveis = todosPoliciais.filter((p) => !idsAfastados.has(p.id));
      
      setPoliciaisModal(policiaisDisponiveis);
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

        {/* Calendário */}
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
                    backgroundColor: '#f3f4f6',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {dia}
                </Paper>
              </Grid>
            ))}
          </Grid>

          {/* Dias do mês */}
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
                      backgroundColor: dia === null ? 'transparent' : '#ffffff',
                      border: dia === null ? 'none' : '1px solid #e5e7eb',
                      cursor: dia === null ? 'default' : 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                      overflow: 'hidden',
                      display: 'flex',
                      flexDirection: 'column',
                      '&:hover': dia !== null ? {
                        backgroundColor: '#f9fafb',
                        borderColor: '#3b82f6',
                      } : {},
                      ...(isHoje(dia) && {
                        border: '2px solid #3b82f6',
                        backgroundColor: '#eff6ff',
                      }),
                    }}
                  >
                    {dia !== null && (
                      <>
                        {/* Número do dia */}
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: isHoje(dia) ? 700 : 500,
                            color: isHoje(dia) ? '#3b82f6' : '#1f2937',
                            p: 1,
                            pb: 0.5,
                            flexShrink: 0,
                          }}
                        >
                          {dia}
                        </Typography>
                        
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
                                  background: 'linear-gradient(to bottom right, transparent 0%, transparent 48%, #e5e7eb 49%, #e5e7eb 51%, transparent 52%, transparent 100%)',
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
                                  backgroundColor: '#dbeafe', // Azul claro para dia
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
                                    color: '#1e40af',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: '#1e3a8a',
                                    },
                                  }}
                                >
                                  {equipes.dia.nome}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: '#3b82f6',
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
                                  backgroundColor: '#fef3c7', // Amarelo claro para noite
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
                                    color: '#92400e',
                                    textAlign: 'center',
                                    lineHeight: 1.2,
                                    margin: 0,
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: '#78350f',
                                    },
                                  }}
                                >
                                  {equipes.noite.nome}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: '0.65rem',
                                    color: '#f59e0b',
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
      </Box>

      {/* Modal de Policiais da Equipe */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {modalTitle}
          <IconButton
            aria-label="close"
            onClick={() => setModalOpen(false)}
            sx={{
              position: 'absolute',
              right: 8,
              top: 8,
              color: (theme) => theme.palette.grey[500],
            }}
          >
            <CloseIcon />
          </IconButton>
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
                          Matrícula: {policial.matricula}
                        </Typography>
                        {policial.status && (
                          <Chip
                            label={policial.status}
                            size="small"
                            sx={{
                              height: '20px',
                              fontSize: '0.65rem',
                              ...(policial.status === 'ATIVO' && {
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                              }),
                              ...(policial.status === 'DESIGNADO' && {
                                backgroundColor: '#fef9c3',
                                color: '#92400e',
                              }),
                              ...(policial.status === 'COMISSIONADO' && {
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                              }),
                              ...(policial.status === 'PTTC' && {
                                backgroundColor: '#dbeafe',
                                color: '#1d4ed8',
                              }),
                            }}
                          />
                        )}
                        {policial.funcao && (
                          <Typography variant="caption" component="span" color="text.secondary">
                            {policial.funcao.nome}
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
