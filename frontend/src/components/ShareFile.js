import React, { useState } from 'react';
import { TextField, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography } from '@mui/material';

function ShareFile({ open, onClose, fileId, token }) {
  const [email, setEmail] = useState('');
  const [publicLink, setPublicLink] = useState('');

  const handleShareViaEmail = async () => {
    try {
      await fetch('http://localhost:5000/share/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ file_id: fileId, email }),
      });
      alert('File shared via email');
    } catch (err) {
      alert('Failed to share via email');
    }
  };

  const handleGeneratePublicLink = async () => {
    console.log('fileId:', fileId);  // Already present, will show UUID
    if (!fileId) {
        alert('File ID is missing');
        return;
    }
    try {
        const requestBody = { file_id: fileId };
        console.log('Generate public link request body:', requestBody);
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
        } else {
            alert(data.message || 'Failed to generate public link');
        }
    } catch (err) {
        alert('Failed to generate public link');
    }
};
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Share File</DialogTitle>
      <DialogContent>
        <TextField
          label="Email"
          fullWidth
          margin="normal"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button onClick={handleShareViaEmail} variant="contained" color="primary">Share via Email</Button>
        <Button onClick={handleGeneratePublicLink} variant="outlined" color="secondary" style={{ marginTop: '10px' }}>
          Generate Public Link
        </Button>
        {publicLink && <Typography>{publicLink}</Typography>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default ShareFile;