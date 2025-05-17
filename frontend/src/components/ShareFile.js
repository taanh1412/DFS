import React, { useState } from 'react';
import { 
  TextField, Button, Dialog, DialogTitle, DialogContent, 
  DialogActions, Typography, Box, Divider, IconButton,
  InputAdornment, Tooltip, CircularProgress, Alert,
  Snackbar, Paper
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CloseIcon from '@mui/icons-material/Close';
import ShareIcon from '@mui/icons-material/Share';

function ShareFile({ open, onClose, fileId, token }) {
  const [email, setEmail] = useState('');
  const [publicLink, setPublicLink] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [error, setError] = useState('');

  const handleShareViaEmail = async () => {
    if (!email) {
      setError('Please enter an email address');
      return;
    }
    
    setEmailLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:5000/share/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ file_id: fileId, email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSnackbarMessage('File shared via email successfully');
        setSnackbarOpen(true);
        setEmail('');
      } else {
        setError(data.message || 'Failed to share via email');
      }
    } catch (err) {
      setError('Failed to share via email. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  };

  const handleGeneratePublicLink = async () => {
    if (!fileId) {
      setError('File ID is missing');
      return;
    }
    
    setLinkLoading(true);
    setError('');
    
    try {
      const requestBody = { file_id: fileId };
      const response = await fetch('http://localhost:5000/share/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPublicLink(data.link);
        setSnackbarMessage('Public link generated');
        setSnackbarOpen(true);
      } else {
        setError(data.message || 'Failed to generate public link');
      }
    } catch (err) {
      setError('Failed to generate public link. Please try again.');
    } finally {
      setLinkLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicLink);
    setSnackbarMessage('Link copied to clipboard');
    setSnackbarOpen(true);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: 3
          }
        }}
      >
        <DialogTitle sx={{ 
          bgcolor: 'primary.main', 
          color: 'primary.contrastText',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ShareIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Share File</Typography>
          </Box>
          <IconButton 
            edge="end" 
            color="inherit" 
            onClick={onClose} 
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* Email Sharing Section */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Share via Email
          </Typography>
          <Box sx={{ mb: 3 }}>
            <TextField
              label="Recipient Email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon color="primary" />
                  </InputAdornment>
                ),
              }}
              disabled={emailLoading}
              placeholder="Enter recipient's email address"
              helperText="The recipient will receive a link to access this file"
            />
            <Button 
              onClick={handleShareViaEmail} 
              variant="contained" 
              color="primary"
              disabled={emailLoading || !email}
              startIcon={emailLoading ? <CircularProgress size={20} /> : <EmailIcon />}
              fullWidth
              sx={{ mt: 1 }}
            >
              {emailLoading ? 'Sending...' : 'Share via Email'}
            </Button>
          </Box>

          <Divider sx={{ my: 3 }}>
            <Typography variant="body2" color="text.secondary">
              OR
            </Typography>
          </Divider>

          {/* Public Link Section */}
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Generate Public Link
          </Typography>
          <Box>
            <Button 
              onClick={handleGeneratePublicLink} 
              variant="outlined" 
              color="secondary"
              disabled={linkLoading}
              startIcon={linkLoading ? <CircularProgress size={20} /> : <LinkIcon />}
              fullWidth
              sx={{ mb: 2 }}
            >
              {linkLoading ? 'Generating...' : 'Generate Public Link'}
            </Button>

            {publicLink && (
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  mt: 2, 
                  bgcolor: 'rgba(0, 0, 0, 0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Typography 
                  variant="body2" 
                  sx={{ 
                    flexGrow: 1, 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {publicLink}
                </Typography>
                <Tooltip title="Copy to clipboard">
                  <IconButton color="primary" onClick={copyToClipboard} size="small">
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Paper>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onClose} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Notification */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}

export default ShareFile;