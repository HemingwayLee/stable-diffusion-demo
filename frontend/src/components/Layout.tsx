import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CollectionsIcon from '@mui/icons-material/Collections';
import { AppBar, Box, Button, Divider, Toolbar, Typography } from '@mui/material';
import { Outlet, Link, useLocation } from 'react-router-dom';
import ModelStatus from './ModelStatus';

export default function Layout() {
  const { pathname } = useLocation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={0} sx={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <Toolbar sx={{ gap: 1 }}>
          <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight={700} sx={{ letterSpacing: '-0.02em', mr: 2 }}>
            SD 3.5 Demo
          </Typography>

          <ModelStatus />

          <Box sx={{ flex: 1 }} />

          <Button
            component={Link}
            to="/"
            startIcon={<AutoAwesomeIcon />}
            color={pathname === '/' ? 'primary' : 'inherit'}
          >
            Generate
          </Button>
          <Button
            component={Link}
            to="/gallery"
            startIcon={<CollectionsIcon />}
            color={pathname === '/gallery' ? 'primary' : 'inherit'}
          >
            Gallery
          </Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
