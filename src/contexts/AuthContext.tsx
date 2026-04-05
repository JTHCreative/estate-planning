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
  let partner = null;
  try {
    partner = await getPartnerProfile(profile);
  } catch {
    // Partner profile may not be accessible yet
  }
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
    try {
      const profile = await getUserProfile(fbUser.uid);
      if (profile) {
        setUser(await profileToUser(profile));
      }
    } catch (err) {
      console.error('refreshUser error:', err);
    }
  };

  useEffect(() => {
    // Safety timeout — never stay on loading screen more than 5 seconds
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const profile = await getUserProfile(fbUser.uid);
          if (profile) {
            setUser(await profileToUser(profile));
          } else {
            // Auth exists but no Firestore profile — create one from auth data
            const newProfile = await createUserProfile(
              fbUser.uid,
              fbUser.email || '',
              fbUser.displayName?.split(' ')[0] || 'User',
              fbUser.displayName?.split(' ').slice(1).join(' ') || '',
            );
            setUser(await profileToUser(newProfile));
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Auth state error:', err);
        // If Firestore fails, still set a minimal user from Firebase Auth
        if (fbUser) {
          setUser({
            id: fbUser.uid,
            email: fbUser.email || '',
            firstName: fbUser.displayName || 'User',
            lastName: '',
            partnerCode: '',
            partnerId: null,
          });
        } else {
          setUser(null);
        }
      }
      clearTimeout(timeout);
      setLoading(false);
    }, (err) => {
      console.error('Auth listener error:', err);
      clearTimeout(timeout);
      setLoading(false);
    });

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    try {
      const profile = await getUserProfile(cred.user.uid);
      if (profile) {
        setUser(await profileToUser(profile));
      }
    } catch (err) {
      console.error('Login profile fetch error:', err);
      // Still set a minimal user so we don't get stuck on loading
      setUser({
        id: cred.user.uid,
        email: cred.user.email || '',
        firstName: '',
        lastName: '',
        partnerCode: '',
        partnerId: null,
      });
    }
    setLoading(false);
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const profile = await createUserProfile(cred.user.uid, email, firstName, lastName);
    setUser(await profileToUser(profile));
    setLoading(false);
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
