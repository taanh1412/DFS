import React from 'react';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import CodeIcon from '@mui/icons-material/Code';
import ArchiveIcon from '@mui/icons-material/Archive';
import TableChartIcon from '@mui/icons-material/TableChart';

const FileTypeIcon = ({ fileName, sx = {} }) => {
  const extension = fileName ? fileName.split('.').pop().toLowerCase() : '';
  
  // Determine which icon to use based on file extension
  switch (extension) {
    // Images
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'bmp':
    case 'svg':
      return <ImageIcon sx={{ ...sx, color: '#4CAF50' }} />;
    
    // Documents
    case 'pdf':
      return <PictureAsPdfIcon sx={{ ...sx, color: '#FF5722' }} />;
    case 'doc':
    case 'docx':
      return <DescriptionIcon sx={{ ...sx, color: '#2196F3' }} />;
    case 'txt':
      return <DescriptionIcon sx={{ ...sx, color: '#607D8B' }} />;
      
    // Spreadsheets
    case 'xls':
    case 'xlsx':
    case 'csv':
      return <TableChartIcon sx={{ ...sx, color: '#4CAF50' }} />;
      
    // Audio
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <AudioFileIcon sx={{ ...sx, color: '#9C27B0' }} />;
      
    // Video
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'webm':
      return <VideoFileIcon sx={{ ...sx, color: '#FF9800' }} />;
      
    // Code
    case 'js':
    case 'jsx':
    case 'ts':
    case 'tsx':
    case 'html':
    case 'css':
    case 'py':
    case 'java':
    case 'php':
      return <CodeIcon sx={{ ...sx, color: '#03A9F4' }} />;
      
    // Archives
    case 'zip':
    case 'rar':
    case 'tar':
    case 'gz':
      return <ArchiveIcon sx={{ ...sx, color: '#795548' }} />;
      
    // Default
    default:
      return <InsertDriveFileIcon sx={{ ...sx, color: '#9E9E9E' }} />;
  }
};

export default FileTypeIcon;