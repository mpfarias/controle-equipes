import { createTheme } from '@mui/material/styles';
import { theme as designTokens } from '../constants/theme';

/**
 * Tema MUI com cores do Design System - Sistema Órion (Dark)
 * Aplica as cores funcionais aos componentes MUI.
 */
export const muiTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: designTokens.sentinelaBlue,
      dark: designTokens.sentinelaNavy,
    },
    secondary: {
      main: designTokens.sentinelaOrange,
      light: designTokens.sentinelaOrangeGlow,
    },
    success: {
      main: designTokens.success,
    },
    warning: {
      main: designTokens.warning,
    },
    error: {
      main: designTokens.error,
    },
    info: {
      main: designTokens.info,
    },
    background: {
      default: designTokens.bgMain,
      paper: designTokens.cardBg,
    },
    text: {
      primary: designTokens.textPrimary,
      secondary: designTokens.textSecondary,
    },
  },
  typography: {
    fontFamily: designTokens.fontFamily,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        /* Deixa o fundo em camadas do html (emblema Órion + scrims) visível */
        body: {
          backgroundColor: 'transparent',
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          color: designTokens.borderSoft,
          '&.Mui-checked': {
            color: designTokens.accentMuted,
          },
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        standardSuccess: {
          backgroundColor: designTokens.alertSuccessBg,
          color: designTokens.statusAtivoText,
        },
        standardError: {
          backgroundColor: designTokens.alertErrorBg,
          color: designTokens.statusComissionadoText,
        },
        standardWarning: {
          backgroundColor: designTokens.alertWarningBg,
          color: designTokens.statusDesignadoText,
        },
        standardInfo: {
          backgroundColor: designTokens.alertInfoBg,
          color: designTokens.statusPttcText,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderColor: designTokens.borderSoft,
        },
        colorPrimary: {
          backgroundColor: designTokens.sentinelaBlue,
          color: '#fff',
        },
        colorSuccess: {
          backgroundColor: designTokens.alertSuccessBg,
          color: designTokens.statusAtivoText,
        },
        colorError: {
          backgroundColor: designTokens.alertErrorBg,
          color: designTokens.statusComissionadoText,
        },
        colorWarning: {
          backgroundColor: designTokens.alertWarningBg,
          color: designTokens.statusDesignadoText,
        },
        colorInfo: {
          backgroundColor: designTokens.alertInfoBg,
          color: designTokens.statusPttcText,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          backgroundColor: designTokens.cardBg,
          border: `1px solid ${designTokens.borderSoft}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: designTokens.cardBg,
          border: `1px solid ${designTokens.borderSoft}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: designTokens.cardBg,
          border: `1px solid ${designTokens.borderSoft}`,
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          color: designTokens.textPrimary,
          borderBottom: `1px solid ${designTokens.borderSoft}`,
          padding: '16px 24px',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: designTokens.textPrimary,
          padding: '24px',
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          borderTop: `1px solid ${designTokens.borderSoft}`,
          padding: '16px 24px',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        select: {
          backgroundColor: designTokens.cardBg,
          color: designTokens.textPrimary,
        },
      },
    },
    MuiMenu: {
      styleOverrides: {
        paper: {
          backgroundColor: designTokens.cardBg,
          border: `1px solid ${designTokens.borderSoft}`,
          '& .MuiMenuItem-root': {
            color: designTokens.textPrimary,
          },
          '& .MuiMenuItem-root:hover': {
            backgroundColor: 'rgba(107, 155, 196, 0.12)',
          },
          '& .MuiMenuItem-root.Mui-selected': {
            backgroundColor: 'rgba(107, 155, 196, 0.2)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& fieldset': {
            borderColor: designTokens.borderSoft,
            borderWidth: '1px',
          },
          '&:hover fieldset': {
            borderColor: designTokens.accentMuted,
          },
          '&.Mui-focused fieldset': {
            borderColor: designTokens.accentMuted,
            borderWidth: '2px',
          },
        },
        input: {
          '&::placeholder': {
            color: designTokens.textSecondary,
            opacity: 1,
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        outlined: {
          borderColor: designTokens.textSecondary,
          color: designTokens.textPrimary,
          '&:hover': {
            borderColor: designTokens.accentMuted,
            color: designTokens.accentMuted,
            backgroundColor: 'rgba(107, 155, 196, 0.08)',
          },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            color: designTokens.textPrimary,
            fontWeight: 600,
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          color: designTokens.textSecondary,
          '&.Mui-focused': {
            color: designTokens.accentMuted,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: designTokens.accentMuted,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          color: designTokens.textSecondary,
          '&.Mui-selected': {
            color: designTokens.textPrimary,
            fontWeight: 600,
          },
        },
      },
    },
    MuiSvgIcon: {
      styleOverrides: {
        root: {
          '&.MuiSelect-icon': {
            color: designTokens.textSecondary,
          },
        },
      },
    },
  },
});
