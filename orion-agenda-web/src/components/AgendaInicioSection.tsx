import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Add, CalendarMonthOutlined, Delete, Edit } from '@mui/icons-material';
import { api } from '../api';
import type {
  OrionAgendaCompromisso,
  OrionAgendaSessao,
  OrionAgendaStatus,
  AgendaPolicialEfetivo,
  Usuario,
} from '../types';
import {
  anosReferenciaDisponiveis,
  chaveDiaLocal,
  diaLocalNoMes,
  formatarHorarioAgenda,
  MESES_REFERENCIA,
  montarMesReferencia,
  referenciaAgendaInicial,
  rotuloDiaLocal,
  rotuloMesReferencia,
} from '../utils/formatAgendaData';
import { AgendaCalendarioMes } from './AgendaCalendarioMes';
import { AgendaCompromissoDetalheDialog } from './AgendaCompromissoDetalheDialog';
import { AgendaExcluirCompromissoDialog } from './AgendaExcluirCompromissoDialog';
import {
  AgendaEditarCompromissoDialog,
  type AgendaEditarCompromissoPayload,
} from './AgendaEditarCompromissoDialog';
import {
  AgendaNovoCompromissoDialog,
  type AgendaNovoCompromissoPayload,
} from './AgendaNovoCompromissoDialog';
import { nomesParticipantesCompromisso, TIPO_LABEL } from '../utils/agendaCompromissoUtil';
import { SaudacaoUsuario } from './common/SaudacaoUsuario';

const accent = '#2dd4bf';

const STATUS_LABEL: Record<OrionAgendaStatus, string> = {
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: alpha('#020617', 0.45),
    '& fieldset': { borderColor: alpha(accent, 0.22) },
  },
  '& .MuiInputLabel-root': { color: alpha('#f0fdfa', 0.65) },
  '& .MuiOutlinedInput-input': { color: '#f0fdfa' },
  '& .MuiSelect-icon': { color: alpha('#f0fdfa', 0.6) },
} as const;

function dataPadraoNovoCompromisso(ano: number, mes: number, dia?: number): string {
  if (dia != null) {
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  }
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m] = hoje.split('-').map(Number);
  if (y === ano && m === mes) return hoje;
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

type AgendaInicioSectionProps = {
  usuario: Usuario;
  publicErr: string | null;
  sessao: OrionAgendaSessao | null;
};

