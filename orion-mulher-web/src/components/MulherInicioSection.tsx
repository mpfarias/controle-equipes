import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Grid,
  Paper,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { api } from '../api';
import { MulherDashboardCharts } from './MulherDashboardCharts';
import type { MulherDashboardStats } from '../types';

const accent = '#f472b6';

export function MulherInicioSection() {
  const [stats, setStats] = useState<MulherDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await api.getDashboardStats());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar painel.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: accent }} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!stats) return null;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#fdf2f8', mb: 2 }}>
        Painel BI — Violência doméstica
      </Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: alpha('#0f172a', 0.65),
              border: `1px solid ${alpha(accent, 0.25)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Total de ocorrências
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: accent }}>
              {stats.total.toLocaleString('pt-BR')}
            </Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Paper
            sx={{
              p: 2,
              bgcolor: alpha('#0f172a', 0.65),
              border: `1px solid ${alpha(accent, 0.15)}`,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Revertidas COPOM Mulher
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#a855f7' }}>
              {stats.revertidasCopomTotal.toLocaleString('pt-BR')}
            </Typography>
          </Paper>
        </Grid>
        {stats.porOrigem.map((o) => (
          <Grid key={o.name} size={{ xs: 12, sm: 6, md: 3 }}>
            <Paper
              sx={{
                p: 2,
                bgcolor: alpha('#0f172a', 0.65),
                border: `1px solid ${alpha(accent, 0.15)}`,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {o.name}
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {o.value.toLocaleString('pt-BR')}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          size="small"
          label={`${stats.resumo.categoriasRegiao} regiões`}
          sx={{ bgcolor: alpha(accent, 0.12), color: accent }}
        />
        <Chip
          size="small"
          label={`${stats.resumo.categoriasTipo} tipos de agressão`}
          sx={{ bgcolor: alpha(accent, 0.12), color: accent }}
        />
        <Chip
          size="small"
          label={`${stats.resumo.categoriasDesfecho} desfechos`}
          sx={{ bgcolor: alpha(accent, 0.12), color: accent }}
        />
        {!stats.meta.coerente ? (
          <Chip size="small" color="warning" label="Totais parciais — verifique filtros de período" />
        ) : null}
      </Box>

      <MulherDashboardCharts stats={stats} />
    </Box>
  );
}
