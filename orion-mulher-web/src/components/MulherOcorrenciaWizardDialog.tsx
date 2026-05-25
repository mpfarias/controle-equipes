import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { api } from '../api';

const accent = '#f472b6';

type Props = {
  open: boolean;
  ocorrenciaId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const CAMPOS_FASE1 = [
  ['nomeVitima', 'Nome da vítima'],
  ['telefoneVitima', 'Telefone da vítima'],
  ['cpfVitima', 'CPF da vítima'],
  ['enderecoVitima', 'Endereço da vítima'],
  ['regiaoAdministrativa', 'Região administrativa'],
  ['historicoOcorrencia', 'Histórico da ocorrência'],
  ['nomeAgressor', 'Nome do agressor'],
  ['enderecoAgressor', 'Endereço do agressor'],
  ['parentescoAgressorVitima', 'Parentesco'],
  ['tipoAmeacaAgressao', 'Tipo de ameaça/agressão'],
] as const;

const CAMPOS_FASE2 = [
  ['comandanteViatura', 'Comandante da viatura'],
  ['responsavelAtendimento', 'Responsável pelo atendimento'],
  ['encaminhamentoDetalhes', 'Detalhes do encaminhamento'],
] as const;

const CAMPOS_FASE3 = [
  ['desfecho', 'Desfecho'],
  ['registrouBoDp', 'Registrou BO/DP'],
  ['numeroOcorrenciaCad', 'Nº ocorrência CAD'],
] as const;

export function MulherOcorrenciaWizardDialog({ open, ocorrenciaId, onClose, onSaved }: Props) {
  const [fase, setFase] = useState(0);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFase(0);
    setError(null);
    if (!ocorrenciaId) {
      setForm({});
      return;
    }
    setLoading(true);
    void api
      .getOcorrencia(ocorrenciaId)
      .then((row) => {
        const next: Record<string, string> = {};
        for (const [k] of [...CAMPOS_FASE1, ...CAMPOS_FASE2, ...CAMPOS_FASE3]) {
          const v = row[k];
          if (v != null && v !== '') next[k] = String(v);
        }
        setForm(next);
        setFase(Math.max(0, Math.min(2, (row.faseAtual as number) - 1)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar.'))
      .finally(() => setLoading(false));
  }, [open, ocorrenciaId]);

  const salvar = useCallback(async () => {
    setSaving(true);
    setError(null);
    const faseAtual = fase + 1;
    const concluida = fase === 2;
    const body = { ...form, faseAtual, concluida };
    try {
      if (ocorrenciaId) {
        await api.updateOcorrencia(ocorrenciaId, body);
      } else {
        await api.createOcorrencia(body);
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  }, [fase, form, ocorrenciaId, onSaved]);

  const camposAtivos = fase === 0 ? CAMPOS_FASE1 : fase === 1 ? CAMPOS_FASE2 : CAMPOS_FASE3;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ bgcolor: alpha('#831843', 0.95), color: '#fdf2f8' }}>
        {ocorrenciaId ? 'Editar ocorrência' : 'Nova ocorrência'} — COPOM Mulher
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Tabs value={fase} onChange={(_, v) => setFase(v)} sx={{ mb: 2 }}>
          <Tab label="Fase 1 — Atendimento" />
          <Tab label="Fase 2 — Encaminhamento" />
          <Tab label="Fase 3 — Desfecho" />
        </Tabs>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress sx={{ color: accent }} />
          </Box>
        ) : (
          <Grid container spacing={2}>
            {camposAtivos.map(([key, label]) => (
              <Grid key={key} size={{ xs: 12, sm: key.includes('historico') || key.includes('encaminhamento') ? 12 : 6 }}>
                <TextField
                  label={label}
                  fullWidth
                  size="small"
                  multiline={key.includes('historico') || key.includes('encaminhamento')}
                  minRows={key.includes('historico') || key.includes('encaminhamento') ? 3 : 1}
                  value={form[key] ?? ''}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        {fase > 0 ? (
          <Button onClick={() => setFase((f) => f - 1)} disabled={saving}>
            Anterior
          </Button>
        ) : null}
        {fase < 2 ? (
          <Button variant="outlined" onClick={() => setFase((f) => f + 1)} disabled={saving}>
            Próxima fase
          </Button>
        ) : null}
        <Button
          variant="contained"
          onClick={() => void salvar()}
          disabled={saving || loading}
          sx={{ bgcolor: accent, '&:hover': { bgcolor: '#ec4899' } }}
        >
          {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
