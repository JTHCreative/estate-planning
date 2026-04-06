import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  CATEGORIES, getInstitutions, getAccounts,
  addInstitution, updateInstitution, deleteInstitution,
  addAccount, updateAccount, deleteAccount,
} from '../lib/storage';
import type { Institution, Account } from '../lib/storage';
import {
  categoryFields, defaultFields, institutionPresets, presetIcons, fieldToFormKey,
  Plus, Trash2, Edit3, Eye, EyeOff, X, MoreHorizontal,
  DollarSign, ShieldCheck, Home, Briefcase, Globe, Zap, Heart,
} from '../lib/categoryConfig';
import * as Icons from 'lucide-react';

type InstitutionWithOwner = Institution & { ownerName: string };
type AccountWithOwner = Account & { ownerName: string };

interface RootCategory {
  name: string;
  icon: any;
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

const iconMap: Record<string, any> = {
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
  const { user } = useAuth();

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

  // Can only add/edit when viewing only own data
  const isOwnDataOnly = activeUserIds.size === 1 && activeUserIds.has(user?.id || '');

  // Filter dropdown
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);

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

  // Reveal state for masked fields
  const [revealedFields, setRevealedFields] = useState<Set<string>>(new Set());

  // Derived: selected category object
  const selectedCategory = selectedCategoryId ? CATEGORIES.find(c => c.id === selectedCategoryId) || null : null;
  const config = selectedCategoryId ? (categoryFields[selectedCategoryId] || defaultFields) : defaultFields;
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


  // Handlers: field masking
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

