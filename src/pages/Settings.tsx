import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Copy, Check, Camera, X, Sun, Moon, UserPlus, UserMinus, Users, LogOut, Lock, KeyRound, User as UserIcon, Save, Edit3, Home, Plus, Trash2, AlertTriangle } from 'lucide-react';

export default function Settings() {
  const { user, joinHousehold, createHousehold, renameHousehold, leaveHousehold, removeMember, updatePhoto, refreshUser, setUserPin, clearUserPin, updateName, updateUserEmail, updateUserPassword, scheduleAccountDeletion, cancelAccountDeletion } = useAuth();
  const { theme, setTheme } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [newHouseholdName, setNewHouseholdName] = useState('');
  const [editingHouseholdId, setEditingHouseholdId] = useState<string | null>(null);
  const [editHouseholdName, setEditHouseholdName] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile edit state
  const [editingName, setEditingName] = useState(false);
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailPasswordInput, setEmailPasswordInput] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError('');
    if (deleteConfirmText !== 'Confirm Delete') {
      setDeleteError('Please type "Confirm Delete" exactly.');
      return;
    }
    setDeleteLoading(true);
    try {
      await scheduleAccountDeletion(deletePassword);
      setShowDeleteModal(false);
      setDeletePassword('');
      setDeleteConfirmText('');
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setDeleteError('Incorrect password.');
      } else {
        setDeleteError(err?.message || 'Failed to schedule deletion.');
      }
    }
    setDeleteLoading(false);
  };

  const handleCancelDeletion = async () => {
    try {
      await cancelAccountDeletion();
    } catch {
      // ignore
    }
  };

  const startEditName = () => {
    setFirstNameInput(user?.firstName || '');
    setLastNameInput(user?.lastName || '');
    setEditingName(true);
    setProfileError('');
    setProfileMessage('');
  };

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    try {
      await updateName(firstNameInput, lastNameInput);
      setProfileMessage('Name updated');
      setEditingName(false);
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  const startEditEmail = () => {
    setEmailInput(user?.email || '');
    setEmailPasswordInput('');
    setEditingEmail(true);
    setProfileError('');
    setProfileMessage('');
  };

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    try {
      await updateUserEmail(emailInput, emailPasswordInput);
      setProfileMessage('Email updated');
      setEditingEmail(false);
      setEmailPasswordInput('');
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    if (newPasswordInput !== confirmPasswordInput) {
      setProfileError('New passwords do not match');
      return;
    }
    if (newPasswordInput.length < 8) {
      setProfileError('Password must be at least 8 characters');
      return;
    }
    try {
      await updateUserPassword(currentPasswordInput, newPasswordInput);
      setProfileMessage('Password updated');
      setShowPasswordForm(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      setProfileError(err.message);
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError('');
    setPinMessage('');
    if (!/^\d{6}$/.test(pinValue)) {
      setPinError('PIN must be exactly 6 digits');
      return;
    }
    if (pinValue !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }
    try {
      await setUserPin(pinValue);
      setPinMessage('PIN set successfully');
      setPinValue('');
      setConfirmPin('');
    } catch (err: any) {
      setPinError(err.message);
    }
  };

  const handleClearPin = async () => {
    if (!confirm('Remove your PIN? Sensitive fields will no longer be protected.')) return;
    try {
      await clearUserPin();
      setPinMessage('PIN removed');
    } catch (err: any) {
      setPinError(err.message);
    }
  };

  const handleCreateHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await createHousehold(newHouseholdName || 'My Household');
      setMessage('Household created!');
      setNewHouseholdName('');
      setShowCreateForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRenameHousehold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouseholdId) return;
    setError('');
    setMessage('');
    try {
      await renameHousehold(editingHouseholdId, editHouseholdName);
      setMessage('Household renamed');
      setEditingHouseholdId(null);
      setEditHouseholdName('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await joinHousehold(inviteCode);
      setMessage('Joined household successfully!');
      setInviteCode('');
      setShowJoinForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (householdId: string) => {
    if (!confirm('Leave this household? You will no longer see other members\' data and they won\'t see yours.')) return;
    setError('');
    setMessage('');
    try {
      await leaveHousehold(householdId);
      setMessage('Left household.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemove = async (memberId: string, memberName: string, householdId: string) => {
    if (!confirm(`Remove ${memberName} from this household? They will no longer see shared data.`)) return;
    try {
      await removeMember(memberId, householdId);
      await refreshUser();
      setMessage(`${memberName} has been removed.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataURL = canvas.toDataURL('image/jpeg', 0.8);
        updatePhoto(dataURL);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemovePhoto = async () => {
    await updatePhoto(null);
  };

  const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : '';

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-columns">
      <div className="settings-left">

      <div className="settings-section">
        <h3><UserIcon size={20} /> Account Settings</h3>

        <div className="settings-subsection">
          <h4>Profile</h4>
          <div className="profile-section">
            <div className="profile-pic-container">
              <div className="profile-pic" onClick={() => fileInputRef.current?.click()} role="button" title="Change photo">
                {user?.photoURL
                  ? <img src={user.photoURL} alt={user.firstName} />
                  : <span>{initials}</span>
                }
                <div className="profile-pic-overlay">
                  <Camera size={20} />
                  <span>{user?.photoURL ? 'Change' : 'Add'}</span>
                </div>
              </div>
              {user?.photoURL && (
                <button className="profile-pic-remove" onClick={handleRemovePhoto} title="Remove photo">
                  <X size={14} />
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
            <div className="profile-info">
              {/* Name */}
              {editingName ? (
                <form onSubmit={handleSaveName} className="profile-edit-form">
                  <label>Name</label>
                  <div className="form-row">
                    <input type="text" value={firstNameInput} onChange={e => setFirstNameInput(e.target.value)} placeholder="First name" required />
                    <input type="text" value={lastNameInput} onChange={e => setLastNameInput(e.target.value)} placeholder="Last name" required />
                  </div>
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm"><Save size={14} /> Save</button>
                  </div>
                </form>
              ) : (
                <div className="profile-row">
                  <label>Name:</label>
                  <span>{user?.firstName} {user?.lastName}</span>
                  <button className="btn btn-icon btn-sm" onClick={startEditName}><Edit3 size={14} /></button>
                </div>
              )}

              {/* Email */}
              {editingEmail ? (
                <form onSubmit={handleSaveEmail} className="profile-edit-form">
                  <label>Email</label>
                  <input type="email" value={emailInput} onChange={e => setEmailInput(e.target.value)} required />
                  <label>Current Password (required)</label>
                  <input type="password" value={emailPasswordInput} onChange={e => setEmailPasswordInput(e.target.value)} placeholder="Enter your current password" required />
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingEmail(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm"><Save size={14} /> Save</button>
                  </div>
                </form>
              ) : (
                <div className="profile-row">
                  <label>Email:</label>
                  <span>{user?.email}</span>
                  <button className="btn btn-icon btn-sm" onClick={startEditEmail}><Edit3 size={14} /></button>
                </div>
              )}

              {/* Password */}
              {showPasswordForm ? (
                <form onSubmit={handleChangePassword} className="profile-edit-form">
                  <label>Current Password</label>
                  <input type="password" value={currentPasswordInput} onChange={e => setCurrentPasswordInput(e.target.value)} required />
                  <label>New Password</label>
                  <input type="password" value={newPasswordInput} onChange={e => setNewPasswordInput(e.target.value)} required />
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPasswordInput} onChange={e => setConfirmPasswordInput(e.target.value)} required />
                  <div className="form-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPasswordForm(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary btn-sm"><Save size={14} /> Update Password</button>
                  </div>
                </form>
              ) : (
                <div className="profile-row">
                  <label>Password:</label>
                  <span>••••••••</span>
                  <button className="btn btn-icon btn-sm" onClick={() => { setShowPasswordForm(true); setProfileError(''); setProfileMessage(''); }}><Edit3 size={14} /></button>
                </div>
              )}

              {profileMessage && <div className="success-msg">{profileMessage}</div>}
              {profileError && <div className="error-msg">{profileError}</div>}
            </div>
          </div>
        </div>

        <div className="settings-subsection">
          <h4><Lock size={14} /> Security PIN</h4>
          <p className="section-desc">
            Set a 6-digit PIN to protect sensitive information like passwords and account numbers.
            Household members will need your PIN to view your sensitive fields.
          </p>

          {user?.hasPin ? (
            <div className="partner-status linked">
              <KeyRound size={18} />
              <div>
                <strong>PIN is set</strong>
                <span>Your sensitive fields are protected</span>
              </div>
              <button className="btn btn-sm btn-danger" onClick={handleClearPin}>
                <X size={14} /> Remove
              </button>
            </div>
          ) : (
            <form onSubmit={handleSetPin} className="pin-form">
              <div className="form-group">
                <label>New 6-digit PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={pinValue}
                  onChange={e => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="pin-input"
                  required
                />
              </div>
              <div className="form-group">
                <label>Confirm PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="pin-input"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary">
                <Lock size={16} /> Set PIN
              </button>
            </form>
          )}

          {pinMessage && <div className="success-msg">{pinMessage}</div>}
          {pinError && <div className="error-msg">{pinError}</div>}
        </div>

        <div className="settings-subsection delete-account-section">
          <h4><Trash2 size={14} /> Delete Account</h4>
          {user?.deletionScheduledAt ? (
            <div className="deletion-scheduled-banner">
              <AlertTriangle size={18} />
              <div>
                <strong>Account scheduled for deletion</strong>
                <span>Your account and all data will be permanently deleted in {user.deletionDaysLeft} day{user.deletionDaysLeft !== 1 ? 's' : ''}.</span>
              </div>
              <button className="btn btn-sm btn-primary" onClick={handleCancelDeletion}>
                Cancel Deletion
              </button>
            </div>
          ) : (
            <>
              <p className="section-desc">
                Permanently delete your account and all associated data. This action is irreversible after the waiting period.
              </p>
              <button className="btn btn-danger" onClick={() => { setShowDeleteModal(true); setDeleteError(''); setDeletePassword(''); setDeleteConfirmText(''); }}>
                <Trash2 size={16} /> Delete Account
              </button>
            </>
          )}
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3><AlertTriangle size={18} /> Delete Account</h3>
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}><X size={18} /></button>
            </div>
            <div className="delete-warning-body">
              <div className="delete-warning-box">
                <AlertTriangle size={24} />
                <div>
                  <strong>This will permanently delete your account</strong>
                  <p>After a 7-day waiting period, the following will be permanently removed:</p>
                  <ul>
                    <li>Your profile and login credentials</li>
                    <li>All institutions and accounts you own</li>
                    <li>All encrypted sensitive data</li>
                    <li>Your membership in all households</li>
                  </ul>
                  <p>You can cancel the deletion at any time during the 7-day period.</p>
                </div>
              </div>
              <form onSubmit={handleScheduleDeletion}>
                <div className="form-group">
                  <label>Enter your password</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    placeholder="Current password"
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label>Type <strong>Confirm Delete</strong> to proceed</label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={e => setDeleteConfirmText(e.target.value)}
                    placeholder="Confirm Delete"
                    required
                  />
                </div>
                {deleteError && <div className="error-msg">{deleteError}</div>}
                <div className="form-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="btn btn-danger"
                    disabled={deleteLoading || deleteConfirmText !== 'Confirm Delete' || !deletePassword}
                  >
                    {deleteLoading ? 'Processing...' : 'Delete My Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="settings-section">
        <h3>Appearance</h3>
        <p className="section-desc">Choose your preferred color theme.</p>
        <div className="theme-toggle">
          <button
            className={`theme-option ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
          >
            <Sun size={20} />
            <span>Light</span>
          </button>
          <button
            className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
          >
            <Moon size={20} />
            <span>Dark</span>
          </button>
        </div>
      </div>

      </div>{/* end settings-left */}
      <div className="settings-right">

      <div className="settings-section">
        <h3><Users size={20} /> Households</h3>
        <p className="section-desc">
          You can be a member of multiple households (e.g. immediate family + parents). Data from all your households is combined in the dashboard.
        </p>

        {/* Empty state */}
        {(!user?.households || user.households.length === 0) && !showCreateForm && !showJoinForm && (
          <div className="household-empty">
            <div className="household-empty-icon"><Home size={32} /></div>
            <h4>You're not in any households yet</h4>
            <p>Create a new household to start sharing estate planning data, or join an existing household using an invite code.</p>
            <div className="household-empty-actions">
              <button className="btn btn-primary" onClick={() => { setShowCreateForm(true); setError(''); setMessage(''); }}>
                <Plus size={16} /> Create Household
              </button>
              <button className="btn btn-ghost" onClick={() => { setShowJoinForm(true); setError(''); setMessage(''); }}>
                <UserPlus size={16} /> Join Household
              </button>
            </div>
          </div>
        )}

        {/* Create household form */}
        {showCreateForm && (
          <form onSubmit={handleCreateHousehold} className="household-create-form">
            <h4>Create a New Household</h4>
            <div className="form-group">
              <label>Household Name</label>
              <input
                type="text"
                value={newHouseholdName}
                onChange={e => setNewHouseholdName(e.target.value)}
                placeholder="e.g. The Smith Family"
                autoFocus
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowCreateForm(false); setNewHouseholdName(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Plus size={16} /> {loading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {/* Join household form (when used as standalone, not always visible) */}
        {showJoinForm && (
          <form onSubmit={handleJoin} className="household-create-form">
            <h4>Join an Existing Household</h4>
            <div className="form-group">
              <label>Invite Code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                autoFocus
                required
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setShowJoinForm(false); setInviteCode(''); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <UserPlus size={16} /> {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        )}

        {/* List of households */}
        {user?.households.map(hh => {
          const isPrimary = hh.id === user.householdId;
          const others = hh.members.filter(m => m.id !== user.id);
          const isEditingName = editingHouseholdId === hh.id;
          return (
            <div key={hh.id} className="household-card">
              <div className="household-card-header">
                {isEditingName ? (
                  <form onSubmit={handleRenameHousehold} className="household-rename-form">
                    <input
                      type="text"
                      value={editHouseholdName}
                      onChange={e => setEditHouseholdName(e.target.value)}
                      autoFocus
                    />
                    <button type="submit" className="btn btn-icon"><Save size={14} /></button>
                    <button type="button" className="btn btn-icon" onClick={() => setEditingHouseholdId(null)}><X size={14} /></button>
                  </form>
                ) : (
                  <>
                    <h4>{hh.name}</h4>
                    <button className="btn btn-icon btn-sm" onClick={() => { setEditingHouseholdId(hh.id); setEditHouseholdName(hh.name); }} title="Rename household">
                      <Edit3 size={12} />
                    </button>
                    {isPrimary && <span className="member-badge">Primary</span>}
                  </>
                )}
              </div>

              <div className="partner-code-box household-invite-box">
                <label>Invite Code</label>
                <div className="code-display">
                  <code>{hh.inviteCode}</code>
                  <button className="btn btn-icon" onClick={() => copyCode(hh.inviteCode)}>
                    {copiedCode === hh.inviteCode ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="household-members">
                <div className="member-card you">
                  <div className="member-avatar">
                    {user?.photoURL
                      ? <img src={user.photoURL} alt="" />
                      : <span>{initials}</span>
                    }
                  </div>
                  <div className="member-info">
                    <strong>{user?.firstName} {user?.lastName}</strong>
                    <span>{user?.email}</span>
                  </div>
                  <span className="member-badge">You</span>
                </div>
                {others.map(member => {
                  const mInitials = `${member.firstName?.[0] || ''}${member.lastName?.[0] || ''}`.toUpperCase();
                  return (
                    <div key={member.id} className="member-card">
                      <div className="member-avatar">
                        {member.photoURL
                          ? <img src={member.photoURL} alt="" />
                          : <span>{mInitials}</span>
                        }
                      </div>
                      <div className="member-info">
                        <strong>{member.firstName} {member.lastName}</strong>
                        <span>{member.email}</span>
                      </div>
                      <button className="btn btn-sm btn-danger" onClick={() => handleRemove(member.id, `${member.firstName} ${member.lastName}`, hh.id)}>
                        <UserMinus size={14} /> Remove
                      </button>
                    </div>
                  );
                })}
              </div>

              <button className="btn btn-ghost btn-danger-text" onClick={() => handleLeave(hh.id)}>
                <LogOut size={16} /> Leave this household
              </button>
            </div>
          );
        })}

        {/* Action buttons when user already has at least one household */}
        {user && user.households.length > 0 && !showCreateForm && !showJoinForm && (
          <div className="household-actions">
            <button className="btn btn-primary" onClick={() => { setShowCreateForm(true); setError(''); setMessage(''); }}>
              <Plus size={16} /> Create Another Household
            </button>
            <button className="btn btn-ghost" onClick={() => { setShowJoinForm(true); setError(''); setMessage(''); }}>
              <UserPlus size={16} /> Join Household
            </button>
          </div>
        )}

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}
      </div>

      </div>{/* end settings-right */}
      </div>{/* end settings-columns */}
    </div>
  );
}
