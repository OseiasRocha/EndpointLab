import { useMemo, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import HomePage from './pages/HomePage';
import { ColorModeContext, type ColorModeCtx } from './context/colorMode';

function buildTheme(mode: 'light' | 'dark') {
  return createTheme({
    palette: {
      mode,
      primary:  { main: '#49cc90', dark: '#3bb07c', contrastText: '#fff' },
      info:     { main: '#4990e2', dark: '#3a7bc8', contrastText: '#fff' },
      success:  { main: '#49cc90', contrastText: '#fff' },
      background: {
        default: mode === 'light' ? '#f4f7f9' : '#1a2530',
        paper:   mode === 'light' ? '#ffffff'  : '#1e2530',
      },
    },
    typography: { fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif' },
    components: { MuiAccordion: { defaultProps: { disableGutters: true } } },
  });
}

export default function App() {
  const stored = (localStorage.getItem('colorMode') ?? 'dark') as 'light' | 'dark';
  const [mode, setMode] = useState<'light' | 'dark'>(stored);

  const ctx = useMemo<ColorModeCtx>(() => ({
    mode,
    toggle: () => setMode(m => {
      const next = m === 'light' ? 'dark' : 'light';
      localStorage.setItem('colorMode', next);
      return next;
    }),
  }), [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={ctx}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
