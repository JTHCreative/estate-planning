import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { exportUserData, importPartnerData } from '../lib/storage';
import { Link2, Unlink, Copy, Check, Download, Upload } from 'lucide-react';

export default function Settings() {
  const { user, doLinkPartner, doUnlinkPartner } = useAuth();
  const [partnerCode, setPartnerCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      doLinkPartner(partnerCode);
      setMessage('Partner linked successfully!');
      setPartnerCode('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlink = () => {
    if (!confirm('Unlink your partner? You will no longer see each other\'s data.')) return;
    setError('');
    setMessage('');
    doUnlinkPartner();
    setMessage('Partner unlinked');
  };

  const copyCode = () => {
    navigator.clipboard.writeText(user?.partnerCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    if (!user) return;
    const data = exportUserData(user.id);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `estate-planning-${user.firstName.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importPartnerData(user.id, reader.result as string);
        setMessage('Data imported successfully!');
        setError('');
      } catch (err: any) {
        setError('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        <p className="section-desc">
          Link your account with your partner to share all estate planning data.
          Both partners must be registered on the <strong>same browser/device</strong>, or use Export/Import below to share across devices.
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

      <div className="settings-section">
        <h3>Data Export & Import</h3>
        <p className="section-desc">
          Export your data as a JSON file to back up or share with your partner on another device.
          Import a partner's exported file to merge their data into your view.
        </p>
        <div className="export-import-btns">
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} /> Export My Data
          </button>
          <button className="btn btn-primary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Import Partner Data
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
        </div>
      </div>
    </div>
  );
}
