import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import { Search } from '@mui/icons-material';
import type { ChamadasCarregamento, ChamadasFiltroConsulta } from '../context/ChamadasImportContext';
import type { CoberturaIntegraChamadas } from '../types';
import {
  camposFiltroPadraoDiaAtual,
  camposFromFiltroIso,
  filtroIsoFromCampos,
  validarPeriodoFiltroCampos,
  type CamposFiltroChamadas,
} from '../utils/chamadasFiltroBrasilia';

type Props = {
  carregamento: ChamadasCarregamento;
  erro: string | null;
  coberturaIntegra?: CoberturaIntegraChamadas | null;
  filtroAtivo?: ChamadasFiltroConsulta | null;
  onBuscar: (filtro: ChamadasFiltroConsulta) => void;
};

export function ChamadasFiltroBar({ carregamento, erro, coberturaIntegra, filtroAtivo, onBuscar }: Props) {
  const [campos, setCampos] = useState<CamposFiltroChamadas>(() => camposFiltroPadraoDiaAtual());
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!filtroAtivo) return;
    try {
      setCampos(camposFromFiltroIso(filtroAtivo));
    } catch {
      /* mantém campos atuais */
    }
  }, [filtroAtivo]);

  const desabilitado = carregamento === 'loading';

  const alterar = (campo: keyof CamposFiltroChamadas, valor: string) => {
    setCampos((prev) => ({ ...prev, [campo]: valor }));
    setErroLocal(null);
  };

  const aplicar = () => {
    const erroPeriodo = validarPeriodoFiltroCampos(campos);
    if (erroPeriodo) {
      setErroLocal(erroPeriodo);
      return;
    }
    try {
      const filtro = filtroIsoFromCampos(campos);
      setErroLocal(null);
      onBuscar(filtro);
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : 'Filtro inválido.');
    }
  };

  const msgErro = erroLocal ?? (carregamento === 'error' ? erro : null);

  const fieldSx = useMemo(() => ({ minWidth: { xs: '100%', sm: 140 } }), []);

  return (
    <Paper sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'flex-end' }}>
          <TextField
            label="Data início"
            type="date"
            size="small"
            value={campos.dataInicio}
            onChange={(e) => alterar('dataInicio', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={desabilitado}
            sx={fieldSx}
          />
          <TextField
            label="Hora início"
            type="time"
            size="small"
            value={campos.horaInicio}
            onChange={(e) => alterar('horaInicio', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={desabilitado}
            sx={fieldSx}
          />
          <TextField
            label="Data fim"
            type="date"
            size="small"
            value={campos.dataFim}
            onChange={(e) => alterar('dataFim', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={desabilitado}
            sx={fieldSx}
          />
          <TextField
            label="Hora fim"
            type="time"
            size="small"
            value={campos.horaFim}
            onChange={(e) => alterar('horaFim', e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={desabilitado}
            sx={fieldSx}
          />
          <Button
            variant="contained"
            startIcon={<Search />}
            onClick={aplicar}
            disabled={desabilitado}
            sx={{ minWidth: { xs: '100%', md: 120 }, flexShrink: 0 }}
          >
            Buscar
          </Button>
        </Stack>
        {carregamento === 'loading' ? (
          <Typography variant="caption" color="text.secondary">
            Buscando…
          </Typography>
        ) : null}
        {carregamento === 'loading' ? <LinearProgress /> : null}
        {msgErro ? (
          <Alert severity="error" variant="outlined">
            {msgErro}
          </Alert>
        ) : null}
        {coberturaIntegra?.dadosIncompletos && coberturaIntegra.mensagem ? (
          <Alert severity="warning" variant="outlined">
            {coberturaIntegra.mensagem}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
