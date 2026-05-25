import type { ReactNode } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Close, WarningAmberOutlined } from '@mui/icons-material';

const accent = '#2dd4bf';
const danger = '#f87171';

export type AgendaConfirmacaoVariant = 'default' | 'danger';

type AgendaConfirmacaoDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  titulo: string;
  mensagem: string;
  confirmarLabel?: string;
  cancelarLabel?: string;
  variant?: AgendaConfirmacaoVariant;
  submitting?: boolean;
  icone?: ReactNode;
  detalhes?: ReactNode;
};

function corVariante(variant: AgendaConfirmacaoVariant): string {
  return variant === 'danger' ? danger : accent;
}

export function AgendaConfirmacaoDialog({
  open,
  onClose,
  onConfirm,
  titulo,
  mensagem,
  confirmarLabel = 'Confirmar',
  cancelarLabel = 'Cancelar',
  variant = 'default',
  submitting = false,
  icone,
  detalhes,
}: AgendaConfirmacaoDialogProps) {
  const cor = corVariante(variant);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: alpha('#0f172a', 0.98),
            border: `1px solid ${alpha(cor, 0.32)}`,
            boxShadow: `0 0 0 1px ${alpha(cor, 0.06)}, 0 28px 56px ${alpha('#000', 0.55)}`,
            backgroundImage:
              variant === 'danger'
                ? `linear-gradient(160deg, ${alpha('#7f1d1d', 0.28)} 0%, transparent 48%)`
                : `linear-gradient(160deg, ${alpha('#0f766e', 0.22)} 0%, transparent 48%)`,
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2,
          borderBottom: `1px solid ${alpha(cor, 0.14)}`,
          bgcolor: alpha(variant === 'danger' ? '#450a0a' : '#0f766e', 0.12),
        }}
      >
        <IconButton
          aria-label="Fechar"
          onClick={onClose}
          disabled={submitting}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: alpha('#f0fdfa', 0.65),
            bgcolor: alpha('#020617', 0.35),
            border: `1px solid ${alpha(cor, 0.15)}`,
            '&:hover': { bgcolor: alpha('#020617', 0.55), color: '#f0fdfa' },
          }}
        >
          <Close fontSize="small" />
        </IconButton>

        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ pr: 4 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(cor, 0.16),
              border: `1px solid ${alpha(cor, 0.38)}`,
              boxShadow: `0 8px 24px ${alpha(cor, 0.16)}`,
              color: cor,
            }}
          >
            {icone ?? (
              <WarningAmberOutlined sx={{ fontSize: 26 }} />
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#f0fdfa', lineHeight: 1.3 }}>
              {titulo}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.78), lineHeight: 1.65 }}>
          {mensagem}
        </Typography>
        {detalhes ? <Box sx={{ mt: 2 }}>{detalhes}</Box> : null}
      </DialogContent>

      <Divider sx={{ borderColor: alpha(cor, 0.12) }} />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          disabled={submitting}
          sx={{
            color: alpha('#f0fdfa', 0.72),
            '&:hover': { bgcolor: alpha('#f0fdfa', 0.06) },
          }}
        >
          {cancelarLabel}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          onClick={() => void onConfirm()}
          disabled={submitting}
          sx={
            variant === 'danger'
              ? {
                  fontWeight: 700,
                  bgcolor: danger,
                  color: '#450a0a',
                  boxShadow: `0 4px 16px ${alpha(danger, 0.35)}`,
                  '&:hover': { bgcolor: '#ef4444' },
                }
              : {
                  fontWeight: 700,
                  bgcolor: accent,
                  color: '#042f2e',
                  boxShadow: `0 4px 16px ${alpha(accent, 0.35)}`,
                  '&:hover': { bgcolor: '#5eead4' },
                }
          }
        >
          {submitting ? 'Aguarde…' : confirmarLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
