import React, { useState, useEffect } from 'react';
import { 
  Button, Typography, Container, List, ListItem, ListItemText, 
  IconButton, TextField, Box, CircularProgress, FormControl, 
  InputLabel, Select, MenuItem, AppBar, Toolbar, Paper, Grid,
  Card, CardContent, CardActions, CardMedia, ToggleButtonGroup, ToggleButton,
  Tooltip, Divider, LinearProgress
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShareIcon from '@mui/icons-material/Share';
import DownloadIcon from '@mui/icons-material/Download';
import SearchIcon from '@mui/icons-material/Search';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import LogoutIcon from '@mui/icons-material/Logout';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FileTypeIcon from './FileTypeIcon';
import ShareFile from './ShareFile';
import RecentFiles from './RecentFiles';
import FileDetails from './FileDetails';
import { useNavigate } from 'react-router-dom';

function FileManager({ token, setToken }) {
  // Existing state variables
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sortOption, setSortOption] = useState('nameAsc');
  const [selectedFileDetails, setSelectedFileDetails] = useState(null);
  const [showRecentFiles, setShowRecentFiles] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [fileTypeFilter, setFileTypeFilter] = useState('all');
  const [isDragging, setIsDragging] = useState(false);
  
  // Storage usage state variables
  const [usagePercent, setUsagePercent] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0); // in bytes
  const MAX_STORAGE_BYTES = 107374182400; // 100GB in bytes
  
  const navigate = useNavigate();

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:5000/files', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      console.log('Fetched files:', data.files);
      
      // Store recent uploads in localStorage
      const now = new Date().getTime();
      const filesWithTimestamp = data.files ? data.files.map(file => ({
        ...file,
        timestamp: now
      })) : [];
      
      setFiles(filesWithTimestamp || []);
      applyFiltersAndSort(filesWithTimestamp || [], searchQuery, sortOption);
    } catch (err) {
      alert('Failed to fetch files');
    } finally {
      setIsLoading(false);
    }
  };

  // Format bytes to human readable size
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Calculate storage usage based on actual file sizes
  useEffect(() => {
    if (files && files.length > 0) {
      // Calculate total size in bytes
      const totalSizeBytes = files.reduce((total, file) => {
        // Make sure file.size exists and is a number
        const fileSize = file.size ? Number(file.size) : 0;
        return total + fileSize;
      }, 0);
      
      // Set storage used in bytes
      setStorageUsed(totalSizeBytes);
      
      // Calculate percentage
      const percentage = (totalSizeBytes / MAX_STORAGE_BYTES) * 100;
      setUsagePercent(Math.min(percentage, 100)); // Cap at 100%
    } else {
      setStorageUsed(0);
      setUsagePercent(0);
    }
  }, [files]);

  const applyFiltersAndSort = (fileList, query, sort) => {
    let result = [...fileList];
    
    // Apply search filter
    if (query) {
      result = result.filter(file => 
        file.name.toLowerCase().includes(query.toLowerCase())
      );
    }
    
    // Apply sorting
    switch (sort) {
      case 'nameAsc':
        result = result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'nameDesc':
        result = result.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'recent':
        result = result.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        break;
      default:
        break;
    }
    
    setFilteredFiles(result);
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  // Apply filters when search query or sort option changes
  useEffect(() => {
    applyFiltersAndSort(files, searchQuery, sortOption);
  }, [searchQuery, sortOption, files]);

  const handleSearch = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleSortChange = (event) => {
    setSortOption(event.target.value);
  };

  // Add a function to handle view mode changes
  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  // Add function to handle file type filter changes
  const handleFileTypeFilterChange = (event) => {
    setFileTypeFilter(event.target.value);
    
    // Apply file type filtering along with other filters
    let filteredByType = [...files];
    
    if (event.target.value !== 'all') {
      filteredByType = files.filter(file => {
        const extension = file.name.split('.').pop().toLowerCase();
        
        switch(event.target.value) {
          case 'images':
            return ['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension);
          case 'documents':
            return ['pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(extension);
          case 'videos':
            return ['mp4', 'avi', 'mov', 'wmv'].includes(extension);
          case 'audio':
            return ['mp3', 'wav', 'ogg', 'flac'].includes(extension);
          default:
            return true;
        }
      });
    }
    
    applyFiltersAndSort(filteredByType, searchQuery, sortOption);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    await uploadFile(file);
  };

  // Extract upload logic to a separate function for reuse
  const uploadFile = async (file) => {
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    try {
      await fetch('http://localhost:5000/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });
      fetchFiles();
    } catch (err) {
      alert('Failed to upload file');
    } finally {
      setIsLoading(false);
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

  const handleFileSelect = (file) => {
    setSelectedFileDetails(file);
  };
  
  // Toggle recent files visibility
  const toggleRecentFiles = () => {
    setShowRecentFiles(!showRecentFiles);
  };
  
  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      uploadFile(file);
    }
  };
  
  return (
    <>
      {/* Navigation Bar remains the same */}
      <AppBar position="static" color="primary" sx={{ mb: 4 }}>
        <Toolbar>
          <FolderOpenIcon sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            DFS File Manager
          </Typography>
          <Button 
            color="inherit" 
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            disabled={isLoading}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg">
        {/* File Details Panel remains the same */}
        <FileDetails
          file={selectedFileDetails}
          onClose={() => setSelectedFileDetails(null)}
          onDownload={handleDownload}
          onShare={handleShare}
          onDelete={handleDelete}
          isOwner={selectedFileDetails && !selectedFileDetails.shared}
        />
        
        {/* Recent Files Section remains the same */}
        <Paper 
          elevation={1} 
          sx={{ 
            p: 2, 
            mb: 3, 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="h6">Recent Files</Typography>
          <Button 
            variant="text" 
            color="primary"
            onClick={toggleRecentFiles}
            endIcon={showRecentFiles ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {showRecentFiles ? 'Hide' : 'Show'}
          </Button>
        </Paper>
        
        {showRecentFiles && (
          <RecentFiles 
            files={files} 
            onFileSelect={handleFileSelect}
          />
        )}
        
        {/* Enhanced Drag & Drop Upload Area */}
        <Paper
          elevation={isDragging ? 3 : 1}
          sx={{
            p: 3,
            mb: 3,
            border: isDragging ? '2px dashed #1976d2' : '2px dashed #e0e0e0',
            borderRadius: 2,
            backgroundColor: isDragging ? 'rgba(25, 118, 210, 0.04)' : 'transparent',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CloudUploadIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            {isDragging ? 'Drop to Upload' : 'Drag & Drop Files Here'}
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center" gutterBottom>
            or
          </Typography>
          <Button variant="contained" component="label" disabled={isLoading}>
            Browse Files
            <input type="file" hidden onChange={handleUpload} />
          </Button>
        </Paper>
        
        {/* Enhanced Storage Usage Indicator */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2">
              Storage Usage
            </Typography>
            <Typography variant="subtitle2" fontWeight="medium">
              {formatBytes(storageUsed)} / 100 GB
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={usagePercent} 
            sx={{ 
              height: 8, 
              borderRadius: 5,
              backgroundColor: 'rgba(0,0,0,0.1)',
              '& .MuiLinearProgress-bar': {
                bgcolor: usagePercent > 90 ? 'error.main' : 
                         usagePercent > 75 ? 'warning.main' : 'primary.main'
              }
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {usagePercent.toFixed(1)}% used
            </Typography>
            <Typography variant="caption" color={usagePercent > 90 ? "error" : "text.secondary"}>
              {formatBytes(MAX_STORAGE_BYTES - storageUsed)} free
            </Typography>
          </Box>
        </Paper>
        
        {/* Enhanced Search and Filter Controls */}
        <Box sx={{ display: 'flex', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          {/* Search Box */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: '250px' }}>
            <SearchIcon sx={{ mr: 1 }} />
            <TextField
              fullWidth
              size="small"
              placeholder="Search files..."
              value={searchQuery}
              onChange={handleSearch}
              variant="outlined"
            />
          </Box>
          
          {/* File Type Filter */}
          <FormControl size="small" sx={{ minWidth: '150px' }}>
            <InputLabel>File Type</InputLabel>
            <Select
              value={fileTypeFilter}
              onChange={handleFileTypeFilterChange}
              label="File Type"
            >
              <MenuItem value="all">All Files</MenuItem>
              <MenuItem value="images">Images</MenuItem>
              <MenuItem value="documents">Documents</MenuItem>
              <MenuItem value="videos">Videos</MenuItem>
              <MenuItem value="audio">Audio</MenuItem>
            </Select>
          </FormControl>
          
          {/* Sort Options */}
          <FormControl size="small" sx={{ minWidth: '150px' }}>
            <InputLabel>Sort By</InputLabel>
            <Select
              value={sortOption}
              onChange={handleSortChange}
              label="Sort By"
            >
              <MenuItem value="nameAsc">Name (A-Z)</MenuItem>
              <MenuItem value="nameDesc">Name (Z-A)</MenuItem>
              <MenuItem value="recent">Recently Added</MenuItem>
            </Select>
          </FormControl>
          
          {/* View Toggle */}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            aria-label="view mode"
            size="small"
          >
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon />
            </ToggleButton>
            <ToggleButton value="grid" aria-label="grid view">
              <ViewModuleIcon />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        
        {/* File Display Area */}
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {filteredFiles.length > 0 ? (
              viewMode === 'list' ? (
                /* List View - similar to your current implementation */
                <List>
                  {filteredFiles.map((file) => (
                    <ListItem 
                      key={file.id} 
                      onClick={() => handleFileSelect(file)}
                      sx={{ 
                        cursor: 'pointer',
                        borderBottom: '1px solid #eee',
                        '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' }
                      }}
                      secondaryAction={
                        <>
                          <IconButton onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDownload(file.id); 
                          }}>
                            <DownloadIcon />
                          </IconButton>
                          {!file.shared && (
                            <IconButton onClick={(e) => { 
                              e.stopPropagation(); 
                              handleShare(file.id); 
                            }}>
                              <ShareIcon />
                            </IconButton>
                          )}
                          {!file.shared && (
                            <IconButton onClick={(e) => { 
                              e.stopPropagation(); 
                              handleDelete(file.id); 
                            }}>
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </>
                      }
                    >
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <FileTypeIcon fileName={file.name} sx={{ mr: 1 }} />
                            <Typography>{file.name}</Typography>
                          </Box>
                        }
                        secondary={file.shared ? 'Shared with you' : 'Owned by you'}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                /* Grid View - new implementation */
                <Grid container spacing={2}>
                  {filteredFiles.map((file) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={file.id}>
                      <Card 
                        sx={{ 
                          height: '100%', 
                          display: 'flex', 
                          flexDirection: 'column',
                          cursor: 'pointer',
                          '&:hover': { 
                            boxShadow: 6, 
                            transform: 'translateY(-2px)',
                            transition: 'all 0.2s'
                          }
                        }}
                        onClick={() => handleFileSelect(file)}
                      >
                        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 2 }}>
                          <FileTypeIcon fileName={file.name} sx={{ fontSize: 60, mb: 2 }} />
                          <Typography variant="subtitle1" noWrap title={file.name}>
                            {file.name}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {file.shared ? 'Shared with you' : 'Owned by you'}
                          </Typography>
                        </CardContent>
                        <Divider />
                        <CardActions sx={{ justifyContent: 'center', px: 1 }}>
                          <Tooltip title="Download">
                            <IconButton 
                              size="small" 
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                handleDownload(file.id); 
                              }}
                            >
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {!file.shared && (
                            <Tooltip title="Share">
                              <IconButton 
                                size="small" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleShare(file.id); 
                                }}
                              >
                                <ShareIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                          
                          {!file.shared && (
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small"
                                color="error" 
                                onClick={(e) => { 
                                  e.stopPropagation(); 
                                  handleDelete(file.id); 
                                }}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="h6" color="textSecondary">
                  {searchQuery ? 'No files match your search' : 'No files found'}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  {searchQuery 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Upload your first file to get started'}
                </Typography>
              </Paper>
            )}
          </>
        )}
        
        {/* Share Dialog - Keep as is */}
        <ShareFile
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          fileId={selectedFile}
          token={token}
        />
        
        {/* New Footer Component */}
        <Paper 
          component="footer" 
          sx={{ 
            p: 3, 
            mt: 4, 
            mb: 2, 
            textAlign: 'center',
            borderRadius: 2
          }}
        >
          <Typography variant="body2" color="textSecondary">
            © {new Date().getFullYear()} DFS File Manager | Secure Distributed File System
          </Typography>
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            Version 1.0
          </Typography>
        </Paper>
      </Container>
    </>
  );
}

export default FileManager;