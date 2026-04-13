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
  householdId: string; // primary household (for backwards compat)
  householdIds: string[]; // all households the user belongs to
  inviteCode: string; // legacy personal invite code
  photoURL: string | null;
  pinHash: string | null;
  deletionScheduledAt?: string | null; // ISO timestamp when deletion was requested
}

export interface Household {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: any;
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
  coOwnerIds?: string[];
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

// --- PIN hashing ---

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'estate-planning-pin-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(uid: string, pin: string): Promise<boolean> {
  const profile = await getUserProfile(uid);
  if (!profile?.pinHash) return false;
  const hash = await hashPin(pin);
  return hash === profile.pinHash;
}

export async function setPin(uid: string, pin: string): Promise<void> {
  const pinHash = await hashPin(pin);
  await updateDoc(doc(db, 'users', uid), { pinHash });
}

export async function clearPin(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { pinHash: null });
}

// --- Field encryption (AES-GCM with PIN-derived key) ---

const ENCRYPTION_SALT = new TextEncoder().encode('estate-planning-aes-salt-v1');

export async function deriveKeyFromPin(pin: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: ENCRYPTION_SALT, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

export async function encryptWithKey(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(plaintext);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  return `enc:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(ct))}`;
}

export async function decryptWithKey(value: string, key: CryptoKey): Promise<string> {
  if (!isEncrypted(value)) return value;
  const parts = value.split(':');
  if (parts.length !== 3) return value;
  const iv = base64ToBytes(parts[1]);
  const ct = base64ToBytes(parts[2]);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ct as BufferSource,
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return '[decryption failed]';
  }
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('enc:');
}

export function isHint(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith('hint:');
}

export function getHintText(value: string): string {
  return value.startsWith('hint:') ? value.slice(5) : value;
}

// --- User Profiles ---

export async function createUserProfile(uid: string, email: string, firstName: string, lastName: string): Promise<UserProfile> {
  // New users start with NO household; they choose to create or join one in Settings
  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase();
  const profile: UserProfile = {
    uid, email: email.toLowerCase(), firstName, lastName,
    householdId: '', householdIds: [], inviteCode, photoURL: null, pinHash: null,
  };
  await setDoc(doc(db, 'users', uid), profile);
  return profile;
}

// --- Household documents ---

function generateInviteCode(): string {
  return crypto.randomUUID().slice(0, 8).toUpperCase();
}

export async function createHousehold(userId: string, name: string): Promise<Household> {
  const householdId = crypto.randomUUID();
  const inviteCode = generateInviteCode();
  const household: Household = {
    id: householdId,
    name: name.trim() || 'My Household',
    inviteCode,
    createdBy: userId,
    createdAt: serverTimestamp(),
  };
  await setDoc(doc(db, 'households', householdId), household);

  // Add this household to the user's list
  const profile = await getUserProfile(userId);
  if (!profile) throw new Error('User profile not found');
  const newIds = [...profile.householdIds, householdId];
  const updates: any = { householdIds: newIds };
  // Make this their primary if they don't have one yet
  if (!profile.householdId) updates.householdId = householdId;
  await updateDoc(doc(db, 'users', userId), updates);

  return household;
}

export async function getHousehold(householdId: string): Promise<Household | null> {
  const snap = await getDoc(doc(db, 'households', householdId));
  if (!snap.exists()) return null;
  return snap.data() as Household;
}

