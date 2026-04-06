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
  createUserProfile, getUserProfile, getHouseholdMembers,
  joinHousehold as joinHouseholdFn, leaveHousehold as leaveHouseholdFn,
  removeMemberFromHousehold as removeMemberFn,
  updateUserProfile,
} from '../lib/storage';
import type { UserProfile, HouseholdMember } from '../lib/storage';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  householdId: string;
  inviteCode: string;
  photoURL: string | null;
  householdMembers: HouseholdMember[];
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  leaveHousehold: () => Promise<void>;
  removeMember: (memberId: string) => Promise<void>;
  updatePhoto: (photoURL: string | null) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function profileToUser(profile: UserProfile): Promise<User> {
  let members: HouseholdMember[] = [];
  try {
    members = await getHouseholdMembers(profile.householdId);
  } catch {
    // May not be accessible yet
  }
  return {
    id: profile.uid,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    householdId: profile.householdId,
    inviteCode: profile.inviteCode,
    photoURL: profile.photoURL || null,
    householdMembers: members,
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
        if (fbUser) {
          setUser({
            id: fbUser.uid,
            email: fbUser.email || '',
            firstName: fbUser.displayName || 'User',
            lastName: '',
            householdId: '',
            inviteCode: '',
            photoURL: null,
            householdMembers: [],
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
      setUser({
        id: cred.user.uid,
        email: cred.user.email || '',
        firstName: '',
        lastName: '',
        householdId: '',
        inviteCode: '',
        photoURL: null,
        householdMembers: [],
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

  const joinHousehold = async (inviteCode: string) => {
    if (!user) return;
    await joinHouseholdFn(user.id, inviteCode);
    await refreshUser();
  };

  const leaveHousehold = async () => {
    if (!user) return;
    await leaveHouseholdFn(user.id);
    await refreshUser();
  };

  const removeMember = async (memberId: string) => {
    if (!user) return;
    await removeMemberFn(memberId);
    await refreshUser();
  };

  const updatePhoto = async (photoURL: string | null) => {
    if (!user) return;
    await updateUserProfile(user.id, { photoURL });
    setUser(prev => prev ? { ...prev, photoURL } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, joinHousehold, leaveHousehold, removeMember, updatePhoto, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
