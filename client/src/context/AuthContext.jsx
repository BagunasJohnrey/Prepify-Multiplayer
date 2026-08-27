import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 1. Initialize from LocalStorage to persist state immediately on reload
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      // 2. Keep LocalStorage in sync with server data (hearts/xp changes)
      localStorage.setItem('user', JSON.stringify(data));
    } catch {
      // not authenticated or network error
      // If unauthorized, api interceptor handles redirect, but we clear state here
      if (error.response && error.response.status === 401) {
         localStorage.removeItem('token');
         localStorage.removeItem('user');
         setUser(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // The httpOnly cookie is the source of truth; always validate it on load.
    refreshUser();
  }, []);

  const login = (userData) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // ignore network errors; clear local state regardless
    }
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);