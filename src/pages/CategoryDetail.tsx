import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CATEGORIES, getInstitutions, getAccounts,
  addInstitution, updateInstitution, deleteInstitution,
  addAccount, updateAccount, deleteAccount, isHint, getHintText,
} from '../lib/storage';
import type { Institution, Account } from '../lib/storage';
import { Plus, ArrowLeft, Trash2, Edit3, ChevronDown, ChevronRight, Eye, EyeOff, X, AlertCircle,
  Landmark, Building2, Banknote, CreditCard, Wallet, PiggyBank, CircleDollarSign,
  Shield, Heart, Car, Truck, Bike, Ship, Caravan, Sailboat, Waves,
  Home, Building, TreePine, MapPin, Hotel, Castle,
  Briefcase, Store, Users, Handshake, Scale,
  Bitcoin, HardDrive, Globe, Image,
  GraduationCap, BookOpen, School,
  FileText, FileLock, FileCheck, FileSignature, FileHeart, ClipboardList,
  Calculator, FileSpreadsheet,
  Gem, Palette, Trophy, Guitar, Monitor, Armchair, Wine, Medal,
  Tv, Music, ShoppingBag, Film, Cloud, Pen, Dumbbell, Newspaper, MoreHorizontal,
  Mail, AtSign, Camera, Video, Database, Apple, Smartphone,
  Zap, Flame, Droplets, Wifi, Phone, Lock, Scissors,
  Stethoscope, Smile, Glasses, Pill, Cross, HeartPulse, Activity,
  DollarSign, HandCoins, Gavel, UserCheck, UserPlus, Contact,
  Church, Leaf, Ribbon,
  type LucideIcon,
} from 'lucide-react';

type InstitutionWithOwner = Institution & { ownerName: string };
type AccountWithOwner = Account & { ownerName: string };

interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
}

