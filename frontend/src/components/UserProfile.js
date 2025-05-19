import React, { useState, useEffect } from 'react';
import {
  Container, Paper, Typography, Box, Avatar, TextField,
  Button, Divider, Grid, CircularProgress, IconButton,
  Alert, Snackbar, InputAdornment
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import { useNavigate } from 'react-router-dom';
import AppNavBar from './AppNavBar';

const UserProfile = ({ token, setToken }) => {
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  
  // Password change state
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Form data for editing
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    organization: '',
    bio: ''
  });

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:5000/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        
        const data = await response.json();
        setProfile(data);
        setFormData({
          fullName: data.fullName || '',
          email: data.email || '',
          organization: data.organization || '',
          bio: data.bio || ''
        });
      } catch (err) {
        setError('Failed to load profile data');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProfile();
  }, [token]);

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
    // Reset form data to current profile when canceling edit
    if (isEditing) {
      setFormData({
        fullName: profile.fullName || '',
        email: profile.email || '',
        organization: profile.organization || '',
        bio: profile.bio || ''
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData({
      ...passwordData,
      [name]: value
    });
  };

  const handleSaveProfile = async () => {
    // Validate email
    if (!formData.email || !formData.email.includes('@')) {
      setNotification({
        open: true,
        message: 'Please enter a valid email address',
        severity: 'error'
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:5000/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update profile');
      }
      
      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      setIsEditing(false);
      setNotification({
        open: true,
        message: 'Profile updated successfully',
        severity: 'success'
      });
    } catch (err) {
      setNotification({
        open: true,
        message: 'Failed to update profile',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setNotification({
        open: true,
        message: 'New passwords do not match',
        severity: 'error'
      });
      return;
    }
    
    if (!passwordData.currentPassword) {
      setNotification({
        open: true,
        message: 'Current password is required',
        severity: 'error'
      });
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setNotification({
        open: true,
        message: 'New password must be at least 6 characters long',
        severity: 'error'
      });
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:5000/profile/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }
      
      // Reset password fields and exit password change mode
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setIsChangingPassword(false);
      setNotification({
        open: true,
        message: 'Password changed successfully',
        severity: 'success'
      });
    } catch (err) {
      setNotification({
        open: true,
        message: err.message || 'Failed to change password',
        severity: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <AppNavBar 
        token={token} 
        setToken={setToken} 
        userInitial={profile ? (profile.fullName?.charAt(0) || profile.email?.charAt(0)) : ''}
      />
      
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        {error ? (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        ) : (
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h4" component="h1">
                User Profile
              </Typography>
              {!isEditing ? (
                <Button 
                  startIcon={<EditIcon />} 
                  variant="outlined" 
                  onClick={handleEditToggle}
                  disabled={isSaving}
                >
                  Edit Profile
                </Button>
              ) : (
                <Box>
                  <Button 
                    startIcon={<SaveIcon />} 
                    variant="contained" 
                    color="primary" 
                    onClick={handleSaveProfile}
                    disabled={isSaving}
                    sx={{ mr: 1 }}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button 
                    startIcon={<CancelIcon />} 
                    variant="outlined" 
                    onClick={handleEditToggle}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>

            <Grid container spacing={3}>
              <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Avatar 
                  sx={{ 
                    width: 150, 
                    height: 150, 
                    mb: 2, 
                    bgcolor: 'primary.main',
                    fontSize: '4rem'
                  }}
                >
                  {(profile?.fullName?.charAt(0) || profile?.email?.charAt(0) || '').toUpperCase()}
                </Avatar>

            <Typography variant="body2" color="textSecondary" sx={{ textAlign: 'center', mt: 1 }}>
                Account created: {profile?.createdAt 
                ? new Date(parseInt(profile.createdAt) * 1000).toLocaleDateString(undefined, {
                year: 'numeric',
                 month: 'long',
                day: 'numeric'
            })
            : 'Unknown date'}
            </Typography>

                <Button 
                  variant="outlined" 
                  onClick={() => setIsChangingPassword(!isChangingPassword)} 
                  startIcon={<LockIcon />}
                  sx={{ mt: 3 }}
                >
                  {isChangingPassword ? 'Cancel Password Change' : 'Change Password'}
                </Button>
              </Grid>

              <Grid item xs={12} md={8}>
                {isChangingPassword ? (
                  <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="h6" gutterBottom>
                      Change Password
                    </Typography>
                    
                    <TextField
                      name="currentPassword"
                      label="Current Password"
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={handlePasswordInputChange}
                      fullWidth
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    
                    <TextField
                      name="newPassword"
                      label="New Password"
                      type="password"
                      value={passwordData.newPassword}
                      onChange={handlePasswordInputChange}
                      fullWidth
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    
                    <TextField
                      name="confirmPassword"
                      label="Confirm New Password"
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={handlePasswordInputChange}
                      fullWidth
                      required
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon color="action" />
                          </InputAdornment>
                        ),
                      }}
                    />
                    
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleChangePassword}
                      disabled={isSaving}
                      sx={{ mt: 1 }}
                    >
                      {isSaving ? <CircularProgress size={24} /> : 'Update Password'}
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Grid container spacing={2}>
                      <Grid item xs={12}>
                        <TextField
                          name="email"
                          label="Email"
                          fullWidth
                          disabled={!isEditing}
                          value={formData.email}
                          onChange={handleInputChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <EmailIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          name="fullName"
                          label="Full Name"
                          fullWidth
                          disabled={!isEditing}
                          value={formData.fullName}
                          onChange={handleInputChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <PersonIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          name="organization"
                          label="Organization"
                          fullWidth
                          disabled={!isEditing}
                          value={formData.organization}
                          onChange={handleInputChange}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <AccountCircleIcon color="action" />
                              </InputAdornment>
                            ),
                          }}
                        />
                      </Grid>
                      
                      <Grid item xs={12}>
                        <TextField
                          name="bio"
                          label="Bio"
                          fullWidth
                          disabled={!isEditing}
                          value={formData.bio}
                          onChange={handleInputChange}
                          multiline
                          rows={4}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 3 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button onClick={() => navigate('/files')}>
                Back to Files
              </Button>
            </Box>
          </Paper>
        )}
        
        <Snackbar
          open={notification.open}
          autoHideDuration={4000}
          onClose={handleCloseNotification}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleCloseNotification} 
            severity={notification.severity} 
            sx={{ width: '100%' }}
          >
            {notification.message}
          </Alert>
        </Snackbar>
      </Container>
    </>
  );
};

export default UserProfile;