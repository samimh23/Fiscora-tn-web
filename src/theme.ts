import { createTheme, type Direction } from '@mui/material/styles';

export const createAppTheme = (direction: Direction) => createTheme({
  direction,
  palette: {
    mode: 'light',
    primary: { main: '#145a46', dark: '#0c3d30', light: '#dcebe5' },
    secondary: { main: '#ef7d5b' },
    background: { default: '#f5f4ee', paper: '#fffdf8' },
    text: { primary: '#17251f', secondary: '#64716b' },
    divider: '#e4e1d7',
    success: { main: '#2f7d5d' },
    warning: { main: '#c47a24' },
    error: { main: '#bd4f4f' },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: direction === 'rtl' ? 'Tahoma, Arial, sans-serif' : 'Inter, "Segoe UI", sans-serif',
    h1: { fontFamily: direction === 'rtl' ? 'Tahoma, Arial, sans-serif' : 'Georgia, serif', fontWeight: 500, letterSpacing: direction === 'rtl' ? 0 : '-0.03em' },
    h2: { fontFamily: direction === 'rtl' ? 'Tahoma, Arial, sans-serif' : 'Georgia, serif', fontWeight: 500, letterSpacing: direction === 'rtl' ? 0 : '-0.02em' },
    h3: { fontFamily: direction === 'rtl' ? 'Tahoma, Arial, sans-serif' : 'Georgia, serif', fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiButton: {
      styleOverrides: { root: { boxShadow: 'none', minHeight: 42 } },
    },
    MuiPaper: {
      styleOverrides: { root: { backgroundImage: 'none' } },
    },
    MuiCard: {
      styleOverrides: { root: { border: '1px solid #e4e1d7', boxShadow: '0 8px 30px rgba(24, 45, 36, 0.05)' } },
    },
  },
});
