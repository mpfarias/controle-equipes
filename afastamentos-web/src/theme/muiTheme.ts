import { createTheme } from '@mui/material/styles';
import { theme as designTokens } from '../constants/theme';

/**
 * Tema MUI com cores do Design System - Sistema Sentinela
 * Aplica as cores funcionais (sucesso, alerta, erro, informação) aos componentes MUI,
 * incluindo Alert, Button, Chip, etc.
 */
export const muiTheme = createTheme({
  palette: {
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
});