  // Handlers: forms
  const resetInstForm = () => setInstForm({ name: '', website: '', phone: '', notes: '' });
  const resetAcctForm = () => setAcctForm({
    accountName: '', accountType: '', accountNumber: '', routingNumber: '',
    username: '', password: '', url: '', contactName: '', contactPhone: '',
    contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
  });

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
    if (!confirm(`Delete this institution and all its ${itemLabel.toLowerCase()}?`)) return;
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
  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedInstitutionId) return;
    if (editingAcct) {
      await updateAccount(editingAcct.id, {
        accountName: acctForm.accountName, accountType: acctForm.accountType || null,
        accountNumber: acctForm.accountNumber || null, routingNumber: acctForm.routingNumber || null,
        username: acctForm.username || null, passwordEncrypted: acctForm.password || null,
        url: acctForm.url || null, contactName: acctForm.contactName || null,
        contactPhone: acctForm.contactPhone || null, contactEmail: acctForm.contactEmail || null,
        estimatedValue: acctForm.estimatedValue || null, beneficiary: acctForm.beneficiary || null,
        notes: acctForm.notes || null,
      });
      setEditingAcct(null);
    } else {
      await addAccount(user.id, {
        institutionId: selectedInstitutionId, accountName: acctForm.accountName,
        accountType: acctForm.accountType || null, accountNumber: acctForm.accountNumber || null,
        routingNumber: acctForm.routingNumber || null, username: acctForm.username || null,
        passwordEncrypted: acctForm.password || null, url: acctForm.url || null,
        contactName: acctForm.contactName || null, contactPhone: acctForm.contactPhone || null,
        contactEmail: acctForm.contactEmail || null, estimatedValue: acctForm.estimatedValue || null,
        beneficiary: acctForm.beneficiary || null, notes: acctForm.notes || null,
      });
    }
    resetAcctForm();
    setShowAcctForm(false);
    await loadCategoryData();
    await loadAllData();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm(`Delete this ${itemLabelSingular.toLowerCase()}?`)) return;
    await deleteAccount(id);
    await loadCategoryData();
    await loadAllData();
  };

  const startEditAcct = (acct: Account) => {
    setAcctForm({
      accountName: acct.accountName, accountType: acct.accountType || '',
      accountNumber: acct.accountNumber || '', routingNumber: acct.routingNumber || '',
      username: acct.username || '', password: acct.passwordEncrypted || '',
      url: acct.url || '', contactName: acct.contactName || '',
      contactPhone: acct.contactPhone || '', contactEmail: acct.contactEmail || '',
      estimatedValue: acct.estimatedValue || '', beneficiary: acct.beneficiary || '',
      notes: acct.notes || ''
    });
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
                  <span>Filter by Member</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    setActiveUserIds(new Set(allMembers.map(m => m.id)));
                  }}>Select All</button>
                </div>
                {allMembers.map(member => {
                  const mInitials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
                  const isMe = member.id === user?.id;
                  const isActive = activeUserIds.has(member.id);
                  return (
                    <div
                      key={member.id}
                      className={`filter-item${isActive ? ' active' : ''}`}
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
            </>
          )}
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
                  <div className="category-tile-counts">
                    <span>{instCount} {instCount === 1 ? 'Institution' : 'Institutions'}</span>
                    <span>{acctCount} {acctCount === 1 ? 'Account' : 'Accounts'}</span>
                  </div>
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
                <h4>Institutions</h4>
                {isOwnDataOnly && <button className="btn btn-sm btn-primary" onClick={() => { resetInstForm(); setEditingInst(null); setShowInstPicker(true); }}>
                  <Plus size={14} /> Add
                </button>}
              </div>
              {categoryInstitutions.length === 0 ? (
                <div className="inst-panel-empty">
                  <p>No institutions yet.</p>
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
                        {isOwnDataOnly && (
                          <div className="inst-panel-item-actions" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-icon" onClick={() => startEditInst(inst)}><Edit3 size={14} /></button>
                            <button className="btn btn-icon btn-danger" onClick={() => handleDeleteInstitution(inst.id)}><Trash2 size={14} /></button>
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
                    {isOwnDataOnly && <button className="btn btn-sm btn-primary" onClick={() => { resetAcctForm(); setEditingAcct(null); setShowAcctForm(true); }}>
                      <Plus size={14} /> {addItemLabel}
                    </button>}
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
                            {isOwnDataOnly && (
                              <div className="account-actions">
                                <button className="btn btn-icon" onClick={() => startEditAcct(acct)}><Edit3 size={14} /></button>
                                <button className="btn btn-icon btn-danger" onClick={() => handleDeleteAccount(acct.id)}><Trash2 size={14} /></button>
                              </div>
                            )}
                          </div>
                          <div className="account-details">
                            {acct.accountNumber && (
                              <div>
                                <label>Account #:</label>
                                <span className="password-field">
                                  {revealedFields.has(`${acct.id}-acct`) ? acct.accountNumber : maskValue(acct.accountNumber)}
                                  <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`)}>
                                    {revealedFields.has(`${acct.id}-acct`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </span>
                              </div>
                            )}
                            {acct.routingNumber && (
                              <div>
                                <label>Routing #:</label>
                                <span className="password-field">
                                  {revealedFields.has(`${acct.id}-rtn`) ? acct.routingNumber : maskValue(acct.routingNumber)}
                                  <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`)}>
                                    {revealedFields.has(`${acct.id}-rtn`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </span>
                              </div>
                            )}
                            {acct.username && (
                              <div>
                                <label>Username:</label>
                                <span className="password-field">
                                  {revealedFields.has(`${acct.id}-user`) ? acct.username : maskValue(acct.username)}
                                  <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`)}>
                                    {revealedFields.has(`${acct.id}-user`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </span>
                              </div>
                            )}
                            {acct.passwordEncrypted && (
                              <div>
                                <label>Password:</label>
                                <span className="password-field">
                                  {revealedFields.has(`${acct.id}-pass`) ? acct.passwordEncrypted : '••••••••'}
                                  <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`)}>
                                    {revealedFields.has(`${acct.id}-pass`) ? <EyeOff size={14} /> : <Eye size={14} />}
                                  </button>
                                </span>
                              </div>
                            )}
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
                  <p>{categoryInstitutions.length > 0 ? 'Select an institution from the left panel.' : 'Add an institution to get started.'}</p>
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
                  return (
                    <div className="form-group" key={field.key}>
                      <label>{field.label}</label>
                      <input
                        type={field.type || 'text'}
                        value={acctForm[formKey]}
                        onChange={e => setAcctForm(f => ({ ...f, [formKey]: e.target.value }))}
                        placeholder={field.placeholder}
                      />
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
    </div>
  );
}
