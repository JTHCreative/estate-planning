import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, '..', 'estate-planning.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    partner_id TEXT REFERENCES users(id),
    partner_code TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS institutions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    website TEXT,
    phone TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    institution_id TEXT NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    account_name TEXT NOT NULL,
    account_type TEXT,
    account_number TEXT,
    routing_number TEXT,
    username TEXT,
    password_encrypted TEXT,
    url TEXT,
    contact_name TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    estimated_value TEXT,
    beneficiary TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checklist_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    category_id TEXT NOT NULL REFERENCES categories(id),
    label TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default categories if empty
const count = db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number };
if (count.c === 0) {
  const categories = [
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

  const insert = db.prepare('INSERT INTO categories (id, name, description, icon, sort_order) VALUES (?, ?, ?, ?, ?)');
  for (const cat of categories) {
    insert.run(cat.id, cat.name, cat.description, cat.icon, cat.sort_order);
  }
}

export default db;
