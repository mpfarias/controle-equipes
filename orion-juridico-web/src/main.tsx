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
    primary: { main: '#c4b5fd' },
    secondary: { main: '#94a3b8' },
    background: { default: '#1e1b2e', paper: '#252136' },
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
