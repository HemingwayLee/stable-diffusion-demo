import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#a855f7' },
    secondary: { main: '#ec4899' },
    background: { default: '#080810', paper: '#10101e' },
    success: { main: '#22c55e' },
    error: { main: '#ef4444' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: { backgroundImage: 'none', backgroundColor: '#10101e' },
      },
    },
  },
});
