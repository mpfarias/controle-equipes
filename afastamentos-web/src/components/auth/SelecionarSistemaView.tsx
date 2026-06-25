import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import {
  AssignmentInd,
  AdminPanelSettings,
  Description,
  Engineering,
  FactCheck,
  Gavel,
  Hub,
  Insights,
  Inventory2,
  Lock,
  Logout,
  SupportAgent,
  Woman,
} from '@mui/icons-material';
import { SaudacaoUsuario } from '../common/SaudacaoUsuario';
import type { Usuario } from '../../types';
import {
  getSistemaDestino,
  labelSistema,
  listaDestinosPosLogin,
  SISTEMA_ID_APP_ATUAL,
  SISTEMA_ID_ORION_AGENDA,
  SISTEMA_ID_ORION_JURIDICO,
  SISTEMA_ID_ORION_MULHER,
  SISTEMA_ID_ORION_PATRIMONIO,
  SISTEMA_ID_ORION_QUALIDADE,
  SISTEMA_ID_ORION_SUPORTE,
} from '../../constants/sistemaDestinos';
import {
  ORION_HUB_ADMIN_SISTEMAS,
  ORION_HUB_GERENCIAMENTO_SISTEMAS,
  ORION_HUB_QUADRANTS,
  orionHubSistemasNosQuadrantes,
  type OrionHubQuadrantDef,
  type OrionHubQuadrantKey,
} from '../../constants/orionHubQuadrants';
import { formatMatricula } from '../../utils/dateUtils';

const accent = '#FF7A1A';

export const ORION_HUB_ICONS: Record<string, ReactNode> = {
  SAD: <Description sx={{ fontSize: 28 }} />,
  OPERACOES: <Hub sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_SUPORTE]: <SupportAgent sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_JURIDICO]: <Gavel sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_QUALIDADE]: <FactCheck sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_PATRIMONIO]: <Inventory2 sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_AGENDA]: <AssignmentInd sx={{ fontSize: 28 }} />,
  [SISTEMA_ID_ORION_MULHER]: <Woman sx={{ fontSize: 28 }} />,
};

function sistemaDisponivel(sistemaId: string, destinos: string[]): boolean {
  if (destinos.includes(sistemaId)) return true;
  if (sistemaId === SISTEMA_ID_ORION_AGENDA && destinos.includes('ORION_ASSESSORIA')) return true;
  return false;
}

function destinoConfigurado(sistemaId: string): boolean {
  const destino = getSistemaDestino(sistemaId);
  if (destino.tipo === 'interno' || destino.tipo === 'orion-suporte') return true;
  if (destino.tipo === 'orion-handoff' || destino.tipo === 'externo') return destino.configurado;
  return false;
}

function sistemaAcessivel(sistemaId: string, destinos: string[]): boolean {
  return sistemaDisponivel(sistemaId, destinos) && destinoConfigurado(sistemaId);
}

function quadrantGridArea(key: OrionHubQuadrantKey): string {
  switch (key) {
    case 'topLeft':
      return 'tl';
    case 'topRight':
      return 'tr';
    case 'bottomLeft':
      return 'bl';
    case 'bottomRight':
      return 'br';
    default:
      return 'tl';
  }
}

function iconeQuadrante(def: OrionHubQuadrantDef): ReactNode {
  const sx = { fontSize: { xs: 26, md: 28 } };
  if (def.tipo === 'administrativo') return <AdminPanelSettings sx={sx} />;
  if (def.tipo === 'gerenciamento') return <Engineering sx={sx} />;
  if (def.tipo === 'estrategico') return <Insights sx={sx} />;
  return ORION_HUB_ICONS[def.sistemaId] ?? <Hub sx={sx} />;
}

type HubQuadrantCardProps = {
  def: OrionHubQuadrantDef;
  clicavel: boolean;
  semPermissao: boolean;
  mensagemBloqueio?: string;
  onClick: () => void;
};

