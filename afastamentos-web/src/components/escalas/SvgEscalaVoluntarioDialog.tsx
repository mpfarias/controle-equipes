import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { Policial } from '../../types';
import { SVG_DURACAO_HORAS } from '../../constants/svgRegras';
import {
  calcularFimSvgVoluntario,
  horasInicioSvgOpcoes,
  SVG_TIPO_VOLUNTARIO_OPCOES,
  type SvgEscalaConfig,
} from '../../utils/svgEscalaVoluntario';
import { sortPorPatenteENome } from '../../utils/sortPoliciais';
import { formatoRelogioUm } from '../../utils/expedienteEscalaRegras';
import {
  filtrarPoliciaisAutocomplete,
  labelPolicialAutocomplete,
} from '../../utils/policialBuscaAutocomplete';

type LinhaForm = {
  key: string;
  policialId: number | '';
  horaInicio: string;
};

function novaLinhaVazia(): LinhaForm {
  return { key: `svg-${Date.now()}-${Math.random()}`, policialId: '', horaInicio: '' };
}

function rotuloFimPreview(horaInicio: string): string {
  if (!horaInicio) return '—';
  const { horaFim, cruzaMeiaNoite } = calcularFimSvgVoluntario(horaInicio);
  const ini = formatoRelogioUm(horaInicio);
  const fim = formatoRelogioUm(horaFim);
  return cruzaMeiaNoite ? `${ini} → ${fim} (dia seguinte)` : `${ini} → ${fim}`;
}

export type SvgEscalaVoluntarioDialogProps = {
  open: boolean;
  loadingPoliciais?: boolean;
  policiais: Policial[];
  onClose: () => void;
  onConfirm: (config: SvgEscalaConfig) => void;
};

export function SvgEscalaVoluntarioDialog({
  open,
  loadingPoliciais = false,
  policiais,
  onClose,
  onConfirm,
}: SvgEscalaVoluntarioDialogProps) {
  const [tipoSvg, setTipoSvg] = useState('');
  const [linhas, setLinhas] = useState<LinhaForm[]>([novaLinhaVazia()]);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const policiaisOrdenados = useMemo(() => sortPorPatenteENome(policiais), [policiais]);
  const policialPorId = useMemo(
    () => new Map(policiaisOrdenados.map((p) => [p.id, p])),
    [policiaisOrdenados],
  );
  const horasOpcoes = useMemo(() => horasInicioSvgOpcoes(), []);

  useEffect(() => {
    if (!open) return;
    setTipoSvg('');
    setLinhas([novaLinhaVazia()]);
    setErroLocal(null);
  }, [open]);

  const atualizarLinha = (key: string, patch: Partial<LinhaForm>) => {
    setLinhas((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const idsUsados = (excetoKey?: string) =>
    new Set(
      linhas
        .filter((l) => l.key !== excetoKey && l.policialId !== '')
        .map((l) => l.policialId as number),
    );

  const handleConfirmar = () => {
    const completas = linhas.filter((l) => l.policialId !== '' && l.horaInicio);
    if (completas.length === 0) {
      setErroLocal('Informe ao menos um policial com horário de início.');
      return;
    }
    const ids = new Set<number>();
    for (const l of completas) {
      const id = l.policialId as number;
      if (ids.has(id)) {
        setErroLocal('Não repita o mesmo policial na lista.');
        return;
      }
      ids.add(id);
    }
    setErroLocal(null);
    onConfirm({
      tipoSvg: tipoSvg.trim(),
      linhas: completas.map((l) => {
        const { horaFim, cruzaMeiaNoite } = calcularFimSvgVoluntario(l.horaInicio);
        return {
          policialId: l.policialId as number,
          horaInicio: l.horaInicio,
          horaFim,
          cruzaMeiaNoite,
        };
      }),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>SVG — serviço voluntário</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Antes de gerar a escala, informe o tipo de SVG, os policiais e o horário de início (horas
            cheias). O término é calculado automaticamente ({SVG_DURACAO_HORAS} horas de serviço).
          </Typography>

          {erroLocal && (
            <Alert severity="warning" onClose={() => setErroLocal(null)}>
              {erroLocal}
            </Alert>
          )}

          <FormControl fullWidth size="small">
            <InputLabel id="svg-tipo-label">Tipo de SVG</InputLabel>
            <Select
              labelId="svg-tipo-label"
              label="Tipo de SVG"
              value={tipoSvg}
              onChange={(e) => setTipoSvg(e.target.value)}
            >
              {SVG_TIPO_VOLUNTARIO_OPCOES.map((o) => (
                <MenuItem key={o.value || '_vazio'} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {loadingPoliciais ? (
            <Typography variant="body2" color="text.secondary">
              Carregando policiais…
            </Typography>
          ) : (
            <>
              {linhas.map((linha, index) => {
                const usados = idsUsados(linha.key);
                const policialSelecionado =
                  linha.policialId === ''
                    ? null
                    : (policialPorId.get(linha.policialId as number) ?? null);
                const opcoesPolicial = policiaisOrdenados.filter(
                  (p) => !usados.has(p.id) || linha.policialId === p.id,
                );
                return (
                  <Box
                    key={linha.key}
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', sm: '1fr 140px 140px auto' },
                      gap: 1.5,
                      alignItems: 'center',
                      p: 1.5,
                      borderRadius: 1,
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Autocomplete
                      size="small"
                      fullWidth
                      options={opcoesPolicial}
                      value={policialSelecionado}
                      onChange={(_, novo) => {
                        atualizarLinha(linha.key, {
                          policialId: novo ? novo.id : '',
                        });
                      }}
                      getOptionLabel={labelPolicialAutocomplete}
                      isOptionEqualToValue={(a, b) => a.id === b.id}
                      filterOptions={(options, state) =>
                        filtrarPoliciaisAutocomplete(options, state.inputValue)
                      }
                      noOptionsText="Nenhum policial encontrado para esta busca"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Policial"
                          placeholder="Busque por nome, matrícula ou equipe…"
                        />
                      )}
                    />

                    <FormControl fullWidth size="small">
                      <InputLabel id={`svg-ini-${linha.key}`}>Início</InputLabel>
                      <Select
                        labelId={`svg-ini-${linha.key}`}
                        label="Início"
                        value={linha.horaInicio}
                        onChange={(e) => atualizarLinha(linha.key, { horaInicio: e.target.value })}
                      >
                        <MenuItem value="">
                          <em>—</em>
                        </MenuItem>
                        {horasOpcoes.map((h) => (
                          <MenuItem key={h} value={h}>
                            {h}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      size="small"
                      label="Término (auto)"
                      value={rotuloFimPreview(linha.horaInicio)}
                      slotProps={{ input: { readOnly: true } }}
                    />

                    <IconButton
                      aria-label={`Remover linha ${index + 1}`}
                      onClick={() => setLinhas((prev) => prev.filter((l) => l.key !== linha.key))}
                      disabled={linhas.length <= 1}
                      size="small"
                    >
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Box>
                );
              })}

              <Button
                startIcon={<AddIcon />}
                variant="outlined"
                size="small"
                onClick={() => setLinhas((prev) => [...prev, novaLinhaVazia()])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Adicionar policial
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleConfirmar} disabled={loadingPoliciais}>
          Confirmar e gerar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
