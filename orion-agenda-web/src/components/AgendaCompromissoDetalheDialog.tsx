import type { ReactNode } from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  AccessTime,
  CalendarMonthOutlined,
  Close,
  DeleteOutline,
  EditOutlined,
  EventNoteOutlined,
  GavelOutlined,
  GroupsOutlined,
  LocationOnOutlined,
  NotesOutlined,
  RecordVoiceOverOutlined,
} from '@mui/icons-material';
import type { OrionAgendaCompromisso, OrionAgendaStatus, OrionAgendaTipo } from '../types';
import {
  formatarHorarioAgenda,
  rotuloDiaLocal,
} from '../utils/formatAgendaData';
import {
  nomesParticipantesCompromisso,
  TIPO_LABEL,
} from '../utils/agendaCompromissoUtil';

const accent = '#2dd4bf';

const STATUS_LABEL: Record<OrionAgendaStatus, string> = {
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const STATUS_COLOR: Record<
  OrionAgendaStatus,
  'info' | 'success' | 'default'
> = {
  AGENDADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'default',
};

const TIPO_ICON: Record<OrionAgendaTipo, typeof GroupsOutlined> = {
  REUNIAO: GroupsOutlined,
  PALESTRA: RecordVoiceOverOutlined,
  PRAZO: EventNoteOutlined,
  AUDIENCIA: GavelOutlined,
  OUTRO: CalendarMonthOutlined,
};

type AgendaCompromissoDetalheDialogProps = {
  open: boolean;
  compromisso: OrionAgendaCompromisso | null;
  onClose: () => void;
  onEditar?: (c: OrionAgendaCompromisso) => void;
  onExcluir?: (c: OrionAgendaCompromisso) => void;
};

function iniciaisNome(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0] ?? ''}${partes[partes.length - 1]![0] ?? ''}`.toUpperCase();
}

function BlocoDetalhe({
  icone,
  rotulo,
  children,
}: {
  icone: React.ReactNode;
  rotulo: string;
  children: ReactNode;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.75,
        borderRadius: 2,
        bgcolor: alpha('#020617', 0.45),
        border: `1px solid ${alpha(accent, 0.14)}`,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box
          sx={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: alpha(accent, 0.12),
            color: accent,
          }}
        >
          {icone}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="overline"
            sx={{
              display: 'block',
              lineHeight: 1.4,
              letterSpacing: '0.08em',
              fontWeight: 700,
              color: alpha('#f0fdfa', 0.48),
            }}
          >
            {rotulo}
          </Typography>
          <Box sx={{ mt: 0.75 }}>{children}</Box>
        </Box>
      </Stack>
    </Paper>
  );
}

export function AgendaCompromissoDetalheDialog({
  open,
  compromisso,
  onClose,
  onEditar,
  onExcluir,
}: AgendaCompromissoDetalheDialogProps) {
  if (!compromisso) return null;

  const participantes = nomesParticipantesCompromisso(compromisso);
  const horario = formatarHorarioAgenda(compromisso.dataInicio, compromisso.diaInteiro);
  const dataRotulo = rotuloDiaLocal(compromisso.dataInicio);
  const TipoIcon = TIPO_ICON[compromisso.tipo];
  const tituloAuto = `${TIPO_LABEL[compromisso.tipo]} — ${compromisso.responsavelNome ?? ''}`;
  const mostrarTitulo = compromisso.titulo && compromisso.titulo !== tituloAuto;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      slotProps={{
        paper: {
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            bgcolor: alpha('#0f172a', 0.98),
            border: `1px solid ${alpha(accent, 0.28)}`,
            boxShadow: `0 0 0 1px ${alpha(accent, 0.06)}, 0 28px 56px ${alpha('#000', 0.55)}`,
            backgroundImage: `linear-gradient(160deg, ${alpha('#0f766e', 0.22)} 0%, transparent 42%)`,
          },
        },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: 3,
          pt: 3,
          pb: 2.5,
          borderBottom: `1px solid ${alpha(accent, 0.14)}`,
          bgcolor: alpha('#0f766e', 0.1),
        }}
      >
        <IconButton
          aria-label="Fechar"
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: alpha('#f0fdfa', 0.65),
            bgcolor: alpha('#020617', 0.35),
            border: `1px solid ${alpha(accent, 0.15)}`,
            '&:hover': { bgcolor: alpha('#020617', 0.55), color: '#f0fdfa' },
          }}
        >
          <Close fontSize="small" />
        </IconButton>

        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ pr: 4 }}>
          <Box
            sx={{
              flexShrink: 0,
              width: 52,
              height: 52,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(accent, 0.18),
              border: `1px solid ${alpha(accent, 0.4)}`,
              boxShadow: `0 8px 24px ${alpha(accent, 0.18)}`,
            }}
          >
            <TipoIcon sx={{ fontSize: 28, color: accent }} />
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1 }}>
              <Chip
                label={TIPO_LABEL[compromisso.tipo]}
                size="small"
                sx={{
                  height: 24,
                  fontWeight: 700,
                  bgcolor: alpha(accent, 0.16),
                  color: accent,
                  border: `1px solid ${alpha(accent, 0.35)}`,
                }}
              />
              <Chip
                label={STATUS_LABEL[compromisso.status]}
                size="small"
                color={STATUS_COLOR[compromisso.status]}
                sx={{ height: 24, fontWeight: 600 }}
              />
            </Stack>

            <Typography variant="h6" sx={{ fontWeight: 800, color: '#f0fdfa', lineHeight: 1.25 }}>
              {mostrarTitulo ? compromisso.titulo : TIPO_LABEL[compromisso.tipo]}
            </Typography>

            <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mt: 1.25 }}>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <CalendarMonthOutlined sx={{ fontSize: 17, color: alpha(accent, 0.85) }} />
                <Typography
                  variant="body2"
                  sx={{ color: alpha('#f0fdfa', 0.82), textTransform: 'capitalize' }}
                >
                  {dataRotulo}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={0.75} alignItems="center">
                <AccessTime sx={{ fontSize: 17, color: alpha(accent, 0.85) }} />
                <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.82), fontWeight: 600 }}>
                  {horario}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </Box>

      <DialogContent sx={{ px: 3, py: 2.5 }}>
        <Stack spacing={1.5}>
          {participantes.length > 0 ? (
            <BlocoDetalhe icone={<GroupsOutlined fontSize="small" />} rotulo="Quem vai">
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {participantes.map((nome) => (
                  <Chip
                    key={nome}
                    avatar={
                      <Avatar
                        sx={{
                          bgcolor: alpha(accent, 0.22),
                          color: accent,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        {iniciaisNome(nome)}
                      </Avatar>
                    }
                    label={nome}
                    sx={{
                      height: 32,
                      bgcolor: alpha('#020617', 0.55),
                      color: '#f0fdfa',
                      border: `1px solid ${alpha(accent, 0.18)}`,
                      '& .MuiChip-label': { fontWeight: 500 },
                    }}
                  />
                ))}
              </Stack>
            </BlocoDetalhe>
          ) : null}

          {compromisso.descricao ? (
            <BlocoDetalhe icone={<NotesOutlined fontSize="small" />} rotulo="Detalhes">
              <Typography
                variant="body2"
                sx={{
                  color: alpha('#f0fdfa', 0.88),
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {compromisso.descricao}
              </Typography>
            </BlocoDetalhe>
          ) : null}

          {compromisso.local ? (
            <BlocoDetalhe icone={<LocationOnOutlined fontSize="small" />} rotulo="Local">
              <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.88), fontWeight: 500 }}>
                {compromisso.local}
              </Typography>
            </BlocoDetalhe>
          ) : null}

          {!compromisso.descricao && !compromisso.local && participantes.length === 0 ? (
            <Paper
              elevation={0}
              sx={{
                py: 3,
                px: 2,
                textAlign: 'center',
                borderRadius: 2,
                bgcolor: alpha('#020617', 0.35),
                border: `1px dashed ${alpha(accent, 0.2)}`,
              }}
            >
              <Typography variant="body2" sx={{ color: alpha('#f0fdfa', 0.45) }}>
                Nenhuma informação adicional registrada para este compromisso.
              </Typography>
            </Paper>
          ) : null}
        </Stack>
      </DialogContent>

      <Divider sx={{ borderColor: alpha(accent, 0.12) }} />

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button
          onClick={onClose}
          sx={{
            color: alpha('#f0fdfa', 0.72),
            '&:hover': { bgcolor: alpha('#f0fdfa', 0.06) },
          }}
        >
          Fechar
        </Button>
        <Box sx={{ flex: 1 }} />
        {onExcluir ? (
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutline />}
            onClick={() => onExcluir(compromisso)}
            sx={{
              borderColor: alpha('#f87171', 0.45),
              '&:hover': { borderColor: '#f87171', bgcolor: alpha('#f87171', 0.08) },
            }}
          >
            Excluir
          </Button>
        ) : null}
        {onEditar ? (
          <Button
            variant="contained"
            startIcon={<EditOutlined />}
            onClick={() => onEditar(compromisso)}
            sx={{
              fontWeight: 700,
              bgcolor: accent,
              color: '#042f2e',
              boxShadow: `0 4px 16px ${alpha(accent, 0.35)}`,
              '&:hover': { bgcolor: '#5eead4' },
            }}
          >
            Editar
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
