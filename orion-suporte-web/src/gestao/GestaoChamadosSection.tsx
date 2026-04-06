import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { api } from '../api';
import type { ErrorReport, ErrorReportAcao, ErrorReportCategoria, ErrorReportStatus } from '../types';
import { formatMatricula } from '../utils/formatMatricula';
import {
  ERROR_REPORT_ACAO_LABEL,
  ERROR_REPORT_CATEGORIA_LABEL,
  ERROR_REPORT_STATUS_LABEL,
} from '../lib/error-reports/labels';
import { ChamadoAnexoPreview } from '../lib/error-reports/ChamadoAnexoPreview';

type AbaGestaoChamados = 'ativos' | 'fechados';

/** Filtro da aba “Chamados” — sem Fechado (fica na aba Chamados Fechados). */
const STATUS_OPCOES_ATIVOS: Array<{ value: '' | ErrorReportStatus; label: string }> = [
  { value: '', label: 'Todos os status' },
  { value: 'ABERTO', label: ERROR_REPORT_STATUS_LABEL.ABERTO },
  { value: 'EM_ANALISE', label: ERROR_REPORT_STATUS_LABEL.EM_ANALISE },
  { value: 'RESOLVIDO', label: ERROR_REPORT_STATUS_LABEL.RESOLVIDO },
  { value: 'CANCELADO', label: ERROR_REPORT_STATUS_LABEL.CANCELADO },
];

function opcoesSelectPorStatus(status: ErrorReportStatus): Array<'EM_ANALISE' | 'RESOLVIDO'> {
  if (status === 'ABERTO') return ['EM_ANALISE', 'RESOLVIDO'];
  if (status === 'EM_ANALISE') return ['RESOLVIDO'];
  return [];
}

function chipGestaoStatusSx(status: ErrorReportStatus): object {
  switch (status) {
    case 'ABERTO':
      return { bgcolor: 'rgba(211, 47, 47, 0.18)', color: '#b71c1c', fontWeight: 600 };
    case 'EM_ANALISE':
      return { bgcolor: 'rgba(255, 154, 60, 0.2)', color: 'var(--sentinela-orange-glow)' };
    case 'RESOLVIDO':
      return { bgcolor: 'rgba(34, 197, 94, 0.2)', color: '#166534' };
    case 'CANCELADO':
      return { bgcolor: 'rgba(180, 180, 180, 0.35)', color: 'var(--text-secondary)' };
    case 'FECHADO':
    default:
      return { bgcolor: 'rgba(0,0,0,0.12)', color: 'var(--text-secondary)' };
  }
}

function statusChipGestao(status: ErrorReportStatus) {
  return (
    <Chip
      size="small"
      label={ERROR_REPORT_STATUS_LABEL[status]}
      sx={chipGestaoStatusSx(status)}
    />
  );
}

/** Valor exibido no select: vazio até o gestor escolher (chip já indica o status atual). */
function valorSelectAdmin(
  r: ErrorReport,
  rascunho: { reportId: number; novo: 'EM_ANALISE' | 'RESOLVIDO' } | null,
): '' | 'EM_ANALISE' | 'RESOLVIDO' {
  if (rascunho?.reportId === r.id) return rascunho.novo;
  return '';
}