// Category-specific form fields
const categoryFields: Record<string, { typePlaceholder: string; fields: FieldConfig[]; accountLabel?: string; addLabel?: string; nameLabel?: string }> = {
  'bank-accounts': {
    typePlaceholder: 'e.g. Checking, Savings, CD, Money Market',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'routingNumber', label: 'Routing Number' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Balance', placeholder: 'e.g. $50,000' },
      { key: 'beneficiary', label: 'Beneficiary / POD' },
      { key: 'contactName', label: 'Contact Name' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'investment-accounts': {
    typePlaceholder: 'e.g. Brokerage, Mutual Fund, Stock Account',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $250,000' },
      { key: 'beneficiary', label: 'Beneficiary / TOD' },
      { key: 'contactName', label: 'Advisor / Broker Name' },
      { key: 'contactPhone', label: 'Advisor Phone' },
      { key: 'contactEmail', label: 'Advisor Email', type: 'email' },
    ],
  },
  'retirement-accounts': {
    typePlaceholder: 'e.g. 401(k), IRA, Roth IRA, Pension, 403(b)',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $500,000' },
      { key: 'beneficiary', label: 'Primary Beneficiary' },
      { key: 'contactName', label: 'Plan Administrator / Advisor' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'insurance-policies': {
    typePlaceholder: 'e.g. Life, Health, Auto, Home, Umbrella, Long-Term Care',
    fields: [
      { key: 'accountNumber', label: 'Policy Number' },
      { key: 'estimatedValue', label: 'Coverage Amount', placeholder: 'e.g. $500,000' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'beneficiary', label: 'Beneficiary' },
      { key: 'contactName', label: 'Agent Name' },
      { key: 'contactPhone', label: 'Agent Phone' },
      { key: 'contactEmail', label: 'Agent Email', type: 'email' },
    ],
  },
  'real-estate': {
    typePlaceholder: 'e.g. Primary Residence, Rental, Vacation Home, Land',
    accountLabel: 'Properties',
    addLabel: 'Add Property',
    nameLabel: 'Property Name',
    fields: [
      { key: 'url', label: 'Street Address', placeholder: 'e.g. 123 Main St' },
      { key: 'contactEmail', label: 'City, State, ZIP', placeholder: 'e.g. Austin, TX 78701' },
      { key: 'accountNumber', label: 'Parcel / Property ID' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $350,000' },
      { key: 'routingNumber', label: 'Mortgage Account #' },
      { key: 'beneficiary', label: 'Title Holder / Deed Names' },
      { key: 'contactName', label: 'Agent / Property Manager' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'username', label: 'Mortgage Portal Username' },
      { key: 'password', label: 'Mortgage Portal Password', type: 'password' },
    ],
  },
  'vehicles': {
    typePlaceholder: 'e.g. Car, Truck, Boat, RV, Motorcycle',
    accountLabel: 'Vehicles',
    addLabel: 'Add Vehicle',
    nameLabel: 'Vehicle Name',
    fields: [
      { key: 'accountNumber', label: 'VIN / Hull ID' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $25,000' },
      { key: 'routingNumber', label: 'Loan Account #' },
      { key: 'beneficiary', label: 'Title Holder' },
      { key: 'contactName', label: 'Lender / Dealer Contact' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'business-interests': {
    typePlaceholder: 'e.g. LLC, Corporation, Partnership, Sole Proprietorship',
    fields: [
      { key: 'accountNumber', label: 'EIN / Tax ID' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $100,000' },
      { key: 'beneficiary', label: 'Ownership / Partners' },
      { key: 'contactName', label: 'Business Attorney / CPA' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
      { key: 'url', label: 'Website' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
    ],
  },
  'digital-assets': {
    typePlaceholder: 'e.g. Crypto Wallet, NFTs, Domain, Digital Store',
    fields: [
      { key: 'accountNumber', label: 'Wallet Address / Account ID' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website / Exchange URL' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $10,000' },
      { key: 'routingNumber', label: 'Recovery Phrase / Seed (secure!)' },
      { key: 'beneficiary', label: 'Designated Heir' },
    ],
  },
  'debts-liabilities': {
    typePlaceholder: 'e.g. Mortgage, Auto Loan, Credit Card, Student Loan, HELOC',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'estimatedValue', label: 'Balance Owed', placeholder: 'e.g. $120,000' },
      { key: 'routingNumber', label: 'Interest Rate', placeholder: 'e.g. 4.5%' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Payment Portal URL' },
      { key: 'contactName', label: 'Lender Contact' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'estate-documents': {
    typePlaceholder: 'e.g. Will, Trust, Power of Attorney, Healthcare Directive',
    fields: [
      { key: 'accountNumber', label: 'Document Reference #' },
      { key: 'estimatedValue', label: 'Date Executed', placeholder: 'e.g. 2024-01-15' },
      { key: 'beneficiary', label: 'Named Parties / Beneficiaries' },
      { key: 'contactName', label: 'Attorney Name' },
      { key: 'contactPhone', label: 'Attorney Phone' },
      { key: 'contactEmail', label: 'Attorney Email', type: 'email' },
      { key: 'url', label: 'Digital Copy Location' },
    ],
  },
  'tax-records': {
    typePlaceholder: 'e.g. Federal Return, State Return, Business Return',
    fields: [
      { key: 'accountNumber', label: 'EIN / SSN (last 4)' },
      { key: 'username', label: 'IRS/State Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Filing Portal URL' },
      { key: 'contactName', label: 'CPA / Tax Preparer' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'personal-property': {
    typePlaceholder: 'e.g. Jewelry, Art, Collectibles, Antiques, Firearms',
    fields: [
      { key: 'accountNumber', label: 'Serial # / Appraisal ID' },
      { key: 'estimatedValue', label: 'Appraised Value', placeholder: 'e.g. $15,000' },
      { key: 'beneficiary', label: 'Intended Heir' },
      { key: 'contactName', label: 'Appraiser / Insurance Agent' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'subscriptions': {
    typePlaceholder: 'e.g. Streaming, Software, Gym, Club Membership',
    fields: [
      { key: 'accountNumber', label: 'Member / Account ID' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Monthly Cost', placeholder: 'e.g. $14.99/mo' },
      { key: 'contactPhone', label: 'Support Phone' },
    ],
  },
  'social-media': {
    typePlaceholder: 'e.g. Email, Facebook, Instagram, Cloud Storage',
    fields: [
      { key: 'username', label: 'Username / Email' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'url', label: 'URL' },
      { key: 'accountNumber', label: 'Recovery Email / Phone' },
      { key: 'routingNumber', label: '2FA Method', placeholder: 'e.g. Authenticator, SMS' },
    ],
  },
  'utilities': {
    typePlaceholder: 'e.g. Electric, Gas, Water, Internet, Phone, Trash',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Monthly Cost', placeholder: 'e.g. $150/mo' },
      { key: 'contactPhone', label: 'Support Phone' },
    ],
  },
  'healthcare': {
    typePlaceholder: 'e.g. Doctor, Dentist, Pharmacy, Specialist, HSA/FSA',
    fields: [
      { key: 'accountNumber', label: 'Member / Patient ID' },
      { key: 'username', label: 'Portal Username' },
      { key: 'password', label: 'Portal Password', type: 'password' },
      { key: 'url', label: 'Patient Portal URL' },
      { key: 'estimatedValue', label: 'HSA/FSA Balance', placeholder: 'e.g. $3,500' },
      { key: 'contactName', label: 'Provider Name' },
      { key: 'contactPhone', label: 'Office Phone' },
      { key: 'contactEmail', label: 'Office Email', type: 'email' },
    ],
  },
  'education': {
    typePlaceholder: 'e.g. 529 Plan, Student Loan, Education Savings',
    fields: [
      { key: 'accountNumber', label: 'Account Number' },
      { key: 'username', label: 'Login Username' },
      { key: 'password', label: 'Login Password', type: 'password' },
      { key: 'url', label: 'Website URL' },
      { key: 'estimatedValue', label: 'Balance', placeholder: 'e.g. $25,000' },
      { key: 'beneficiary', label: 'Beneficiary / Student' },
      { key: 'contactName', label: 'Advisor / Servicer' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
  'trusts-entities': {
    typePlaceholder: 'e.g. Revocable Trust, Irrevocable Trust, Family LLC',
    fields: [
      { key: 'accountNumber', label: 'EIN / Tax ID' },
      { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $1,000,000' },
      { key: 'beneficiary', label: 'Trustees / Beneficiaries' },
      { key: 'contactName', label: 'Attorney / Trustee' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
      { key: 'url', label: 'Document Location' },
    ],
  },
  'emergency-contacts': {
    typePlaceholder: 'e.g. Attorney, CPA, Financial Advisor, Executor, Family',
    accountLabel: 'Contacts',
    addLabel: 'Add Contact',
    nameLabel: 'Contact Label',
    fields: [
      { key: 'contactName', label: 'Full Name' },
      { key: 'contactPhone', label: 'Phone Number' },
      { key: 'contactEmail', label: 'Email Address', type: 'email' },
      { key: 'accountNumber', label: 'Relationship / Role' },
      { key: 'url', label: 'Website' },
    ],
  },
  'final-wishes': {
    typePlaceholder: 'e.g. Funeral Home, Cemetery, Cremation, Organ Donation',
    fields: [
      { key: 'accountNumber', label: 'Policy / Pre-plan #' },
      { key: 'estimatedValue', label: 'Pre-paid Amount', placeholder: 'e.g. $8,000' },
      { key: 'contactName', label: 'Funeral Director / Contact' },
      { key: 'contactPhone', label: 'Contact Phone' },
      { key: 'contactEmail', label: 'Contact Email', type: 'email' },
    ],
  },
};

const defaultFields: { typePlaceholder: string; fields: FieldConfig[] } = {
  typePlaceholder: 'e.g. Account Type',
  fields: [
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'routingNumber', label: 'Routing Number' },
    { key: 'username', label: 'Login Username' },
    { key: 'password', label: 'Login Password', type: 'password' },
    { key: 'url', label: 'Website URL' },
    { key: 'estimatedValue', label: 'Estimated Value', placeholder: 'e.g. $50,000' },
    { key: 'beneficiary', label: 'Beneficiary' },
    { key: 'contactName', label: 'Contact Name' },
    { key: 'contactPhone', label: 'Contact Phone' },
    { key: 'contactEmail', label: 'Contact Email', type: 'email' },
  ],
};

// Quick-pick institution presets per category
const institutionPresets: Record<string, string[]> = {
  'bank-accounts': ['Chase', 'Bank of America', 'Wells Fargo', 'Citibank', 'US Bank', 'Capital One', 'PNC Bank', 'TD Bank', 'Ally Bank', 'Marcus by Goldman Sachs', 'Discover Bank', 'Navy Federal', 'USAA', 'Charles Schwab', 'Local Credit Union', 'Other'],
  'investment-accounts': ['Fidelity', 'Charles Schwab', 'Vanguard', 'TD Ameritrade', 'E*TRADE', 'Merrill Lynch', 'Morgan Stanley', 'Edward Jones', 'Robinhood', 'Wealthfront', 'Betterment', 'Interactive Brokers', 'Other'],
  'retirement-accounts': ['Fidelity', 'Vanguard', 'Charles Schwab', 'TIAA', 'T. Rowe Price', 'Empower', 'Principal', 'John Hancock', 'ADP Retirement', 'Merrill Lynch', 'Edward Jones', 'Other'],
  'insurance-policies': ['State Farm', 'Allstate', 'GEICO', 'Progressive', 'USAA', 'Liberty Mutual', 'Farmers', 'Nationwide', 'MetLife', 'Prudential', 'New York Life', 'Northwestern Mutual', 'Aflac', 'Humana', 'UnitedHealthcare', 'Blue Cross Blue Shield', 'Aetna', 'Other'],
  'real-estate': ['Primary Residence', 'Rental Property', 'Vacation Home', 'Land / Lot', 'Commercial Property', 'Timeshare', 'Other'],
  'vehicles': ['Car', 'Truck', 'SUV', 'Motorcycle', 'Boat', 'RV / Camper', 'ATV / UTV', 'Jet Ski', 'Trailer', 'Classic / Antique Car', 'Other'],
  'business-interests': ['LLC', 'S-Corp', 'C-Corp', 'Sole Proprietorship', 'Partnership', 'Franchise', 'Non-Profit', 'Other'],
  'digital-assets': ['Coinbase', 'Binance', 'Kraken', 'Crypto.com', 'Ledger Wallet', 'Trezor Wallet', 'MetaMask', 'PayPal Crypto', 'Domain Names', 'Digital Storefront', 'NFT Collection', 'Other'],
  'debts-liabilities': ['Mortgage', 'Auto Loan', 'Student Loan', 'Credit Card', 'Personal Loan', 'HELOC', 'Medical Debt', 'Business Loan', 'Other'],
  'estate-documents': ['Last Will & Testament', 'Revocable Living Trust', 'Power of Attorney', 'Healthcare Directive', 'HIPAA Authorization', 'Beneficiary Designations', 'Guardianship Designation', 'Letter of Intent', 'Other'],
  'tax-records': ['Federal Tax Return', 'State Tax Return', 'Business Tax Return', 'Property Tax', 'CPA / Tax Preparer', 'Other'],
  'personal-property': ['Jewelry', 'Fine Art', 'Collectibles', 'Antiques', 'Firearms', 'Musical Instruments', 'Electronics', 'Furniture', 'Wine / Spirits Collection', 'Sports Memorabilia', 'Other'],
  'subscriptions': ['Netflix', 'Spotify', 'Amazon Prime', 'Disney+', 'YouTube Premium', 'Apple One', 'Hulu', 'HBO Max', 'Adobe Creative Cloud', 'Microsoft 365', 'Gym Membership', 'Club Membership', 'Newspaper / Magazine', 'Other'],
  'social-media': ['Gmail', 'Outlook / Hotmail', 'Yahoo Mail', 'iCloud', 'Facebook', 'Instagram', 'X / Twitter', 'LinkedIn', 'TikTok', 'YouTube', 'Google Drive', 'Dropbox', 'OneDrive', 'Apple ID', 'Other'],
  'utilities': ['Electric', 'Gas', 'Water / Sewer', 'Internet', 'Cell Phone', 'Home Phone', 'Cable / Satellite TV', 'Trash / Recycling', 'HOA', 'Security System', 'Lawn / Landscaping', 'Other'],
  'healthcare': ['Primary Doctor', 'Dentist', 'Eye Doctor', 'Specialist', 'Pharmacy', 'Hospital', 'Health Insurance', 'Dental Insurance', 'Vision Insurance', 'HSA Account', 'FSA Account', 'Medicare', 'Other'],
  'education': ['529 Plan', 'Coverdell ESA', 'Student Loan - Federal', 'Student Loan - Private', 'Scholarship Fund', 'Other'],
  'trusts-entities': ['Revocable Living Trust', 'Irrevocable Trust', 'Family LLC', 'Family Foundation', 'Charitable Trust', 'Special Needs Trust', 'Other'],
  'emergency-contacts': ['Attorney', 'CPA / Accountant', 'Financial Advisor', 'Insurance Agent', 'Executor', 'Trustee', 'Guardian', 'Spouse / Partner', 'Family Member', 'Close Friend', 'Neighbor', 'Doctor', 'Other'],
  'final-wishes': ['Funeral Home', 'Cemetery', 'Crematorium', 'Church / Place of Worship', 'Organ Donation Registry', 'Pre-paid Burial Plan', 'Other'],
};

const presetIcons: Record<string, LucideIcon> = {
  // Banks
  'Chase': Landmark, 'Bank of America': Building2, 'Wells Fargo': Banknote, 'Citibank': CreditCard,
  'US Bank': Landmark, 'Capital One': CreditCard, 'PNC Bank': Landmark, 'TD Bank': Building2,
  'Ally Bank': Wallet, 'Marcus by Goldman Sachs': CircleDollarSign, 'Discover Bank': CreditCard,
  'Navy Federal': Shield, 'USAA': Shield, 'Charles Schwab': CircleDollarSign, 'Local Credit Union': Users,
  // Investments
  'Fidelity': CircleDollarSign, 'Vanguard': CircleDollarSign, 'TD Ameritrade': CircleDollarSign,
  'E*TRADE': CircleDollarSign, 'Merrill Lynch': Building2, 'Morgan Stanley': Building2,
  'Edward Jones': Briefcase, 'Robinhood': Leaf, 'Wealthfront': CircleDollarSign,
  'Betterment': CircleDollarSign, 'Interactive Brokers': CircleDollarSign,
  // Retirement
  'TIAA': PiggyBank, 'T. Rowe Price': PiggyBank, 'Empower': PiggyBank,
  'Principal': PiggyBank, 'John Hancock': PiggyBank, 'ADP Retirement': PiggyBank,
  // Insurance
  'State Farm': Shield, 'Allstate': Shield, 'GEICO': Shield, 'Progressive': Shield,
  'Liberty Mutual': Shield, 'Farmers': Shield, 'Nationwide': Shield,
  'MetLife': Shield, 'Prudential': Shield, 'New York Life': Heart,
  'Northwestern Mutual': Shield, 'Aflac': HeartPulse, 'Humana': HeartPulse,
  'UnitedHealthcare': HeartPulse, 'Blue Cross Blue Shield': HeartPulse, 'Aetna': HeartPulse,
  // Real Estate
  'Primary Residence': Home, 'Rental Property': Building, 'Vacation Home': Hotel,
  'Land / Lot': TreePine, 'Commercial Property': Building2, 'Timeshare': Castle,
  // Vehicles
  'Car': Car, 'Truck': Truck, 'SUV': Car, 'Motorcycle': Bike, 'Boat': Ship,
  'RV / Camper': Caravan, 'ATV / UTV': Bike, 'Jet Ski': Waves,
  'Trailer': Caravan, 'Classic / Antique Car': Car, 'Sailboat': Sailboat,
  // Business
  'LLC': Briefcase, 'S-Corp': Building2, 'C-Corp': Building2,
  'Sole Proprietorship': Store, 'Partnership': Handshake, 'Franchise': Store,
  'Non-Profit': Heart,
  // Digital
  'Coinbase': Bitcoin, 'Binance': Bitcoin, 'Kraken': Bitcoin, 'Crypto.com': Bitcoin,
  'Ledger Wallet': HardDrive, 'Trezor Wallet': HardDrive, 'MetaMask': Wallet,
  'PayPal Crypto': Wallet, 'Domain Names': Globe, 'Digital Storefront': Store,
  'NFT Collection': Image,
  // Debts
  'Mortgage': Home, 'Auto Loan': Car, 'Student Loan': GraduationCap,
  'Credit Card': CreditCard, 'Personal Loan': Banknote, 'HELOC': Home,
  'Medical Debt': HeartPulse, 'Business Loan': Briefcase,
  // Estate Documents
  'Last Will & Testament': FileText, 'Revocable Living Trust': FileLock,
  'Power of Attorney': FileSignature, 'Healthcare Directive': FileHeart,
  'HIPAA Authorization': FileCheck, 'Beneficiary Designations': ClipboardList,
  'Guardianship Designation': UserCheck, 'Letter of Intent': FileText,
  // Tax
  'Federal Tax Return': FileSpreadsheet, 'State Tax Return': FileSpreadsheet,
  'Business Tax Return': Calculator, 'Property Tax': Home, 'CPA / Tax Preparer': Calculator,
  // Personal Property
  'Jewelry': Gem, 'Fine Art': Palette, 'Collectibles': Trophy,
  'Antiques': Armchair, 'Firearms': Shield, 'Musical Instruments': Guitar,
  'Electronics': Monitor, 'Furniture': Armchair, 'Wine / Spirits Collection': Wine,
  'Sports Memorabilia': Medal,
  // Subscriptions
  'Netflix': Tv, 'Spotify': Music, 'Amazon Prime': ShoppingBag, 'Disney+': Film,
  'YouTube Premium': Video, 'Apple One': Apple, 'Hulu': Tv, 'HBO Max': Film,
  'Adobe Creative Cloud': Pen, 'Microsoft 365': Cloud,
  'Gym Membership': Dumbbell, 'Club Membership': Users,
  'Newspaper / Magazine': Newspaper,
  // Social Media
  'Gmail': Mail, 'Outlook / Hotmail': Mail, 'Yahoo Mail': Mail, 'iCloud': Cloud,
  'Facebook': Users, 'Instagram': Camera, 'X / Twitter': AtSign,
  'LinkedIn': Briefcase, 'TikTok': Music, 'YouTube': Video,
  'Google Drive': Database, 'Dropbox': Database, 'OneDrive': Cloud,
  'Apple ID': Apple,
  // Utilities
  'Electric': Zap, 'Gas': Flame, 'Water / Sewer': Droplets,
  'Internet': Wifi, 'Cell Phone': Smartphone, 'Home Phone': Phone,
  'Cable / Satellite TV': Tv, 'Trash / Recycling': Trash2,
  'HOA': Home, 'Security System': Lock, 'Lawn / Landscaping': Scissors,
  // Healthcare
  'Primary Doctor': Stethoscope, 'Dentist': Smile, 'Eye Doctor': Glasses,
  'Specialist': Activity, 'Pharmacy': Pill, 'Hospital': Cross,
  'Health Insurance': HeartPulse, 'Dental Insurance': Smile,
  'Vision Insurance': Glasses, 'HSA Account': Wallet, 'FSA Account': Wallet,
  'Medicare': HeartPulse,
  // Education
  '529 Plan': GraduationCap, 'Coverdell ESA': BookOpen,
  'Student Loan - Federal': GraduationCap, 'Student Loan - Private': GraduationCap,
  'Scholarship Fund': School,
  // Trusts
  'Irrevocable Trust': FileLock,
  'Family LLC': Users, 'Family Foundation': Heart,
  'Charitable Trust': Heart, 'Special Needs Trust': HeartPulse,
  // Emergency Contacts
  'Attorney': Gavel, 'CPA / Accountant': Calculator, 'Financial Advisor': DollarSign,
  'Insurance Agent': Shield, 'Executor': UserCheck, 'Trustee': Scale,
  'Guardian': UserPlus, 'Spouse / Partner': Heart, 'Family Member': Users,
  'Close Friend': Contact, 'Neighbor': Home, 'Doctor': Stethoscope,
  // Final Wishes
  'Funeral Home': Building, 'Cemetery': MapPin, 'Crematorium': Flame,
  'Church / Place of Worship': Church, 'Organ Donation Registry': Ribbon,
  'Pre-paid Burial Plan': HandCoins,
  // Fallback
  'Other': MoreHorizontal,
};

// Map field keys to acctForm keys
const fieldToFormKey: Record<string, string> = {
  accountNumber: 'accountNumber',
  routingNumber: 'routingNumber',
  username: 'username',
  password: 'password',
  url: 'url',
  estimatedValue: 'estimatedValue',
  beneficiary: 'beneficiary',
  contactName: 'contactName',
  contactPhone: 'contactPhone',
  contactEmail: 'contactEmail',
};

const SENSITIVE_FIELD_KEYS = new Set(['accountNumber', 'routingNumber', 'username', 'password']);

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const config = categoryFields[categoryId || ''] || defaultFields;
  const itemLabel = config.accountLabel || 'Accounts';
  const itemLabelSingular = itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;
  const addItemLabel = config.addLabel || 'Add Account';
  const nameFieldLabel = config.nameLabel || 'Account Name';
  const [category, setCategory] = useState<typeof CATEGORIES[0] | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionWithOwner[]>([]);
  const [accounts, setAccounts] = useState<AccountWithOwner[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showInstForm, setShowInstForm] = useState(false);
  const [showInstPicker, setShowInstPicker] = useState(false);
  const [showAcctForm, setShowAcctForm] = useState<string | null>(null);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  const [instForm, setInstForm] = useState({ name: '', website: '', phone: '', notes: '' });
  const [acctForm, setAcctForm] = useState({
    accountName: '', accountType: '', accountNumber: '', routingNumber: '',
    username: '', password: '', url: '', contactName: '', contactPhone: '',
    contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
  });
  const [hintMode, setHintMode] = useState<Record<string, boolean>>({});
  const [openComboMenu, setOpenComboMenu] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !categoryId) return;
    setCategory(CATEGORIES.find(c => c.id === categoryId) || null);
    const [insts, accts] = await Promise.all([
      getInstitutions(user.id, categoryId),
      getAccounts(user.id),
    ]);
    setInstitutions(insts);
    setAccounts(accts);
  }, [user, categoryId]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleField = (key: string) => {
    setRevealedFields(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const maskValue = (value: string) => {
    if (value.length <= 4) return '••••';
    return '••••' + value.slice(-4);
  };

  const resetInstForm = () => setInstForm({ name: '', website: '', phone: '', notes: '' });
  const resetAcctForm = () => {
    setAcctForm({
      accountName: '', accountType: '', accountNumber: '', routingNumber: '',
      username: '', password: '', url: '', contactName: '', contactPhone: '',
      contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
    });
    setHintMode({});
    setOpenComboMenu(null);
  };

  const handleAddInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !categoryId) return;
    if (editingInst) {
      await updateInstitution(editingInst.id, {
        name: instForm.name, website: instForm.website || null,
        phone: instForm.phone || null, notes: instForm.notes || null,
      });
      setEditingInst(null);
    } else {
      await addInstitution(user.id, {
        categoryId, name: instForm.name,
        website: instForm.website || null, phone: instForm.phone || null, notes: instForm.notes || null,
      });
    }
    resetInstForm();
    setShowInstForm(false);
    await load();
  };

  const handleAddAccount = async (e: React.FormEvent, institutionId: string) => {
    e.preventDefault();
    if (!user) return;

    // Apply hint prefix for fields in hint mode
    const acctNum = hintMode.accountNumber && acctForm.accountNumber ? `hint:${acctForm.accountNumber}` : (acctForm.accountNumber || null);
    const rtnNum = hintMode.routingNumber && acctForm.routingNumber ? `hint:${acctForm.routingNumber}` : (acctForm.routingNumber || null);
    const uname = hintMode.username && acctForm.username ? `hint:${acctForm.username}` : (acctForm.username || null);
    const pwd = hintMode.password && acctForm.password ? `hint:${acctForm.password}` : (acctForm.password || null);

    if (editingAcct) {
      await updateAccount(editingAcct.id, {
        accountName: acctForm.accountName, accountType: acctForm.accountType || null,
        accountNumber: acctNum, routingNumber: rtnNum,
        username: uname, passwordEncrypted: pwd,
        url: acctForm.url || null, contactName: acctForm.contactName || null,
        contactPhone: acctForm.contactPhone || null, contactEmail: acctForm.contactEmail || null,
        estimatedValue: acctForm.estimatedValue || null, beneficiary: acctForm.beneficiary || null,
        notes: acctForm.notes || null,
      });
      setEditingAcct(null);
    } else {
      await addAccount(user.id, {
        institutionId, accountName: acctForm.accountName,
        accountType: acctForm.accountType || null, accountNumber: acctNum,
        routingNumber: rtnNum, username: uname,
        passwordEncrypted: pwd, url: acctForm.url || null,
        contactName: acctForm.contactName || null, contactPhone: acctForm.contactPhone || null,
        contactEmail: acctForm.contactEmail || null, estimatedValue: acctForm.estimatedValue || null,
        beneficiary: acctForm.beneficiary || null, notes: acctForm.notes || null,
      });
    }
    resetAcctForm();
    setShowAcctForm(null);
    await load();
  };

  const handleDeleteInstitution = async (id: string) => {
    if (!confirm(`Delete this institution and all its ${itemLabel.toLowerCase()}?`)) return;
    await deleteInstitution(id);
    await load();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(`Delete this ${itemLabelSingular.toLowerCase()}?`)) return;
    await deleteAccount(id);
    await load();
  };

  const startEditInst = (inst: Institution) => {
    setInstForm({ name: inst.name, website: inst.website || '', phone: inst.phone || '', notes: inst.notes || '' });
    setEditingInst(inst);
    setShowInstForm(true);
  };

  const startEditAcct = (acct: Account) => {
    const editHintMode: Record<string, boolean> = {};
    let acctNum = acct.accountNumber || '';
    let rtnNum = acct.routingNumber || '';
    let username = acct.username || '';
    let password = acct.passwordEncrypted || '';

    if (isHint(acctNum)) { editHintMode.accountNumber = true; acctNum = getHintText(acctNum); }
    if (isHint(rtnNum)) { editHintMode.routingNumber = true; rtnNum = getHintText(rtnNum); }
    if (isHint(username)) { editHintMode.username = true; username = getHintText(username); }
    if (isHint(password)) { editHintMode.password = true; password = getHintText(password); }

    setAcctForm({
      accountName: acct.accountName, accountType: acct.accountType || '',
      accountNumber: acctNum, routingNumber: rtnNum,
      username: username, password: password,
      url: acct.url || '', contactName: acct.contactName || '',
      contactPhone: acct.contactPhone || '', contactEmail: acct.contactEmail || '',
      estimatedValue: acct.estimatedValue || '', beneficiary: acct.beneficiary || '',
      notes: acct.notes || ''
    });
    setHintMode(editHintMode);
    setEditingAcct(acct);
    setShowAcctForm(acct.institutionId);
  };

  if (!category) return <div className="loading">Loading...</div>;

  return (
    <div className="category-detail">
      <div className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          <ArrowLeft size={18} /> Back
        </button>
        <div>
          <h2>{category.name}</h2>
          <p>{category.description}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetInstForm(); setEditingInst(null); setShowInstPicker(true); }}>
          <Plus size={18} /> Add Institution
        </button>
      </div>

      {/* Institution Quick-Pick Grid */}
      {showInstPicker && (
        <div className="modal-overlay" onClick={() => setShowInstPicker(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Choose a Type</h3>
              <button className="btn btn-ghost" onClick={() => setShowInstPicker(false)}><X size={18} /></button>
            </div>
            <div className="preset-grid">
              {(institutionPresets[categoryId!] || ['Other']).map(preset => {
                const PresetIcon = presetIcons[preset] || MoreHorizontal;
                return (
                <button
                  key={preset}
                  className="preset-btn"
                  onClick={() => {
                    if (preset === 'Other') {
                      setInstForm({ name: '', website: '', phone: '', notes: '' });
                    } else {
                      setInstForm({ name: preset, website: '', phone: '', notes: '' });
                    }
                    setShowInstPicker(false);
                    setShowInstForm(true);
                  }}
                >
                  <PresetIcon size={24} />
                  <span>{preset}</span>
                </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showInstForm && (
        <div className="modal-overlay" onClick={() => setShowInstForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingInst ? 'Edit Institution' : 'Add Institution'}</h3>
              <button className="btn btn-ghost" onClick={() => setShowInstForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddInstitution}>
              <div className="form-group">
                <label>Institution Name *</label>
                <input type="text" value={instForm.name} onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
              </div>
              <div className="form-group">
                <label>Website</label>
                <input type="text" value={instForm.website} onChange={e => setInstForm(f => ({ ...f, website: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="text" value={instForm.phone} onChange={e => setInstForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={instForm.notes} onChange={e => setInstForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowInstForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingInst ? 'Update' : 'Add'} Institution</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {institutions.length === 0 ? (
        <div className="empty-state">
          <p>No institutions added yet. Click "Add Institution" to get started.</p>
        </div>
      ) : (
        <div className="institutions-list">
          {institutions.map(inst => {
            const instAccounts = accounts.filter(a => a.institutionId === inst.id);
            const isExpanded = expanded.has(inst.id);
            return (
              <div key={inst.id} className="institution-card">
                <div className="institution-header" onClick={() => toggleExpand(inst.id)}>
                  <div className="institution-toggle">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div className="institution-info">
                    <h4>{inst.name}</h4>
                    <span className="meta">
                      {inst.ownerName} · {instAccounts.length} {instAccounts.length === 1 ? itemLabelSingular.toLowerCase() : itemLabel.toLowerCase()}
                      {inst.website && <> · <a href={inst.website.startsWith('http') ? inst.website : `https://${inst.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{inst.website}</a></>}
                    </span>
                  </div>
                  <div className="institution-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-icon" onClick={() => startEditInst(inst)}><Edit3 size={16} /></button>
                    <button className="btn btn-icon btn-danger" onClick={() => handleDeleteInstitution(inst.id)}><Trash2 size={16} /></button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="institution-body">
                    {inst.phone && <p className="inst-detail"><strong>Phone:</strong> {inst.phone}</p>}
                    {inst.notes && <p className="inst-detail"><strong>Notes:</strong> {inst.notes}</p>}

                    <div className="accounts-section">
                      <div className="accounts-header">
                        <h5>{itemLabel}</h5>
                        <button className="btn btn-sm btn-primary" onClick={() => { resetAcctForm(); setEditingAcct(null); setShowAcctForm(inst.id); }}>
                          <Plus size={14} /> {addItemLabel}
                        </button>
                      </div>

                      {showAcctForm === inst.id && (
                        <div className="modal-overlay" onClick={() => setShowAcctForm(null)}>
                          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                              <h3>{editingAcct ? `Edit ${itemLabelSingular}` : addItemLabel}</h3>
                              <button className="btn btn-ghost" onClick={() => setShowAcctForm(null)}><X size={18} /></button>
                            </div>
                            <form onSubmit={e => handleAddAccount(e, inst.id)}>
                              {(() => {
                                const config = categoryFields[categoryId!] || defaultFields;
                                return (
                                  <div className="form-grid">
                                    <div className="form-group">
                                      <label>{nameFieldLabel} *</label>
                                      <input type="text" value={acctForm.accountName} onChange={e => setAcctForm(f => ({ ...f, accountName: e.target.value }))} required />
                                    </div>
                                    <div className="form-group">
                                      <label>Type</label>
                                      <input type="text" value={acctForm.accountType} onChange={e => setAcctForm(f => ({ ...f, accountType: e.target.value }))} placeholder={config.typePlaceholder} />
                                    </div>
                                    {config.fields.map(field => {
                                      const formKey = fieldToFormKey[field.key] as keyof typeof acctForm;
                                      const isSensitive = SENSITIVE_FIELD_KEYS.has(field.key);
                                      const isInHintMode = isSensitive && hintMode[formKey];
                                      const isMenuOpen = openComboMenu === formKey;
                                      return (
                                        <div className="form-group" key={field.key}>
                                          <label>
                                            {field.label}
                                            {isInHintMode && <span className="hint-mode-badge">Hint</span>}
                                          </label>
                                          {isSensitive ? (
                                            <div className="sensitive-combo-field">
                                              <input
                                                type={isInHintMode ? 'text' : (field.type || 'text')}
                                                value={acctForm[formKey]}
                                                onChange={e => setAcctForm(f => ({ ...f, [formKey]: e.target.value }))}
                                                placeholder={isInHintMode ? `Hint for ${field.label.toLowerCase()}...` : field.placeholder}
                                                className={isInHintMode ? 'hint-input' : ''}
                                              />
                                              <div className="sensitive-combo-toggle">
                                                <button
                                                  type="button"
                                                  className="btn btn-icon btn-combo-toggle"
                                                  onClick={() => setOpenComboMenu(isMenuOpen ? null : formKey)}
                                                >
                                                  <ChevronDown size={14} />
                                                </button>
                                                {isMenuOpen && (
                                                  <>
                                                    <div className="combo-backdrop" onClick={() => setOpenComboMenu(null)} />
                                                    <div className="sensitive-combo-menu open">
                                                      <button
                                                        type="button"
                                                        className={`sensitive-combo-option${!isInHintMode ? ' active' : ''}`}
                                                        onClick={() => { setHintMode(prev => ({ ...prev, [formKey]: false })); setOpenComboMenu(null); }}
                                                      >
                                                        <Lock size={14} />
                                                        <div>
                                                          <strong>Value</strong>
                                                          <span>Store the actual {field.label.toLowerCase()} (encrypted)</span>
                                                        </div>
                                                      </button>
                                                      <button
                                                        type="button"
                                                        className={`sensitive-combo-option${isInHintMode ? ' active' : ''}`}
                                                        onClick={() => { setHintMode(prev => ({ ...prev, [formKey]: true })); setOpenComboMenu(null); }}
                                                      >
                                                        <AlertCircle size={14} />
                                                        <div>
                                                          <strong>Hint</strong>
                                                          <span>Store a hint or reference instead</span>
                                                        </div>
                                                      </button>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          ) : (
                                            <input
                                              type={field.type || 'text'}
                                              value={acctForm[formKey]}
                                              onChange={e => setAcctForm(f => ({ ...f, [formKey]: e.target.value }))}
                                              placeholder={field.placeholder}
                                            />
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                              <div className="form-group form-full">
                                <label>Notes</label>
                                <textarea value={acctForm.notes} onChange={e => setAcctForm(f => ({ ...f, notes: e.target.value }))} />
                              </div>
                              <div className="form-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAcctForm(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingAcct ? 'Update' : 'Add'} {itemLabelSingular}</button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}

                      {instAccounts.length === 0 ? (
                        <p className="no-accounts">No {itemLabel.toLowerCase()} yet.</p>
                      ) : (
                        <div className="accounts-list">
                          {instAccounts.map(acct => (
                            <div key={acct.id} className="account-card">
                              <div className="account-header">
                                <div className="account-header-info">
                                  <div className="account-owner-avatar">{acct.ownerName.split(' ').map(n => n[0]).join('')}</div>
                                  <span className="account-owner-name">{acct.ownerName}</span>
                                  {acct.accountType && <span className="badge">{acct.accountType}</span>}
                                  <strong>{acct.accountName}</strong>
                                </div>
                                <div className="account-actions">
                                  <button className="btn btn-icon" onClick={() => startEditAcct(acct)}><Edit3 size={14} /></button>
                                  <button className="btn btn-icon btn-danger" onClick={() => handleDeleteAccount(acct.id)}><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <div className="account-details">
                                {acct.accountNumber && (
                                  isHint(acct.accountNumber) ? (
                                    <div>
                                      <label>Account #:</label>
                                      <span className="hint-display"><AlertCircle size={14} className="hint-icon" /><em>{getHintText(acct.accountNumber)}</em></span>
                                    </div>
                                  ) : (
                                    <div>
                                      <label>Account #:</label>
                                      <span className="password-field">
                                        {revealedFields.has(`${acct.id}-acct`) ? acct.accountNumber : maskValue(acct.accountNumber)}
                                        <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`)}>
                                          {revealedFields.has(`${acct.id}-acct`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </span>
                                    </div>
                                  )
                                )}
                                {acct.routingNumber && (
                                  isHint(acct.routingNumber) ? (
                                    <div>
                                      <label>Routing #:</label>
                                      <span className="hint-display"><AlertCircle size={14} className="hint-icon" /><em>{getHintText(acct.routingNumber)}</em></span>
                                    </div>
                                  ) : (
                                    <div>
                                      <label>Routing #:</label>
                                      <span className="password-field">
                                        {revealedFields.has(`${acct.id}-rtn`) ? acct.routingNumber : maskValue(acct.routingNumber)}
                                        <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`)}>
                                          {revealedFields.has(`${acct.id}-rtn`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </span>
                                    </div>
                                  )
                                )}
                                {acct.username && (
                                  isHint(acct.username) ? (
                                    <div>
                                      <label>Username:</label>
                                      <span className="hint-display"><AlertCircle size={14} className="hint-icon" /><em>{getHintText(acct.username)}</em></span>
                                    </div>
                                  ) : (
                                    <div>
                                      <label>Username:</label>
                                      <span className="password-field">
                                        {revealedFields.has(`${acct.id}-user`) ? acct.username : maskValue(acct.username)}
                                        <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`)}>
                                          {revealedFields.has(`${acct.id}-user`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </span>
                                    </div>
                                  )
                                )}
                                {acct.passwordEncrypted && (
                                  isHint(acct.passwordEncrypted) ? (
                                    <div>
                                      <label>Password:</label>
                                      <span className="hint-display"><AlertCircle size={14} className="hint-icon" /><em>{getHintText(acct.passwordEncrypted)}</em></span>
                                    </div>
                                  ) : (
                                    <div>
                                      <label>Password:</label>
                                      <span className="password-field">
                                        {revealedFields.has(`${acct.id}-pass`) ? acct.passwordEncrypted : '••••••••'}
                                        <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`)}>
                                          {revealedFields.has(`${acct.id}-pass`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                        </button>
                                      </span>
                                    </div>
                                  )
                                )}
                                {acct.url && <div><label>URL:</label> <a href={acct.url.startsWith('http') ? acct.url : `https://${acct.url}`} target="_blank" rel="noreferrer">{acct.url}</a></div>}
                                {acct.estimatedValue && <div><label>Value:</label> <span>{acct.estimatedValue}</span></div>}
                                {acct.beneficiary && <div><label>Beneficiary:</label> <span>{acct.beneficiary}</span></div>}
                                {acct.contactName && <div><label>Contact:</label> <span>{acct.contactName} {acct.contactPhone ? `· ${acct.contactPhone}` : ''} {acct.contactEmail ? `· ${acct.contactEmail}` : ''}</span></div>}
                                {acct.notes && <div><label>Notes:</label> <span>{acct.notes}</span></div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
