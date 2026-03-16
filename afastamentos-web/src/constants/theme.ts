/**
 * Design System - Sistema Sentinela
 * Tokens de cores e tipografia para uso em componentes
 */

export const theme = {
  /* Brand */
  sentinelaBlue: '#0F2A44',
  sentinelaNavy: '#081B2C',
  sentinelaOrange: '#FF7A1A',
  sentinelaOrangeGlow: '#FF9A3C',

  /* UI */
  bgMain: '#F4F7FA',
  bgDark: '#0B1F33',
  cardBg: '#FFFFFF',
  borderSoft: '#D6E0EA',

  /* Text */
  textPrimary: '#1B2B38',
  textSecondary: '#5C6F82',

  /* Status */
  success: '#2E8B57',
  warning: '#FF7A1A',
  error: '#D64545',
  info: '#2C7BE5',

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
