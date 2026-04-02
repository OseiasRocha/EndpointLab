import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import HomePage from './pages/HomePage';

const theme = createTheme({
  palette: {
    background: { default: '#f4f7f9' },
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
  },
  components: {
    MuiAccordion: {
      defaultProps: { disableGutters: true },
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ThemeProvider>
  );
}
