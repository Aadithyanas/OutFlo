// frontend/src/components/Navbar.tsx
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CampaignIcon from '@mui/icons-material/Campaign';
import MessageIcon from '@mui/icons-material/Message';

const Navbar = () => {
  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          Campaign Management
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            color="inherit" 
            component={RouterLink} 
            to="/"
            startIcon={<CampaignIcon />}
          >
            Campaigns
          </Button>
          <Button 
            color="inherit" 
            component={RouterLink} 
            to="/message-generator"
            startIcon={<MessageIcon />}
          >
            Message Generator
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;