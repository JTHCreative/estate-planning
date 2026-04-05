import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  registerUser, loginUser, logoutUser, getCurrentUser, getPartnerInfo,
  linkPartner, unlinkPartner,
} from '../lib/storage';
import type { StoredUser } from '../lib/storage';

export interface User {
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
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
  doLinkPartner: (partnerCode: string) => void;
  doUnlinkPartner: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function toUser(stored: StoredUser): User {
  const partner = getPartnerInfo(stored);
  return {
    id: stored.id,
    email: stored.email,
    firstName: stored.firstName,
    lastName: stored.lastName,
    partnerCode: stored.partnerCode,
    partnerId: stored.partnerId,
    partner: partner ? { id: partner.id, email: partner.email, firstName: partner.firstName, lastName: partner.lastName } : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = () => {
    const current = getCurrentUser();
    setUser(current ? toUser(current) : null);
  };

  useEffect(() => {
    refreshUser();
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const stored = await loginUser(email, password);
    setUser(toUser(stored));
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const stored = await registerUser(email, password, firstName, lastName);
    setUser(toUser(stored));
  };

  const logout = () => {
    logoutUser();
    setUser(null);
  };

  const doLinkPartner = (partnerCode: string) => {
    if (!user) return;
    linkPartner(user.id, partnerCode);
    refreshUser();
  };

  const doUnlinkPartner = () => {
    if (!user) return;
    unlinkPartner(user.id);
    refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, doLinkPartner, doUnlinkPartner, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
