import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { consumirOrionSsoDoHashDaUrl } from './utils/consumeOrionSsoHash';
import App from './App';
import './styles.css';

consumirOrionSsoDoHashDaUrl();

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#fbbf24' },
    secondary: { main: '#94a3b8' },
    background: { default: '#0f172a', paper: '#1e293b' },
  },
  typography: {
    fontFamily: '"Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