function formatarData(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

function detalheAcaoTexto(acao: ErrorReportAcao): string {
  const d = acao.detalhes;
  if (!d) return '';
  if (acao.tipo === 'COMENTARIO' && typeof d.texto === 'string') return d.texto;
  if (acao.tipo === 'STATUS_ALTERADO' && typeof d.de === 'string' && typeof d.para === 'string') {
    return `${ERROR_REPORT_STATUS_LABEL[d.de as ErrorReportStatus] ?? d.de} → ${ERROR_REPORT_STATUS_LABEL[d.para as ErrorReportStatus] ?? d.para}`;
  }
  if (acao.tipo === 'CHAMADO_CRIADO') {
    const cat = typeof d.categoria === 'string' ? ERROR_REPORT_CATEGORIA_LABEL[d.categoria as ErrorReportCategoria] ?? d.categoria : '';
    const proto = typeof d.protocolo === 'string' && d.protocolo ? `Protocolo: ${d.protocolo}` : '';
    return [cat, proto].filter(Boolean).join(' — ');
  }
  if (acao.tipo === 'CHAMADO_CANCELADO' && typeof d.motivo === 'string') {
    return d.motivo;
  }
  return '';
}

function textoBuscaNormalizado(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

interface GestaoChamadosSectionProps {
  /** Atualiza o contador do ícone no header (chamados em aberto). */
  onContagemAbertosChange?: (total: number) => void;
}

export function GestaoChamadosSection({ onContagemAbertosChange }: GestaoChamadosSectionProps) {
  const [lista, setLista] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [contagemAbertos, setContagemAbertos] = useState(0);
  const [abaGestao, setAbaGestao] = useState<AbaGestaoChamados>('ativos');
  const [statusFiltro, setStatusFiltro] = useState<'' | ErrorReportStatus>('');
  const [busca, setBusca] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [confirmarStatus, setConfirmarStatus] = useState<{
    reportId: number;
    protocolo: string;
    statusAtual: ErrorReportStatus;
    novo: 'EM_ANALISE' | 'RESOLVIDO';
  } | null>(null);
  const [rascunhoSelectStatus, setRascunhoSelectStatus] = useState<{
    reportId: number;
    novo: 'EM_ANALISE' | 'RESOLVIDO';
  } | null>(null);
  const [sucessoStatus, setSucessoStatus] = useState<{
    protocolo: string;
    novo: 'EM_ANALISE' | 'RESOLVIDO';
  } | null>(null);
  const [confirmarArquivar, setConfirmarArquivar] = useState<{
    reportId: number;
    protocolo: string;
    statusAtual: ErrorReportStatus;
  } | null>(null);
  const [sucessoArquivado, setSucessoArquivado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    setLoading(true);
    try {
      const [todos, contagem] = await Promise.all([
        api.listErrorReportsAdminTodos(),
        api.getErrorReportsAdminContagemAbertos(),
      ]);
      setLista(todos);
      setContagemAbertos(contagem.total);
      onContagemAbertosChange?.(contagem.total);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar os chamados.');
    } finally {
      setLoading(false);
    }
  }, [onContagemAbertosChange]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalFechados = useMemo(() => lista.filter((x) => x.status === 'FECHADO').length, [lista]);

  const listaFiltrada = useMemo(() => {
    let r =
      abaGestao === 'fechados'
        ? lista.filter((x) => x.status === 'FECHADO')
        : lista.filter((x) => x.status !== 'FECHADO');
    if (abaGestao === 'ativos' && statusFiltro) {
      r = r.filter((x) => x.status === statusFiltro);
    }
    const q = textoBuscaNormalizado(busca.trim());
    if (q) {
      r = r.filter((x) => {
        if (textoBuscaNormalizado(x.descricao).includes(q)) return true;
        const u = x.usuario;
        if (u && textoBuscaNormalizado(u.nome).includes(q)) return true;
        if (u && textoBuscaNormalizado(u.matricula).includes(q)) return true;
        if (textoBuscaNormalizado(x.protocolo).includes(q)) return true;
        if (x.anexoNome && textoBuscaNormalizado(x.anexoNome).includes(q)) return true;
        return false;
      });
    }
    return r;
  }, [lista, abaGestao, statusFiltro, busca]);

  function aoEscolherNovoStatus(r: ErrorReport, novo: 'EM_ANALISE' | 'RESOLVIDO') {
    const permitidos = opcoesSelectPorStatus(r.status);
    if (!permitidos.includes(novo)) return;
    if (r.status === novo) return;
    setRascunhoSelectStatus({ reportId: r.id, novo });
    setConfirmarStatus({
      reportId: r.id,
      protocolo: r.protocolo,
      statusAtual: r.status,
      novo,
    });
  }

  function fecharConfirmarStatus() {
    if (savingId != null) return;
    setConfirmarStatus(null);
    setRascunhoSelectStatus(null);
  }

  async function confirmarAlteracaoStatus() {
    if (!confirmarStatus) return;
    const { reportId, protocolo, novo } = confirmarStatus;
    setSavingId(reportId);
    setErro(null);
    try {
      await api.updateErrorReportStatus(reportId, { status: novo });
      setConfirmarStatus(null);
      setRascunhoSelectStatus(null);
      setSucessoStatus({ protocolo, novo });
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao atualizar status.');
      setRascunhoSelectStatus(null);
    } finally {
      setSavingId(null);
    }
  }

  function fecharConfirmarArquivar() {
    if (savingId != null) return;
    setConfirmarArquivar(null);
  }

  async function executarArquivar() {
    if (!confirmarArquivar) return;
    const { reportId, protocolo } = confirmarArquivar;
    setSavingId(reportId);
    setErro(null);
    try {
      await api.updateErrorReportStatus(reportId, { status: 'FECHADO' });
      setConfirmarArquivar(null);
      setSucessoArquivado(protocolo);
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao arquivar chamado.');
    } finally {
      setSavingId(null);
    }
  }

  function aoTrocarAba(_: React.SyntheticEvent, value: AbaGestaoChamados) {
    setAbaGestao(value);
    setExpandedId(null);
    setRascunhoSelectStatus(null);
    setConfirmarStatus(null);
    setConfirmarArquivar(null);
    if (value === 'fechados') setStatusFiltro('');
  }

  return (
    <section>
      <div className="section-header">
        <div>
          <h2>Gestão de chamados</h2>
          <p className="subtitle">
            Acompanhe e atualize os chamados registrados pelos usuários do Órion SAD.
          </p>
        </div>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip label={`${contagemAbertos} em aberto`} color={contagemAbertos > 0 ? 'error' : 'default'} size="small" />
        </Stack>
      </div>

      <Tabs value={abaGestao} onChange={aoTrocarAba} sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Chamados" value="ativos" sx={{ textTransform: 'none' }} />
        <Tab label="Chamados Fechados" value="fechados" sx={{ textTransform: 'none' }} />
      </Tabs>

      {erro && (
        <Typography color="error" sx={{ mb: 2 }}>
          {erro}
        </Typography>
      )}

      <Paper
        elevation={1}
        sx={{
          p: 2,
          mb: 2,
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            label="Buscar"
            placeholder="Descrição, matrícula, nome ou protocolo"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ flex: 1, minWidth: 220 }}
          />
          {abaGestao === 'ativos' && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel id="filtro-status-gestao">Status</InputLabel>
              <Select
                labelId="filtro-status-gestao"
                label="Status"
                value={statusFiltro}
                onChange={(e) => setStatusFiltro(e.target.value as '' | ErrorReportStatus)}
              >
                {STATUS_OPCOES_ATIVOS.map((o) => (
                  <MenuItem key={o.value || 'todos'} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {abaGestao === 'fechados' && (
            <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
              Demandas encerradas e arquivadas pelo administrador.
            </Typography>
          )}
          <Button variant="outlined" onClick={() => void carregar()} disabled={loading} sx={{ textTransform: 'none' }}>
            Atualizar lista
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Typography color="text.secondary">Carregando chamados…</Typography>
      ) : listaFiltrada.length === 0 ? (
        <Typography color="text.secondary">
          {lista.length === 0
            ? 'Nenhum chamado registrado no sistema.'
            : abaGestao === 'fechados'
              ? totalFechados === 0
                ? 'Nenhum chamado arquivado ainda.'
                : 'Nenhum resultado corresponde à busca.'
              : 'Nenhum chamado corresponde aos filtros.'}
        </Typography>
      ) : (
        <TableContainer
          component={Paper}
          sx={{ border: '1px solid var(--border-soft)', backgroundColor: 'var(--card-bg)' }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 48 }} />
                <TableCell sx={{ fontWeight: 700 }}>Protocolo</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Abertura</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Solicitante</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Categoria</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {listaFiltrada.map((r) => {
                const opcoesSelect = opcoesSelectPorStatus(r.status);
                const mostrarSelect = abaGestao === 'ativos' && opcoesSelect.length > 0;
                const mostrarArquivar =
                  abaGestao === 'ativos' && (r.status === 'RESOLVIDO' || r.status === 'CANCELADO');

                return (
                  <Fragment key={r.id}>
                    <TableRow hover selected={expandedId === r.id}>
                      <TableCell>
                        <IconButton
                          size="small"
                          aria-label="expandir"
                          onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                        >
                          {expandedId === r.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                          {r.protocolo}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatarData(r.createdAt)}</TableCell>
                      <TableCell>
                        {r.usuario ? (
                          <>
                            {r.usuario.nome}
                            <Typography component="div" variant="caption" color="text.secondary">
                              {formatMatricula(r.usuario.matricula)}
                            </Typography>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{ERROR_REPORT_CATEGORIA_LABEL[r.categoria]}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          {statusChipGestao(r.status)}
                          {mostrarSelect && (
                            <FormControl size="small" sx={{ minWidth: 220 }}>
                              <InputLabel id={`gst-${r.id}`} shrink>
                                Alterar para
                              </InputLabel>
                              <Select
                                labelId={`gst-${r.id}`}
                                label="Alterar para"
                                displayEmpty
                                value={valorSelectAdmin(r, rascunhoSelectStatus)}
                                disabled={savingId === r.id}
                                onChange={(e) => {
                                  const novo = e.target.value as 'EM_ANALISE' | 'RESOLVIDO';
                                  if (novo !== 'EM_ANALISE' && novo !== 'RESOLVIDO') return;
                                  aoEscolherNovoStatus(r, novo);
                                }}
                                renderValue={(v) => (
                                  <Typography component="span" variant="body2" noWrap sx={{ display: 'block' }}>
                                    {v ? ERROR_REPORT_STATUS_LABEL[v] : 'Escolher…'}
                                  </Typography>
                                )}
                                MenuProps={{
                                  PaperProps: { sx: { maxHeight: 320 } },
                                }}
                              >
                                <MenuItem value="" disabled sx={{ opacity: 0.7 }}>
                                  <em>Escolher…</em>
                                </MenuItem>
                                {opcoesSelect.map((s) => (
                                  <MenuItem key={s} value={s}>
                                    {ERROR_REPORT_STATUS_LABEL[s]}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          )}
                          {mostrarArquivar && (
                            <Tooltip title="Fechar e arquivar demanda">
                              <span>
                                <IconButton
                                  size="small"
                                  aria-label="Arquivar chamado"
                                  disabled={savingId === r.id}
                                  onClick={() =>
                                    setConfirmarArquivar({
                                      reportId: r.id,
                                      protocolo: r.protocolo,
                                      statusAtual: r.status,
                                    })
                                  }
                                  sx={{
                                    color: '#fff',
                                    backgroundColor: 'var(--sentinela-blue)',
                                    '&:hover': {
                                      backgroundColor: 'var(--sentinela-blue)',
                                      opacity: 0.92,
                                    },
                                    '&.Mui-disabled': {
                                      color: 'rgba(255,255,255,0.45)',
                                      backgroundColor: 'rgba(0,0,0,0.12)',
                                    },
                                  }}
                                >
                                  <ArchiveOutlinedIcon sx={{ color: '#fff' }} />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: expandedId === r.id ? undefined : 0 }}>
                        <Collapse in={expandedId === r.id} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                              Descrição
                            </Typography>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
                              {r.descricao}
                            </Typography>
                            {r.anexoDataUrl ? (
                              <ChamadoAnexoPreview anexoDataUrl={r.anexoDataUrl} anexoNome={r.anexoNome} />
                            ) : null}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, mt: r.anexoDataUrl ? 2 : 0 }}>
                              Histórico de ações
                            </Typography>
                            <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                              {(Array.isArray(r.acoes) ? r.acoes : []).map((acao, idx) => (
                                <Box
                                  key={`${r.id}-${acao.em}-${idx}`}
                                  component="li"
                                  sx={{
                                    pl: 2,
                                    borderLeft: '3px solid var(--sentinela-orange)',
                                    py: 0.5,
                                  }}
                                >
                                  <Typography variant="caption" color="text.secondary">
                                    {formatarData(acao.em)} — {acao.usuarioNome}
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {ERROR_REPORT_ACAO_LABEL[acao.tipo] ?? acao.tipo}
                                  </Typography>
                                  {detalheAcaoTexto(acao) && (
                                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                      {detalheAcaoTexto(acao)}
                                    </Typography>
                                  )}
                                </Box>
                              ))}
                            </Stack>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={confirmarStatus != null}
        onClose={() => fecharConfirmarStatus()}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Confirmar alteração de status</DialogTitle>
        <DialogContent>
          {confirmarStatus && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Protocolo <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{confirmarStatus.protocolo}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Alterar de <strong>{ERROR_REPORT_STATUS_LABEL[confirmarStatus.statusAtual]}</strong> para{' '}
                <strong>{ERROR_REPORT_STATUS_LABEL[confirmarStatus.novo]}</strong>?
              </Typography>
              <Typography variant="caption" color="text.secondary">
                O solicitante verá o novo status na tela Reportar erro ao atualizar a lista.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharConfirmarStatus} disabled={savingId != null} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={() => void confirmarAlteracaoStatus()}
            disabled={savingId != null}
            sx={{ textTransform: 'none' }}
          >
            {savingId != null ? 'Salvando…' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={confirmarArquivar != null}
        onClose={() => fecharConfirmarArquivar()}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Arquivar demanda</DialogTitle>
        <DialogContent>
          {confirmarArquivar && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Protocolo <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{confirmarArquivar.protocolo}</strong>
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                O chamado está como <strong>{ERROR_REPORT_STATUS_LABEL[confirmarArquivar.statusAtual]}</strong>. Deseja
                fechar e arquivá-lo? Ele será movido para a aba <strong>Chamados Fechados</strong>.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                O solicitante verá o status “Fechado” na área de reporte.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharConfirmarArquivar} disabled={savingId != null} sx={{ textTransform: 'none' }}>
            Voltar
          </Button>
          <Button
            variant="contained"
            onClick={() => void executarArquivar()}
            disabled={savingId != null}
            sx={{ textTransform: 'none' }}
          >
            {savingId != null ? 'Arquivando…' : 'Confirmar arquivamento'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={sucessoStatus != null}
        onClose={() => setSucessoStatus(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Status atualizado</DialogTitle>
        <DialogContent>
          {sucessoStatus && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                O chamado{' '}
                <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                  {sucessoStatus.protocolo}
                </Box>{' '}
                foi marcado como <strong>{ERROR_REPORT_STATUS_LABEL[sucessoStatus.novo]}</strong>.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                O status já está salvo; o usuário verá a alteração na área de reporte.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setSucessoStatus(null)} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(sucessoArquivado)}
        onClose={() => setSucessoArquivado(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: { sx: { backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-soft)' } },
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Demanda arquivada</DialogTitle>
        <DialogContent>
          {sucessoArquivado && (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                O chamado{' '}
                <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace', fontWeight: 600 }}>
                  {sucessoArquivado}
                </Box>{' '}
                foi fechado e arquivado. Consulte-o na aba <strong>Chamados Fechados</strong>.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="contained" onClick={() => setSucessoArquivado(null)} sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
    </section>
  );
}
