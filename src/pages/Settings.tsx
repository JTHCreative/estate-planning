import { useState } from 'react';
import { useAuth, apiFetch } from '../contexts/AuthContext';
import { Link2, Unlink, Copy, Check } from 'lucide-react';

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const [partnerCode, setPartnerCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const data = await apiFetch('/auth/link-partner', { method: 'POST', body: JSON.stringify({ partnerCode }) });
      setMessage(data.message);
      setPartnerCode('');
      refreshUser();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink your partner? You will no longer see each other\'s data.')) return;
    setError('');
    setMessage('');
    try {
      await apiFetch('/auth/unlink-partner', { method: 'POST' });
      setMessage('Partner unlinked');
      refreshUser();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.partnerCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-section">
        <h3>Your Profile</h3>
        <div className="profile-info">
          <div><label>Name:</label> <span>{user?.firstName} {user?.lastName}</span></div>
          <div><label>Email:</label> <span>{user?.email}</span></div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Partner Linking</h3>
        <p className="section-desc">Link your account with your partner to share all estate planning data between your accounts.</p>

        <div className="partner-code-box">
          <label>Your Partner Code</label>
          <div className="code-display">
            <code>{user?.partnerCode}</code>
            <button className="btn btn-icon" onClick={copyCode}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
          <p className="hint">Share this code with your partner so they can link to your account.</p>
        </div>

        {user?.partner ? (
          <div className="partner-status linked">
            <Link2 size={18} />
            <div>
              <strong>Linked with {user.partner.firstName} {user.partner.lastName}</strong>
              <span>{user.partner.email}</span>
            </div>
            <button className="btn btn-sm btn-danger" onClick={handleUnlink}>
              <Unlink size={14} /> Unlink
            </button>
          </div>
        ) : (
          <form onSubmit={handleLink} className="link-form">
            <div className="form-group">
              <label>Enter Partner's Code</label>
              <div className="input-group">
                <input
                  type="text"
                  value={partnerCode}
                  onChange={e => setPartnerCode(e.target.value.toUpperCase())}
                  placeholder="e.g. A1B2C3D4"
                  required
                />
                <button type="submit" className="btn btn-primary">
                  <Link2 size={16} /> Link Partner
                </button>
              </div>
            </div>
          </form>
        )}

        {message && <div className="success-msg">{message}</div>}
        {error && <div className="error-msg">{error}</div>}
      </div>
    </div>
  );
}
