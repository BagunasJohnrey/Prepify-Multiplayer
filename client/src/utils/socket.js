import { io } from 'socket.io-client';

// Determine the base URL dynamically:
// The VITE_SOCKET_URL should be the Render URL (e.g., https://prepify-multiplayer.onrender.com)
const API_BASE_URL_RAW = import.meta.env.VITE_SOCKET_URL
    ? import.meta.env.VITE_SOCKET_URL
    : window.location.origin;

// CRITICAL FIX: Remove potential trailing slash from the base URL to prevent double slashes 
// (e.g., 'https://domain.com//socket.io/') when the explicit path is added below.
const API_BASE_URL = API_BASE_URL_RAW.endsWith('/') 
    ? API_BASE_URL_RAW.slice(0, -1) 
    : API_BASE_URL_RAW;

const socket = io(API_BASE_URL, {
    // path: '/socket.io/', // Removed (Relies on server/vercel configuration)
    
    // CHANGED: Prioritize Polling for better stability on serverless hosts
    transports: ['polling', 'websocket'], 
    
    forceNew: true,
    withCredentials: false,
    
    // Reduced timeout for faster failure/retry
    timeout: 15000, 
    reconnectionAttempts: 10 
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