import React from 'react';
import { 
  Paper, Typography, Box, Button, Divider,
  IconButton, Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import DeleteIcon from '@mui/icons-material/Delete';

const FileDetails = ({ file, onClose, onDownload, onShare, onDelete, isOwner }) => {
  if (!file) return null;

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{file.name}</Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
      <Divider sx={{ mb: 2 }} />
      
      <Box sx={{ mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          Status: {file.shared ? 'Shared with you' : 'Owned by you'}
        </Typography>
      </Box>
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip title="Download">
          <Button 
            variant="contained" 
            size="small"
            startIcon={<DownloadIcon />}
            onClick={() => onDownload(file.id)}
          >
            Download
          </Button>
        </Tooltip>
        
        {isOwner && (
          <>
            <Tooltip title="Share">
              <Button 
                variant="outlined" 
                size="small"
                startIcon={<ShareIcon />}
                onClick={() => onShare(file.id)}
              >
                Share
              </Button>
            </Tooltip>
            
            <Tooltip title="Delete">
              <Button 
                variant="outlined" 
                color="error" 
                size="small"
                startIcon={<DeleteIcon />}
                onClick={() => onDelete(file.id)}
              >
                Delete
              </Button>
            </Tooltip>
          </>
        )}
      </Box>
    </Paper>
  );
};

export default FileDetails;