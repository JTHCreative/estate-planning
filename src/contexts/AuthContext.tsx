import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  partnerCode: string;
  partnerId: string | null;
  partner?: { id: string; email: string; firstName: string; lastName: string } | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export { apiFetch };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const data = await apiFetch('/auth/me');
      setUser(data);
    } catch {
      setToken(null);
      setUser(null);
      localStorage.removeItem('token');
    }
  };

  useEffect(() => {
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, refreshUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
