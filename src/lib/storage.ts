import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';

// --- Types ---

export interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  householdId: string;
  inviteCode: string;
  photoURL: string | null;
}

export interface HouseholdMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  photoURL: string | null;
}

export interface Institution {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  website: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: any;
}

export interface Account {
  id: string;
  institutionId: string;
  userId: string;
  accountName: string;
  accountType: string | null;
  accountNumber: string | null;
  routingNumber: string | null;
  username: string | null;
  passwordEncrypted: string | null;
  url: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  estimatedValue: string | null;
  beneficiary: string | null;
  notes: string | null;
  createdAt: any;
}

// --- User Profiles ---

export async function createUserProfile(uid: string, email: string, firstName: string, lastName: string): Promise<UserProfile> {
  const householdId = crypto.randomUUID();
  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const profile: UserProfile = {
    uid, email: email.toLowerCase(), firstName, lastName,
    householdId, inviteCode, photoURL: null,
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), updates);
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const data = snap.data() as any;
  // Migration: if old profile has partnerId but no householdId, migrate
  if (!data.householdId) {
    const householdId = crypto.randomUUID();
    const inviteCode = data.partnerCode || crypto.randomUUID().slice(0, 8).toUpperCase();
    await updateDoc(doc(db, 'users', uid), { householdId, inviteCode });
    data.householdId = householdId;
    data.inviteCode = inviteCode;
    // If they had a partner, migrate partner to same household
    if (data.partnerId) {
      const partnerSnap = await getDoc(doc(db, 'users', data.partnerId));
      if (partnerSnap.exists()) {
        await updateDoc(doc(db, 'users', data.partnerId), { householdId, inviteCode: partnerSnap.data().partnerCode || crypto.randomUUID().slice(0, 8).toUpperCase() });
      }
    }
  }
  return {
    uid: data.uid,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    householdId: data.householdId,
    inviteCode: data.inviteCode || data.partnerCode,
    photoURL: data.photoURL || null,
  };
}

// --- Household Members ---

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const q = query(collection(db, 'users'), where('householdId', '==', householdId));
  const snap = await getDocs(q);
  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: data.uid,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      photoURL: data.photoURL || null,
    };
  });
}

export async function joinHousehold(userId: string, inviteCode: string): Promise<void> {
  // Find any user with this invite code
  const q = query(collection(db, 'users'), where('inviteCode', '==', inviteCode));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Invalid invite code');

  const target = snap.docs[0].data();
  if (target.uid === userId) throw new Error('Cannot join your own household');

  const targetHouseholdId = target.householdId;
  if (!targetHouseholdId) throw new Error('Invalid household');

  // Update the joining user's householdId to the target's household
  await updateDoc(doc(db, 'users', userId), { householdId: targetHouseholdId });
}

export async function leaveHousehold(userId: string): Promise<void> {
  // Create a new solo household for this user
  const newHouseholdId = crypto.randomUUID();
  await updateDoc(doc(db, 'users', userId), { householdId: newHouseholdId });
}

export async function removeMemberFromHousehold(memberId: string): Promise<void> {
  // Same as leaving — give them their own household
  await leaveHousehold(memberId);
}

// --- Helper: visible user IDs ---

async function getVisibleUserIds(userId: string): Promise<string[]> {
  const profile = await getUserProfile(userId);
  if (!profile) return [userId];
  const members = await getHouseholdMembers(profile.householdId);
  return members.map(m => m.id);
}

// --- Institutions ---

export async function getInstitutions(userId: string, categoryId?: string): Promise<(Institution & { ownerName: string })[]> {
  const ids = await getVisibleUserIds(userId);
  const results: (Institution & { ownerName: string })[] = [];

  for (const uid of ids) {
    const profile = await getUserProfile(uid);
    const ownerName = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';

    let q;
    if (categoryId) {
      q = query(collection(db, 'institutions'), where('userId', '==', uid), where('categoryId', '==', categoryId), orderBy('name'));
    } else {
      q = query(collection(db, 'institutions'), where('userId', '==', uid), orderBy('name'));
    }
    const snap = await getDocs(q);
    snap.forEach(d => results.push({ ...(d.data() as Institution), id: d.id, ownerName }));
  }

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addInstitution(userId: string, data: Omit<Institution, 'id' | 'userId' | 'createdAt'>): Promise<Institution> {
  const ref = doc(collection(db, 'institutions'));
  const inst: Institution = { ...data, id: ref.id, userId, createdAt: serverTimestamp() };
  await setDoc(ref, inst);
  return inst;
}

export async function updateInstitution(id: string, updates: Partial<Institution>): Promise<void> {
  await updateDoc(doc(db, 'institutions', id), updates);
}

export async function deleteInstitution(id: string): Promise<void> {
  const q = query(collection(db, 'accounts'), where('institutionId', '==', id));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => batch.delete(d.ref));
  batch.delete(doc(db, 'institutions', id));
  await batch.commit();
}

// --- Accounts ---

