import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  CATEGORIES, getInstitutions, getAccounts,
  addInstitution, updateInstitution, deleteInstitution,
  addAccount, updateAccount, deleteAccount,
} from '../lib/storage';
import type { Institution, Account } from '../lib/storage';
import { Plus, ArrowLeft, Trash2, Edit3, ChevronDown, ChevronRight, Eye, EyeOff, X } from 'lucide-react';

type InstitutionWithOwner = Institution & { ownerName: string };
type AccountWithOwner = Account & { ownerName: string };

export default function CategoryDetail() {
  const { categoryId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState<typeof CATEGORIES[0] | null>(null);
  const [institutions, setInstitutions] = useState<InstitutionWithOwner[]>([]);
  const [accounts, setAccounts] = useState<AccountWithOwner[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showInstForm, setShowInstForm] = useState(false);
  const [showAcctForm, setShowAcctForm] = useState<string | null>(null);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const [editingAcct, setEditingAcct] = useState<Account | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const [instForm, setInstForm] = useState({ name: '', website: '', phone: '', notes: '' });
  const [acctForm, setAcctForm] = useState({
    accountName: '', accountType: '', accountNumber: '', routingNumber: '',
    username: '', password: '', url: '', contactName: '', contactPhone: '',
    contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
  });

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

  const togglePassword = (id: string) => {
    setRevealedPasswords(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const resetInstForm = () => setInstForm({ name: '', website: '', phone: '', notes: '' });
  const resetAcctForm = () => setAcctForm({
    accountName: '', accountType: '', accountNumber: '', routingNumber: '',
    username: '', password: '', url: '', contactName: '', contactPhone: '',
    contactEmail: '', estimatedValue: '', beneficiary: '', notes: ''
  });

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
        institutionId, accountName: acctForm.accountName,
        accountType: acctForm.accountType || null, accountNumber: acctForm.accountNumber || null,
        routingNumber: acctForm.routingNumber || null, username: acctForm.username || null,
        passwordEncrypted: acctForm.password || null, url: acctForm.url || null,
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
    if (!confirm('Delete this institution and all its accounts?')) return;
    await deleteInstitution(id);
    await load();
  };

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Delete this account?')) return;
    await deleteAccount(id);
    await load();
  };

  const startEditInst = (inst: Institution) => {
    setInstForm({ name: inst.name, website: inst.website || '', phone: inst.phone || '', notes: inst.notes || '' });
    setEditingInst(inst);
    setShowInstForm(true);
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
        <button className="btn btn-primary" onClick={() => { resetInstForm(); setEditingInst(null); setShowInstForm(true); }}>
          <Plus size={18} /> Add Institution
        </button>
      </div>

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
                <input type="text" value={instForm.name} onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))} required />
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
                      {inst.ownerName} · {instAccounts.length} account{instAccounts.length !== 1 ? 's' : ''}
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
                        <h5>Accounts</h5>
                        <button className="btn btn-sm btn-primary" onClick={() => { resetAcctForm(); setEditingAcct(null); setShowAcctForm(inst.id); }}>
                          <Plus size={14} /> Add Account
                        </button>
                      </div>

                      {showAcctForm === inst.id && (
                        <div className="modal-overlay" onClick={() => setShowAcctForm(null)}>
                          <div className="modal modal-large" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                              <h3>{editingAcct ? 'Edit Account' : 'Add Account'}</h3>
                              <button className="btn btn-ghost" onClick={() => setShowAcctForm(null)}><X size={18} /></button>
                            </div>
                            <form onSubmit={e => handleAddAccount(e, inst.id)}>
                              <div className="form-grid">
                                <div className="form-group">
                                  <label>Account Name *</label>
                                  <input type="text" value={acctForm.accountName} onChange={e => setAcctForm(f => ({ ...f, accountName: e.target.value }))} required />
                                </div>
                                <div className="form-group">
                                  <label>Account Type</label>
                                  <input type="text" value={acctForm.accountType} onChange={e => setAcctForm(f => ({ ...f, accountType: e.target.value }))} placeholder="e.g. Checking, Savings, IRA" />
                                </div>
                                <div className="form-group">
                                  <label>Account Number</label>
                                  <input type="text" value={acctForm.accountNumber} onChange={e => setAcctForm(f => ({ ...f, accountNumber: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Routing Number</label>
                                  <input type="text" value={acctForm.routingNumber} onChange={e => setAcctForm(f => ({ ...f, routingNumber: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Login Username</label>
                                  <input type="text" value={acctForm.username} onChange={e => setAcctForm(f => ({ ...f, username: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Login Password</label>
                                  <input type="password" value={acctForm.password} onChange={e => setAcctForm(f => ({ ...f, password: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Website URL</label>
                                  <input type="text" value={acctForm.url} onChange={e => setAcctForm(f => ({ ...f, url: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Estimated Value</label>
                                  <input type="text" value={acctForm.estimatedValue} onChange={e => setAcctForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="e.g. $50,000" />
                                </div>
                                <div className="form-group">
                                  <label>Beneficiary</label>
                                  <input type="text" value={acctForm.beneficiary} onChange={e => setAcctForm(f => ({ ...f, beneficiary: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Contact Name</label>
                                  <input type="text" value={acctForm.contactName} onChange={e => setAcctForm(f => ({ ...f, contactName: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Contact Phone</label>
                                  <input type="text" value={acctForm.contactPhone} onChange={e => setAcctForm(f => ({ ...f, contactPhone: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                  <label>Contact Email</label>
                                  <input type="email" value={acctForm.contactEmail} onChange={e => setAcctForm(f => ({ ...f, contactEmail: e.target.value }))} />
                                </div>
                              </div>
                              <div className="form-group form-full">
                                <label>Notes</label>
                                <textarea value={acctForm.notes} onChange={e => setAcctForm(f => ({ ...f, notes: e.target.value }))} />
                              </div>
                              <div className="form-actions">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAcctForm(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingAcct ? 'Update' : 'Add'} Account</button>
                              </div>
                            </form>
                          </div>
                        </div>
                      )}

                      {instAccounts.length === 0 ? (
                        <p className="no-accounts">No accounts yet.</p>
                      ) : (
                        <div className="accounts-list">
                          {instAccounts.map(acct => (
                            <div key={acct.id} className="account-card">
                              <div className="account-header">
                                <div>
                                  <strong>{acct.accountName}</strong>
                                  {acct.accountType && <span className="badge">{acct.accountType}</span>}
                                  <span className="meta">{acct.ownerName}</span>
                                </div>
                                <div className="account-actions">
                                  <button className="btn btn-icon" onClick={() => startEditAcct(acct)}><Edit3 size={14} /></button>
                                  <button className="btn btn-icon btn-danger" onClick={() => handleDeleteAccount(acct.id)}><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <div className="account-details">
                                {acct.accountNumber && <div><label>Account #:</label> <span>{acct.accountNumber}</span></div>}
                                {acct.routingNumber && <div><label>Routing #:</label> <span>{acct.routingNumber}</span></div>}
                                {acct.username && <div><label>Username:</label> <span>{acct.username}</span></div>}
                                {acct.passwordEncrypted && (
                                  <div>
                                    <label>Password:</label>
                                    <span className="password-field">
                                      {revealedPasswords.has(acct.id) ? acct.passwordEncrypted : '••••••••'}
                                      <button className="btn btn-icon btn-tiny" onClick={() => togglePassword(acct.id)}>
                                        {revealedPasswords.has(acct.id) ? <EyeOff size={14} /> : <Eye size={14} />}
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
