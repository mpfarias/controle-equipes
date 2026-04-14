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
import { Block, Edit } from '@mui/icons-material';
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
import { labelTipoServico, type EscalaGeradaDraftPayload } from '../../utils/gerarEscalasCalculo';
import {
  openEscalaGeradaBlankWindow,
  writeEscalaGeradaLoadingWindow,
  writeEscalaGeradaPrintWindow,
} from '../../utils/escalaGeradaPrint';

function ymdFromApi(value: string): string {
  const m = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1]! : value.slice(0, 10);
}

function labelTurnoTroca(t: TrocaServicoTurno | undefined): string {
  if (t === 'NOTURNO') return 'Noturno (19h–07h)';
  return 'Diurno (07h–19h)';
}

function escalaGeradaToDraft(eg: EscalaGerada): EscalaGeradaDraftPayload {
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
  const [loadingTrocas, setLoadingTrocas] = useState(false);
  const [errorTrocas, setErrorTrocas] = useState<string | null>(null);
  const [itensTrocas, setItensTrocas] = useState<TrocaServicoAtivaListaItem[]>([]);
  const [trocasTab, setTrocasTab] = useState<'andamento' | 'efetivadas'>('andamento');

  const [mostrarEscalasGeradas, setMostrarEscalasGeradas] = useState(false);
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
    if (mostrarTrocas) {
      void carregarTrocas();
    }
  }, [mostrarTrocas, carregarTrocas]);

  useEffect(() => {
    if (mostrarEscalasGeradas) {
      void carregarEscalasGeradas();
    }
  }, [mostrarEscalasGeradas, carregarEscalasGeradas]);

  const abrirEdicao = (row: TrocaServicoAtivaListaItem) => {
    setEditError(null);
    setEditRow(row);
    setEditDataA(ymdFromApi(row.dataServicoA));
    setEditDataB(ymdFromApi(row.dataServicoB));
    setEditTurnoA(row.turnoServicoA ?? 'NOTURNO');
    setEditTurnoB(row.turnoServicoB ?? 'NOTURNO');
  };

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

      <div className="management-grid">
        {podeVerTrocas ? (
        <div className="management-item">
          <button
            type="button"
            className="management-card"
            onClick={() => setMostrarTrocas((v) => !v)}
            aria-expanded={mostrarTrocas}
          >
            <span className="management-card-title">Ver trocas de serviço</span>
            <span className="management-card-description">
              Lista trocas ativas: alterar datas (quando ainda não houve retorno parcial) ou cancelar e restaurar
              equipes de origem.
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
                          overflowX: 'auto',
                        }}
                      >
                        <Table size="small" stickyHeader sx={{ minWidth: 920 }}>
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
                                {formatMatricula(row.policialA.matricula)} · equipe atual{' '}
                                {formatEquipeLabel(row.policialA.equipe)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Origem: {formatEquipeLabel(row.equipeOrigemA)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 150 }} align="center">
                              <Typography variant="body2" component="span" display="block">
                                {formatDate(row.dataServicoA)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="span" display="block">
                                {labelTurnoTroca(row.turnoServicoA)}
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
                                {formatMatricula(row.policialB.matricula)} · equipe atual{' '}
                                {formatEquipeLabel(row.policialB.equipe)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" display="block">
                                Origem: {formatEquipeLabel(row.equipeOrigemB)}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', minWidth: 150 }} align="center">
                              <Typography variant="body2" component="span" display="block">
                                {formatDate(row.dataServicoB)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" component="span" display="block">
                                {labelTurnoTroca(row.turnoServicoB)}
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
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => void carregarEscalasGeradas()}
                    disabled={loadingEscalas}
                  >
                    Atualizar lista
                  </Button>
                  {loadingEscalas && <CircularProgress size={22} />}
                </Box>

                {!loadingEscalas && itensEscalas.length === 0 && !errorEscalas && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma escala salva no momento.
                  </Typography>
                )}

                {itensEscalas.length > 0 && (
                  <TableContainer
                    sx={{ border: '1px solid var(--border-soft)', borderRadius: 1, maxWidth: '100%' }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell>Data da escala</TableCell>
                          <TableCell>Tipo de serviço</TableCell>
                          <TableCell>Resumo</TableCell>
                          <TableCell align="right">Linhas</TableCell>
                          <TableCell>Salva em</TableCell>
                          <TableCell>Por</TableCell>
                          <TableCell align="right">Ações</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {itensEscalas.map((row) => (
                          <TableRow key={row.id} hover>
                            <TableCell>{formatDate(row.dataEscala)}</TableCell>
                            <TableCell>{labelTipoServico(row.tipoServico)}</TableCell>
                            <TableCell sx={{ maxWidth: 280 }}>
                              <Typography variant="body2" noWrap title={row.resumoEquipes ?? undefined}>
                                {row.resumoEquipes?.trim() ? row.resumoEquipes : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">{row.linhasCount}</TableCell>
                            <TableCell>{formatDate(row.createdAt)}</TableCell>
                            <TableCell>{row.createdByName ?? '—'}</TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                                <Button size="small" variant="contained" onClick={() => abrirEscalaGeradaImpressao(row.id)}>
                                  Abrir
                                </Button>
                                {podeDesativarEscala && (
                                  <Button size="small" color="warning" variant="outlined" onClick={() => setDesativarEscala(row)}>
                                    Desativar
                                  </Button>
                                )}
                                {podeExcluirEscala && (
                                  <Button size="small" color="error" variant="outlined" onClick={() => setExcluirEscala(row)}>
                                    Excluir
                                  </Button>
                                )}
                              </Stack>
                            </TableCell>
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
      </div>

      <Dialog open={Boolean(editRow)} onClose={() => !editSaving && setEditRow(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Alterar datas e turnos da troca</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {editError && <Alert severity="error">{editError}</Alert>}
            {editRow && (
              <Typography variant="body2" color="text.secondary">
                Ajuste data e horário (turno 12×24) para cada policial. O cadastro volta à equipe de origem após o fim do
                turno informado (diurno: 19h do dia; noturno: 07h do dia seguinte, Brasília).
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
              <InputLabel id="edit-troca-turno-a">Turno do serviço</InputLabel>
              <Select
                labelId="edit-troca-turno-a"
                label="Turno do serviço"
                value={editTurnoA}
                onChange={(e) => setEditTurnoA(e.target.value as TrocaServicoTurno)}
              >
                <MenuItem value="DIURNO">Diurno (07h–19h)</MenuItem>
                <MenuItem value="NOTURNO">Noturno (19h–07h)</MenuItem>
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
              <InputLabel id="edit-troca-turno-b">Turno do serviço</InputLabel>
              <Select
                labelId="edit-troca-turno-b"
                label="Turno do serviço"
                value={editTurnoB}
                onChange={(e) => setEditTurnoB(e.target.value as TrocaServicoTurno)}
              >
                <MenuItem value="DIURNO">Diurno (07h–19h)</MenuItem>
                <MenuItem value="NOTURNO">Noturno (19h–07h)</MenuItem>
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
            Os policiais voltarão às equipes de origem desta troca (A:{' '}
            {cancelRow ? formatEquipeLabel(cancelRow.equipeOrigemA) : '—'}, B:{' '}
            {cancelRow ? formatEquipeLabel(cancelRow.equipeOrigemB) : '—'}). Deseja continuar?
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