export async function getAccounts(userId: string, institutionId?: string): Promise<(Account & { ownerName: string })[]> {
  const ids = await getVisibleUserIds(userId);
  const results: (Account & { ownerName: string })[] = [];

  for (const uid of ids) {
    const profile = await getUserProfile(uid);
    const ownerName = profile ? `${profile.firstName} ${profile.lastName}` : 'Unknown';

    let q;
    if (institutionId) {
      q = query(collection(db, 'accounts'), where('userId', '==', uid), where('institutionId', '==', institutionId));
    } else {
      q = query(collection(db, 'accounts'), where('userId', '==', uid));
    }
    const snap = await getDocs(q);
    snap.forEach(d => results.push({ ...(d.data() as Account), id: d.id, ownerName }));
  }

  return results.sort((a, b) => a.accountName.localeCompare(b.accountName));
}

export async function addAccount(userId: string, data: Omit<Account, 'id' | 'userId' | 'createdAt'>): Promise<Account> {
  const ref = doc(collection(db, 'accounts'));
  const acct: Account = { ...data, id: ref.id, userId, createdAt: serverTimestamp() };
  await setDoc(ref, acct);
  return acct;
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<void> {
  await updateDoc(doc(db, 'accounts', id), updates);
}

export async function deleteAccount(id: string): Promise<void> {
  await deleteDoc(doc(db, 'accounts', id));
}

// --- Stats ---

export async function getStats(userId: string) {
  const institutions = await getInstitutions(userId);
  const accounts = await getAccounts(userId);

  const categoryCounts = CATEGORIES.map(cat => ({
    ...cat,
    institution_count: institutions.filter(i => i.categoryId === cat.id).length,
    account_count: accounts.filter(a => institutions.some(i => i.id === a.institutionId && i.categoryId === cat.id)).length,
  }));

  return {
    totalInstitutions: institutions.length,
    totalAccounts: accounts.length,
    categoryCounts,
  };
}

// --- Categories (static) ---

export const CATEGORIES = [
  { id: 'bank-accounts', name: 'Bank Accounts', description: 'Checking, savings, money market, and CD accounts', icon: 'landmark', sort_order: 1 },
  { id: 'investment-accounts', name: 'Investment & Brokerage Accounts', description: 'Stocks, bonds, mutual funds, brokerage accounts', icon: 'trending-up', sort_order: 2 },
  { id: 'retirement-accounts', name: 'Retirement Accounts', description: '401(k), IRA, Roth IRA, pension plans', icon: 'piggy-bank', sort_order: 3 },
  { id: 'insurance-policies', name: 'Insurance Policies', description: 'Life, health, auto, home, umbrella, long-term care', icon: 'shield', sort_order: 4 },
  { id: 'real-estate', name: 'Real Estate & Property', description: 'Primary residence, rental properties, vacation homes, land', icon: 'home', sort_order: 5 },
  { id: 'vehicles', name: 'Vehicles & Transportation', description: 'Cars, boats, RVs, motorcycles', icon: 'car', sort_order: 6 },
  { id: 'business-interests', name: 'Business Interests', description: 'Business ownership, partnerships, LLCs', icon: 'briefcase', sort_order: 7 },
  { id: 'digital-assets', name: 'Digital Assets', description: 'Cryptocurrency, digital wallets, online accounts, domains', icon: 'globe', sort_order: 8 },
  { id: 'debts-liabilities', name: 'Debts & Liabilities', description: 'Mortgages, loans, credit cards, lines of credit', icon: 'credit-card', sort_order: 9 },
  { id: 'estate-documents', name: 'Estate Planning Documents', description: 'Wills, trusts, power of attorney, healthcare directives', icon: 'file-text', sort_order: 10 },
  { id: 'tax-records', name: 'Tax Records', description: 'Tax returns, accountant info, EIN numbers', icon: 'calculator', sort_order: 11 },
  { id: 'personal-property', name: 'Valuable Personal Property', description: 'Jewelry, art, collectibles, antiques, firearms', icon: 'gem', sort_order: 12 },
  { id: 'subscriptions', name: 'Subscriptions & Memberships', description: 'Recurring subscriptions, club memberships, loyalty programs', icon: 'repeat', sort_order: 13 },
  { id: 'social-media', name: 'Social Media & Email Accounts', description: 'Email, social media, cloud storage accounts', icon: 'at-sign', sort_order: 14 },
  { id: 'utilities', name: 'Utilities & Services', description: 'Electric, gas, water, internet, phone, trash', icon: 'zap', sort_order: 15 },
  { id: 'healthcare', name: 'Healthcare & Medical', description: 'Doctors, pharmacies, medical records, HSA/FSA', icon: 'heart-pulse', sort_order: 16 },
  { id: 'education', name: 'Education Accounts', description: '529 plans, student loans, education savings', icon: 'graduation-cap', sort_order: 17 },
  { id: 'trusts-entities', name: 'Trusts & Legal Entities', description: 'Family trusts, LLCs, corporations, foundations', icon: 'scale', sort_order: 18 },
  { id: 'emergency-contacts', name: 'Emergency Contacts & Advisors', description: 'Attorney, CPA, financial advisor, executor, emergency contacts', icon: 'phone', sort_order: 19 },
  { id: 'final-wishes', name: 'Final Wishes & Arrangements', description: 'Funeral preferences, burial/cremation, organ donation, obituary', icon: 'heart', sort_order: 20 },
];
