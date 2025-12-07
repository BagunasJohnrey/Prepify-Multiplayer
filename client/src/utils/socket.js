import { io } from 'socket.io-client';

// Use the dedicated Socket URL set via Vercel env var
const API_BASE_URL = import.meta.env.VITE_SOCKET_URL;

const socket = io(API_BASE_URL, {
    path: '/socket.io/', 
    
    // Prioritize native WebSockets on Render, fallback to polling
    transports: ['websocket', 'polling'], 
    
    forceNew: true,
    withCredentials: false,
    
    // INCREASE TIMEOUT AND ATTEMPTS FOR COLD START
    timeout: 60000,           // Wait up to 60 seconds for initial connection
    reconnectionAttempts: 10  // Allow more retries
});

socket.on('connect', () => {
    console.log('Socket.IO connected:', socket.id);
});

socket.on('disconnect', () => {
    console.log('Socket.IO disconnected');
});

socket.on('connect_error', (err) => {
    console.error('Socket.IO Connection Error:', err.message);
});

export default socket;