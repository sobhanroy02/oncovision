import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  clearSession,
  loadSession,
  loadTheme,
  registerUser,
  saveTheme,
  updateSessionUser,
  loginUser,
} from '../services/authStore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [theme] = useState(loadTheme());
  const [session, setSession] = useState(loadSession());

  useEffect(() => {
    document.body.dataset.theme = 'light';
    saveTheme('light');
  }, [theme]);

  const value = useMemo(() => ({
    theme: 'light',
    setTheme: () => {},
    session,
    user: session,
    isAuthenticated: !!session,
    login: (payload) => {
      const user = loginUser(payload);
      setSession(user);
      return user;
    },
    register: (payload) => {
      const user = registerUser(payload);
      setSession(user);
      return user;
    },
    logout: () => {
      clearSession();
      setSession(null);
    },
    updateProfile: (updates) => {
      const next = updateSessionUser(updates);
      setSession(next);
      return next;
    },
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
