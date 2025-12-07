import axios from 'axios';

// 1. Get the backend URL from Vercel environment variables
let baseUrl = import.meta.env.VITE_API_URL;

// 2. Fallback for local development if env var is missing
if (!baseUrl) {
    baseUrl = window.location.origin; // or 'http://localhost:3000'
}

// 3. CRITICAL FIX: Ensure the URL ends with '/api'
// If the variable is "https://myapp.onrender.com", this makes it "https://myapp.onrender.com/api"
if (!baseUrl.endsWith('/api')) {
    // Remove potential trailing slash then append /api
    baseUrl = baseUrl.replace(/\/$/, '') + '/api';
}

const api = axios.create({
  baseURL: baseUrl, 
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/'; 
    }
    return Promise.reject(error);
  }
);

export default api;