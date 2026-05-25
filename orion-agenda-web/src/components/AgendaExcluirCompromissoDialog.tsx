import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DeleteOutline } from '@mui/icons-material';
import type { OrionAgendaCompromisso } from '../types';
import { formatarHorarioAgenda, rotuloDiaLocal } from '../utils/formatAgendaData';
import { nomesParticipantesCompromisso, TIPO_LABEL } from '../utils/agendaCompromissoUtil';
import { AgendaConfirmacaoDialog } from './AgendaConfirmacaoDialog';

const accent = '#2dd4bf';

type AgendaExcluirCompromissoDialogProps = {
  open: boolean;
  compromisso: OrionAgendaCompromisso | null;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  submitting?: boolean;
};

export function AgendaExcluirCompromissoDialog({
  open,
  compromisso,
  onClose,
  onConfirm,
  submitting = false,
}: AgendaExcluirCompromissoDialogProps) {
  const participantes = compromisso ? nomesParticipantesCompromisso(compromisso) : [];

  return (
    <AgendaConfirmacaoDialog
      open={open}
      onClose={onClose}
      onConfirm={onConfirm}
      titulo="Excluir compromisso?"
      mensagem="Esta ação não pode ser desfeita. O compromisso será removido permanentemente da agenda."
      confirmarLabel="Excluir"
      cancelarLabel="Cancelar"
      variant="danger"
      submitting={submitting}
      icone={<DeleteOutline sx={{ fontSize: 26 }} />}
      detalhes={
        compromisso ? (
          <Box
            sx={{
              p: 1.75,
              borderRadius: 2,
              bgcolor: alpha('#020617', 0.45),
              border: `1px solid ${alpha(accent, 0.14)}`,
            }}
          >
            <Stack spacing={1}>
              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                <Chip
                  label={TIPO_LABEL[compromisso.tipo]}
                  size="small"
                  sx={{
                    height: 24,
                    fontWeight: 700,
                    bgcolor: alpha(accent, 0.14),
                    color: accent,
                    border: `1px solid ${alpha(accent, 0.28)}`,
                  }}
                />
              </Stack>
              <Typography
                variant="body2"
                sx={{ color: alpha('#f0fdfa', 0.88), textTransform: 'capitalize' }}
              >
                {rotuloDiaLocal(compromisso.dataInicio)} ·{' '}
                {formatarHorarioAgenda(compromisso.dataInicio, compromisso.diaInteiro)}
              </Typography>
              {participantes.length > 0 ? (
                <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.62) }}>
                  {participantes.join(', ')}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        ) : null
      }
    />
  );
}
