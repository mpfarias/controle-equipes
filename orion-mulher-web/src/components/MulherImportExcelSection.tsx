import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { UploadFile } from '@mui/icons-material';
import { api } from '../api';
import type { MulherExcelImportResult } from '../types';

const accent = '#f472b6';

export function MulherImportExcelSection() {
  const [modo, setModo] = useState<'replace' | 'append'>('replace');
  const [useEnv, setUseEnv] = useState(false);
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [resultado, setResultado] = useState<MulherExcelImportResult | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aCorrer, setACorrer] = useState(false);

  async function enviar() {
    setErro(null);
    setResultado(null);
    setACorrer(true);
    try {
      if (useEnv) {
        setResultado(await api.importExcel({ mode: modo, useEnvPath: true }));
        return;
      }
      if (!ficheiro) {
        setErro('Escolha um arquivo .xlsx ou marque usar planilha do servidor.');
        return;
      }
      setResultado(await api.importExcel({ mode: modo, file: ficheiro }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na importação.');
    } finally {
      setACorrer(false);
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700, color: '#fdf2f8', mb: 1 }}>
        Importar Excel
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2, maxWidth: 720 }}>
        O painel e as listagens usam somente PostgreSQL. Esta ação lê a planilha do formulário de
        violência doméstica e grava na base. O modo <strong>substituir</strong> apaga apenas registros
        com origem &quot;importação Excel&quot; anteriores e importa de novo.
      </Typography>

      <Paper
        sx={{
          p: 3,
          maxWidth: 640,
          bgcolor: alpha('#0f172a', 0.65),
          border: `1px solid ${alpha(accent, 0.2)}`,
        }}
      >
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel id="modo-import-label">Modo</InputLabel>
          <Select
            labelId="modo-import-label"
            label="Modo"
            value={modo}
            onChange={(e) => setModo(e.target.value as 'replace' | 'append')}
          >
            <MenuItem value="replace">Substituir importações Excel anteriores (recomendado)</MenuItem>
            <MenuItem value="append">Acrescentar (pode duplicar dados)</MenuItem>
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Checkbox checked={useEnv} onChange={(e) => setUseEnv(e.target.checked)} />}
          label={
            <Typography variant="body2">
              Usar planilha do servidor (<code>MULHER_EXCEL_PATH</code> ou pasta padrão do projeto)
            </Typography>
          }
          sx={{ mb: 2, display: 'flex', alignItems: 'flex-start' }}
        />

        {!useEnv ? (
          <Box sx={{ mb: 2 }}>
            <Button variant="outlined" component="label" startIcon={<UploadFile />} sx={{ mb: 1 }}>
              Escolher arquivo .xlsx
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={(e) => setFicheiro(e.target.files?.[0] ?? null)}
              />
            </Button>
            {ficheiro ? (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {ficheiro.name} ({Math.round(ficheiro.size / 1024)} KB)
              </Typography>
            ) : null}
          </Box>
        ) : null}

        {erro ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        ) : null}
        {resultado ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Inseridos: {resultado.inserted} · Ignorados: {resultado.skipped}
            {resultado.removedPreviousExcelRows != null
              ? ` · Removidos (Excel anterior): ${resultado.removedPreviousExcelRows}`
              : ''}
            {resultado.errors.length > 0 ? (
              <Box component="pre" sx={{ mt: 1, fontSize: 11, overflow: 'auto', maxHeight: 160 }}>
                {resultado.errors.join('\n')}
              </Box>
            ) : null}
          </Alert>
        ) : null}

        <Button
          variant="contained"
          disabled={aCorrer}
          onClick={() => void enviar()}
          sx={{ bgcolor: accent, '&:hover': { bgcolor: '#ec4899' } }}
        >
          {aCorrer ? 'Importando…' : 'Executar importação'}
        </Button>
      </Paper>
    </Box>
  );
}
