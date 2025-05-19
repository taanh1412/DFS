import React, { useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import FileManager from './components/FileManager';
import UserProfile from './components/UserProfile'; // Add this import
import theme from './theme';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');

  return (
    <ThemeProvider theme={theme}>
      <Router>
        <Routes>
          <Route path="/login" element={token ? <Navigate to="/files" /> : <Login setToken={setToken} />} />
          <Route path="/register" element={token ? <Navigate to="/files" /> : <Register setToken={setToken} />} />
          <Route path="/files" element={token ? <FileManager token={token} setToken={setToken} /> : <Navigate to="/login" />} />
          <Route path="/profile" element={token ? <UserProfile token={token} /> : <Navigate to="/login" />} /> {/* Add this route */}
          <Route path="/" element={<Navigate to={token ? "/files" : "/login"} />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;