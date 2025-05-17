import React, { useState, useEffect } from 'react';
import { Button, Typography, Container, List, ListItem, ListItemText, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import ShareFile from './ShareFile';
import { useNavigate } from 'react-router-dom';

function FileManager({ token, setToken }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const navigate = useNavigate();

  const fetchFiles = async () => {
    try {
      const response = await fetch('http://localhost:5000/files', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      console.log('Fetched files:', data.files);
      setFiles(data.files || []);
    } catch (err) {
      alert('Failed to fetch files');
    }
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    try {
      await fetch('http://localhost:5000/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      fetchFiles();
    } catch (err) {
      alert('Failed to upload file');
    }
  };

  const handleDelete = async (fileId) => {
    try {
      await fetch(`http://localhost:5000/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchFiles();
    } catch (err) {
      alert('Failed to delete file');
    }
  };

  const handleShare = (fileId) => {
    console.log('Selected fileId:', fileId);
    setSelectedFile(fileId);
    setShareDialogOpen(true);
  };

  const handleDownload = async (fileId) => {
    try {
      const response = await fetch(`http://localhost:5000/files/${fileId}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to download file');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = files.find(file => file.id === fileId).name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download file: ' + err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    navigate('/login');
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>File Manager</Typography>
      <Button variant="contained" component="label">
        Upload File
        <input type="file" hidden onChange={handleUpload} />
      </Button>
      <Button variant="outlined" onClick={handleLogout} style={{ marginLeft: '10px' }}>Logout</Button>
      <List>
        {files.map((file) => (
          <ListItem key={file.id} secondaryAction={
            <>
              <IconButton onClick={() => handleDownload(file.id)}>
                <DownloadIcon />
              </IconButton>
              {!file.shared && (  // Only show share button for owned files
                <IconButton onClick={() => handleShare(file.id)}>
                  <ShareIcon />
                </IconButton>
              )}
              {!file.shared && (  // Only show delete button for owned files
                <IconButton onClick={() => handleDelete(file.id)}>
                  <DeleteIcon />
                </IconButton>
              )}
            </>
          }>
            <ListItemText
              primary={file.name}
              secondary={file.shared ? 'Shared with you' : 'Owned by you'}
            />
          </ListItem>
        ))}
      </List>
      <ShareFile
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        fileId={selectedFile}
        token={token}
      />
    </Container>
  );
}

export default FileManager;