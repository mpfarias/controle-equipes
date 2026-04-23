import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { Block, DeleteOutline, Edit, OpenInNew, Refresh } from '@mui/icons-material';
import { api } from '../../api';
import type {
  EscalaGerada,
  EscalaGeradaResumo,
  TrocaServicoAtivaListaItem,
  TrocaServicoTurno,
  Usuario,
} from '../../types';
import { formatEquipeLabel } from '../../constants';
import { formatDate, formatMatricula } from '../../utils/dateUtils';
import type { PermissoesPorTela } from '../../utils/permissions';
import { canDesativar, canExcluir, canView, podeGerenciarTrocaServicoElevado } from '../../utils/permissions';
import { ESCALA_MOTORISTA_DIA } from '../../constants/escalaMotoristasDia';
import { labelTipoServico, type EscalaGeradaDraftPayload } from '../../utils/gerarEscalasCalculo';
import { trocaServicoAtivaEhEntreMotoristasDeDia } from '../../utils/policialTrocaServico';
import {
  openEscalaGeradaBlankWindow,
  writeEscalaGeradaLoadingWindow,
  writeEscalaGeradaPrintWindow,
} from '../../utils/escalaGeradaPrint';

function ymdFromApi(value: string): string {
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : value.slice(0, 10);
}

function mesAtualIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return m;
}

function anoAtualIso(): string {
  return String(new Date().getFullYear());
}

/** Valor do select «Mês» no ranking: agrega todo o ano escolhido. */
const RANKING_MES_TODOS = 'TODOS';

function labelTurnoTroca(t: TrocaServicoTurno | undefined, row: TrocaServicoAtivaListaItem): string {
  if (trocaServicoAtivaEhEntreMotoristasDeDia(row)) {
    if (t === 'NOTURNO') return `Registro «noturno» (não aplicável — escala ${ESCALA_MOTORISTA_DIA})`;
    return `${ESCALA_MOTORISTA_DIA} — motorista de dia (07h às 07h)`;
  }
  if (t === 'NOTURNO') return 'Noturno (19h–07h)';
  return 'Diurno (07h–19h)';
}

function isDraftSnapshotSalvo(v: unknown): v is EscalaGeradaDraftPayload {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return typeof o.dataEscala === 'string' && typeof o.tipoServico === 'string' && Array.isArray(o.linhas);
}

/** Cores dos ícones da lista de escalas: legíveis no tema claro e no escuro (evita primary «apagado» no dark). */
function sxEscalaGeradaIcon(role: 'abrir' | 'desativar' | 'excluir' | 'atualizar'): SxProps<Theme> {
  return (theme: Theme) => {
    const dark = theme.palette.mode === 'dark';
    const hover = { backgroundColor: theme.palette.action.hover };
    switch (role) {
      case 'abrir':
      case 'atualizar':
        return {
          color: dark ? theme.palette.primary.light : theme.palette.primary.dark,
          '&:hover': hover,
        };
      case 'desativar':
        return {
          color: dark ? theme.palette.warning.light : theme.palette.warning.dark,
          '&:hover': hover,
        };
      case 'excluir':
        return {
          color: dark ? theme.palette.error.light : theme.palette.error.dark,
          '&:hover': hover,
        };
      default:
        return {};
    }
  };
}

function escalaGeradaToDraft(eg: EscalaGerada): EscalaGeradaDraftPayload {
  if (isDraftSnapshotSalvo(eg.impressaoDraft)) {
    const d = eg.impressaoDraft;
    return {
      ...d,
      resumoEquipes: typeof d.resumoEquipes === 'string' ? d.resumoEquipes : (eg.resumoEquipes ?? ''),
    };
  }
  return {
    dataEscala: ymdFromApi(eg.dataEscala),
    tipoServico: eg.tipoServico,
    resumoEquipes: eg.resumoEquipes ?? '',
    linhas: eg.linhas.map((l) => ({
      lista: l.lista,
      policialId: l.policialId,
      nome: l.nome,
      matricula: l.matricula,
      equipe: l.equipe,
      horarioServico: l.horarioServico,
      funcaoNome: l.funcaoNome,
      detalheAfastamento: l.detalheAfastamento,
    })),
  };
}

interface VisualizarEscalasTabProps {
  currentUser: Usuario;
  permissoes?: PermissoesPorTela | null;
}

