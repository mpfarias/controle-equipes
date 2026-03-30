/**
 * Design System - Sistema Órion
 * Tokens de cores e tipografia para uso em componentes
 */

export const theme = {
  /* Brand */
  sentinelaBlue: '#0F2A44',
  sentinelaNavy: '#081B2C',
  sentinelaOrange: '#FF7A1A',
  sentinelaOrangeGlow: '#FF9A3C',

  /* UI */
  bgMain: '#1E232A',
  bgDark: '#0B1F33',
  cardBg: '#252B33',
  borderSoft: '#3A4451',

  /* Text */
  textPrimary: '#E8EEF4',
  textSecondary: '#A8B8C8',

  /* Status */
  success: '#2E8B57',
  warning: '#FF7A1A',
  error: '#D64545',
  info: '#2C7BE5',

  /* Status badges (dark theme - tons mais suaves e harmoniosos) */
  statusAtivoBg: 'rgba(74, 131, 100, 0.25)',
  statusAtivoText: '#86C99E',
  statusComissionadoBg: 'rgba(139, 92, 92, 0.25)',
  statusComissionadoText: '#D4A0A0',
  statusDesignadoBg: 'rgba(139, 115, 74, 0.25)',
  statusDesignadoText: '#D4B896',
  statusPttcBg: 'rgba(74, 107, 139, 0.25)',
  statusPttcText: '#8BA8C4',
  statusDesativadoBg: 'rgba(139, 92, 92, 0.25)',
  statusDesativadoText: '#D4A0A0',
  statusMutedBg: 'rgba(107, 120, 139, 0.2)',
  statusMutedText: '#94a3b8',

  /* Alerts (dark theme - tons suaves) */
  alertSuccessBg: 'rgba(74, 131, 100, 0.2)',
  alertErrorBg: 'rgba(139, 92, 92, 0.2)',
  alertWarningBg: 'rgba(139, 115, 74, 0.2)',
  alertInfoBg: 'rgba(74, 107, 139, 0.2)',

  /* Accent suave (checkbox, focus, links) */
  accentMuted: '#6B9BC4',

  /* Typography */
  fontFamily: "'Roboto', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSize: {
    titulo: 'clamp(1.75rem, 2vw, 2rem)',   /* 28–32px */
    secao: 'clamp(1.25rem, 1.5vw, 1.5rem)', /* 20–24px */
    subtitulo: 'clamp(1rem, 1.125vw, 1.125rem)', /* 16–18px */
    normal: 'clamp(0.875rem, 1vw, 1rem)',   /* 14–16px */
    tecnico: '0.8125rem',                   /* 13px */
  },
  fontWeight: {
    bold: 700,
    semiBold: 600,
    medium: 500,
    regular: 400,
  },
} as const;
