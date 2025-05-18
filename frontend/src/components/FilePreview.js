import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, 
  Button, Box, Typography, IconButton, CircularProgress,
  Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

// Need to set worker path for PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;

function FilePreview({ open, onClose, file, token, onDownload }) {
  const [isLoading, setIsLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState(null);
  const [error, setError] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  
  // For PDF preview
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);

  React.useEffect(() => {
    if (open && file) {
      loadFilePreview();
    }
    return () => {
      // Cleanup URL when component unmounts or file changes
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [open, file]);

  const loadFilePreview = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`http://localhost:5000/files/${file.id}/download`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      
      if (!response.ok) {
        throw new Error('Failed to load file preview');
      }
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setFileUrl(url);
    } catch (err) {
      setError('Failed to load file preview: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getFileType = () => {
    if (!file || !file.name) return 'unknown';
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    // Image files
    if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
      return 'image';
    }
    
    // PDF files
    if (extension === 'pdf') {
      return 'pdf';
    }
    
    // Text files
    if (['txt', 'md', 'rtf', 'csv', 'json', 'xml', 'html', 'css', 'js', 'py', 'sh'].includes(extension)) {
      return 'text';
    }
    
    // Audio files
    if (['mp3', 'wav', 'ogg', 'aac', 'flac'].includes(extension)) {
      return 'audio';
    }
    
    // Video files
    if (['mp4', 'webm', 'ogv', 'mov', 'avi'].includes(extension)) {
      return 'video';
    }
    
    return 'unknown';
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const handleNextPage = () => {
    setPageNumber(prevPageNumber => Math.min(prevPageNumber + 1, numPages));
  };

  const handlePrevPage = () => {
    setPageNumber(prevPageNumber => Math.max(prevPageNumber - 1, 1));
  };

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
  };

  const renderPreview = () => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
          <CircularProgress />
        </Box>
      );
    }

    if (error) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: 400,
          flexDirection: 'column',
          p: 3 
        }}>
          <Typography color="error" gutterBottom align="center">
            {error}
          </Typography>
          <Button 
            variant="contained" 
            onClick={onDownload} 
            startIcon={<DownloadIcon />}
            sx={{ mt: 2 }}
          >
            Download Instead
          </Button>
        </Box>
      );
    }

    const fileType = getFileType();
    
    switch (fileType) {
      case 'image':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            overflow: 'auto',
            maxHeight: fullscreen ? '80vh' : '400px'
          }}>
            <img 
              src={fileUrl} 
              alt={file.name} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: fullscreen ? '80vh' : '400px',
                objectFit: 'contain'
              }} 
            />
          </Box>
        );

      case 'pdf':
        return (
          <Box sx={{ 
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflow: 'auto',
            maxHeight: fullscreen ? '80vh' : '400px'
          }}>
            <Document
              file={fileUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={<CircularProgress />}
              error={<Typography color="error">Failed to load PDF</Typography>}
            >
              <Page 
                pageNumber={pageNumber} 
                renderTextLayer={true}
                renderAnnotationLayer={true}
                width={fullscreen ? 800 : 600}
              />
            </Document>
            
            {numPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2, gap: 2 }}>
                <Button 
                  onClick={handlePrevPage} 
                  disabled={pageNumber <= 1}
                  variant="outlined"
                >
                  Previous
                </Button>
                <Typography>
                  Page {pageNumber} of {numPages}
                </Typography>
                <Button 
                  onClick={handleNextPage} 
                  disabled={pageNumber >= numPages}
                  variant="outlined"
                >
                  Next
                </Button>
              </Box>
            )}
          </Box>
        );

      case 'text':
        return (
          <Box sx={{ 
            overflow: 'auto',
            maxHeight: fullscreen ? '80vh' : '400px',
            width: '100%'
          }}>
            <iframe 
              src={fileUrl} 
              title={file.name}
              style={{ 
                width: '100%', 
                height: fullscreen ? '70vh' : '380px',
                border: '1px solid #eee',
                borderRadius: 4
              }}
            />
          </Box>
        );

      case 'audio':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center',
            p: 3
          }}>
            <Typography variant="h6" gutterBottom>{file.name}</Typography>
            <audio controls src={fileUrl} style={{ width: '100%' }}>
              Your browser does not support the audio element.
            </audio>
          </Box>
        );

      case 'video':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center',
            overflow: 'auto',
            maxHeight: fullscreen ? '80vh' : '400px'
          }}>
            <video 
              controls 
              src={fileUrl} 
              style={{ 
                maxWidth: '100%', 
                maxHeight: fullscreen ? '80vh' : '400px' 
              }}
            >
              Your browser does not support the video element.
            </video>
          </Box>
        );

      default:
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: 300,
            flexDirection: 'column',
            p: 3 
          }}>
            <Typography variant="h6" gutterBottom>
              Preview not available
            </Typography>
            <Typography variant="body2" color="textSecondary" align="center" gutterBottom>
              This file type cannot be previewed. You can download it instead.
            </Typography>
            <Button 
              variant="contained" 
              onClick={onDownload} 
              startIcon={<DownloadIcon />}
              sx={{ mt: 2 }}
            >
              Download File
            </Button>
          </Box>
        );
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={fullscreen}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between',
        alignItems: 'center',
        bgcolor: 'primary.main',
        color: 'primary.contrastText'
      }}>
        <Typography variant="h6" component="div" sx={{ 
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '80%'
        }}>
          {file ? file.name : 'File Preview'}
        </Typography>
        <Box>
          <IconButton
            color="inherit"
            onClick={toggleFullscreen}
            edge="start"
          >
            {fullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
          </IconButton>
          <IconButton
            color="inherit"
            onClick={onClose}
            edge="end"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      
      <DialogContent dividers sx={{ 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullscreen ? '80vh' : '400px'
      }}>
        {renderPreview()}
      </DialogContent>
      
      <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
        <Button onClick={onClose} variant="outlined">
          Close
        </Button>
        <Button 
          onClick={onDownload} 
          variant="contained" 
          startIcon={<DownloadIcon />}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default FilePreview;