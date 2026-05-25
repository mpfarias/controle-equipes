import { Box, Button, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import type { OrionAgendaCompromisso, OrionAgendaStatus } from '../types';
import {
  DIAS_SEMANA_CURTO,
  ehHojeLocal,
  formatarHorarioAgenda,
  gradeCalendarioMes,
  rotuloMesReferencia,
  montarMesReferencia,
} from '../utils/formatAgendaData';
import { nomesParticipantesCompromisso, TIPO_LABEL } from '../utils/agendaCompromissoUtil';

const accent = '#2dd4bf';
const amareloAgenda = '#fbbf24';

const STATUS_LABEL: Record<OrionAgendaStatus, string> = {
  AGENDADO: 'Agendado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

function diaTemCompromissoAgendado(compromissos: OrionAgendaCompromisso[]): boolean {
  return compromissos.some((c) => c.status === 'AGENDADO');
}

function ConteudoHoverCompromissos({ compromissos }: { compromissos: OrionAgendaCompromisso[] }) {
  return (
    <Stack spacing={1.25} sx={{ py: 0.25 }}>
      {compromissos.map((c, index) => {
        const participantes = nomesParticipantesCompromisso(c);
        return (
          <Box
            key={c.id}
            sx={{
              pt: index > 0 ? 1 : 0,
              borderTop: index > 0 ? `1px solid ${alpha(accent, 0.18)}` : 'none',
            }}
          >
            <Typography
              variant="caption"
              sx={{ display: 'block', fontWeight: 800, color: accent, lineHeight: 1.35 }}
            >
              {TIPO_LABEL[c.tipo]} · {formatarHorarioAgenda(c.dataInicio, c.diaInteiro)}
            </Typography>
            <Typography
              variant="caption"
              sx={{ display: 'block', color: alpha('#f0fdfa', 0.55), fontSize: '0.68rem', mt: 0.2 }}
            >
              {STATUS_LABEL[c.status]}
            </Typography>
            {participantes.length > 0 ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: alpha('#f0fdfa', 0.82),
                  mt: 0.35,
                  lineHeight: 1.4,
                }}
              >
                {participantes.join(', ')}
              </Typography>
            ) : null}
            {c.descricao ? (
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  color: alpha('#f0fdfa', 0.62),
                  mt: 0.35,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {c.descricao}
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}

type AgendaCalendarioMesProps = {
  ano: number;
  mes: number;
  compromissosPorDia: Map<number, OrionAgendaCompromisso[]>;
  onAdicionarDia?: (dia: number) => void;
  onVerCompromisso?: (compromisso: OrionAgendaCompromisso) => void;
};

export function AgendaCalendarioMes({
  ano,
  mes,
  compromissosPorDia,
  onAdicionarDia,
  onVerCompromisso,
}: AgendaCalendarioMesProps) {
  const celulas = gradeCalendarioMes(ano, mes);
  const mesRef = montarMesReferencia(ano, mes);

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{
          color: alpha('#f0fdfa', 0.72),
          fontWeight: 600,
          mb: 1.5,
          textTransform: 'capitalize',
        }}
      >
        {rotuloMesReferencia(mesRef)}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: { xs: 0.75, sm: 1 },
        }}
      >
        {DIAS_SEMANA_CURTO.map((nome) => (
          <Typography
            key={nome}
            variant="caption"
            sx={{
              textAlign: 'center',
              fontWeight: 700,
              color: alpha('#f0fdfa', 0.45),
              py: 0.5,
              fontSize: '0.72rem',
              letterSpacing: '0.04em',
            }}
          >
            {nome}
          </Typography>
        ))}

        {celulas.map((celula, idx) => {
          if (celula.dia == null) {
            return (
              <Box
                key={`empty-${idx}`}
                sx={{ minHeight: { xs: 88, sm: 108, md: 120 } }}
              />
            );
          }

          const compromissos = compromissosPorDia.get(celula.dia) ?? [];
          const hoje = ehHojeLocal(ano, mes, celula.dia);
          const comAgendamento = diaTemCompromissoAgendado(compromissos);
          const maxVisiveis = 3;
          const visiveis = compromissos.slice(0, maxVisiveis);
          const restantes = compromissos.length - visiveis.length;

          const estiloDia = (() => {
            if (comAgendamento && hoje) {
              return {
                bgcolor: alpha(amareloAgenda, 0.24),
                border: `1px solid ${alpha(accent, 0.55)}`,
                boxShadow: `0 0 0 1px ${alpha(accent, 0.22)} inset`,
                numeroColor: accent,
              };
            }
            if (comAgendamento) {
              return {
                bgcolor: alpha(amareloAgenda, 0.2),
                border: `1px solid ${alpha(amareloAgenda, 0.48)}`,
                boxShadow: `0 0 12px ${alpha(amareloAgenda, 0.12)}`,
                numeroColor: alpha('#fef9c3', 0.95),
              };
            }
            if (hoje) {
              return {
                bgcolor: alpha(accent, 0.18),
                border: `1px solid ${alpha(accent, 0.55)}`,
                boxShadow: `0 0 0 1px ${alpha(accent, 0.2)} inset`,
                numeroColor: accent,
              };
            }
            return {
              bgcolor: alpha('#020617', 0.35),
              border: `1px solid ${alpha(accent, 0.12)}`,
              boxShadow: 'none',
              numeroColor: '#f0fdfa',
            };
          })();

          const diaCell = (
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                minHeight: { xs: 88, sm: 108, md: 120 },
                borderRadius: 2,
                p: { xs: 0.75, sm: 1 },
                pt: { xs: 3.25, sm: 3.5 },
                bgcolor: estiloDia.bgcolor,
                border: estiloDia.border,
                boxShadow: estiloDia.boxShadow,
                transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                ...(compromissos.length > 0
                  ? {
                      '&:hover': {
                        boxShadow: `0 0 0 1px ${alpha(comAgendamento ? amareloAgenda : accent, 0.5)}, 0 10px 24px ${alpha('#000', 0.4)}`,
                        zIndex: 2,
                      },
                    }
                  : {}),
                ...(onAdicionarDia
                  ? {
                      '&:hover .agenda-dia-add': {
                        opacity: 1,
                        pointerEvents: 'auto',
                      },
                    }
                  : {}),
              }}
            >
              <Typography
                className="agenda-dia-numero"
                variant="body1"
                sx={{
                  position: 'absolute',
                  top: { xs: 8, sm: 10 },
                  left: { xs: 10, sm: 12 },
                  fontWeight: hoje ? 800 : 700,
                  fontSize: { xs: '0.95rem', sm: '1.05rem' },
                  color: estiloDia.numeroColor,
                  lineHeight: 1,
                }}
              >
                {celula.dia}
              </Typography>

              {compromissos.length > 0 ? (
                <Stack spacing={0.35} sx={{ flex: 1, minWidth: 0, width: '100%', mb: 0.5 }}>
                  {visiveis.map((c) => (
                    <Box
                      key={c.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onVerCompromisso?.(c);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onVerCompromisso?.(c);
                        }
                      }}
                      sx={{
                        px: 0.75,
                        py: 0.35,
                        borderRadius: 1,
                        bgcolor:
                          c.status === 'CANCELADO'
                            ? alpha('#020617', 0.35)
                            : c.status === 'AGENDADO'
                              ? alpha('#020617', 0.42)
                              : alpha(accent, 0.14),
                        border: `1px solid ${alpha(
                          c.status === 'AGENDADO' ? amareloAgenda : accent,
                          c.status === 'CANCELADO' ? 0.12 : 0.28,
                        )}`,
                        cursor: 'pointer',
                        opacity: c.status === 'CANCELADO' ? 0.55 : 1,
                        transition: 'background-color 0.12s ease',
                        '&:hover': {
                          bgcolor: alpha(
                            c.status === 'AGENDADO' ? amareloAgenda : accent,
                            0.28,
                          ),
                        },
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          fontWeight: 700,
                          color: '#f0fdfa',
                          fontSize: '0.62rem',
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {TIPO_LABEL[c.tipo]}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          display: 'block',
                          color: alpha('#f0fdfa', 0.72),
                          fontSize: '0.6rem',
                          lineHeight: 1.2,
                        }}
                      >
                        {formatarHorarioAgenda(c.dataInicio, c.diaInteiro)}
                      </Typography>
                    </Box>
                  ))}
                  {restantes > 0 ? (
                    <Typography
                      variant="caption"
                      sx={{ color: alpha('#f0fdfa', 0.45), fontSize: '0.58rem', pl: 0.5 }}
                    >
                      +{restantes} mais
                    </Typography>
                  ) : null}
                </Stack>
              ) : null}

              {onAdicionarDia ? (
                <Button
                  className="agenda-dia-add"
                  size="small"
                  fullWidth
                  startIcon={<span style={{ fontSize: '0.9rem', lineHeight: 1 }}>+</span>}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdicionarDia(celula.dia!);
                  }}
                  sx={{
                    mt: 'auto',
                    flexShrink: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                    transition: 'opacity 0.15s ease',
                    fontWeight: 700,
                    fontSize: '0.62rem',
                    px: 0.75,
                    py: 0.35,
                    minHeight: 0,
                    borderRadius: 1,
                    bgcolor: alpha(accent, 0.92),
                    color: '#042f2e',
                    boxShadow: `0 2px 8px ${alpha('#000', 0.25)}`,
                    '&:hover': { bgcolor: '#5eead4' },
                  }}
                >
                  Adicionar
                </Button>
              ) : null}
            </Box>
          );

          if (compromissos.length === 0) {
            return <Box key={`dia-${celula.dia}`}>{diaCell}</Box>;
          }

          return (
            <Tooltip
              key={`dia-tooltip-${celula.dia}`}
              title={<ConteudoHoverCompromissos compromissos={compromissos} />}
              placement="top"
              arrow
              enterDelay={280}
              leaveDelay={80}
              describeChild
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: alpha('#0f172a', 0.98),
                    border: `1px solid ${alpha(accent, 0.32)}`,
                    boxShadow: `0 12px 32px ${alpha('#000', 0.5)}`,
                    maxWidth: 300,
                    p: 1.25,
                    backgroundImage: `linear-gradient(160deg, ${alpha('#0f766e', 0.2)} 0%, transparent 55%)`,
                  },
                },
                arrow: {
                  sx: { color: alpha('#0f172a', 0.98) },
                },
              }}
            >
              {diaCell}
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}
