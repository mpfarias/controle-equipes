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
    secondary: { main: '#fcd34d' },
    background: { default: '#0c1222', paper: '#111827' },
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
