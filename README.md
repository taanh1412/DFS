# DFS - Distributed File Storage System

![DFS File Manager](https://img.shields.io/badge/DFS-File%20Manager-blue)
![Version](https://img.shields.io/badge/Version-1.0-green)

A secure, distributed file storage system with an intuitive web interface that allows users to store, manage, share and preview files across a distributed network of storage nodes.

## Features

### File Management
- **Upload files** via drag-and-drop or file selection
- **Download files** from any device with access credentials
- **Delete files** you own
- **Automatic previews** for compatible file types (images, PDFs, text files, audio, video)
- **Advanced filtering** and sorting options by name, size, type, and date

### File Sharing
- **Share files via email** with other users
- **Generate public links** for files to share with non-registered users
- **View shared files** from other users

### User Management
- **User registration and authentication**
- **Profile management** with customizable details
- **Password changing** capability
- **View profiles** of users who have shared files with you

### System Features
- **Storage monitoring** with usage statistics
- **Real-time file list refresh** for collaborative environments
- **Distributed file storage** across multiple nodes
- **Fault tolerance** through data replication

## Architecture

DFS uses a distributed architecture with the following components:

### Backend
- **Supernode**: Central server that handles authentication, file metadata, and coordinates storage
- **Storage Nodes**: Distributed across multiple clusters for actual file storage
- **Kafka**: Message broker for async communication between components
- **Redis**: In-memory database for caching file metadata and sharing information
- **Flask**: REST API endpoints for frontend communication

### Frontend
- **React**: Modern, component-based UI
- **Material UI**: Consistent, responsive design components
- **React Router**: Navigation between different sections

## Screenshots

(Screenshots would be placed here)

## Installation

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.9+ (for backend development)

### Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/dfs.git
cd dfs
```

2. Start the backend services using Docker Compose
```bash
cd backend
docker-compose up -d
```

3. Start the frontend development server
```bash
cd ../frontend
npm install
npm start
```

4. Access the application at http://localhost:3000

## System Components

### Backend

1. **Supernode**
   - Authentication service
   - File metadata management
   - File distribution coordination
   - API endpoints for frontend

2. **Storage Nodes**
   - Organized in clusters for redundancy
   - Each node stores actual file data
   - Replicates files for fault tolerance

3. **Cluster Monitor**
   - Monitors health of clusters
   - Manages rebalancing of data
   - Handles node failures

### Frontend

1. **Authentication**
   - Login/Register pages
   - Token-based authentication

2. **File Manager**
   - Main interface for file operations
   - Drag-and-drop upload
   - List and grid view for files
   - Preview, share, and delete operations

3. **User Profile**
   - View and edit user details
   - Change password
   - View storage usage

## API Endpoints

The backend exposes several RESTful API endpoints, including:

- **Authentication**: `/login`, `/register`
- **Files**: `/files`, `/files/<file_id>/download`, `/files/<file_id>`
- **Sharing**: `/share/email`, `/share/public`
- **User**: `/profile`, `/users/<email>`

## Technologies Used

- **Frontend**: React, Material-UI, React Router, React PDF
- **Backend**: Python Flask, Redis, Kafka
- **DevOps**: Docker, Docker Compose
- **Communication**: REST API, WebSockets (for real-time updates)

## Development

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python supernode/app.py
```

### Frontend Development
```bash
cd frontend
npm install
npm start
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributors

- Your Name - Initial work

## Acknowledgments

- Thanks to all contributors who have helped with the development of this system

---
© 2025 DFS File Manager | Secure Distributed File System
