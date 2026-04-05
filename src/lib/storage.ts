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
  partnerCode: string;
  partnerId: string | null;
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
  const partnerCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const profile: UserProfile = { uid, email: email.toLowerCase(), firstName, lastName, partnerCode, partnerId: null };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}

export async function getPartnerProfile(user: UserProfile): Promise<UserProfile | null> {
  if (!user.partnerId) return null;
  return getUserProfile(user.partnerId);
}

export async function linkPartner(userId: string, partnerCode: string): Promise<void> {
  // Find partner by code
  const q = query(collection(db, 'users'), where('partnerCode', '==', partnerCode));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Invalid partner code');

  const partner = snap.docs[0].data() as UserProfile;
  if (partner.uid === userId) throw new Error('Cannot link to yourself');
  if (partner.partnerId && partner.partnerId !== userId) throw new Error('That user is already linked to another partner');

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), { partnerId: partner.uid });
  batch.update(doc(db, 'users', partner.uid), { partnerId: userId });
  await batch.commit();
}

export async function unlinkPartner(userId: string): Promise<void> {
  const profile = await getUserProfile(userId);
  if (!profile?.partnerId) return;

  const batch = writeBatch(db);
  batch.update(doc(db, 'users', userId), { partnerId: null });
  batch.update(doc(db, 'users', profile.partnerId), { partnerId: null });
  await batch.commit();
}

// --- Helper: visible user IDs ---

async function getVisibleUserIds(userId: string): Promise<string[]> {
  const profile = await getUserProfile(userId);
  const ids = [userId];
  if (profile?.partnerId) ids.push(profile.partnerId);
  return ids;
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
  // Delete all accounts under this institution first
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
