import React from 'react';
import { Typography, Box, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

const RecentFiles = ({ files, onFileSelect }) => {
  // Take the most recent 5 files
  const recentFiles = [...files]
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 5);

  if (recentFiles.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>
        Recent Files
      </Typography>
      <List dense>
        {recentFiles.map((file) => (
          <ListItem 
            button 
            key={file.id}
            onClick={() => onFileSelect(file)}
          >
            <ListItemIcon>
              <InsertDriveFileIcon />
            </ListItemIcon>
            <ListItemText 
              primary={file.name} 
              secondary={file.shared ? 'Shared with you' : 'Owned by you'} 
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default RecentFiles;