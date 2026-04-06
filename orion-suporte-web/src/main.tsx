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
    primary: { main: '#2dd4bf' },
    secondary: { main: '#818cf8' },
    background: { default: '#022c22', paper: '#0f172a' },
    success: { main: '#34d399' },
    info: { main: '#5eead4' },
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
