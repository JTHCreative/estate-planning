import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  CATEGORIES, getInstitutions, getAccounts,
  addInstitution, updateInstitution, deleteInstitution,
  addAccount, updateAccount, deleteAccount, verifyPin, getUserProfile,
  deriveKeyFromPin, encryptWithKey, decryptWithKey, isEncrypted, isHint, getHintText,
} from '../lib/storage';
import type { Institution, Account } from '../lib/storage';
import {
  categoryFields, defaultFields, institutionPresets, presetIcons, fieldToFormKey,
  SENSITIVE_FIELD_KEYS,
  Plus, Trash2, Edit3, Eye, EyeOff, X, MoreHorizontal,
  DollarSign, ShieldCheck, Home, Briefcase, Globe, Zap, Heart,
  type LucideIcon,
} from '../lib/categoryConfig';
import * as Icons from 'lucide-react';

type InstitutionWithOwner = Institution & { ownerName: string };
type AccountWithOwner = Account & { ownerName: string };

interface RootCategory {
  name: string;
  icon: LucideIcon;
  categoryIds: string[];
}

const rootCategories: RootCategory[] = [
  { name: 'Financial Accounts', icon: DollarSign, categoryIds: ['bank-accounts', 'investment-accounts', 'retirement-accounts', 'debts-liabilities'] },
  { name: 'Insurance & Protection', icon: ShieldCheck, categoryIds: ['insurance-policies', 'healthcare'] },
  { name: 'Property & Assets', icon: Home, categoryIds: ['real-estate', 'vehicles', 'personal-property'] },
  { name: 'Business & Legal', icon: Briefcase, categoryIds: ['business-interests', 'trusts-entities', 'estate-documents', 'tax-records'] },
  { name: 'Digital Life', icon: Globe, categoryIds: ['digital-assets', 'social-media', 'subscriptions'] },
  { name: 'Everyday & Utilities', icon: Zap, categoryIds: ['utilities', 'education'] },
  { name: 'People & Wishes', icon: Heart, categoryIds: ['emergency-contacts', 'final-wishes'] },
];

const iconMap: Record<string, LucideIcon> = {
  'landmark': Icons.Landmark,
  'trending-up': Icons.TrendingUp,
  'piggy-bank': Icons.PiggyBank,
  'shield': Icons.Shield,
  'home': Icons.Home,
  'car': Icons.Car,
  'briefcase': Icons.Briefcase,
  'globe': Icons.Globe,
  'credit-card': Icons.CreditCard,
  'file-text': Icons.FileText,
  'calculator': Icons.Calculator,
  'gem': Icons.Gem,
  'repeat': Icons.Repeat,
  'at-sign': Icons.AtSign,
  'zap': Icons.Zap,
  'heart-pulse': Icons.HeartPulse,
  'graduation-cap': Icons.GraduationCap,
  'scale': Icons.Scale,
  'phone': Icons.Phone,
  'heart': Icons.Heart,
};

