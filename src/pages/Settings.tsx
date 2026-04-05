import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link2, Unlink, Copy, Check, Camera, X } from 'lucide-react';

export default function Settings() {
  const { user, doLinkPartner, doUnlinkPartner, updatePhoto } = useAuth();
  const [partnerCode, setPartnerCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await doLinkPartner(partnerCode);
      setMessage('Partner linked successfully!');
      setPartnerCode('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Unlink your partner? You will no longer see each other\'s data.')) return;
    setError('');
    setMessage('');
    try {
      await doUnlinkPartner();
      setMessage('Partner unlinked');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.partnerCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Resize and convert to base64 data URL
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = 128;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Crop to square from center
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
        <h3>Partner Linking</h3>
        <p className="section-desc">
          Link your account with your partner to share all estate planning data between your accounts.
          Both partners can be on any device — data syncs through the cloud.
        </p>

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
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  <Link2 size={16} /> {loading ? 'Linking...' : 'Link Partner'}
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
