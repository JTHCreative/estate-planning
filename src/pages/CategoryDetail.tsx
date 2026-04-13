import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CATEGORIES, getInstitutions, getAccounts,
  addInstitution, updateInstitution, deleteInstitution,
  addAccount, updateAccount, deleteAccount, isHint, getHintText,
} from '../lib/storage';
import type { Institution, Account } from '../lib/storage';
import {
  categoryFields, defaultFields, institutionPresets, presetIcons, fieldToFormKey,
  SENSITIVE_FIELD_KEYS,
  Plus, ArrowLeft, Trash2, Edit3, ChevronDown, ChevronRight, Eye, EyeOff, X,
} from '../lib/categoryConfig';
import { AlertCircle, Lock, MoreHorizontal } from 'lucide-react';

type InstitutionWithOwner = Institution & { ownerName: string };
type AccountWithOwner = Account & { ownerName: string };

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
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

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
    setVisiblePasswords({});
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
                                                type={isInHintMode ? 'text' : (field.type === 'password' && !visiblePasswords[formKey]) ? 'password' : 'text'}
                                                value={acctForm[formKey]}
                                                onChange={e => setAcctForm(f => ({ ...f, [formKey]: e.target.value }))}
                                                placeholder={isInHintMode ? `Hint for ${field.label.toLowerCase()}...` : field.placeholder}
                                                className={isInHintMode ? 'hint-input' : ''}
                                              />
                                              {field.type === 'password' && !isInHintMode && (
                                                <button
                                                  type="button"
                                                  className="btn btn-icon btn-password-toggle"
                                                  onClick={() => setVisiblePasswords(prev => ({ ...prev, [formKey]: !prev[formKey] }))}
                                                >
                                                  {visiblePasswords[formKey] ? <EyeOff size={14} /> : <Eye size={14} />}
                                                </button>
                                              )}
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
                                {acct.accountNumber && (() => {
                                  const raw = acct.accountNumber;
                                  const hintVal = isHint(raw);
                                  const displayVal = hintVal ? getHintText(raw) : raw;
                                  const revealed = revealedFields.has(`${acct.id}-acct`);
                                  return (
                                    <div>
                                      <label>Account #:</label>
                                      {revealed && hintVal ? (
                                        <span className="hint-display">
                                          <AlertCircle size={14} className="hint-icon" /><em>{displayVal}</em>
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`)}><EyeOff size={14} /></button>
                                        </span>
                                      ) : (
                                        <span className="password-field">
                                          {revealed ? displayVal : maskValue(displayVal)}
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-acct`)}>
                                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                          </button>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {acct.routingNumber && (() => {
                                  const raw = acct.routingNumber;
                                  const hintVal = isHint(raw);
                                  const displayVal = hintVal ? getHintText(raw) : raw;
                                  const revealed = revealedFields.has(`${acct.id}-rtn`);
                                  return (
                                    <div>
                                      <label>Routing #:</label>
                                      {revealed && hintVal ? (
                                        <span className="hint-display">
                                          <AlertCircle size={14} className="hint-icon" /><em>{displayVal}</em>
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`)}><EyeOff size={14} /></button>
                                        </span>
                                      ) : (
                                        <span className="password-field">
                                          {revealed ? displayVal : maskValue(displayVal)}
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-rtn`)}>
                                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                          </button>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {acct.username && (() => {
                                  const raw = acct.username;
                                  const hintVal = isHint(raw);
                                  const displayVal = hintVal ? getHintText(raw) : raw;
                                  const revealed = revealedFields.has(`${acct.id}-user`);
                                  return (
                                    <div>
                                      <label>Username:</label>
                                      {revealed && hintVal ? (
                                        <span className="hint-display">
                                          <AlertCircle size={14} className="hint-icon" /><em>{displayVal}</em>
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`)}><EyeOff size={14} /></button>
                                        </span>
                                      ) : (
                                        <span className="password-field">
                                          {revealed ? displayVal : maskValue(displayVal)}
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-user`)}>
                                            {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                          </button>
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                                {acct.passwordEncrypted && (() => {
                                  const raw = acct.passwordEncrypted;
                                  const hintVal = isHint(raw);
                                  const displayVal = hintVal ? getHintText(raw) : raw;
                                  const revealed = revealedFields.has(`${acct.id}-pass`);
                                  return (
                                    <div>
                                      <label>Password:</label>
                                      {revealed && hintVal ? (
                                        <span className="hint-display">
                                          <AlertCircle size={14} className="hint-icon" /><em>{displayVal}</em>
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`)}><EyeOff size={14} /></button>
                                        </span>
                                      ) : (
                                        <span className="password-field">
                                          {revealed ? displayVal : '••••••••'}
                                          <button className="btn btn-icon btn-tiny" onClick={() => toggleField(`${acct.id}-pass`)}>
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