export async function updateHouseholdName(householdId: string, name: string): Promise<void> {
  await updateDoc(doc(db, 'households', householdId), { name: name.trim() });
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
  // Migration: ensure householdIds array exists
  if (!Array.isArray(data.householdIds) || data.householdIds.length === 0) {
    const householdIds = data.householdId ? [data.householdId] : [];
    if (householdIds.length > 0) {
      await updateDoc(doc(db, 'users', uid), { householdIds });
    }
    data.householdIds = householdIds;
  }

  // Migration: ensure household documents exist for any household IDs
  for (const hid of data.householdIds) {
    try {
      const hSnap = await getDoc(doc(db, 'households', hid));
      if (!hSnap.exists()) {
        // Create a household doc for this legacy household
        const householdName = `${data.firstName || 'My'}'s Household`;
        await setDoc(doc(db, 'households', hid), {
          id: hid,
          name: householdName,
          inviteCode: data.inviteCode || crypto.randomUUID().slice(0, 8).toUpperCase(),
          createdBy: data.uid,
          createdAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore migration errors — user may not have permission yet
    }
  }
  return {
    uid: data.uid,
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    householdId: data.householdId,
    householdIds: data.householdIds || [data.householdId],
    inviteCode: data.inviteCode || data.partnerCode,
    photoURL: data.photoURL || null,
    pinHash: data.pinHash || null,
  };
}

// --- Household Members ---

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  // Use array-contains to find users in this household
  const q = query(collection(db, 'users'), where('householdIds', 'array-contains', householdId));
  const snap = await getDocs(q);
  const members = snap.docs.map(d => {
    const data = d.data();
    return {
      id: data.uid,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      photoURL: data.photoURL || null,
    };
  });
  // Fallback for legacy users not yet migrated
  if (members.length === 0) {
    const legacyQ = query(collection(db, 'users'), where('householdId', '==', householdId));
    const legacySnap = await getDocs(legacyQ);
    return legacySnap.docs.map(d => {
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
  return members;
}

export async function joinHousehold(userId: string, inviteCode: string): Promise<string> {
  let targetHouseholdId: string | null = null;

  // First: try to find a household by its invite code (new system)
  const householdQ = query(collection(db, 'households'), where('inviteCode', '==', inviteCode));
  const householdSnap = await getDocs(householdQ);
  if (!householdSnap.empty) {
    targetHouseholdId = householdSnap.docs[0].id;
  } else {
    // Legacy fallback: find a user with this personal invite code
    const userQ = query(collection(db, 'users'), where('inviteCode', '==', inviteCode));
    const userSnap = await getDocs(userQ);
    if (userSnap.empty) throw new Error('Invalid invite code');
    const target = userSnap.docs[0].data();
    if (target.uid === userId) throw new Error('Cannot join your own household');
    targetHouseholdId = target.householdId;
  }

  if (!targetHouseholdId) throw new Error('Invalid household');

  const profile = await getUserProfile(userId);
  if (!profile) throw new Error('User profile not found');
  if (profile.householdIds.includes(targetHouseholdId)) {
    throw new Error('You are already a member of this household');
  }
  const newHouseholdIds = [...profile.householdIds, targetHouseholdId];
  const updates: any = { householdIds: newHouseholdIds };
  // Make this their primary if they don't have one yet
  if (!profile.householdId) updates.householdId = targetHouseholdId;
  await updateDoc(doc(db, 'users', userId), updates);
  return targetHouseholdId;
}

export async function leaveHousehold(userId: string, householdIdToLeave?: string): Promise<void> {
  const profile = await getUserProfile(userId);
  if (!profile) return;

  // If no specific household given, leave all and create a new solo one
  if (!householdIdToLeave) {
    const newHouseholdId = crypto.randomUUID();
    await updateDoc(doc(db, 'users', userId), {
      householdId: newHouseholdId,
      householdIds: [newHouseholdId],
    });
    return;
  }

  // Remove the specific household from the array
  const remaining = profile.householdIds.filter(id => id !== householdIdToLeave);

  // If they have no households left, create a new solo one
  if (remaining.length === 0) {
    const newHouseholdId = crypto.randomUUID();
    await updateDoc(doc(db, 'users', userId), {
      householdId: newHouseholdId,
      householdIds: [newHouseholdId],
    });
    return;
  }

  // If leaving their primary household, set primary to the first remaining
  const updates: any = { householdIds: remaining };
  if (profile.householdId === householdIdToLeave) {
    updates.householdId = remaining[0];
  }
  await updateDoc(doc(db, 'users', userId), updates);
}

export async function removeMemberFromHousehold(memberId: string, householdId: string): Promise<void> {
  // Remove the household from the member's householdIds
  await leaveHousehold(memberId, householdId);
}

// --- Helper: visible user IDs (union across all the user's households) ---

async function getVisibleUserIds(userId: string): Promise<string[]> {
  const profile = await getUserProfile(userId);
  if (!profile) return [userId];
  const seen = new Set<string>([userId]);
  for (const hid of profile.householdIds) {
    const members = await getHouseholdMembers(hid);
    for (const m of members) seen.add(m.id);
  }
  return Array.from(seen);
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
  // If adding to someone else's institution, try to become a co-owner (non-blocking)
  try {
    const instSnap = await getDoc(doc(db, 'institutions', data.institutionId));
    if (instSnap.exists()) {
      const inst = instSnap.data() as Institution;
      if (inst.userId !== userId) {
        const existing = inst.coOwnerIds || [];
        if (!existing.includes(userId)) {
          await updateDoc(doc(db, 'institutions', data.institutionId), {
            coOwnerIds: [...existing, userId],
          });
        }
      }
    }
  } catch {
    // Co-owner update may fail if rules don't allow it — continue with account creation
  }

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

// --- Account Deletion ---

export async function scheduleDeletion(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { deletionScheduledAt: new Date().toISOString() });
}

export async function cancelDeletion(uid: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { deletionScheduledAt: null });
}

export function getDeletionDaysLeft(deletionScheduledAt: string | null | undefined): number | null {
  if (!deletionScheduledAt) return null;
  const scheduled = new Date(deletionScheduledAt).getTime();
  const deleteAt = scheduled + 7 * 24 * 60 * 60 * 1000; // 7 days
  const now = Date.now();
  if (now >= deleteAt) return 0;
  return Math.ceil((deleteAt - now) / (24 * 60 * 60 * 1000));
}

export async function permanentlyDeleteUser(uid: string): Promise<void> {
  // Delete all accounts owned by this user
  const acctQ = query(collection(db, 'accounts'), where('userId', '==', uid));
  const acctSnap = await getDocs(acctQ);
  const batch1 = writeBatch(db);
  acctSnap.forEach(d => batch1.delete(d.ref));
  if (!acctSnap.empty) await batch1.commit();

  // Delete all institutions owned by this user
  const instQ = query(collection(db, 'institutions'), where('userId', '==', uid));
  const instSnap = await getDocs(instQ);
  const batch2 = writeBatch(db);
  instSnap.forEach(d => batch2.delete(d.ref));
  if (!instSnap.empty) await batch2.commit();

  // Remove user from co-owner lists on other institutions
  const allInstQ = query(collection(db, 'institutions'));
  const allInstSnap = await getDocs(allInstQ);
  const batch3 = writeBatch(db);
  let coOwnerUpdates = 0;
  allInstSnap.forEach(d => {
    const data = d.data();
    if (data.coOwnerIds && data.coOwnerIds.includes(uid)) {
      batch3.update(d.ref, { coOwnerIds: data.coOwnerIds.filter((id: string) => id !== uid) });
      coOwnerUpdates++;
    }
  });
  if (coOwnerUpdates > 0) await batch3.commit();

  // Remove user from all households
  const profile = await getUserProfile(uid);
  if (profile) {
    for (const hid of profile.householdIds) {
      await leaveHousehold(uid, hid);
    }
  }

  // Delete user profile document
  await deleteDoc(doc(db, 'users', uid));
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
