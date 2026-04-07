import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword as fbUpdatePassword,
  updateEmail as fbUpdateEmail,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import {
  createUserProfile, getUserProfile, getHouseholdMembers,
  joinHousehold as joinHouseholdFn, leaveHousehold as leaveHouseholdFn,
  removeMemberFromHousehold as removeMemberFn,
  updateUserProfile, setPin, clearPin,
} from '../lib/storage';
import type { UserProfile, HouseholdMember } from '../lib/storage';

export interface HouseholdInfo {
  id: string;
  members: HouseholdMember[];
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  householdId: string;
  householdIds: string[];
  inviteCode: string;
  photoURL: string | null;
  hasPin: boolean;
  householdMembers: HouseholdMember[]; // union of all members across all households
  households: HouseholdInfo[]; // detailed list of each household with its members
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  joinHousehold: (inviteCode: string) => Promise<void>;
  leaveHousehold: (householdId?: string) => Promise<void>;
  removeMember: (memberId: string, householdId: string) => Promise<void>;
  updatePhoto: (photoURL: string | null) => Promise<void>;
  updateName: (firstName: string, lastName: string) => Promise<void>;
  updateUserEmail: (newEmail: string, currentPassword: string) => Promise<void>;
  updateUserPassword: (currentPassword: string, newPassword: string) => Promise<void>;
  setUserPin: (pin: string) => Promise<void>;
  clearUserPin: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

async function profileToUser(profile: UserProfile): Promise<User> {
  const households: HouseholdInfo[] = [];
  const seen = new Set<string>();
  const allMembers: HouseholdMember[] = [];

  for (const hid of profile.householdIds) {
    try {
      const members = await getHouseholdMembers(hid);
      households.push({ id: hid, members });
      for (const m of members) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          allMembers.push(m);
        }
      }
    } catch {
      // May not be accessible yet
    }
  }

  return {
    id: profile.uid,
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    householdId: profile.householdId,
    householdIds: profile.householdIds,
    inviteCode: profile.inviteCode,
    photoURL: profile.photoURL || null,
    hasPin: !!profile.pinHash,
    householdMembers: allMembers,
    households,
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
            householdIds: [],
            inviteCode: '',
            photoURL: null,
            hasPin: false,
            householdMembers: [],
            households: [],
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
        householdIds: [],
        inviteCode: '',
        photoURL: null,
        hasPin: false,
        householdMembers: [],
        households: [],
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

  const leaveHousehold = async (householdId?: string) => {
    if (!user) return;
    await leaveHouseholdFn(user.id, householdId);
    await refreshUser();
  };

  const removeMember = async (memberId: string, householdId: string) => {
    if (!user) return;
    await removeMemberFn(memberId, householdId);
    await refreshUser();
  };

  const updatePhoto = async (photoURL: string | null) => {
    if (!user) return;
    await updateUserProfile(user.id, { photoURL });
    setUser(prev => prev ? { ...prev, photoURL } : prev);
  };

  const updateName = async (firstName: string, lastName: string) => {
    if (!user) return;
    await updateUserProfile(user.id, { firstName, lastName });
    setUser(prev => prev ? { ...prev, firstName, lastName } : prev);
  };

  const updateUserEmail = async (newEmail: string, currentPassword: string) => {
    if (!user || !auth.currentUser) return;
    // Re-authenticate first
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, cred);
    // Update Firebase Auth email
    await fbUpdateEmail(auth.currentUser, newEmail);
    // Update Firestore profile
    await updateUserProfile(user.id, { email: newEmail.toLowerCase() });
    setUser(prev => prev ? { ...prev, email: newEmail.toLowerCase() } : prev);
  };

  const updateUserPassword = async (currentPassword: string, newPassword: string) => {
    if (!user || !auth.currentUser) return;
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, cred);
    await fbUpdatePassword(auth.currentUser, newPassword);
  };

  const setUserPin = async (pin: string) => {
    if (!user) return;
    await setPin(user.id, pin);
    setUser(prev => prev ? { ...prev, hasPin: true } : prev);
  };

  const clearUserPin = async () => {
    if (!user) return;
    await clearPin(user.id);
    setUser(prev => prev ? { ...prev, hasPin: false } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, joinHousehold, leaveHousehold, removeMember, updatePhoto, updateName, updateUserEmail, updateUserPassword, setUserPin, clearUserPin, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