function HubQuadrantCard({ def, clicavel, semPermissao, mensagemBloqueio, onClick }: HubQuadrantCardProps) {
  return (
    <Box
      component="button"
      type="button"
      disabled={!clicavel}
      onClick={() => clicavel && onClick()}
      sx={{
        gridArea: quadrantGridArea(def.key),
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        textAlign: 'left',
        gap: { xs: 0.5, md: 0.75 },
        p: { xs: 1.35, sm: 1.6, md: 2 },
        minHeight: 0,
        height: '100%',
        maxWidth: { md: 300, lg: 320 },
        width: '100%',
        justifySelf: { md: def.key.includes('Left') ? 'start' : 'end' },
        borderRadius: 2,
        border: `1px solid ${alpha('#fff', clicavel ? 0.14 : 0.06)}`,
        bgcolor: alpha('#0a1628', clicavel ? 0.78 : 0.42),
        color: 'inherit',
        cursor: clicavel ? 'pointer' : 'not-allowed',
        opacity: clicavel ? 1 : 0.48,
        boxShadow: clicavel
          ? `0 8px 28px ${alpha('#000', 0.32)}, inset 0 1px 0 ${alpha('#fff', 0.06)}`
          : `inset 0 1px 0 ${alpha('#fff', 0.04)}`,
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease',
        '&:hover:enabled': {
          transform: 'translateY(-1px)',
          borderColor: alpha(accent, 0.5),
          bgcolor: alpha('#0d1e36', 0.9),
        },
        '&:focus-visible': {
          outline: `2px solid ${alpha(accent, 0.85)}`,
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: clicavel ? accent : alpha('#e8eef4', 0.4),
        }}
      >
        {iconeQuadrante(def)}
        <Typography
          sx={{
            fontWeight: 700,
            color: '#e8eef4',
            lineHeight: 1.15,
            fontSize: { xs: '0.82rem', sm: '0.9rem', md: '0.95rem' },
          }}
        >
          {def.title}
        </Typography>
      </Box>
      <Typography
        variant="caption"
        sx={{
          color: alpha('#e8eef4', 0.52),
          lineHeight: 1.35,
          fontSize: { xs: '0.68rem', md: '0.72rem' },
          display: { xs: 'none', sm: 'block' },
        }}
      >
        {def.subtitle}
      </Typography>
      {!clicavel ? (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 'auto' }}>
          <Lock sx={{ fontSize: 13, color: alpha('#e8eef4', 0.4) }} />
          <Typography variant="caption" sx={{ color: alpha('#e8eef4', 0.45), fontSize: '0.65rem' }}>
            {mensagemBloqueio ?? (semPermissao ? 'Sem permissão' : 'Indisponível')}
          </Typography>
        </Stack>
      ) : null}
    </Box>
  );
}

type HubModulosDialogProps = {
  open: boolean;
  onClose: () => void;
  destinos: string[];
  onEscolher: (sistemaId: string) => void;
  titulo: string;
  descricao: string;
  vazioMensagem: string;
  sistemaIds: readonly string[];
  iconeModulo: (sistemaId: string) => ReactNode;
};

