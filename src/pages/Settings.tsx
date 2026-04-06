import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Copy, Check, Camera, X, Sun, Moon, UserPlus, UserMinus, Users, LogOut } from 'lucide-react';

export default function Settings() {
  const { user, joinHousehold, leaveHousehold, removeMember, updatePhoto, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      <div className="settings-section">
        <h3>Your Profile</h3>
        <div className="profile-section">
          <div className="profile-pic-container">
            <div className="profile-pic">
              {user?.photoURL
                ? <img src={user.photoURL} alt={user.firstName} />
                : <span>{initials}</span>
              }
            </div>
            <div className="profile-pic-actions">
              <button className="btn btn-sm btn-primary" onClick={() => fileInputRef.current?.click()}>
                <Camera size={14} /> {user?.photoURL ? 'Change' : 'Add Photo'}
              </button>
              {user?.photoURL && (
                <button className="btn btn-sm btn-danger" onClick={handleRemovePhoto}>
                  <X size={14} /> Remove
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
            </div>
          </div>
          <div className="profile-info">
            <div><label>Name:</label> <span>{user?.firstName} {user?.lastName}</span></div>
            <div><label>Email:</label> <span>{user?.email}</span></div>
          </div>
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
    </div>
  );
}