export function VisualizarEscalasTab({ currentUser, permissoes }: VisualizarEscalasTabProps) {
  const [mostrarTrocas, setMostrarTrocas] = useState(false);
  const [mostrarRankingTrocas, setMostrarRankingTrocas] = useState(false);
  const [loadingTrocas, setLoadingTrocas] = useState(false);
  const [errorTrocas, setErrorTrocas] = useState<string | null>(null);
  const [itensTrocas, setItensTrocas] = useState<TrocaServicoAtivaListaItem[]>([]);
  const [trocasTab, setTrocasTab] = useState<'andamento' | 'efetivadas'>('andamento');
  const [rankingMesRef, setRankingMesRef] = useState<string>(mesAtualIso());
  const [rankingAnoRef, setRankingAnoRef] = useState<string>(anoAtualIso());

  const [mostrarEscalasGeradas, setMostrarEscalasGeradas] = useState(false);
  const [mostrarEscalasExtrasGeradas, setMostrarEscalasExtrasGeradas] = useState(false);
  const [loadingEscalas, setLoadingEscalas] = useState(false);
  const [errorEscalas, setErrorEscalas] = useState<string | null>(null);
  const [itensEscalas, setItensEscalas] = useState<EscalaGeradaResumo[]>([]);
  const [abrirEscalaError, setAbrirEscalaError] = useState<string | null>(null);

  const [editRow, setEditRow] = useState<TrocaServicoAtivaListaItem | null>(null);
  const [editDataA, setEditDataA] = useState('');
  const [editDataB, setEditDataB] = useState('');
  const [editTurnoA, setEditTurnoA] = useState<TrocaServicoTurno>('DIURNO');
  const [editTurnoB, setEditTurnoB] = useState<TrocaServicoTurno>('DIURNO');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [cancelRow, setCancelRow] = useState<TrocaServicoAtivaListaItem | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [desativarEscala, setDesativarEscala] = useState<EscalaGeradaResumo | null>(null);
  const [desativarSaving, setDesativarSaving] = useState(false);
  const [desativarError, setDesativarError] = useState<string | null>(null);
  const [excluirEscala, setExcluirEscala] = useState<EscalaGeradaResumo | null>(null);
  const [excluirSaving, setExcluirSaving] = useState(false);
  const [excluirError, setExcluirError] = useState<string | null>(null);

  const podeVerTrocas = canView(permissoes, 'troca-servico');
  const podeGerenciarTrocas = podeGerenciarTrocaServicoElevado(permissoes, currentUser);
  const podeDesativarEscala = canDesativar(permissoes, 'escalas-consultar');
  const podeExcluirEscala = canExcluir(permissoes, 'escalas-consultar');

  const carregarTrocas = useCallback(async () => {
    setLoadingTrocas(true);
    setErrorTrocas(null);
    try {
      await api.processarRevertesTrocaServico();
      const data = await api.listTrocasServicoAtivas();
      setItensTrocas(data);
    } catch (e) {
      setItensTrocas([]);
      setErrorTrocas(e instanceof Error ? e.message : 'Não foi possível carregar as trocas.');
    } finally {
      setLoadingTrocas(false);
    }
  }, []);

  const itensTrocasFiltradas = useMemo(() => {
    const efetivadas = itensTrocas.filter((r) => r.restauradoA && r.restauradoB);
    if (trocasTab === 'efetivadas') return efetivadas;
    // Em andamento = ao menos um dos policiais ainda não retornou para a origem.
    return itensTrocas.filter((r) => !r.restauradoA || !r.restauradoB);
  }, [itensTrocas, trocasTab]);

  const anosRankingOptions = useMemo(() => {
    const anos = new Set<string>([anoAtualIso()]);
    for (const t of itensTrocas) {
      anos.add(ymdFromApi(t.dataServicoA).slice(0, 4));
      anos.add(ymdFromApi(t.dataServicoB).slice(0, 4));
    }
    return Array.from(anos).sort((a, b) => Number(b) - Number(a));
  }, [itensTrocas]);

  const rankingTrocasServico = useMemo(() => {
    const acc = new Map<
      number,
      { policialId: number; nome: string; matricula: string; programadas: number; efetivadas: number }
    >();
    const contabilizar = (
      p: { id: number; nome: string; matricula: string },
      tipo: 'programada' | 'efetivada',
    ) => {
      const atual = acc.get(p.id) ?? {
        policialId: p.id,
        nome: p.nome,
        matricula: p.matricula,
        programadas: 0,
        efetivadas: 0,
      };
      if (tipo === 'efetivada') atual.efetivadas += 1;
      else atual.programadas += 1;
      acc.set(p.id, atual);
    };

    for (const t of itensTrocas) {
      const efetivada = t.restauradoA && t.restauradoB;
      const ymdA = ymdFromApi(t.dataServicoA);
      const ymdB = ymdFromApi(t.dataServicoB);
      const anoA = ymdA.slice(0, 4);
      const anoB = ymdB.slice(0, 4);
      const mesA = ymdA.slice(5, 7);
      const mesB = ymdB.slice(5, 7);
      const mesOk = (mes: string) => rankingMesRef === RANKING_MES_TODOS || mes === rankingMesRef;
      if (anoA === rankingAnoRef && mesOk(mesA)) {
        contabilizar(t.policialA, efetivada ? 'efetivada' : 'programada');
      }
      if (anoB === rankingAnoRef && mesOk(mesB)) {
        contabilizar(t.policialB, efetivada ? 'efetivada' : 'programada');
      }
    }

    return Array.from(acc.values())
      .map((r) => ({ ...r, total: r.programadas + r.efetivadas }))
      .filter((r) => r.total > 0)
      .sort((a, b) => {
        if (b.total !== a.total) return b.total - a.total;
        if (b.efetivadas !== a.efetivadas) return b.efetivadas - a.efetivadas;
        if (b.programadas !== a.programadas) return b.programadas - a.programadas;
        return a.nome.localeCompare(b.nome, 'pt-BR');
      });
  }, [itensTrocas, rankingAnoRef, rankingMesRef]);

  const itensEscalasExtras = useMemo(
    () => itensEscalas.filter((r) => String(r.tipoServico).split(',').includes('EXTRAORDINARIA')),
    [itensEscalas],
  );

  const carregarEscalasGeradas = useCallback(async () => {
    setLoadingEscalas(true);
    setErrorEscalas(null);
    try {
      const data = await api.listEscalaGeradas({ take: 200 });
      setItensEscalas(data);
    } catch (e) {
      setItensEscalas([]);
      setErrorEscalas(e instanceof Error ? e.message : 'Não foi possível carregar as escalas.');
    } finally {
      setLoadingEscalas(false);
    }
  }, []);

  useEffect(() => {
    if (mostrarTrocas || mostrarRankingTrocas) {
      void carregarTrocas();
    }
  }, [mostrarTrocas, mostrarRankingTrocas, carregarTrocas]);

  useEffect(() => {
    if (mostrarEscalasGeradas || mostrarEscalasExtrasGeradas) {
      void carregarEscalasGeradas();
    }
  }, [mostrarEscalasGeradas, mostrarEscalasExtrasGeradas, carregarEscalasGeradas]);

  const abrirEdicao = (row: TrocaServicoAtivaListaItem) => {
    setEditError(null);
    setEditRow(row);
    setEditDataA(ymdFromApi(row.dataServicoA));
    setEditDataB(ymdFromApi(row.dataServicoB));
    const motor = trocaServicoAtivaEhEntreMotoristasDeDia(row);
    setEditTurnoA(motor ? 'DIURNO' : row.turnoServicoA ?? 'NOTURNO');
    setEditTurnoB(motor ? 'DIURNO' : row.turnoServicoB ?? 'NOTURNO');
  };

  useEffect(() => {
    if (!editRow || !trocaServicoAtivaEhEntreMotoristasDeDia(editRow)) return;
    setEditTurnoA('DIURNO');
    setEditTurnoB('DIURNO');
  }, [editRow]);

  const salvarEdicao = async () => {
    if (!editRow) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await api.updateTrocaServicoDatas(editRow.id, {
        dataServicoA: editDataA.trim(),
        dataServicoB: editDataB.trim(),
        turnoServicoA: editTurnoA,
        turnoServicoB: editTurnoB,
      });
      setEditRow(null);
      await carregarTrocas();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setEditSaving(false);
    }
  };

  const confirmarCancelamento = async () => {
    if (!cancelRow) return;
    setCancelSaving(true);
    setCancelError(null);
    try {
      await api.cancelarTrocaServico(cancelRow.id);
      setCancelRow(null);
      await carregarTrocas();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : 'Falha ao cancelar.');
    } finally {
      setCancelSaving(false);
    }
  };

  const podeAlterarDatas = (row: TrocaServicoAtivaListaItem) =>
    row.status !== 'CONCLUIDA' && !row.restauradoA && !row.restauradoB;

  const confirmarDesativarEscala = async () => {
    if (!desativarEscala) return;
    setDesativarSaving(true);
    setDesativarError(null);
    try {
      await api.desativarEscalaGerada(desativarEscala.id);
      setDesativarEscala(null);
      await carregarEscalasGeradas();
    } catch (e) {
      setDesativarError(e instanceof Error ? e.message : 'Falha ao desativar.');
    } finally {
      setDesativarSaving(false);
    }
  };

  const confirmarExcluirEscala = async () => {
    if (!excluirEscala) return;
    setExcluirSaving(true);
    setExcluirError(null);
    try {
      await api.deleteEscalaGerada(excluirEscala.id);
      setExcluirEscala(null);
      await carregarEscalasGeradas();
    } catch (e) {
      setExcluirError(e instanceof Error ? e.message : 'Falha ao excluir.');
    } finally {
      setExcluirSaving(false);
    }
  };

  const abrirEscalaGeradaImpressao = (id: number) => {
    setAbrirEscalaError(null);
    const w = openEscalaGeradaBlankWindow();
    if (!w) {
      setAbrirEscalaError('O navegador bloqueou a nova janela. Permita pop-ups para este site.');
      return;
    }
    writeEscalaGeradaLoadingWindow(w);
    void (async () => {
      try {
        const full = await api.getEscalaGerada(id);
        writeEscalaGeradaPrintWindow(w, escalaGeradaToDraft(full));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Falha ao carregar a escala.';
        w.document.open();
        w.document.write(
          `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Erro</title></head><body><p>${msg.replace(/</g, '&lt;')}</p></body></html>`,
        );
        w.document.close();
      }
    })();
  };

  return (
    <>
      <p className="subtitle" style={{ marginTop: 0, marginBottom: 16 }}>
        Clique em um cartão para expandir
        {podeVerTrocas ? ' e consultar trocas de serviço ou' : ' e'} consultar escalas já salvas.
      </p>

      <div className="management-grid visualizar-escalas-panels">
        {podeVerTrocas ? (
        <>
        <div className="management-item">
          <button
            type="button"
            className="management-card"
            onClick={() => setMostrarTrocas((v) => !v)}
            aria-expanded={mostrarTrocas}
          >
            <span className="management-card-title">Ver trocas de serviço</span>
            <span className="management-card-description">
              Lista trocas ativas: alterar datas (quando ainda não houve encerramento parcial do turno) ou cancelar o
              registro da troca.
            </span>
          </button>
          <div className={`management-panel ${mostrarTrocas ? 'management-panel--open' : ''}`}>
            <div className="management-panel__content">
              <Stack spacing={2}>
                {errorTrocas && (
                  <Alert severity="error" onClose={() => setErrorTrocas(null)}>
                    {errorTrocas}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {loadingTrocas && <CircularProgress size={22} />}
                </Box>

                {!loadingTrocas && itensTrocas.length === 0 && !errorTrocas && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma troca registrada (em andamento ou concluída).
                  </Typography>
                )}

                {itensTrocas.length > 0 && (
                  <>
                    <Tabs
                      value={trocasTab}
                      onChange={(_, v) => setTrocasTab(v as 'andamento' | 'efetivadas')}
                      variant="scrollable"
                      scrollButtons="auto"
                      allowScrollButtonsMobile
                    >
                      <Tab value="andamento" label="Trocas em andamento" />
                      <Tab value="efetivadas" label="Trocas efetivadas" />
                    </Tabs>

                    {itensTrocasFiltradas.length > 0 ? (
                      <TableContainer
                        sx={{
                          border: '1px solid var(--border-soft)',
                          borderRadius: 1,
                          maxWidth: '100%',
                          overflow: 'hidden',
                        }}
                      >
                        <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'auto' }}>
                          <TableHead>
                            <TableRow>
                              <TableCell>Policial A</TableCell>
                              <TableCell
                                sx={{ whiteSpace: 'nowrap', minWidth: 150 }}
                                title="Data e turno do serviço trocado"
                                align="center"
                              >
                                Data e turno
                              </TableCell>
                              <TableCell>Policial B</TableCell>
                              <TableCell
                                sx={{ whiteSpace: 'nowrap', minWidth: 150 }}
                                title="Data e turno do serviço trocado"
                                align="center"
                              >
                                Data e turno
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>Situação</TableCell>
                              <TableCell align="right" sx={{ minWidth: 96, whiteSpace: 'nowrap' }}>
                                Ações
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {itensTrocasFiltradas.map((row) => (
                              <TableRow key={row.id} hover>
                            <TableCell sx={{ minWidth: 220 }}>
                              <Typography variant="body2" fontWeight={600} noWrap title={row.policialA.nome}>
                                {row.policialA.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {formatMatricula(row.policialA.matricula)} · Equipe (cadastro):{' '}
                                {formatEquipeLabel(row.policialA.equipe)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Plantão trocado na equipe do parceiro:{' '}
                                {formatEquipeLabel(row.equipeOrigemB)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 150 }} align="center">
                              <Typography variant="body2" component="span" display="block">
                                {formatDate(row.dataServicoA)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="span" display="block">
                                {labelTurnoTroca(row.turnoServicoA, row)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography
                                variant="body2"
                                fontWeight={600}
                                noWrap
                                title={row.policialB.nome}
                              >
                                {row.policialB.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                {formatMatricula(row.policialB.matricula)} · Equipe (cadastro):{' '}
                                {formatEquipeLabel(row.policialB.equipe)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Plantão trocado na equipe do parceiro:{' '}
                                {formatEquipeLabel(row.equipeOrigemA)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 150 }} align="center">
                              <Typography variant="body2" component="span" display="block">
                                {formatDate(row.dataServicoB)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="span" display="block">
                                {labelTurnoTroca(row.turnoServicoB, row)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                              {row.status === 'CONCLUIDA' && (
                                <Chip
                                  label="Concluída"
                                  size="small"
                                  color="success"
                                  variant="outlined"
                                  sx={{ mb: 0.5 }}
                                />
                              )}
                              <Typography variant="caption" component="span" display="block" sx={{ whiteSpace: 'nowrap' }}>
                                {row.restauradoA ? 'A: finalizado' : 'A: em troca'}
                              </Typography>
                              <Typography variant="caption" component="span" display="block" sx={{ whiteSpace: 'nowrap' }}>
                                {row.restauradoB ? 'B: finalizado' : 'B: em troca'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ minWidth: 96, whiteSpace: 'nowrap' }}>
                              {podeGerenciarTrocas && trocasTab === 'andamento' && row.status !== 'CONCLUIDA' ? (
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                                  <Tooltip
                                    title={
                                      podeAlterarDatas(row)
                                        ? 'Alterar datas e turnos'
                                        : 'Após retorno parcial, altere apenas cancelando e registrando nova troca.'
                                    }
                                  >
                                    <span>
                                      <IconButton
                                        size="small"
                                        color="warning"
                                        onClick={() => abrirEdicao(row)}
                                        disabled={!podeAlterarDatas(row)}
                                        aria-label="Alterar datas e turnos"
                                      >
                                        <Edit fontSize="small" />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Cancelar troca">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={() => setCancelRow(row)}
                                      aria-label="Cancelar troca"
                                    >
                                      <Block fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  Somente leitura
                                </Typography>
                              )}
                            </TableCell>
                          </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        {trocasTab === 'efetivadas'
                          ? 'Nenhuma troca efetivada no momento.'
                          : 'Nenhuma troca em andamento no momento.'}
                      </Typography>
                    )}
                  </>
                )}
              </Stack>
            </div>
          </div>
        </div>
        <div className="management-item">
          <button
            type="button"
            className="management-card"
            onClick={() => setMostrarRankingTrocas((v) => !v)}
            aria-expanded={mostrarRankingTrocas}
          >
            <span className="management-card-title">Ranking de trocas de serviço</span>
            <span className="management-card-description">
              Lista policiais com contagem de trocas programadas (não efetivadas) e trocas efetivadas. Em «Mês»,
              escolha «Todos» para ver o total do ano selecionado.
            </span>
          </button>
          <div className={`management-panel ${mostrarRankingTrocas ? 'management-panel--open' : ''}`}>
            <div className="management-panel__content">
              <Stack spacing={2}>
                {errorTrocas && (
                  <Alert severity="error" onClose={() => setErrorTrocas(null)}>
                    {errorTrocas}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  {loadingTrocas && <CircularProgress size={22} />}
                  <Typography variant="body2" color="text.secondary">
                    Filtros do ranking:
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel id="ranking-mes-ref-label">Mês</InputLabel>
                    <Select
                      labelId="ranking-mes-ref-label"
                      label="Mês"
                      value={rankingMesRef}
                      onChange={(e) => setRankingMesRef(e.target.value)}
                    >
                      <MenuItem value={RANKING_MES_TODOS}>Todos</MenuItem>
                      <MenuItem value="01">Janeiro</MenuItem>
                      <MenuItem value="02">Fevereiro</MenuItem>
                      <MenuItem value="03">Março</MenuItem>
                      <MenuItem value="04">Abril</MenuItem>
                      <MenuItem value="05">Maio</MenuItem>
                      <MenuItem value="06">Junho</MenuItem>
                      <MenuItem value="07">Julho</MenuItem>
                      <MenuItem value="08">Agosto</MenuItem>
                      <MenuItem value="09">Setembro</MenuItem>
                      <MenuItem value="10">Outubro</MenuItem>
                      <MenuItem value="11">Novembro</MenuItem>
                      <MenuItem value="12">Dezembro</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel id="ranking-ano-ref-label">Ano</InputLabel>
                    <Select
                      labelId="ranking-ano-ref-label"
                      label="Ano"
                      value={rankingAnoRef}
                      onChange={(e) => setRankingAnoRef(e.target.value)}
                    >
                      {anosRankingOptions.map((ano) => (
                        <MenuItem key={ano} value={ano}>
                          {ano}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                {!loadingTrocas && rankingTrocasServico.length === 0 && !errorTrocas && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhum policial com registro de troca de serviço.
                  </Typography>
                )}

                {rankingTrocasServico.length > 0 && (
                  <TableContainer
                    sx={{
                      border: '1px solid var(--border-soft)',
                      borderRadius: 1,
                      maxWidth: '100%',
                      overflow: 'hidden',
                    }}
                  >
                    <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'auto' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Policial</TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap', minWidth: 220 }}>
                            Trocas programadas (não efetivadas)
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap', minWidth: 180 }}>
                            Trocas efetivadas
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: 'nowrap', minWidth: 120 }}>
                            Total
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rankingTrocasServico.map((r) => (
                          <TableRow key={r.policialId} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} noWrap title={r.nome}>
                                {r.nome}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatMatricula(r.matricula)}
                              </Typography>
                            </TableCell>
                            <TableCell align="center">{r.programadas}</TableCell>
                            <TableCell align="center">{r.efetivadas}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>{r.total}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Stack>
            </div>
          </div>
        </div>
        </>
        ) : null}

        <div className="management-item">
          <button
            type="button"
            className="management-card"
            onClick={() => setMostrarEscalasGeradas((v) => !v)}
            aria-expanded={mostrarEscalasGeradas}
          >
            <span className="management-card-title">Ver escalas geradas</span>
            <span className="management-card-description">
              Escalas salvas a partir da aba Gerar Escalas. Abra para visualizar ou imprimir. Quem tem permissão pode
              desativar (ocultar da lista) ou excluir definitivamente.
            </span>
          </button>
          <div className={`management-panel ${mostrarEscalasGeradas ? 'management-panel--open' : ''}`}>
            <div className="management-panel__content">
              <Stack spacing={2}>
                {abrirEscalaError && (
                  <Alert severity="warning" onClose={() => setAbrirEscalaError(null)}>
                    {abrirEscalaError}
                  </Alert>
                )}
                {errorEscalas && (
                  <Alert severity="error" onClose={() => setErrorEscalas(null)}>
                    {errorEscalas}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                  <Tooltip title="Atualizar lista">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => void carregarEscalasGeradas()}
                        disabled={loadingEscalas}
                        aria-label="Atualizar lista de escalas geradas"
                        sx={sxEscalaGeradaIcon('atualizar')}
                      >
                        {loadingEscalas ? <CircularProgress size={20} color="inherit" /> : <Refresh fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                {!loadingEscalas && itensEscalas.length === 0 && !errorEscalas && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma escala salva no momento.
                  </Typography>
                )}

                {itensEscalas.length > 0 && (
                  <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
                    <TableContainer
                      sx={{
                        border: '1px solid var(--border-soft)',
                        borderRadius: 1,
                        width: '100%',
                        maxWidth: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'auto' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>Data da escala</TableCell>
                          <TableCell>Tipo de serviço</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>Salva em</TableCell>
                          <TableCell>Por</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            Ações
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensEscalas.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell>{formatDate(row.dataEscala)}</TableCell>
                            <TableCell sx={{ maxWidth: 360 }}>
                              <Tooltip title={labelTipoServico(row.tipoServico)} placement="top-start">
                                <Typography variant="body2" noWrap component="span" display="block">
                                  {labelTipoServico(row.tipoServico)}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{formatDate(row.createdAt)}</TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Tooltip title={row.createdByName ?? '—'} placement="top-start">
                                <Typography variant="body2" noWrap component="span" display="block">
                                  {row.createdByName ?? '—'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  flexWrap: 'nowrap',
                                  justifyContent: 'flex-end',
                                  alignItems: 'center',
                                  gap: 0.25,
                                }}
                              >
                                <Tooltip title="Abrir / imprimir">
                                  <IconButton
                                    size="small"
                                    onClick={() => abrirEscalaGeradaImpressao(row.id)}
                                    aria-label={`Abrir escala do dia ${row.dataEscala}`}
                                    sx={sxEscalaGeradaIcon('abrir')}
                                  >
                                    <OpenInNew fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {podeDesativarEscala && (
                                  <Tooltip title="Desativar">
                                    <IconButton
                                      size="small"
                                      onClick={() => setDesativarEscala(row)}
                                      aria-label={`Desativar escala ${row.id}`}
                                      sx={sxEscalaGeradaIcon('desativar')}
                                    >
                                      <Block fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {podeExcluirEscala && (
                                  <Tooltip title="Excluir definitivamente">
                                    <IconButton
                                      size="small"
                                      onClick={() => setExcluirEscala(row)}
                                      aria-label={`Excluir escala ${row.id}`}
                                      sx={sxEscalaGeradaIcon('excluir')}
                                    >
                                      <DeleteOutline fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  </Box>
                )}
              </Stack>
            </div>
          </div>
        </div>

        <div className="management-item">
          <button
            type="button"
            className="management-card"
            onClick={() => setMostrarEscalasExtrasGeradas((v) => !v)}
            aria-expanded={mostrarEscalasExtrasGeradas}
          >
            <span className="management-card-title">Ver escalas extras geradas</span>
            <span className="management-card-description">
              Lista apenas escalas extraordinárias já salvas. Abra para visualizar/imprimir; permissões de desativar e
              excluir seguem as mesmas da consulta geral.
            </span>
          </button>
          <div className={`management-panel ${mostrarEscalasExtrasGeradas ? 'management-panel--open' : ''}`}>
            <div className="management-panel__content">
              <Stack spacing={2}>
                {abrirEscalaError && (
                  <Alert severity="warning" onClose={() => setAbrirEscalaError(null)}>
                    {abrirEscalaError}
                  </Alert>
                )}
                {errorEscalas && (
                  <Alert severity="error" onClose={() => setErrorEscalas(null)}>
                    {errorEscalas}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap' }}>
                  <Tooltip title="Atualizar lista">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => void carregarEscalasGeradas()}
                        disabled={loadingEscalas}
                        aria-label="Atualizar lista de escalas extras geradas"
                        sx={sxEscalaGeradaIcon('atualizar')}
                      >
                        {loadingEscalas ? <CircularProgress size={20} color="inherit" /> : <Refresh fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>

                {!loadingEscalas && itensEscalasExtras.length === 0 && !errorEscalas && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma escala extraordinária salva no momento.
                  </Typography>
                )}

                {itensEscalasExtras.length > 0 && (
                  <Box sx={{ width: '100%', minWidth: 0, maxWidth: '100%' }}>
                    <TableContainer
                      sx={{
                        border: '1px solid var(--border-soft)',
                        borderRadius: 1,
                        width: '100%',
                        maxWidth: '100%',
                        overflow: 'hidden',
                      }}
                    >
                      <Table size="small" stickyHeader sx={{ width: '100%', tableLayout: 'auto' }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>Data da escala</TableCell>
                          <TableCell>Tipo de serviço</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>Salva em</TableCell>
                          <TableCell>Por</TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            Ações
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensEscalasExtras.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell>{formatDate(row.dataEscala)}</TableCell>
                            <TableCell sx={{ maxWidth: 360 }}>
                              <Tooltip title={labelTipoServico(row.tipoServico)} placement="top-start">
                                <Typography variant="body2" noWrap component="span" display="block">
                                  {labelTipoServico(row.tipoServico)}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>{formatDate(row.createdAt)}</TableCell>
                            <TableCell sx={{ maxWidth: 220 }}>
                              <Tooltip title={row.createdByName ?? '—'} placement="top-start">
                                <Typography variant="body2" noWrap component="span" display="block">
                                  {row.createdByName ?? '—'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right" sx={{ whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                              <Box
                                sx={{
                                  display: 'flex',
                                  flexDirection: 'row',
                                  flexWrap: 'nowrap',
                                  justifyContent: 'flex-end',
                                  alignItems: 'center',
                                  gap: 0.25,
                                }}
                              >
                                <Tooltip title="Abrir / imprimir">
                                  <IconButton
                                    size="small"
                                    onClick={() => abrirEscalaGeradaImpressao(row.id)}
                                    aria-label={`Abrir escala extra do dia ${row.dataEscala}`}
                                    sx={sxEscalaGeradaIcon('abrir')}
                                  >
                                    <OpenInNew fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {podeDesativarEscala && (
                                  <Tooltip title="Desativar">
                                    <IconButton
                                      size="small"
                                      onClick={() => setDesativarEscala(row)}
                                      aria-label={`Desativar escala extra ${row.id}`}
                                      sx={sxEscalaGeradaIcon('desativar')}
                                    >
                                      <Block fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                {podeExcluirEscala && (
                                  <Tooltip title="Excluir definitivamente">
                                    <IconButton
                                      size="small"
                                      onClick={() => setExcluirEscala(row)}
                                      aria-label={`Excluir escala extra ${row.id}`}
                                      sx={sxEscalaGeradaIcon('excluir')}
                                    >
                                      <DeleteOutline fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  </Box>
                )}
              </Stack>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(editRow)} onClose={() => !editSaving && setEditRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Alterar datas e turnos da troca</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            {editRow && (
              <Typography variant="body2" color="text.secondary">
                {trocaServicoAtivaEhEntreMotoristasDeDia(editRow) ? (
                  <>
                    Troca entre <strong>motoristas de dia</strong> (escala <strong>{ESCALA_MOTORISTA_DIA}</strong>): a
                    cobertura do dia civil é <strong>07h às 07h</strong>. O cadastro de equipe não muda; o encerramento
                    automático do registro segue o marco técnico às <strong>19h</strong> do dia de cada serviço (Brasília).
                  </>
                ) : (
                  <>
                    Ajuste data e horário (turno 12×24) para cada policial. O cadastro de equipe não muda; após o fim do
                    turno informado (diurno: 19h do dia; noturno: 07h do dia seguinte, Brasília), o lado correspondente da
                    troca é encerrado no registro.
                  </>
                )}
              </Typography>
            )}
            <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
              {editRow?.policialA.nome ?? 'Policial A'}
            </Typography>
            <TextField
              label="Data do serviço"
              type="date"
              value={editDataA}
              onChange={(e) => setEditDataA(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel id="edit-troca-turno-a">
                {editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow)
                  ? `Cobertura na troca (${ESCALA_MOTORISTA_DIA})`
                  : 'Turno do serviço'}
              </InputLabel>
              <Select
                labelId="edit-troca-turno-a"
                label={
                  editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow)
                    ? `Cobertura na troca (${ESCALA_MOTORISTA_DIA})`
                    : 'Turno do serviço'
                }
                value={editTurnoA}
                onChange={(e) => setEditTurnoA(e.target.value as TrocaServicoTurno)}
              >
                {editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow) ? (
                  <MenuItem value="DIURNO">
                    {ESCALA_MOTORISTA_DIA} — motorista de dia (07h às 07h)
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem value="DIURNO">Diurno (07h–19h)</MenuItem>
                    <MenuItem value="NOTURNO">Noturno (19h–07h)</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>
              {editRow?.policialB.nome ?? 'Policial B'}
            </Typography>
            <TextField
              label="Data do serviço"
              type="date"
              value={editDataB}
              onChange={(e) => setEditDataB(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
              size="small"
            />
            <FormControl fullWidth size="small">
              <InputLabel id="edit-troca-turno-b">
                {editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow)
                  ? `Cobertura na troca (${ESCALA_MOTORISTA_DIA})`
                  : 'Turno do serviço'}
              </InputLabel>
              <Select
                labelId="edit-troca-turno-b"
                label={
                  editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow)
                    ? `Cobertura na troca (${ESCALA_MOTORISTA_DIA})`
                    : 'Turno do serviço'
                }
                value={editTurnoB}
                onChange={(e) => setEditTurnoB(e.target.value as TrocaServicoTurno)}
              >
                {editRow && trocaServicoAtivaEhEntreMotoristasDeDia(editRow) ? (
                  <MenuItem value="DIURNO">
                    {ESCALA_MOTORISTA_DIA} — motorista de dia (07h às 07h)
                  </MenuItem>
                ) : (
                  <>
                    <MenuItem value="DIURNO">Diurno (07h–19h)</MenuItem>
                    <MenuItem value="NOTURNO">Noturno (19h–07h)</MenuItem>
                  </>
                )}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditRow(null)} disabled={editSaving}>
            Fechar
          </Button>
          <Button variant="contained" onClick={() => void salvarEdicao()} disabled={editSaving}>
            {editSaving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(desativarEscala)}
        onClose={() => !desativarSaving && setDesativarEscala(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Desativar escala gerada</DialogTitle>
        <DialogContent>
          {desativarError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {desativarError}
            </Alert>
          )}
          <Typography variant="body2">
            A escala do dia{' '}
            <strong>{desativarEscala ? formatDate(desativarEscala.dataEscala) : '—'}</strong> (
            {desativarEscala ? labelTipoServico(desativarEscala.tipoServico) : '—'}) deixará de aparecer nesta lista. O registro
            permanece no banco (somente oculto). Para removê-lo por completo, use Excluir.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDesativarEscala(null)} disabled={desativarSaving}>
            Cancelar
          </Button>
          <Button color="warning" variant="contained" onClick={() => void confirmarDesativarEscala()} disabled={desativarSaving}>
            {desativarSaving ? 'Desativando…' : 'Desativar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(excluirEscala)} onClose={() => !excluirSaving && setExcluirEscala(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Excluir escala gerada</DialogTitle>
        <DialogContent>
          {excluirError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {excluirError}
            </Alert>
          )}
          <Typography variant="body2">
            Excluir definitivamente a escala do dia{' '}
            <strong>{excluirEscala ? formatDate(excluirEscala.dataEscala) : '—'}</strong> (
            {excluirEscala ? labelTipoServico(excluirEscala.tipoServico) : '—'}) e todas as linhas salvas? Esta ação não pode ser
            desfeita.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setExcluirEscala(null)} disabled={excluirSaving}>
            Não
          </Button>
          <Button color="error" variant="contained" onClick={() => void confirmarExcluirEscala()} disabled={excluirSaving}>
            {excluirSaving ? 'Excluindo…' : 'Sim, excluir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(cancelRow)} onClose={() => !cancelSaving && setCancelRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancelar troca de serviço</DialogTitle>
        <DialogContent>
          {cancelError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {cancelError}
            </Alert>
          )}
          <Typography variant="body2">
            O registro desta troca será cancelado. O cadastro de equipe dos policiais não é alterado pela troca de serviço;
            as equipes de origem registradas na troca são A:{' '}
            {cancelRow ? formatEquipeLabel(cancelRow.equipeOrigemA) : '—'}, B:{' '}
            {cancelRow ? formatEquipeLabel(cancelRow.equipeOrigemB) : '—'}. Deseja continuar?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelRow(null)} disabled={cancelSaving}>
            Não
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => void confirmarCancelamento()}
            disabled={cancelSaving}
          >
            {cancelSaving ? 'Cancelando…' : 'Sim, cancelar troca'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