function HubModulosDialog({
  open,
  onClose,
  destinos,
  onEscolher,
  titulo,
  descricao,
  vazioMensagem,
  sistemaIds,
  iconeModulo,
}: HubModulosDialogProps) {
  const opcoes = useMemo(
    () =>
      sistemaIds
        .filter((id) => sistemaAcessivel(id, destinos))
        .map((id) => ({
          id,
          label: labelSistema(id),
          icon: iconeModulo(id),
        })),
    [destinos, iconeModulo, sistemaIds],
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      disableScrollLock
      slotProps={{
        paper: {
          sx: {
            bgcolor: alpha('#0a1628', 0.96),
            backgroundImage: 'none',
            border: `1px solid ${alpha('#fff', 0.1)}`,
            borderRadius: 2.5,
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          pb: 1,
          color: '#e8eef4',
          fontWeight: 700,
        }}
      >
        {titulo}
        <IconButton aria-label="Fechar" onClick={onClose} size="small" sx={{ color: alpha('#e8eef4', 0.7) }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 3 }}>
        <Typography variant="body2" sx={{ color: alpha('#e8eef4', 0.55), mb: 2.5 }}>
          {descricao}
        </Typography>
        {opcoes.length === 0 ? (
          <Typography variant="body2" sx={{ color: alpha('#e8eef4', 0.45), fontStyle: 'italic' }}>
            {vazioMensagem}
          </Typography>
        ) : (
          <Stack spacing={1.5}>
            {opcoes.map((opcao) => (
              <Paper
                key={opcao.id}
                component="button"
                type="button"
                elevation={0}
                onClick={() => {
                  onClose();
                  onEscolher(opcao.id);
                }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  width: '100%',
                  p: 2,
                  textAlign: 'left',
                  cursor: 'pointer',
                  borderRadius: 2,
                  border: `1px solid ${alpha('#fff', 0.1)}`,
                  bgcolor: alpha('#000', 0.28),
                  color: 'inherit',
                  transition: 'border-color 0.18s, background-color 0.18s, transform 0.15s',
                  '&:hover': {
                    borderColor: alpha(accent, 0.45),
                    bgcolor: alpha('#000', 0.4),
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: accent,
                    bgcolor: alpha(accent, 0.14),
                    border: `1px solid ${alpha(accent, 0.32)}`,
                  }}
                >
                  {opcao.icon}
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#e8eef4' }}>
                  {opcao.label}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function HubTituloOperacoes() {
  return (
    <Box
      sx={{
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'center',
        px: 1,
        pt: { xs: 0.25, md: 0.5 },
        pb: { xs: 0.75, md: 1.25 },
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <Stack alignItems="center" spacing={{ xs: 0.85, md: 1.1 }} sx={{ maxWidth: 420 }}>
        <Typography
          variant="overline"
          sx={{
            letterSpacing: '0.32em',
            fontSize: { xs: '0.62rem', md: '0.68rem' },
            fontWeight: 700,
            color: alpha('#e8eef4', 0.42),
            lineHeight: 1,
          }}
        >
          COPOM
        </Typography>
        <Box
          sx={{
            width: { xs: 48, md: 64 },
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.65)}, transparent)`,
          }}
        />
        <Typography
          component="h1"
          sx={{
            fontFamily: "'Space Grotesk', 'Roboto', sans-serif",
            fontWeight: 700,
            fontSize: { xs: '1.45rem', sm: '1.65rem', md: '1.9rem', lg: '2.1rem' },
            lineHeight: 1.12,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            textAlign: 'center',
            color: alpha('#e8eef4', 0.92),
            textWrap: 'balance',
          }}
        >
          Centro de Operações
        </Typography>
        <Box
          sx={{
            width: { xs: 48, md: 64 },
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, transparent, ${alpha(accent, 0.65)}, transparent)`,
          }}
        />
      </Stack>
    </Box>
  );
}

type HubTopBarProps = {
  usuario: Usuario;
  onLogout: () => void;
};

function HubTopBar({ usuario, onLogout }: HubTopBarProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{
        flexShrink: 0,
        px: { xs: 0.5, sm: 1 },
        pb: { xs: 0.75, md: 1 },
        gap: 1,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="overline"
          sx={{
            display: 'block',
            letterSpacing: '0.18em',
            color: alpha('#e8eef4', 0.48),
            fontWeight: 700,
            fontSize: { xs: '0.58rem', md: '0.62rem' },
            lineHeight: 1.2,
          }}
        >
          ECOSSISTEMA ÓRION
        </Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: alpha('#e8eef4', 0.55),
            mt: 0.25,
            fontSize: { xs: '0.68rem', md: '0.72rem' },
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: { xs: 180, sm: 320, md: 480 },
          }}
        >
          <SaudacaoUsuario nomeCompleto={usuario.nome} prefixo="Olá," /> ({formatMatricula(usuario.matricula)})
        </Typography>
      </Box>
      <Button
        type="button"
        variant="outlined"
        color="inherit"
        size="small"
        startIcon={<Logout sx={{ fontSize: '1rem !important' }} />}
        onClick={onLogout}
        sx={{
          flexShrink: 0,
          color: alpha('#e8eef4', 0.65),
          borderColor: alpha('#fff', 0.2),
          textTransform: 'none',
          fontSize: '0.78rem',
          py: 0.5,
          px: { xs: 1, sm: 1.5 },
          '&:hover': { borderColor: alpha('#fff', 0.35), bgcolor: alpha('#fff', 0.04) },
        }}
      >
        Sair
      </Button>
    </Stack>
  );
}

interface SelecionarSistemaViewProps {
  usuario: Usuario;
  onEscolher: (sistemaId: string) => void;
  onLogout: () => void;
}

export function SelecionarSistemaView({ usuario, onEscolher, onLogout }: SelecionarSistemaViewProps) {
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [gerenciamentoDialogOpen, setGerenciamentoDialogOpen] = useState(false);
  const hubDialogAberto = adminDialogOpen || gerenciamentoDialogOpen;
  const destinos = listaDestinosPosLogin(usuario);

  useEffect(() => {
    if (!hubDialogAberto) return undefined;
    document.documentElement.classList.add('scroll-locked');
    return () => {
      document.documentElement.classList.remove('scroll-locked');
    };
  }, [hubDialogAberto]);

  const adminOpcoesDisponiveis = ORION_HUB_ADMIN_SISTEMAS.filter((id) => sistemaAcessivel(id, destinos));
  const gerenciamentoOpcoesDisponiveis = ORION_HUB_GERENCIAMENTO_SISTEMAS.filter((id) =>
    sistemaAcessivel(id, destinos),
  );

  const idsNosQuadrantes = new Set(orionHubSistemasNosQuadrantes());
  const extras = destinos.filter((id) => !idsNosQuadrantes.has(id) && id !== 'ORION_ASSESSORIA');

  const mostrarAlertaConfig =
    ORION_HUB_QUADRANTS.some((q) => {
      if (q.tipo === 'administrativo') {
        return adminOpcoesDisponiveis.some((id) => !destinoConfigurado(id));
      }
      if (q.tipo === 'gerenciamento') {
        return gerenciamentoOpcoesDisponiveis.some((id) => !destinoConfigurado(id));
      }
      if (q.tipo === 'estrategico') return false;
      if (!sistemaDisponivel(q.sistemaId, destinos)) return false;
      return !destinoConfigurado(q.sistemaId);
    }) || extras.some((id) => !destinoConfigurado(id));

  const quadrantState = (def: OrionHubQuadrantDef) => {
    if (def.tipo === 'administrativo') {
      const habilitado = adminOpcoesDisponiveis.length > 0;
      return {
        clicavel: habilitado,
        semPermissao: !habilitado,
        onClick: () => setAdminDialogOpen(true),
      };
    }
    if (def.tipo === 'gerenciamento') {
      const habilitado = gerenciamentoOpcoesDisponiveis.length > 0;
      return {
        clicavel: habilitado,
        semPermissao: !habilitado,
        onClick: () => setGerenciamentoDialogOpen(true),
      };
    }
    if (def.tipo === 'estrategico') {
      return {
        clicavel: false,
        semPermissao: false,
        mensagemBloqueio: 'Em breve',
        onClick: () => {},
      };
    }
    const habilitado = sistemaAcessivel(def.sistemaId, destinos);
    return {
      clicavel: habilitado,
      semPermissao: !sistemaDisponivel(def.sistemaId, destinos),
      onClick: () => onEscolher(def.sistemaId),
    };
  };

  return (
    <Box className="orion-hub-shell" sx={{ width: '100%', mx: 'auto', height: '100%' }}>
      <HubTopBar usuario={usuario} onLogout={onLogout} />

      {mostrarAlertaConfig ? (
        <Alert
          severity="info"
          sx={{
            flexShrink: 0,
            mb: 0.75,
            py: 0.25,
            px: 1.25,
            fontSize: '0.68rem',
            bgcolor: alpha('#2c7be5', 0.12),
            color: '#b8d4f0',
            border: `1px solid ${alpha('#2c7be5', 0.35)}`,
            '& .MuiAlert-message': { py: 0.25 },
          }}
        >
          Alguns módulos exigem URL no <code style={{ fontSize: '0.85em' }}>.env</code>.
        </Alert>
      ) : null}

      <HubTituloOperacoes />

      <Box
        className="orion-hub-grid"
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          width: '100%',
          maxWidth: { md: 920, lg: 1000 },
          mx: 'auto',
          px: { xs: 0.5, sm: 1, md: 2 },
          gap: { xs: 1, sm: 1.25, md: 2 },
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gridTemplateAreas: `
            "tl tr"
            "bl br"
          `,
          alignItems: 'stretch',
        }}
      >
        {ORION_HUB_QUADRANTS.map((def) => {
          const state = quadrantState(def);
          return (
            <HubQuadrantCard
              key={def.key}
              def={def}
              clicavel={state.clicavel}
              semPermissao={state.semPermissao}
              mensagemBloqueio={'mensagemBloqueio' in state ? state.mensagemBloqueio : undefined}
              onClick={state.onClick}
            />
          );
        })}
      </Box>

      {extras.length > 0 ? (
        <Stack
          alignItems="center"
          spacing={{ xs: 1.25, md: 1.75 }}
          sx={{
            flexShrink: 0,
            pt: { xs: 0.75, md: 1 },
            pb: { xs: 0.25, md: 0.5 },
            px: 1,
          }}
        >
          <Typography
            sx={{
              fontFamily: "'Space Grotesk', 'Roboto', sans-serif",
              fontWeight: 800,
              fontSize: { xs: '1.25rem', sm: '1.45rem', md: '1.65rem', lg: '1.85rem' },
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              textAlign: 'center',
              color: alpha('#e8eef4', 0.82),
            }}
          >
            PMDF
          </Typography>
          <Stack direction="row" flexWrap="wrap" justifyContent="center" gap={1}>
            {extras.map((id) => {
              const ok = destinoConfigurado(id);
              return (
                <Button
                  key={id}
                  variant="outlined"
                  size="small"
                  disabled={!ok}
                  onClick={() => ok && onEscolher(id)}
                  startIcon={ORION_HUB_ICONS[id] ?? <Hub sx={{ fontSize: 18 }} />}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.72rem',
                    py: 0.35,
                    borderColor: alpha('#fff', 0.18),
                    color: alpha('#e8eef4', 0.85),
                    '&:hover': { borderColor: alpha(accent, 0.45), bgcolor: alpha(accent, 0.08) },
                  }}
                >
                  {labelSistema(id)}
                </Button>
              );
            })}
          </Stack>
        </Stack>
      ) : null}

      <HubModulosDialog
        open={adminDialogOpen}
        onClose={() => setAdminDialogOpen(false)}
        destinos={destinos}
        onEscolher={onEscolher}
        titulo="Administrativo"
        descricao="Selecione o módulo administrativo que deseja acessar."
        vazioMensagem="Nenhum módulo administrativo disponível para o seu perfil."
        sistemaIds={ORION_HUB_ADMIN_SISTEMAS}
        iconeModulo={(id) => ORION_HUB_ICONS[id === SISTEMA_ID_APP_ATUAL ? 'SAD' : id] ?? <Hub sx={{ fontSize: 36 }} />}
      />

      <HubModulosDialog
        open={gerenciamentoDialogOpen}
        onClose={() => setGerenciamentoDialogOpen(false)}
        destinos={destinos}
        onEscolher={onEscolher}
        titulo="Gerenciamento Operacional"
        descricao="Selecione o módulo operacional que deseja acessar."
        vazioMensagem="Nenhum módulo operacional disponível para o seu perfil."
        sistemaIds={ORION_HUB_GERENCIAMENTO_SISTEMAS}
        iconeModulo={(id) => ORION_HUB_ICONS[id] ?? <Hub sx={{ fontSize: 36 }} />}
      />
    </Box>
  );
}
