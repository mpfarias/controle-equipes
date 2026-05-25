import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { AgendaPolicialEfetivo, OrionAgendaCompromisso, OrionAgendaTipo } from '../types';
import {
  ehCompromissoDuplicado,
  mensagemCompromissoDuplicado,
  policiaisIdsDoCompromisso,
  TIPO_LABEL,
  TIPOS_AGENDA,
} from '../utils/agendaCompromissoUtil';
import {
  dataIsoParaInputDate,
  datetimeLocalParaIso,
  horarioIsoParaInput,
  montarDatetimeLocal,
  rotuloDataInputDate,
} from '../utils/formatAgendaData';
import { fieldSx, PolicialAutocomplete } from './AgendaNovoCompromissoDialog';

const accent = '#2dd4bf';

export type AgendaEditarCompromissoPayload = {
  tipo: OrionAgendaTipo;
  policialIds: number[];
  descricao?: string;
  dataInicio: string;
};

type AgendaEditarCompromissoDialogProps = {
  open: boolean;
  onClose: () => void;
  onSalvar: (payload: AgendaEditarCompromissoPayload) => Promise<void>;
  compromisso: OrionAgendaCompromisso | null;
  policiais: AgendaPolicialEfetivo[];
  compromissosExistentes?: OrionAgendaCompromisso[];
  submitting: boolean;
};

export function AgendaEditarCompromissoDialog({
  open,
  onClose,
  onSalvar,
  compromisso,
  policiais,
  compromissosExistentes = [],
  submitting,
}: AgendaEditarCompromissoDialogProps) {
  const [tipo, setTipo] = useState<OrionAgendaTipo>('REUNIAO');
  const [detalhes, setDetalhes] = useState('');
  const [policialSlots, setPolicialSlots] = useState<Array<AgendaPolicialEfetivo | null>>([null]);
  const [horario, setHorario] = useState('09:00');
  const [dataDia, setDataDia] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const rotuloData = useMemo(() => rotuloDataInputDate(dataDia), [dataDia]);

  useEffect(() => {
    if (!open || !compromisso) return;

    setTipo(compromisso.tipo);
    setDetalhes(compromisso.descricao ?? '');
    setHorario(horarioIsoParaInput(compromisso.dataInicio));
    setDataDia(dataIsoParaInputDate(compromisso.dataInicio));
    setErroLocal(null);

    const ids = policiaisIdsDoCompromisso(compromisso);
    const slots: Array<AgendaPolicialEfetivo | null> = ids.map((id) => {
      const p = policiais.find((x) => x.id === id);
      return p ?? null;
    });
    setPolicialSlots(slots.length > 0 ? slots : [null]);
  }, [open, compromisso, policiais]);

  const opcoesPolicial = useMemo(
    () => [...policiais].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [policiais],
  );

  function opcoesParaSlot(index: number) {
    const excluir = policialSlots
      .map((p, i) => (i !== index && p ? p.id : null))
      .filter((id): id is number => id != null);
    return opcoesPolicial.filter((p) => !excluir.includes(p.id));
  }

  const podeAdicionarOutroPolicial =
    policialSlots.length < opcoesPolicial.length &&
    policialSlots[policialSlots.length - 1] != null;

  function atualizarSlot(index: number, value: AgendaPolicialEfetivo | null) {
    setPolicialSlots((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  function adicionarSlotPolicial() {
    setPolicialSlots((prev) => [...prev, null]);
  }

  async function handleSalvar() {
    if (!compromisso) return;

    const selecionados = policialSlots.filter((p): p is AgendaPolicialEfetivo => p != null);
    if (selecionados.length === 0) {
      setErroLocal('Selecione ao menos um policial.');
      return;
    }
    if (policialSlots.some((p) => p == null)) {
      setErroLocal('Preencha todos os campos de policial ou remova os vazios.');
      return;
    }
    if (!horario) {
      setErroLocal('Informe o horário de início.');
      return;
    }

    const [anoStr, mesStr, diaStr] = dataDia.split('-');
    const ano = Number(anoStr);
    const mes = Number(mesStr);
    const dia = Number(diaStr);
    if (!ano || !mes || !dia) {
      setErroLocal('Data inválida.');
      return;
    }

    const datetimeLocal = montarDatetimeLocal(ano, mes, dia, horario);
    const dataInicio = datetimeLocalParaIso(datetimeLocal, false);
    const policialIds = selecionados.map((p) => p.id);
    const duplicado = compromissosExistentes.some((c) =>
      ehCompromissoDuplicado(c, { tipo, dataInicio, policialIds }, compromisso.id),
    );
    if (duplicado) {
      setErroLocal(mensagemCompromissoDuplicado());
      return;
    }

    setErroLocal(null);
    await onSalvar({
      tipo,
      policialIds,
      descricao: detalhes.trim() || undefined,
      dataInicio,
    });
  }

  if (!compromisso) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontWeight: 700 }}>
        Editar compromisso
        {rotuloData ? (
          <Typography
            component="span"
            variant="body2"
            sx={{
              display: 'block',
              mt: 0.5,
              fontWeight: 500,
              color: alpha('#f0fdfa', 0.62),
              textTransform: 'capitalize',
            }}
          >
            {rotuloData}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth sx={fieldSx}>
            <InputLabel>Tipo do compromisso</InputLabel>
            <Select
              label="Tipo do compromisso"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as OrionAgendaTipo)}
            >
              {TIPOS_AGENDA.map((t) => (
                <MenuItem key={t} value={t}>
                  {TIPO_LABEL[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Detalhes"
            value={detalhes}
            onChange={(e) => setDetalhes(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Informações complementares sobre o compromisso"
            sx={fieldSx}
          />

          {policialSlots.map((slot, index) => (
            <PolicialAutocomplete
              key={`edit-policial-slot-${index}`}
              label={index === 0 ? 'Quem vai ao compromisso' : 'Outro policial'}
              value={slot}
              options={opcoesParaSlot(index)}
              onChange={(value) => atualizarSlot(index, value)}
            />
          ))}

          {podeAdicionarOutroPolicial ? (
            <Link
              component="button"
              type="button"
              variant="body2"
              onClick={adicionarSlotPolicial}
              sx={{
                alignSelf: 'flex-start',
                color: accent,
                fontWeight: 600,
                textDecoration: 'none',
                cursor: 'pointer',
                '&:hover': { textDecoration: 'underline', color: '#5eead4' },
              }}
            >
              Adicionar outro policial
            </Link>
          ) : null}

          <TextField
            label="Horário de início"
            type="time"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={fieldSx}
          />

          {erroLocal ? (
            <span style={{ color: '#f87171', fontSize: '0.875rem' }}>{erroLocal}</span>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleSalvar()}
          disabled={submitting}
          sx={{ bgcolor: accent, color: '#042f2e', '&:hover': { bgcolor: '#5eead4' } }}
        >
          {submitting ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
