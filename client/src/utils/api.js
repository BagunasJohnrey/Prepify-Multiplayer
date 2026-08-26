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
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('user');
      // Only redirect when on a protected route. On public pages a 401 just means
      // "not logged in" and must NOT trigger a redirect loop (which also floods the
      // rate limiter and opens endless socket connections).
      const path = window.location.pathname;
      const protectedPrefixes = ['/dashboard', '/quiz', '/result'];
      const isProtected = protectedPrefixes.some(
        (p) => path === p || path.startsWith(p + '/')
      );
      if (isProtected) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;