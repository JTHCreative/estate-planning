import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createUserProfile, getUserProfile, getPartnerProfile,
  linkPartner as linkPartnerFn, unlinkPartner as unlinkPartnerFn,
} from '../lib/storage';
import type { UserProfile } from '../lib/storage';

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
  refreshUser: () => Promise<void>;
  doLinkPartner: (partnerCode: string) => Promise<void>;
  doUnlinkPartner: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function profileToUser(profile: UserProfile): Promise<User> {
  const partner = await getPartnerProfile(profile);
  return {
    id: profile.uid,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    partnerCode: profile.partnerCode,
    partnerId: profile.partnerId,
    partner: partner ? { id: partner.uid, email: partner.email, firstName: partner.firstName, lastName: partner.lastName } : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) { setUser(null); return; }
    const profile = await getUserProfile(fbUser.uid);
    if (profile) {
      setUser(await profileToUser(profile));
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const profile = await getUserProfile(fbUser.uid);
          if (profile) {
            setUser(await profileToUser(profile));
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state error:', err);
        setUser(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('Auth listener error:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getUserProfile(cred.user.uid);
    if (profile) setUser(await profileToUser(profile));
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = await createUserProfile(cred.user.uid, email, firstName, lastName);
    setUser(await profileToUser(profile));
  };

  const logout = () => {
    signOut(auth);
    setUser(null);
  };

  const doLinkPartner = async (partnerCode: string) => {
    if (!user) return;
    await linkPartnerFn(user.id, partnerCode);
    await refreshUser();
  };

  const doUnlinkPartner = async () => {
    if (!user) return;
    await unlinkPartnerFn(user.id);
    await refreshUser();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, doLinkPartner, doUnlinkPartner, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