export function AgendaInicioSection({ usuario, publicErr, sessao }: AgendaInicioSectionProps) {
  const refInicial = useMemo(() => referenciaAgendaInicial(), []);
  const [mesNum, setMesNum] = useState(refInicial.mes);
  const [anoNum, setAnoNum] = useState(refInicial.ano);
  const mesRef = useMemo(() => montarMesReferencia(anoNum, mesNum), [anoNum, mesNum]);
  const anosDisponiveis = useMemo(() => anosReferenciaDisponiveis(), []);
  const [itens, setItens] = useState<OrionAgendaCompromisso[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [policiais, setPoliciais] = useState<AgendaPolicialEfetivo[]>([]);
  const [novoDialogOpen, setNovoDialogOpen] = useState(false);
  const [novoDataInicial, setNovoDataInicial] = useState('');
  const [novoComCampoData, setNovoComCampoData] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCompromisso, setEditingCompromisso] = useState<OrionAgendaCompromisso | null>(
    null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [detalheCompromisso, setDetalheCompromisso] = useState<OrionAgendaCompromisso | null>(
    null,
  );

  useEffect(() => {
    void api
      .listarPoliciaisEfetivo()
      .then(setPoliciais)
      .catch(() => setPoliciais([]));
  }, []);

  const carregar = useCallback(async (mesOverride?: string) => {
    setError(null);
    setLoading(true);
    try {
      const data = await api.listarCompromissos({ mes: mesOverride ?? mesRef });
      setItens(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a agenda.');
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [mesRef]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const gruposPorDia = useMemo(() => {
    const map = new Map<string, OrionAgendaCompromisso[]>();
    for (const c of itens) {
      const k = chaveDiaLocal(c.dataInicio);
      const arr = map.get(k) ?? [];
      arr.push(c);
      map.set(k, arr);
    }
    return [...map.entries()];
  }, [itens]);

  const compromissosPorDia = useMemo(() => {
    const map = new Map<number, OrionAgendaCompromisso[]>();
    for (const c of itens) {
      const dia = diaLocalNoMes(c.dataInicio, anoNum, mesNum);
      if (dia == null) continue;
      const arr = map.get(dia) ?? [];
      arr.push(c);
      map.set(dia, arr);
    }
    for (const [dia, lista] of map) {
      lista.sort(
        (a, b) =>
          new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime() || a.id - b.id,
      );
      map.set(dia, lista);
    }
    return map;
  }, [itens, anoNum, mesNum]);

  const compromissoExcluir = useMemo(
    () => (deleteId != null ? (itens.find((c) => c.id === deleteId) ?? null) : null),
    [deleteId, itens],
  );

  function dataHojeSp(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  }

  function abrirNovoCompromisso(dia?: number) {
    setNovoComCampoData(false);
    setNovoDataInicial(dataPadraoNovoCompromisso(anoNum, mesNum, dia));
    setNovoDialogOpen(true);
  }

  function abrirNovo() {
    setNovoComCampoData(true);
    setNovoDataInicial(dataHojeSp());
    setNovoDialogOpen(true);
  }

  function mesReferenciaDeIso(iso: string): string | null {
    const local = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const [y, m] = local.split('-').map(Number);
    if (!y || !m) return null;
    return montarMesReferencia(y, m);
  }

  async function salvarNovoCompromisso(payload: AgendaNovoCompromissoPayload) {
    setSubmitting(true);
    setError(null);
    try {
      await api.criarCompromisso(payload);
      setNovoDialogOpen(false);

      let mesCarregar: string | undefined;
      if (novoComCampoData) {
        const ref = mesReferenciaDeIso(payload.dataInicio);
        if (ref) {
          const [y, m] = ref.split('-').map(Number);
          setAnoNum(y!);
          setMesNum(m!);
          mesCarregar = ref;
        }
      }

      await carregar(mesCarregar);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  function abrirEditar(c: OrionAgendaCompromisso) {
    setEditingCompromisso(c);
    setEditDialogOpen(true);
  }

  async function salvarEdicaoCompromisso(payload: AgendaEditarCompromissoPayload) {
    if (editingCompromisso == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.atualizarCompromisso(editingCompromisso.id, {
        ...payload,
        dataFim: null,
        diaInteiro: false,
      });
      setEditDialogOpen(false);
      setEditingCompromisso(null);
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar.');
      throw e;
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmarExclusao() {
    if (deleteId == null) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.excluirCompromisso(deleteId);
      setDeleteId(null);
      await carregar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível excluir.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={2.5}>
      {publicErr ? (
        <Alert severity="warning" variant="outlined" sx={{ borderColor: 'divider' }}>
          Não foi possível comunicar com o servidor. Verifique se a API está em execução e se{' '}
          <code style={{ fontSize: '0.85em' }}>VITE_API_URL</code> aponta para o endereço correto.
          {publicErr ? ` (${publicErr})` : null}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2.5,
          bgcolor: alpha('#0f172a', 0.72),
          border: `1px solid ${alpha(accent, 0.22)}`,
          backgroundImage: `linear-gradient(135deg, ${alpha('#0f766e', 0.14)} 0%, transparent 55%)`,
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" alignItems="flex-start" spacing={2} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                flexShrink: 0,
                width: 48,
                height: 48,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(accent, 0.14),
                border: `1px solid ${alpha(accent, 0.35)}`,
              }}
            >
              <CalendarMonthOutlined sx={{ color: accent, fontSize: 28 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#f0fdfa' }}>
                <SaudacaoUsuario nomeCompleto={usuario.nome} prefixo="Bem-vindo(a)," />
              </Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={abrirNovo}
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              bgcolor: accent,
              color: '#042f2e',
              '&:hover': { bgcolor: '#5eead4' },
            }}
          >
            Novo compromisso
          </Button>
        </Stack>
      </Paper>

      {sessao && !sessao.podeAcessarModulo ? (
        <Alert severity="warning" variant="outlined" sx={{ borderColor: alpha(accent, 0.3) }}>
          {sessao.mensagem}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: alpha('#0f172a', 0.55),
          border: `1px solid ${alpha(accent, 0.15)}`,
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <FormControl size="small" sx={{ ...fieldSx, minWidth: 180 }}>
            <InputLabel>Mês de referência</InputLabel>
            <Select
              label="Mês de referência"
              value={mesNum}
              onChange={(e) => setMesNum(Number(e.target.value))}
            >
              {MESES_REFERENCIA.map((m) => (
                <MenuItem key={m.valor} value={m.valor}>
                  {m.rotulo}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ ...fieldSx, minWidth: 120 }}>
            <InputLabel>Ano</InputLabel>
            <Select label="Ano" value={anoNum} onChange={(e) => setAnoNum(Number(e.target.value))}>
              {anosDisponiveis.map((a) => (
                <MenuItem key={a} value={a}>
                  {a}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 2,
          bgcolor: alpha('#0f172a', 0.55),
          border: `1px solid ${alpha(accent, 0.15)}`,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#f0fdfa', mb: 2 }}>
          Calendário do mês
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} sx={{ color: accent }} />
          </Box>
        ) : (
          <AgendaCalendarioMes
            ano={anoNum}
            mes={mesNum}
            compromissosPorDia={compromissosPorDia}
            onAdicionarDia={abrirNovoCompromisso}
            onVerCompromisso={setDetalheCompromisso}
          />
        )}
      </Paper>

      {!loading && itens.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'var(--text-secondary)', textAlign: 'center', py: 1 }}>
          Nenhum compromisso em {rotuloMesReferencia(mesRef)}.
        </Typography>
      ) : null}

      {!loading && itens.length > 0 ? (
        <Stack spacing={2}>
          {gruposPorDia.map(([dia, lista]) => (
            <Box key={dia}>
              <Typography
                variant="subtitle2"
                sx={{
                  color: alpha(accent, 0.9),
                  fontWeight: 700,
                  textTransform: 'capitalize',
                  mb: 1,
                  pl: 0.5,
                }}
              >
                {rotuloDiaLocal(lista[0]!.dataInicio)}
              </Typography>
              <Stack spacing={1}>
                {lista.map((c) => {
                  const participantes = nomesParticipantesCompromisso(c);
                  return (
                  <Paper
                    key={c.id}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      bgcolor: alpha('#0f172a', 0.65),
                      border: `1px solid ${alpha(accent, 0.12)}`,
                      opacity: c.status === 'CANCELADO' ? 0.65 : 1,
                    }}
                  >
                    <Stack
                      direction={{ xs: 'column', sm: 'row' }}
                      justifyContent="space-between"
                      alignItems={{ xs: 'flex-start', sm: 'center' }}
                      gap={1}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography sx={{ fontWeight: 700, color: '#f0fdfa' }}>
                            {TIPO_LABEL[c.tipo]}
                          </Typography>
                          <Chip label={STATUS_LABEL[c.status]} size="small" color={
                              c.status === 'CONCLUIDO'
                                ? 'success'
                                : c.status === 'CANCELADO'
                                  ? 'default'
                                  : 'info'
                            } sx={{ height: 22, fontSize: '0.65rem' }} />
                        </Stack>
                        <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                          {participantes.join(', ')}
                          {participantes.length > 0 ? ' · ' : ''}
                          {formatarHorarioAgenda(c.dataInicio, c.diaInteiro)}
                          {c.local ? ` · ${c.local}` : ''}
                        </Typography>
                        {c.descricao ? (
                          <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.55), mt: 0.75 }}>
                            {c.descricao}
                          </Typography>
                        ) : null}
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton
                          size="small"
                          aria-label="Editar"
                          onClick={() => abrirEditar(c)}
                          sx={{ color: accent }}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label="Excluir"
                          onClick={() => setDeleteId(c.id)}
                          sx={{ color: alpha('#f87171', 0.9) }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  </Paper>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : null}

      <AgendaNovoCompromissoDialog
        open={novoDialogOpen}
        onClose={() => setNovoDialogOpen(false)}
        onSalvar={salvarNovoCompromisso}
        policiais={policiais}
        dataInicial={novoDataInicial}
        mostrarCampoData={novoComCampoData}
        compromissosExistentes={itens}
        submitting={submitting}
      />

      <AgendaCompromissoDetalheDialog
        open={detalheCompromisso != null}
        compromisso={detalheCompromisso}
        onClose={() => setDetalheCompromisso(null)}
        onEditar={(c) => {
          setDetalheCompromisso(null);
          abrirEditar(c);
        }}
        onExcluir={(c) => {
          setDetalheCompromisso(null);
          setDeleteId(c.id);
        }}
      />

      <AgendaEditarCompromissoDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setEditingCompromisso(null);
        }}
        onSalvar={salvarEdicaoCompromisso}
        compromisso={editingCompromisso}
        policiais={policiais}
        compromissosExistentes={itens}
        submitting={submitting}
      />

      <AgendaExcluirCompromissoDialog
        open={deleteId != null}
        compromisso={compromissoExcluir}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmarExclusao}
        submitting={submitting}
      />
    </Stack>
  );
}