export default function Dashboard() {
  const { user, setUserPin, refreshUser } = useAuth();

  // User filter state
  const [activeUserIds, setActiveUserIds] = useState<Set<string>>(new Set());

  // Initialize active users when user/household loads
  useEffect(() => {
    if (user) {
      const ids = new Set(user.householdMembers.map(m => m.id));
      if (ids.size === 0) ids.add(user.id);
      setActiveUserIds(ids);
    }
  }, [user?.id, user?.householdMembers]);

  const toggleUserFilter = (uid: string) => {
    setActiveUserIds(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        if (next.size > 1) next.delete(uid); // Don't allow empty
      } else {
        next.add(uid);
      }
      return next;
    });
  };


  // Filter dropdown
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [expandedHouseholds, setExpandedHouseholds] = useState<Set<string>>(new Set());

  const toggleHouseholdExpand = (hid: string) => {
    setExpandedHouseholds(prev => {
      const next = new Set(prev);
      next.has(hid) ? next.delete(hid) : next.add(hid);
      return next;
    });
  };

  const toggleHouseholdMembers = (memberIds: string[]) => {
    // If all are selected, deselect all. Otherwise select all.
    setActiveUserIds(prev => {
      const next = new Set(prev);
      const allSelected = memberIds.every(id => next.has(id));
      if (allSelected) {
        // Deselect all (but keep the user selected if they would otherwise have nothing)
        for (const id of memberIds) next.delete(id);
        if (next.size === 0 && user) next.add(user.id);
      } else {
        for (const id of memberIds) next.add(id);
      }
      return next;
    });
  };

  // Members list: always include self even if householdMembers is empty
  const allMembers = (user?.householdMembers && user.householdMembers.length > 0)
    ? user.householdMembers
    : user ? [{ id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, photoURL: user.photoURL }] : [];

  // Navigation state
  const [selectedRoot, setSelectedRoot] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);

  // Data state
  const [institutions, setInstitutions] = useState<InstitutionWithOwner[]>([]);
  const [accounts, setAccounts] = useState<AccountWithOwner[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<InstitutionWithOwner[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountWithOwner[]>([]);
  // Modal state
  const [showInstPicker, setShowInstPicker] = useState(false);
  const [showInstForm, setShowInstForm] = useState(false);
  const [showAcctForm, setShowAcctForm] = useState(false);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);

  // Form state
  const [instForm, setInstForm] = useState({ name: '', website: '', phone: '', notes: '' });
  const [acctForm, setAcctForm] = useState({
    accountName: '', accountType: '', accountNumber: '', routingNumber: '',
    username: '', password: '', url: '', contactName: '', contactPhone: '',
    contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
  });
  // Track which sensitive fields are in "hint" mode (key = formKey)
  const [hintMode, setHintMode] = useState<Record<string, boolean>>({});
  // Track which combo dropdown menu is currently open (null = none)
  const [openComboMenu, setOpenComboMenu] = useState<string | null>(null);

  // Reveal state for masked fields
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);

  // PIN unlock state - which user IDs are currently unlocked for sensitive viewing
  const [unlockedUsers, setUnlockedUsers] = useState<Set<string>>(new Set());
  const [pinPromptUserId, setPinPromptUserId] = useState<string | null>(null);
  const [pinPromptFieldKey, setPinPromptFieldKey] = useState<string | null>(null);
  const [pinPromptForSave, setPinPromptForSave] = useState(false);
  const [pinPromptIsSetup, setPinPromptIsSetup] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [pinPromptError, setPinPromptError] = useState('');

  // Cache derived AES keys per user (in a ref so it persists across renders without triggering re-renders)
  const userKeysRef = useRef<Map<string, CryptoKey>>(new Map());
  // Cache decrypted field values: key = `${acctId}-${fieldName}`, value = decrypted plaintext
  const [decryptedFields, setDecryptedFields] = useState<Map<string, string>>(new Map());

  // Derived: selected category object
  const selectedCategory = selectedCategoryId ? CATEGORIES.find(c => c.id === selectedCategoryId) || null : null;
  const config = selectedCategoryId ? (categoryFields[selectedCategoryId] || defaultFields) : defaultFields;
  const instLabel = config.institutionLabel || 'Institutions';
  const instLabelSingular = instLabel.endsWith('s') ? instLabel.slice(0, -1) : instLabel;
  const addInstLabel = config.addInstitutionLabel || 'Add Institution';
  const instNameFieldLabel = config.institutionNameLabel || 'Institution Name';
  const itemLabel = config.accountLabel || 'Accounts';
  const itemLabelSingular = itemLabel.endsWith('s') ? itemLabel.slice(0, -1) : itemLabel;
  const addItemLabel = config.addLabel || 'Add Account';
  const nameFieldLabel = config.nameLabel || 'Account Name';

  // Institutions filtered for the selected category AND active users
  const categoryInstitutions = institutions.filter(i => i.categoryId === selectedCategoryId && activeUserIds.has(i.userId));
  const selectedInstitution = categoryInstitutions.find(i => i.id === selectedInstitutionId) || null;
  const institutionAccounts = accounts.filter(a => a.institutionId === selectedInstitutionId && activeUserIds.has(a.userId));

  // Filtered counts based on activeUserIds
  const filteredInsts = allInstitutions.filter(i => activeUserIds.has(i.userId));
  const filteredAccts = allAccounts.filter(a => activeUserIds.has(a.userId));

  const getCategoryCounts = (catId: string) => {
    const instCount = filteredInsts.filter(i => i.categoryId === catId).length;
    const catInstIds = new Set(filteredInsts.filter(i => i.categoryId === catId).map(i => i.id));
    const acctCount = filteredAccts.filter(a => catInstIds.has(a.institutionId)).length;
    return { instCount, acctCount };
  };

  // Load all household data for counts
  const loadAllData = useCallback(async () => {
    if (!user) return;
    const [insts, accts] = await Promise.all([
      getInstitutions(user.id),
      getAccounts(user.id),
    ]);
    setAllInstitutions(insts);
    setAllAccounts(accts);
  }, [user]);

  // Load institutions and accounts for the selected category
  const loadCategoryData = useCallback(async () => {
    if (!user || !selectedCategoryId) return;
    const [insts, accts, allInsts, allAccts] = await Promise.all([
      getInstitutions(user.id, selectedCategoryId),
      getAccounts(user.id),
      getInstitutions(user.id),
      getAccounts(user.id),
    ]);
    setInstitutions(insts);
    setAccounts(accts);
    setAllInstitutions(allInsts);
    setAllAccounts(allAccts);
  }, [user, selectedCategoryId]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (selectedCategoryId) {
      loadCategoryData();
    }
  }, [selectedCategoryId, loadCategoryData]);

  // Auto-select first institution when category data loads
  useEffect(() => {
    if (selectedCategoryId && categoryInstitutions.length > 0 && !selectedInstitutionId) {
      setSelectedInstitutionId(categoryInstitutions[0].id);
    }
  }, [selectedCategoryId, categoryInstitutions, selectedInstitutionId]);

  // Handlers: navigation
  const handleRootClick = (idx: number) => {
    if (selectedRoot === idx) {
      // Collapse
      setSelectedRoot(null);
      setSelectedCategoryId(null);
      setSelectedInstitutionId(null);
    } else {
      setSelectedRoot(idx);
      setSelectedCategoryId(null);
      setSelectedInstitutionId(null);
    }
  };

  const handleSubcategoryClick = (catId: string) => {
    setSelectedCategoryId(catId);
    setSelectedInstitutionId(null);
    setRevealedFields(new Set());
  };

  // Search results: match institutions and accounts by name
  const searchResults = (() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [] as Array<{ type: 'institution' | 'account'; institution: InstitutionWithOwner; account?: AccountWithOwner }>;

    const results: Array<{ type: 'institution' | 'account'; institution: InstitutionWithOwner; account?: AccountWithOwner }> = [];

    // Match institutions visible to the active filter
    for (const inst of allInstitutions) {
      if (!activeUserIds.has(inst.userId)) continue;
      if (inst.name.toLowerCase().includes(q)) {
        results.push({ type: 'institution', institution: inst });
      }
    }

    // Match accounts (and include their institution)
    for (const acct of allAccounts) {
      if (!activeUserIds.has(acct.userId)) continue;
      if (acct.accountName.toLowerCase().includes(q) || (acct.accountType || '').toLowerCase().includes(q)) {
        const inst = allInstitutions.find(i => i.id === acct.institutionId);
        if (inst) results.push({ type: 'account', institution: inst, account: acct });
      }
    }

    return results.slice(0, 12);
  })();

  // Auto-navigate to a specific institution (and optionally an account within it)
  const navigateToInstitution = (inst: InstitutionWithOwner, acctId?: string) => {
    // Find which root group this category belongs to
    const rootIdx = rootCategories.findIndex(r => r.categoryIds.includes(inst.categoryId));
    if (rootIdx === -1) return;
    setSelectedRoot(rootIdx);
    setSelectedCategoryId(inst.categoryId);
    setSelectedInstitutionId(inst.id);
    setRevealedFields(new Set());
    setSearchQuery('');
    setShowSearchResults(false);
    // If we navigated to a specific account, mark it for highlight (optional future use)
    void acctId;
  };

  // Decrypt all encrypted fields visible for the given owner using their cached key
  const decryptOwnerFields = async (ownerId: string) => {
    const key = userKeysRef.current.get(ownerId);
    if (!key) return;
    const newDecrypted = new Map(decryptedFields);
    const ownerAccts = allAccounts.filter(a => a.userId === ownerId);
    for (const acct of ownerAccts) {
      const fields: Array<['acct' | 'rtn' | 'user' | 'pass', string | null]> = [
        ['acct', acct.accountNumber],
        ['rtn', acct.routingNumber],
        ['user', acct.username],
        ['pass', acct.passwordEncrypted],
      ];
      for (const [tag, val] of fields) {
        if (val && isEncrypted(val)) {
          const plain = await decryptWithKey(val, key);
          newDecrypted.set(`${acct.id}-${tag}`, plain);
        }
      }
    }
    setDecryptedFields(newDecrypted);
  };

  // Get the plain (or decrypted) value for a sensitive field
  const getFieldValue = (acctId: string, tag: string, raw: string | null): string => {
    if (!raw) return '';
    if (!isEncrypted(raw)) return raw;
    return decryptedFields.get(`${acctId}-${tag}`) || raw;
  };

  // Handlers: field masking
  const toggleField = async (key: string, ownerId: string) => {
    // If currently revealed, just hide it
    if (revealedFields.has(key)) {
      setRevealedFields(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      return;
    }
    // If owner is already unlocked this session, reveal directly
    if (unlockedUsers.has(ownerId)) {
      setRevealedFields(prev => new Set(prev).add(key));
      return;
    }
    // Otherwise, check if owner has a PIN. If not, reveal directly.
    const ownerProfile = await getUserProfile(ownerId);
    if (!ownerProfile?.pinHash) {
      setUnlockedUsers(prev => new Set(prev).add(ownerId));
      setRevealedFields(prev => new Set(prev).add(key));
      return;
    }
    // PIN required — show the prompt
    setPinPromptUserId(ownerId);
    setPinPromptFieldKey(key);
    setPinPromptForSave(false);
    setPinInput('');
    setPinPromptError('');
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinPromptUserId) return;
    setPinPromptError('');

    if (pinPromptIsSetup) {
      // First-time PIN setup before encrypting sensitive data
      if (pinInput.length !== 6) {
        setPinPromptError('PIN must be 6 digits');
        return;
      }
      if (pinInput !== pinConfirmInput) {
        setPinPromptError('PINs do not match');
        return;
      }
      try {
        await setUserPin(pinInput);
      } catch {
        setPinPromptError('Could not set PIN. Please try again.');
        return;
      }
      // Refresh user so user.hasPin reflects the new state
      await refreshUser();
    } else {
      const ok = await verifyPin(pinPromptUserId, pinInput);
      if (!ok) {
        setPinPromptError('Incorrect PIN');
        setPinInput('');
        return;
      }
    }

    // Derive and cache the AES key for this user
    const key = await deriveKeyFromPin(pinInput);
    userKeysRef.current.set(pinPromptUserId, key);
    setUnlockedUsers(prev => new Set(prev).add(pinPromptUserId));

    // Decrypt all visible fields for this user
    await decryptOwnerFields(pinPromptUserId);

    if (pinPromptFieldKey) {
      setRevealedFields(prev => new Set(prev).add(pinPromptFieldKey));
    }

    const wasForSave = pinPromptForSave;
    setPinPromptUserId(null);
    setPinPromptFieldKey(null);
    setPinPromptForSave(false);
    setPinPromptIsSetup(false);
    setPinInput('');
    setPinConfirmInput('');

    // If this was triggered by a save attempt, retry the save
    if (wasForSave) {
      setTimeout(() => savePendingAccountRef.current?.(), 0);
    }
  };

  // Ref to allow PIN unlock to retry an account save
  const savePendingAccountRef = useRef<(() => void) | null>(null);

  const maskValue = (value: string) => {
    if (value.length <= 4) return '••••';
    return '••••' + value.slice(-4);
  };

  // Handlers: forms
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

  // Institution CRUD
  const handleAddInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCategoryId) return;
    if (editingInst) {
      await updateInstitution(editingInst.id, {
        name: instForm.name, website: instForm.website || null,
        phone: instForm.phone || null, notes: instForm.notes || null,
      });
      setEditingInst(null);
    } else {
      const newInst = await addInstitution(user.id, {
        categoryId: selectedCategoryId, name: instForm.name,
        website: instForm.website || null, phone: instForm.phone || null, notes: instForm.notes || null,
      });
      setSelectedInstitutionId(newInst.id);
    }
    resetInstForm();
    setShowInstForm(false);
    await loadCategoryData();
    await loadAllData();
  };

  const handleDeleteInstitution = async (id: string) => {
    if (!confirm(`Delete this ${instLabelSingular.toLowerCase()} and all its ${itemLabel.toLowerCase()}?`)) return;
    await deleteInstitution(id);
    if (selectedInstitutionId === id) {
      setSelectedInstitutionId(null);
    }
    await loadCategoryData();
    await loadAllData();
  };

  const startEditInst = (inst: Institution) => {
    setInstForm({ name: inst.name, website: inst.website || '', phone: inst.phone || '', notes: inst.notes || '' });
    setEditingInst(inst);
    setShowInstForm(true);
  };

  // Account CRUD
  const performAccountSave = async () => {
    if (!user || !selectedInstitutionId) return;

    // Prepare sensitive fields: hints get "hint:" prefix baked into the value before encryption
    let acctNum = acctForm.accountNumber || null;
    let rtnNum = acctForm.routingNumber || null;
    let username = acctForm.username || null;
    let password = acctForm.password || null;

    // Apply hint prefix for fields in hint mode (prefix is encrypted along with the value)
    if (hintMode.accountNumber && acctNum) acctNum = `hint:${acctNum}`;
    if (hintMode.routingNumber && rtnNum) rtnNum = `hint:${rtnNum}`;
    if (hintMode.username && username) username = `hint:${username}`;
    if (hintMode.password && password) password = `hint:${password}`;

    // Encrypt ALL sensitive fields (including hints)
    const hasSensitiveData = !!(acctNum || rtnNum || username || password);

    if (hasSensitiveData) {
      if (!user.hasPin) {
        savePendingAccountRef.current = () => { performAccountSave(); };
        setPinPromptUserId(user.id);
        setPinPromptFieldKey(null);
        setPinPromptForSave(true);
        setPinPromptIsSetup(true);
        setPinInput('');
        setPinConfirmInput('');
        setPinPromptError('');
        return;
      }
      const key = userKeysRef.current.get(user.id);
      if (!key) {
        savePendingAccountRef.current = () => { performAccountSave(); };
        setPinPromptUserId(user.id);
        setPinPromptFieldKey(null);
        setPinPromptForSave(true);
        setPinPromptIsSetup(false);
        setPinInput('');
        setPinPromptError('');
        return;
      }
      if (acctNum) acctNum = await encryptWithKey(acctNum, key);
      if (rtnNum) rtnNum = await encryptWithKey(rtnNum, key);
      if (username) username = await encryptWithKey(username, key);
      if (password) password = await encryptWithKey(password, key);
    }

    if (editingAcct) {
      await updateAccount(editingAcct.id, {
        accountName: acctForm.accountName, accountType: acctForm.accountType || null,
        accountNumber: acctNum, routingNumber: rtnNum,
        username: username, passwordEncrypted: password,
        url: acctForm.url || null, contactName: acctForm.contactName || null,
        contactPhone: acctForm.contactPhone || null, contactEmail: acctForm.contactEmail || null,
        estimatedValue: acctForm.estimatedValue || null, beneficiary: acctForm.beneficiary || null,
        notes: acctForm.notes || null,
      });
      setEditingAcct(null);
    } else {
      await addAccount(user.id, {
        institutionId: selectedInstitutionId, accountName: acctForm.accountName,
        accountType: acctForm.accountType || null, accountNumber: acctNum,
        routingNumber: rtnNum, username: username,
        passwordEncrypted: password, url: acctForm.url || null,
        contactName: acctForm.contactName || null, contactPhone: acctForm.contactPhone || null,
        contactEmail: acctForm.contactEmail || null, estimatedValue: acctForm.estimatedValue || null,
        beneficiary: acctForm.beneficiary || null, notes: acctForm.notes || null,
      });
    }
    resetAcctForm();
    setShowAcctForm(false);
    savePendingAccountRef.current = null;
    await loadCategoryData();
    await loadAllData();
    // Re-decrypt visible fields for our user if a key is cached (PIN unlocked)
    if (userKeysRef.current.has(user.id)) await decryptOwnerFields(user.id);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    await performAccountSave();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(`Delete this ${itemLabelSingular.toLowerCase()}?`)) return;
    await deleteAccount(id);
    await loadCategoryData();
    await loadAllData();
  };

  const startEditAcct = async (acct: Account) => {
    // For encrypted accounts, we need the user's key to decrypt fields for editing
    let acctNum = acct.accountNumber || '';
    let rtnNum = acct.routingNumber || '';
    let username = acct.username || '';
    let password = acct.passwordEncrypted || '';

    const hasEncrypted = isEncrypted(acct.accountNumber) || isEncrypted(acct.routingNumber)
      || isEncrypted(acct.username) || isEncrypted(acct.passwordEncrypted);

    if (hasEncrypted) {
      const key = userKeysRef.current.get(acct.userId);
      if (!key) {
        // Need PIN to decrypt before editing
        setPinPromptUserId(acct.userId);
        setPinPromptFieldKey(null);
        setPinPromptForSave(false);
        savePendingAccountRef.current = () => { startEditAcct(acct); };
        setPinInput('');
        setPinPromptError('');
        return;
      }
      if (isEncrypted(acctNum)) acctNum = await decryptWithKey(acctNum, key);
      if (isEncrypted(rtnNum)) rtnNum = await decryptWithKey(rtnNum, key);
      if (isEncrypted(username)) username = await decryptWithKey(username, key);
      if (isEncrypted(password)) password = await decryptWithKey(password, key);
    }

    // Detect which decrypted fields are hints and restore hint mode
    const editHintMode: Record<string, boolean> = {};
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
    setShowAcctForm(true);
  };

  // Get the selected root category info for breadcrumb
  const selectedRootCategory = selectedRoot !== null ? rootCategories[selectedRoot] : null;

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dash-header">
        <h2>Dashboard</h2>
        <div className="dash-header-actions">
        <div className="search-wrapper">
          <div className="search-input-wrap">
            <Icons.Search size={16} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search institutions or accounts..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
              onFocus={() => setShowSearchResults(true)}
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => { setSearchQuery(''); setShowSearchResults(false); }}>
                <X size={14} />
              </button>
            )}
          </div>
          {showSearchResults && searchQuery && (
            <>
              <div className="filter-backdrop" onClick={() => setShowSearchResults(false)} />
              <div className="search-results">
                {searchResults.length === 0 ? (
                  <div className="search-empty">No matches found</div>
                ) : (
                  searchResults.map((r, idx) => {
                    const owner = allMembers.find(m => m.id === r.institution.userId);
                    const ownerInitials = owner ? `${owner.firstName?.[0] || ''}${owner.lastName?.[0] || ''}`.toUpperCase() : '';
                    const cat = CATEGORIES.find(c => c.id === r.institution.categoryId);
                    return (
                      <div
                        key={idx}
                        className="search-result-item"
                        onClick={() => navigateToInstitution(r.institution, r.account?.id)}
                      >
                        <div className="search-result-avatar">
                          {owner?.photoURL
                            ? <img src={owner.photoURL} alt="" />
                            : <span>{ownerInitials}</span>
                          }
                        </div>
                        <div className="search-result-info">
                          <div className="search-result-title">
                            {r.type === 'account' ? r.account!.accountName : r.institution.name}
                          </div>
                          <div className="search-result-meta">
                            {r.type === 'account' && (
                              <>{r.institution.name} · </>
                            )}
                            {cat?.name}
                          </div>
                        </div>
                        <span className="search-result-type">{r.type === 'account' ? 'Account' : 'Institution'}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
        <div className="filter-wrapper">
          <button className="btn btn-filter" onClick={() => setShowFilterDropdown(!showFilterDropdown)}>
            <Icons.Filter size={16} />
            Filter
            {activeUserIds.size < allMembers.length && (
              <span className="filter-badge">{activeUserIds.size}</span>
            )}
          </button>
          {showFilterDropdown && (
            <>
              <div className="filter-backdrop" onClick={() => setShowFilterDropdown(false)} />
              <div className="filter-dropdown">
                <div className="filter-dropdown-header">
                  <span>Filter by Household / Member</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setActiveUserIds(new Set(allMembers.map(m => m.id)));
                  }}>Select All</button>
                </div>

                {/* If user has households, show grouped by household */}
                {user && user.households.length > 0 ? (
                  user.households.map(hh => {
                    const memberIds = hh.members.map(m => m.id);
                    const allSelected = memberIds.length > 0 && memberIds.every(id => activeUserIds.has(id));
                    const someSelected = memberIds.some(id => activeUserIds.has(id));
                    const isExpanded = expandedHouseholds.has(hh.id);
                    return (
                      <div key={hh.id} className="filter-household">
                        <div className="filter-household-header">
                          <div
                            className={`filter-item-check${allSelected ? ' active' : ''}${!allSelected && someSelected ? ' partial' : ''}`}
                            onClick={() => toggleHouseholdMembers(memberIds)}
                          >
                            {allSelected && <Icons.Check size={14} />}
                            {!allSelected && someSelected && <Icons.Minus size={14} />}
                          </div>
                          <span className="filter-household-name" onClick={() => toggleHouseholdMembers(memberIds)}>
                            {hh.name}
                          </span>
                          <span className="filter-household-count">{hh.members.length}</span>
                          <button className="btn btn-icon btn-sm" onClick={() => toggleHouseholdExpand(hh.id)}>
                            {isExpanded ? <Icons.ChevronDown size={14} /> : <Icons.ChevronRight size={14} />}
                          </button>
                        </div>
                        {isExpanded && hh.members.map(member => {
                          const mInitials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
                          const isMe = member.id === user.id;
                          const isActive = activeUserIds.has(member.id);
                          return (
                            <div
                              key={`${hh.id}-${member.id}`}
                              className={`filter-item filter-household-member${isActive ? ' active' : ''}`}
                              onClick={() => toggleUserFilter(member.id)}
                            >
                              <div className="filter-item-check">
                                {isActive && <Icons.Check size={14} />}
                              </div>
                              {member.photoURL
                                ? <img src={member.photoURL} alt="" className="filter-item-avatar" />
                                : <span className="filter-item-initials">{mInitials}</span>
                              }
                              <span>{member.firstName} {member.lastName}{isMe ? ' (You)' : ''}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })
                ) : (
                  // No households — just show the user
                  user && (
                    <div
                      className={`filter-item${activeUserIds.has(user.id) ? ' active' : ''}`}
                      onClick={() => toggleUserFilter(user.id)}
                    >
                      <div className="filter-item-check">
                        {activeUserIds.has(user.id) && <Icons.Check size={14} />}
                      </div>
                      {user.photoURL
                        ? <img src={user.photoURL} alt="" className="filter-item-avatar" />
                        : <span className="filter-item-initials">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                      }
                      <span>{user.firstName} {user.lastName} (You)</span>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </div>
        </div>
      </div>

      {/* Root Category Cards */}
      <div className="root-cards-grid">
        {rootCategories.map((root, idx) => {
          const RootIcon = root.icon;
          let rootInsts = 0, rootAccts = 0;
          root.categoryIds.forEach(catId => {
            const c = getCategoryCounts(catId);
            rootInsts += c.instCount;
            rootAccts += c.acctCount;
          });
          return (
            <div
              key={root.name}
              className={`root-card${selectedRoot === idx ? ' active' : ''}${rootInsts > 0 ? ' has-data' : ''}`}
              onClick={() => handleRootClick(idx)}
            >
              <RootIcon size={32} />
              <span className="root-card-name">{root.name}</span>
              <div className="root-card-counts">
                <span>{rootInsts} {rootInsts === 1 ? 'Institution' : 'Institutions'}</span>
                <span>{rootAccts} {rootAccts === 1 ? 'Account' : 'Accounts'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Subcategory Section */}
      {selectedRoot !== null && selectedRootCategory && (
        <div className="subcategory-section">
          <h3>{selectedRootCategory.name}</h3>
          <div className="category-tile-grid">
            {selectedRootCategory.categoryIds.map(catId => {
              const cat = CATEGORIES.find(c => c.id === catId);
              if (!cat) return null;
              const CatIcon = iconMap[cat.icon] || Icons.Folder;
              const { instCount, acctCount } = getCategoryCounts(catId);
              const isSelected = selectedCategoryId === catId;
              return (
                <div
                  key={catId}
                  className={`category-tile${instCount > 0 ? ' has-data' : ''}${isSelected ? ' selected' : ''}`}
                  onClick={() => handleSubcategoryClick(catId)}
                >
                  <div className="category-tile-icon"><CatIcon size={28} /></div>
                  <span className="category-tile-name">{cat.name}</span>
                  {(() => {
                    const catConfig = categoryFields[catId] || defaultFields;
                    const catInstLabel = catConfig.institutionLabel || 'Institutions';
                    const catInstSingular = catInstLabel.endsWith('s') ? catInstLabel.slice(0, -1) : catInstLabel;
                    const catAcctLabel = catConfig.accountLabel || 'Accounts';
                    const catAcctSingular = catAcctLabel.endsWith('s') ? catAcctLabel.slice(0, -1) : catAcctLabel;
                    return (
                      <div className="category-tile-counts">
                        <span>{instCount} {instCount === 1 ? catInstSingular : catInstLabel}</span>
                        <span>{acctCount} {acctCount === 1 ? catAcctSingular : catAcctLabel}</span>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Two-column layout below subcategory tiles */}
      {selectedCategoryId && selectedRootCategory && selectedCategory && (
        <>

          <div className="two-column-layout">
            {/* Left: Institution Panel */}
            <div className="inst-panel">
              <div className="inst-panel-header">
                <h4>{instLabel}</h4>
                <button className="btn btn-sm btn-primary" onClick={() => { resetInstForm(); setEditingInst(null); setShowInstPicker(true); }}>
                  <Plus size={14} /> Add
                </button>
              </div>
              {categoryInstitutions.length === 0 ? (
                <div className="inst-panel-empty">
                  <p>No {instLabel.toLowerCase()} yet.</p>
                  <p className="hint">Click "+ Add" to get started.</p>
                </div>
              ) : (
                <div className="inst-panel-list">
                  {categoryInstitutions.map(inst => {
                    const instAccts = accounts.filter(a => a.institutionId === inst.id && activeUserIds.has(a.userId));
                    const instAcctCount = instAccts.length;
                    // Get unique users who have accounts in this institution
                    const userIds = [...new Set(instAccts.map(a => a.userId))];
                    const instUsers = userIds.map(uid => allMembers.find(m => m.id === uid)).filter(Boolean);
                    return (
                      <div
                        key={inst.id}
                        className={`inst-panel-item${selectedInstitutionId === inst.id ? ' active' : ''}`}
                        onClick={() => setSelectedInstitutionId(inst.id)}
                      >
                        <div className="inst-panel-item-info">
                          <strong>{inst.name}</strong>
                          <span className="meta">{instAcctCount} {instAcctCount === 1 ? itemLabelSingular.toLowerCase() : itemLabel.toLowerCase()}</span>
                        </div>
                        {instUsers.length > 0 && (
                          <div className={`inst-user-avatars${instUsers.length > 3 ? ' wrap' : ''}`}>
                            {instUsers.map(m => {
                              const mInitials = `${m!.firstName?.[0] || ''}${m!.lastName?.[0] || ''}`.toUpperCase();
                              return (
                                <div key={m!.id} className="inst-user-avatar" title={`${m!.firstName} ${m!.lastName}`}>
                                  {m!.photoURL
                                    ? <img src={m!.photoURL} alt="" />
                                    : <span>{mInitials}</span>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {(inst.userId === user?.id || (inst.coOwnerIds || []).includes(user?.id || '')) && (
                          <div className="inst-panel-item-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-icon" onClick={() => startEditInst(inst)}><Edit3 size={14} /></button>
                            {inst.userId === user?.id && (
                              <button className="btn btn-icon btn-danger" onClick={() => handleDeleteInstitution(inst.id)}><Trash2 size={14} /></button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right: Account Panel */}
            <div className="acct-panel">
              {selectedInstitution ? (
                <>
                  <div className="acct-panel-header">
                    <div>
                      <h4>{selectedInstitution.name}</h4>
                      {selectedInstitution.website && (
                        <a
                          href={selectedInstitution.website.startsWith('http') ? selectedInstitution.website : `https://${selectedInstitution.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inst-website-link"
                        >
                          {selectedInstitution.website}
                        </a>
                      )}
                      {selectedInstitution.phone && <span className="meta"> | {selectedInstitution.phone}</span>}
                      {selectedInstitution.notes && <p className="meta">{selectedInstitution.notes}</p>}
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={() => { resetAcctForm(); setEditingAcct(null); setShowAcctForm(true); }}>
                      <Plus size={14} /> {addItemLabel}
                    </button>
                  </div>

                  {institutionAccounts.length === 0 ? (
                    <div className="empty-state">
                      <p>No {itemLabel.toLowerCase()} yet. Click "{addItemLabel}" to get started.</p>
                    </div>
                  ) : (
                    <div className="accounts-list">
                      {institutionAccounts.map(acct => {
                        const acctOwner = allMembers.find(m => m.id === acct.userId);
                        const acctInitials = acct.ownerName.split(' ').map(n => n[0]).join('');
                        return (
                        <div key={acct.id} className="account-card">
                          <div className="account-header">
                            <div className="account-header-info">
                              <div className="account-owner-avatar">
                                {acctOwner?.photoURL
                                  ? <img src={acctOwner.photoURL} alt="" />
                                  : acctInitials
                                }
                              </div>
                              <span className="account-owner-name">{acct.ownerName}</span>
                              {acct.accountType && <span className="badge">{acct.accountType}</span>}
                              <strong>{acct.accountName}</strong>
                            </div>
                            {acct.userId === user?.id && (
                              <div className="account-actions">
                                <button className="btn btn-icon" onClick={() => startEditAcct(acct)}><Edit3 size={14} /></button>
                                <button className="btn btn-icon btn-danger" onClick={() => handleDeleteAccount(acct.id)}><Trash2 size={14} /></button>
                              </div>
                            )}
                          </div>
                          <div className="account-details">
                            {acct.accountNumber && (() => {
                              const plain = getFieldValue(acct.id, 'acct', acct.accountNumber);
                              const isEnc = isEncrypted(acct.accountNumber);
                              const canRead = !isEnc || decryptedFields.has(`${acct.id}-acct`);
                              const revealed = revealedFields.has(`${acct.id}-acct`) && canRead;
                              const hintVal = canRead && isHint(plain);
                              return (
                                <div>
                                  <label>Account #:</label>
                                  {revealed && hintVal ? (
                                    <span className="hint-display">
                                      <Icons.AlertCircle size={14} className="hint-icon" /><em>{getHintText(plain)}</em>
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`, acct.userId)}><EyeOff size={14} /></button>
                                    </span>
                                  ) : (
                                    <span className="password-field">
                                      {revealed ? plain : (canRead ? maskValue(hintVal ? getHintText(plain) : plain) : '••••••••')}
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`, acct.userId)}>
                                        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {acct.routingNumber && (() => {
                              const plain = getFieldValue(acct.id, 'rtn', acct.routingNumber);
                              const isEnc = isEncrypted(acct.routingNumber);
                              const canRead = !isEnc || decryptedFields.has(`${acct.id}-rtn`);
                              const revealed = revealedFields.has(`${acct.id}-rtn`) && canRead;
                              const hintVal = canRead && isHint(plain);
                              return (
                                <div>
                                  <label>Routing #:</label>
                                  {revealed && hintVal ? (
                                    <span className="hint-display">
                                      <Icons.AlertCircle size={14} className="hint-icon" /><em>{getHintText(plain)}</em>
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`, acct.userId)}><EyeOff size={14} /></button>
                                    </span>
                                  ) : (
                                    <span className="password-field">
                                      {revealed ? plain : (canRead ? maskValue(hintVal ? getHintText(plain) : plain) : '••••••••')}
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`, acct.userId)}>
                                        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {acct.username && (() => {
                              const plain = getFieldValue(acct.id, 'user', acct.username);
                              const isEnc = isEncrypted(acct.username);
                              const canRead = !isEnc || decryptedFields.has(`${acct.id}-user`);
                              const revealed = revealedFields.has(`${acct.id}-user`) && canRead;
                              const hintVal = canRead && isHint(plain);
                              return (
                                <div>
                                  <label>Username:</label>
                                  {revealed && hintVal ? (
                                    <span className="hint-display">
                                      <Icons.AlertCircle size={14} className="hint-icon" /><em>{getHintText(plain)}</em>
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`, acct.userId)}><EyeOff size={14} /></button>
                                    </span>
                                  ) : (
                                    <span className="password-field">
                                      {revealed ? plain : (canRead ? maskValue(hintVal ? getHintText(plain) : plain) : '••••••••')}
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`, acct.userId)}>
                                        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {acct.passwordEncrypted && (() => {
                              const plain = getFieldValue(acct.id, 'pass', acct.passwordEncrypted);
                              const isEnc = isEncrypted(acct.passwordEncrypted);
                              const canRead = !isEnc || decryptedFields.has(`${acct.id}-pass`);
                              const revealed = revealedFields.has(`${acct.id}-pass`) && canRead;
                              const hintVal = canRead && isHint(plain);
                              return (
                                <div>
                                  <label>Password:</label>
                                  {revealed && hintVal ? (
                                    <span className="hint-display">
                                      <Icons.AlertCircle size={14} className="hint-icon" /><em>{getHintText(plain)}</em>
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`, acct.userId)}><EyeOff size={14} /></button>
                                    </span>
                                  ) : (
                                    <span className="password-field">
                                      {revealed ? plain : '••••••••'}
                                      <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`, acct.userId)}>
                                        {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                      </button>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                            {acct.url && <div><label>URL:</label> <a href={acct.url.startsWith('http') ? acct.url : `https://${acct.url}`} target="_blank" rel="noreferrer">{acct.url}</a></div>}
                            {acct.estimatedValue && <div><label>Value:</label> <span>{acct.estimatedValue}</span></div>}
                            {acct.beneficiary && <div><label>Beneficiary:</label> <span>{acct.beneficiary}</span></div>}
                            {acct.contactName && <div><label>Contact:</label> <span>{acct.contactName} {acct.contactPhone ? `· ${acct.contactPhone}` : ''} {acct.contactEmail ? `· ${acct.contactEmail}` : ''}</span></div>}
                            {acct.notes && <div><label>Notes:</label> <span>{acct.notes}</span></div>}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <div className="empty-state">
                  <p>{categoryInstitutions.length > 0 ? `Select ${instLabelSingular === instLabel ? 'an' : 'a'} ${instLabelSingular.toLowerCase()} from the left panel.` : `Add ${instLabelSingular === instLabel ? 'an' : 'a'} ${instLabelSingular.toLowerCase()} to get started.`}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Institution Quick-Pick Modal */}
      {showInstPicker && selectedCategoryId && (
        <div className="modal-overlay" onClick={() => setShowInstPicker(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Choose a Type</h3>
              <button className="btn btn-ghost" onClick={() => setShowInstPicker(false)}><X size={18} /></button>
            </div>
            <div className="preset-grid">
              {(institutionPresets[selectedCategoryId] || ['Other']).map(preset => {
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

      {/* Institution Form Modal */}
      {showInstForm && (
        <div className="modal-overlay" onClick={() => setShowInstForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingInst ? `Edit ${instLabelSingular}` : addInstLabel}</h3>
              <button className="btn btn-ghost" onClick={() => setShowInstForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddInstitution}>
              <div className="form-group">
                <label>{instNameFieldLabel} *</label>
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
                <button type="submit" className="btn btn-primary">{editingInst ? 'Update' : 'Add'} {instLabelSingular}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Form Modal */}
      {showAcctForm && selectedCategoryId && (
        <div className="modal-overlay" onClick={() => setShowAcctForm(false)}>
          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingAcct ? `Edit ${itemLabelSingular}` : addItemLabel}</h3>
              <button className="btn btn-ghost" onClick={() => setShowAcctForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddAccount}>
              <div className="form-grid">
                <div className="form-group">
                  <label>{nameFieldLabel} *</label>
                  <input type="text" value={acctForm.accountName} onChange={e => setAcctForm(f => ({ ...f, accountName: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label>Type</label>
                  {config.typeOptions && (config.typeOptions.includes(acctForm.accountType) || acctForm.accountType === '') ? (
                    <select value={acctForm.accountType} onChange={e => {
                      const val = e.target.value;
                      if (val === '__other') {
                        setAcctForm(f => ({ ...f, accountType: ' ' }));
                      } else {
                        setAcctForm(f => ({ ...f, accountType: val }));
                      }
                    }}>
                      <option value="">Select type...</option>
                      {config.typeOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      <option value="__other">Other...</option>
                    </select>
                  ) : config.typeOptions ? (
                    <div className="custom-type-input">
                      <input type="text" value={acctForm.accountType} onChange={e => setAcctForm(f => ({ ...f, accountType: e.target.value }))} placeholder="Enter custom type..." autoFocus />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAcctForm(f => ({ ...f, accountType: '' }))}>
                        <Icons.ChevronDown size={14} /> List
                      </button>
                    </div>
                  ) : (
                    <input type="text" value={acctForm.accountType} onChange={e => setAcctForm(f => ({ ...f, accountType: e.target.value }))} placeholder={config.typePlaceholder} />
                  )}
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
                              <Icons.ChevronDown size={14} />
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
                                    <Icons.Lock size={14} />
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
                                    <Icons.AlertCircle size={14} />
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
              <div className="form-group form-full">
                <label>Notes</label>
                <textarea value={acctForm.notes} onChange={e => setAcctForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowAcctForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editingAcct ? 'Update' : 'Add'} {itemLabelSingular}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN Prompt Modal */}
      {pinPromptUserId && (() => {
        const owner = allMembers.find(m => m.id === pinPromptUserId);
        const closePrompt = () => {
          setPinPromptUserId(null);
          setPinPromptFieldKey(null);
          setPinPromptForSave(false);
          setPinPromptIsSetup(false);
          setPinInput('');
          setPinConfirmInput('');
          setPinPromptError('');
          savePendingAccountRef.current = null;
        };
        return (
          <div className="modal-overlay" onClick={closePrompt}>
            <div className="modal pin-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3><Icons.Lock size={18} /> {pinPromptIsSetup ? 'Set a PIN' : 'Enter PIN'}</h3>
                <button className="btn btn-ghost" onClick={closePrompt}><X size={18} /></button>
              </div>
              <p className="section-desc">
                {pinPromptIsSetup
                  ? 'Sensitive information is encrypted with a 6-digit PIN. Set one now to save this account securely.'
                  : `Enter ${owner?.firstName}'s 6-digit PIN to view sensitive information.`}
              </p>
              <form onSubmit={submitPin}>
                <div className="form-group">
                  {pinPromptIsSetup && <label>New 6-digit PIN</label>}
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="pin-input"
                    autoFocus
                    required
                  />
                </div>
                {pinPromptIsSetup && (
                  <div className="form-group">
                    <label>Confirm PIN</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={pinConfirmInput}
                      onChange={e => setPinConfirmInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••••"
                      className="pin-input"
                      required
                    />
                  </div>
                )}
                {pinPromptError && <div className="error-msg">{pinPromptError}</div>}
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={closePrompt}>Cancel</button>
                  <button type="submit" className="btn btn-primary">{pinPromptIsSetup ? 'Set PIN & Save' : 'Unlock'}</button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
