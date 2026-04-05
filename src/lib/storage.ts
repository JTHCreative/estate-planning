// Simple client-side storage using localStorage
// Data is stored per-user, keyed by email

const USERS_KEY = 'ep_users';
const CURRENT_USER_KEY = 'ep_current_user';
const DATA_PREFIX = 'ep_data_';

export interface StoredUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
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
  createdAt: string;
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
  createdAt: string;
}

interface UserData {
  institutions: Institution[];
  accounts: Account[];
}

function generateId(): string {
  return crypto.randomUUID();
}

// Simple hash for client-side password verification (not cryptographic security,
// but adequate for protecting local browser data)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'estate-planning-salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// --- User management ---

function getUsers(): StoredUser[] {
  const raw = localStorage.getItem(USERS_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getUserData(userId: string): UserData {
  const raw = localStorage.getItem(DATA_PREFIX + userId);
  return raw ? JSON.parse(raw) : { institutions: [], accounts: [] };
}

function saveUserData(userId: string, data: UserData) {
  localStorage.setItem(DATA_PREFIX + userId, JSON.stringify(data));
}

export async function registerUser(email: string, password: string, firstName: string, lastName: string): Promise<StoredUser> {
  const users = getUsers();
  if (users.find(u => u.email === email.toLowerCase())) {
    throw new Error('Email already registered');
  }

  const user: StoredUser = {
    id: generateId(),
    email: email.toLowerCase(),
    firstName,
    lastName,
    passwordHash: await hashPassword(password),
    partnerCode: generateId().slice(0, 8).toUpperCase(),
    partnerId: null,
  };

  users.push(user);
  saveUsers(users);
  saveUserData(user.id, { institutions: [], accounts: [] });
  localStorage.setItem(CURRENT_USER_KEY, user.id);
  return user;
}

export async function loginUser(email: string, password: string): Promise<StoredUser> {
  const users = getUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) throw new Error('Invalid email or password');

  const hash = await hashPassword(password);
  if (hash !== user.passwordHash) throw new Error('Invalid email or password');

  localStorage.setItem(CURRENT_USER_KEY, user.id);
  return user;
}

export function logoutUser() {
  localStorage.removeItem(CURRENT_USER_KEY);
}

export function getCurrentUser(): StoredUser | null {
  const userId = localStorage.getItem(CURRENT_USER_KEY);
  if (!userId) return null;
  const users = getUsers();
  return users.find(u => u.id === userId) || null;
}

export function getPartnerInfo(user: StoredUser): StoredUser | null {
  if (!user.partnerId) return null;
  const users = getUsers();
  return users.find(u => u.id === user.partnerId) || null;
}

export function linkPartner(userId: string, partnerCode: string): void {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  const partner = users.find(u => u.partnerCode === partnerCode);

  if (!user || !partner) throw new Error('Invalid partner code');
  if (partner.id === userId) throw new Error('Cannot link to yourself');
  if (partner.partnerId && partner.partnerId !== userId) throw new Error('That user is already linked to another partner');

  user.partnerId = partner.id;
  partner.partnerId = user.id;
  saveUsers(users);
}

export function unlinkPartner(userId: string): void {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;

  if (user.partnerId) {
    const partner = users.find(u => u.id === user.partnerId);
    if (partner) partner.partnerId = null;
  }
  user.partnerId = null;
  saveUsers(users);
}

// --- Visible user IDs (self + partner) ---

function getVisibleUserIds(userId: string): string[] {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  const ids = [userId];
  if (user?.partnerId) ids.push(user.partnerId);
  return ids;
}

// --- Institutions ---

export function getInstitutions(userId: string, categoryId?: string): (Institution & { ownerName: string })[] {
  const ids = getVisibleUserIds(userId);
  const users = getUsers();
  const all: (Institution & { ownerName: string })[] = [];

  for (const uid of ids) {
    const data = getUserData(uid);
    const owner = users.find(u => u.id === uid);
    const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown';
    for (const inst of data.institutions) {
      if (!categoryId || inst.categoryId === categoryId) {
        all.push({ ...inst, ownerName });
      }
    }
  }
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export function addInstitution(userId: string, inst: Omit<Institution, 'id' | 'userId' | 'createdAt'>): Institution {
  const data = getUserData(userId);
  const newInst: Institution = { ...inst, id: generateId(), userId, createdAt: new Date().toISOString() };
  data.institutions.push(newInst);
  saveUserData(userId, data);
  return newInst;
}

export function updateInstitution(userId: string, id: string, updates: Partial<Institution>): void {
  const ids = getVisibleUserIds(userId);
  for (const uid of ids) {
    const data = getUserData(uid);
    const idx = data.institutions.findIndex(i => i.id === id);
    if (idx !== -1) {
      data.institutions[idx] = { ...data.institutions[idx], ...updates };
      saveUserData(uid, data);
      return;
    }
  }
}

export function deleteInstitution(userId: string, id: string): void {
  const data = getUserData(userId);
  data.institutions = data.institutions.filter(i => i.id !== id);
  data.accounts = data.accounts.filter(a => a.institutionId !== id);
  saveUserData(userId, data);
}

// --- Accounts ---

export function getAccounts(userId: string, institutionId?: string): (Account & { ownerName: string })[] {
  const ids = getVisibleUserIds(userId);
  const users = getUsers();
  const all: (Account & { ownerName: string })[] = [];

  for (const uid of ids) {
    const data = getUserData(uid);
    const owner = users.find(u => u.id === uid);
    const ownerName = owner ? `${owner.firstName} ${owner.lastName}` : 'Unknown';
    for (const acct of data.accounts) {
      if (!institutionId || acct.institutionId === institutionId) {
        all.push({ ...acct, ownerName });
      }
    }
  }
  return all.sort((a, b) => a.accountName.localeCompare(b.accountName));
}

export function addAccount(userId: string, acct: Omit<Account, 'id' | 'userId' | 'createdAt'>): Account {
  const data = getUserData(userId);
  const newAcct: Account = { ...acct, id: generateId(), userId, createdAt: new Date().toISOString() };
  data.accounts.push(newAcct);
  saveUserData(userId, data);
  return newAcct;
}

export function updateAccount(userId: string, id: string, updates: Partial<Account>): void {
  const ids = getVisibleUserIds(userId);
  for (const uid of ids) {
    const data = getUserData(uid);
    const idx = data.accounts.findIndex(a => a.id === id);
    if (idx !== -1) {
      data.accounts[idx] = { ...data.accounts[idx], ...updates };
      saveUserData(uid, data);
      return;
    }
  }
}

export function deleteAccount(userId: string, id: string): void {
  const data = getUserData(userId);
  data.accounts = data.accounts.filter(a => a.id !== id);
  saveUserData(userId, data);
}

// --- Stats ---

export function getStats(userId: string) {
  const institutions = getInstitutions(userId);
  const accounts = getAccounts(userId);

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

// --- Export / Import for partner sharing ---

export function exportUserData(userId: string): string {
  const data = getUserData(userId);
  return JSON.stringify(data, null, 2);
}

export function importPartnerData(userId: string, jsonString: string): void {
  const imported: UserData = JSON.parse(jsonString);
  if (!imported.institutions || !imported.accounts) throw new Error('Invalid data format');

  // Merge imported data — assign new IDs to avoid conflicts, mark as partner data
  const data = getUserData(userId);
  const idMap = new Map<string, string>();

  for (const inst of imported.institutions) {
    const newId = generateId();
    idMap.set(inst.id, newId);
    data.institutions.push({ ...inst, id: newId, userId });
  }

  for (const acct of imported.accounts) {
    const newInstId = idMap.get(acct.institutionId);
    if (newInstId) {
      data.accounts.push({ ...acct, id: generateId(), institutionId: newInstId, userId });
    }
  }

  saveUserData(userId, data);
}

// --- Categories (static, no backend needed) ---

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
