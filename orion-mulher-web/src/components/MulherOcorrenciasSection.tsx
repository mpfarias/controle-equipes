import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Add, ChevronLeft, ChevronRight, Refresh, Search } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { api } from '../api';
import type { MulherOcorrenciaListaItem } from '../types';
import { MulherOcorrenciaWizardDialog } from './MulherOcorrenciaWizardDialog';

const accent = '#f472b6';

function formatData(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
}

export function MulherOcorrenciasSection() {
  const [items, setItems] = useState<MulherOcorrenciaListaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [busca, setBusca] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listOcorrencias({ page, q: busca || undefined });
      setItems(data.items);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao listar ocorrências.');
    } finally {
      setLoading(false);
    }
  }, [page, busca]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#fdf2f8', flex: 1 }}>
          Ocorrências ({total})
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            size="small"
            placeholder="Buscar vítima, agressor, CAD…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(1);
                setBusca(q.trim());
              }
            }}
            sx={{ minWidth: 240 }}
          />
          <IconButton
            aria-label="Buscar"
            onClick={() => {
              setPage(1);
              setBusca(q.trim());
            }}
            sx={{ color: accent }}
          >
            <Search />
          </IconButton>
          <IconButton aria-label="Atualizar" onClick={() => void carregar()} sx={{ color: accent }}>
            <Refresh />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setEditId(null);
              setWizardOpen(true);
            }}
            sx={{ bgcolor: accent, '&:hover': { bgcolor: '#ec4899' } }}
          >
            Nova ocorrência
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer component={Paper} sx={{ bgcolor: alpha('#0f172a', 0.65), border: `1px solid ${alpha(accent, 0.15)}` }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: accent }} />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Vítima</TableCell>
                <TableCell>Agressor</TableCell>
                <TableCell>RA</TableCell>
                <TableCell>Data</TableCell>
                <TableCell>CAD</TableCell>
                <TableCell>Fase</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Nenhuma ocorrência encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{row.nomeVitima ?? '—'}</TableCell>
                    <TableCell>{row.nomeAgressor ?? '—'}</TableCell>
                    <TableCell>{row.regiaoAdministrativa ?? '—'}</TableCell>
                    <TableCell>{formatData(row.dataHoraOcorrencia)}</TableCell>
                    <TableCell>{row.numeroOcorrenciaCad ?? '—'}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={`Fase ${row.faseAtual}${row.concluida ? ' ✓' : ''}`}
                        sx={{ bgcolor: alpha(accent, 0.15), color: accent }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => {
                          setEditId(row.id);
                          setWizardOpen(true);
                        }}
                      >
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableContainer>

      <Stack direction="row" justifyContent="center" alignItems="center" spacing={2} sx={{ mt: 2 }}>
        <IconButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          <ChevronLeft />
        </IconButton>
        <Typography variant="body2">
          Página {page} de {totalPages}
        </Typography>
        <IconButton disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          <ChevronRight />
        </IconButton>
      </Stack>

      <MulherOcorrenciaWizardDialog
        open={wizardOpen}
        ocorrenciaId={editId}
        onClose={() => {
          setWizardOpen(false);
          setEditId(null);
        }}
        onSaved={() => {
          setWizardOpen(false);
          setEditId(null);
          void carregar();
        }}
      />
    </Box>
  );
}
