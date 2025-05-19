import React from 'react';
import {
  AppBar, Toolbar, Typography, Button, Box, Avatar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import CloudIcon from '@mui/icons-material/Cloud';

const AppNavBar = ({ token, setToken, userInitial = '' }) => {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    navigate('/login');
  };
  
  return (
    <AppBar position="static" color="primary" sx={{ mb: 4 }}>
      <Toolbar>
        <FolderOpenIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          DFS File Manager
        </Typography>
        
        {token && (
          <>
            <Button 
              color="inherit" 
              onClick={() => navigate('/files')} 
              sx={{ mr: 1 }}
              startIcon={<CloudIcon />}
            >
              Files
            </Button>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button 
                color="inherit" 
                onClick={() => navigate('/profile')} 
                sx={{ mr: 1 }}
                startIcon={
                  userInitial ? (
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: 'secondary.main' }}>
                      {userInitial}
                    </Avatar>
                  ) : (
                    <PersonIcon />
                  )
                }
              >
                Profile
              </Button>
              
              <Button 
                color="inherit" 
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                Logout
              </Button>
            </Box>
          </>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default AppNavBar;