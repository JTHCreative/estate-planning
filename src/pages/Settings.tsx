import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Copy, Check, Camera, X, Sun, Moon, UserPlus, UserMinus, Users, LogOut, Lock, KeyRound, User as UserIcon, Save, Edit3 } from 'lucide-react';

export default function Settings() {
  const { user, joinHousehold, leaveHousehold, removeMember, updatePhoto, refreshUser, setUserPin, clearUserPin, updateName, updateUserEmail, updateUserPassword } = useAuth();
  const { theme, setTheme } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await joinHousehold(inviteCode);
      setMessage('Joined household successfully!');
      setInviteCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this household? You will no longer see other members\' data and they won\'t see yours.')) return;
    setError('');
    setMessage('');
    try {
      await leaveHousehold();
      setMessage('Left household. You now have your own private household.');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemove = async (memberId: string, memberName: string) => {
    if (!confirm(`Remove ${memberName} from the household? They will no longer see shared data.`)) return;
    try {
      await removeMember(memberId);
      await refreshUser();
      setMessage(`${memberName} has been removed.`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.inviteCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  const otherMembers = user?.householdMembers.filter(m => m.id !== user.id) || [];

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
      </div>

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
        <h3><Users size={20} /> Household Members</h3>
        <p className="section-desc">
          Share your estate planning data with family members. Everyone in the household can see each other's institutions and accounts.
        </p>

        <div className="partner-code-box">
          <label>Your Household Invite Code</label>
          <div className="code-display">
            <code>{user?.inviteCode}</code>
            <button className="btn btn-icon" onClick={copyCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="hint">Share this code with family members so they can join your household.</p>
        </div>

        {/* Current members */}
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

          {otherMembers.map(member => {
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
                <button className="btn btn-sm btn-danger" onClick={() => handleRemove(member.id, `${member.firstName} ${member.lastName}`)}>
                  <UserMinus size={14} /> Remove
                </button>
              </div>
            );
          })}
        </div>

        {/* Join another household */}
        <div className="household-join">
          <h4>Join Another Household</h4>
          <p className="hint">Enter an invite code from a family member to join their household. This will move you out of your current household.</p>
          <form onSubmit={handleJoin} className="link-form">
            <div className="input-group">
              <input
                type="text"
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder="e.g. A1B2C3D4"
                required
              />
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <UserPlus size={16} /> {loading ? 'Joining...' : 'Join'}
              </button>
            </div>
          </form>
        </div>

        {/* Leave household (only show if there are other members) */}
        {otherMembers.length > 0 && (
          <button className="btn btn-ghost btn-danger-text" onClick={handleLeave}>
            <LogOut size={16} /> Leave this household
          </button>
        )}

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}
      </div>

      </div>{/* end settings-right */}
      </div>{/* end settings-columns */}
    </div>
  );
}
