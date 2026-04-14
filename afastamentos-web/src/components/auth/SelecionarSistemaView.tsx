import type { ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  ArrowForward,
  Description,
  FactCheck,
  Gavel,
  Hub,
  Inventory2,
  Logout,
  OpenInNew,
  SupportAgent,
  Woman,
} from '@mui/icons-material';
import type { Usuario } from '../../types';
import {
  getSistemaDestino,
  labelSistema,
  listaDestinosPosLogin,
  SISTEMA_ID_APP_ATUAL,
  SISTEMA_ID_ORION_JURIDICO,
  SISTEMA_ID_ORION_PATRIMONIO,
  SISTEMA_ID_ORION_MULHER,
  SISTEMA_ID_ORION_QUALIDADE,
  SISTEMA_ID_ORION_SUPORTE,
} from '../../constants/sistemaDestinos';
import { formatMatricula } from '../../utils/dateUtils';

const accent = '#FF7A1A';

const ICONS: Record<string, ReactNode> = {
  SAD: <Description sx={{ fontSize: 28 }} />,
  OPERACOES: <Hub sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_SUPORTE]: <SupportAgent sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_QUALIDADE]: <FactCheck sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_JURIDICO]: <Gavel sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_PATRIMONIO]: <Inventory2 sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_MULHER]: <Woman sx={{ fontSize: 28 }} />,
};

interface SelecionarSistemaViewProps {
  usuario: Usuario;
  onEscolher: (sistemaId: string) => void;
  onLogout: () => void;
}

export function SelecionarSistemaView({ usuario, onEscolher, onLogout }: SelecionarSistemaViewProps) {
  const sistemas = listaDestinosPosLogin(usuario);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 720,
        mx: 'auto',
        position: 'relative',
        borderRadius: { xs: 2, md: 3 },
        overflow: 'hidden',
        boxShadow: `
          0 0 0 1px ${alpha('#fff', 0.06)},
          0 24px 80px rgba(0, 0, 0, 0.55)
        `,
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 50% at 20% -10%, ${alpha(accent, 0.12)}, transparent 50%),
            linear-gradient(165deg, #050a12 0%, #0b1628 45%, #081018 100%)
          `,
        }}
      />
      <Stack spacing={3} sx={{ position: 'relative', p: { xs: 3, sm: 4, md: 5 } }}>
        <Box>
          <Typography
            variant="overline"
            sx={{ letterSpacing: '0.22em', color: alpha('#e8eef4', 0.5), fontWeight: 700, fontSize: '0.65rem' }}
          >
            ACESSO AO ECOSSISTEMA
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#e8eef4', mt: 1, letterSpacing: '-0.02em' }}>
            Escolha o sistema
          </Typography>
          <Typography variant="body2" sx={{ color: alpha('#e8eef4', 0.55), mt: 1, maxWidth: 480 }}>
            Olá, <strong style={{ color: '#e8eef4' }}>{usuario.nome}</strong> ({formatMatricula(usuario.matricula)}).
            Selecione abaixo qual módulo deseja abrir nesta sessão.
          </Typography>
        </Box>

        <Stack spacing={1.5}>
          {sistemas.map((id) => {
            const destino = getSistemaDestino(id);
            const urlOk =
              destino.tipo === 'interno' ||
              destino.tipo === 'orion-suporte' ||
              destino.tipo === 'orion-handoff' ||
              (destino.tipo === 'externo' && destino.configurado);
            const desabilitado =
              (destino.tipo === 'externo' && !destino.configurado) ||
              (destino.tipo === 'orion-handoff' && !destino.configurado);
            const ehAtual = id === SISTEMA_ID_APP_ATUAL;

            return (
              <Paper
                key={id}
                component="button"
                type="button"
                disabled={desabilitado}
                onClick={() => !desabilitado && onEscolher(id)}
                elevation={0}
                sx={{
                  textAlign: 'left',
                  cursor: desabilitado ? 'not-allowed' : 'pointer',
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha('#fff', desabilitado ? 0.04 : 0.1)}`,
                  bgcolor: alpha('#000', desabilitado ? 0.15 : 0.28),
                  opacity: desabilitado ? 0.55 : 1,
                  transition: 'border-color 0.2s, background-color 0.2s, transform 0.15s',
                  '&:hover:not(:disabled)': {
                    borderColor: alpha(accent, 0.45),
                    bgcolor: alpha('#000', 0.34),
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box
                    sx={{
                      width: 52,
                      height: 52,
                      borderRadius: 2,
                      display: 'grid',
                      placeItems: 'center',
                      color: desabilitado ? alpha('#e8eef4', 0.35) : accent,
                      bgcolor: alpha(accent, desabilitado ? 0.06 : 0.15),
                      border: `1px solid ${alpha(accent, desabilitado ? 0.12 : 0.35)}`,
                    }}
                  >
                    {ICONS[id] ?? <Hub sx={{ fontSize: 28 }} />}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#e8eef4' }}>
                      {labelSistema(id)}
                    </Typography>
                  </Box>
                  {ehAtual ? (
                    <ArrowForward sx={{ color: accent, flexShrink: 0 }} />
                  ) : urlOk ? (
                    <OpenInNew sx={{ color: alpha('#e8eef4', 0.45), flexShrink: 0 }} />
                  ) : null}
                </Stack>
              </Paper>
            );
          })}
        </Stack>

        {sistemas.some((id) => {
          const d = getSistemaDestino(id);
          return (
            (d.tipo === 'externo' && !d.configurado) ||
            (d.tipo === 'orion-handoff' && !d.configurado)
          );
        }) && (
          <Alert severity="info" sx={{ bgcolor: alpha('#2c7be5', 0.12), color: '#b8d4f0', border: `1px solid ${alpha('#2c7be5', 0.35)}` }}>
            Configure as variáveis <code style={{ fontSize: '0.85em' }}>VITE_SISTEMA_URL_OPERACOES</code>,{' '}
            <code style={{ fontSize: '0.85em' }}>VITE_ORION_QUALIDADE_URL</code>,{' '}
            <code style={{ fontSize: '0.85em' }}>VITE_ORION_JURIDICO_URL</code>,{' '}
            <code style={{ fontSize: '0.85em' }}>VITE_ORION_PATRIMONIO_URL</code> e{' '}
            <code style={{ fontSize: '0.85em' }}>VITE_ORION_MULHER_URL</code> no arquivo{' '}
            <code style={{ fontSize: '0.85em' }}>.env</code> quando o deploy não usar o host/porta padrão de desenvolvimento.
          </Alert>
        )}

        <Button
          type="button"
          variant="outlined"
          color="inherit"
          startIcon={<Logout />}
          onClick={onLogout}
          sx={{
            alignSelf: 'flex-start',
            color: alpha('#e8eef4', 0.65),
            borderColor: alpha('#fff', 0.2),
            '&:hover': { borderColor: alpha('#fff', 0.35), bgcolor: alpha('#fff', 0.04) },
          }}
        >
          Sair e voltar ao login
        </Button>
      </Stack>
    </Box>
  );
}
