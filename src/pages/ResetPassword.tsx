import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import logo from '../assets/logo.svg';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const oobCode = searchParams.get('oobCode') || '';

  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [invalidCode, setInvalidCode] = useState(false);

  useEffect(() => {
    if (!oobCode) {
      setInvalidCode(true);
      setVerifying(false);
      return;
    }
    verifyPasswordResetCode(auth, oobCode)
      .then(userEmail => {
        setEmail(userEmail);
        setVerifying(false);
      })
      .catch(() => {
        setInvalidCode(true);
        setVerifying(false);
      });
  }, [oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
    } catch (err: any) {
      if (err?.code === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err?.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <img src={logo} alt="Estate Planner" className="auth-logo" />
            <h1>Estate Planner</h1>
          </div>
          <p className="section-desc" style={{ textAlign: 'center' }}>Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (invalidCode) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <img src={logo} alt="Estate Planner" className="auth-logo" />
            <h1>Estate Planner</h1>
          </div>
          <div className="error-msg" style={{ marginBottom: 16 }}>
            This password reset link is invalid or has expired.
          </div>
          <Link to="/login" className="btn btn-primary btn-full" style={{ textAlign: 'center', display: 'block' }}>
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <img src={logo} alt="Estate Planner" className="auth-logo" />
            <h1>Estate Planner</h1>
          </div>
          <div className="success-msg" style={{ marginBottom: 16 }}>
            Your password has been reset successfully.
          </div>
          <Link to="/login" className="btn btn-primary btn-full" style={{ textAlign: 'center', display: 'block' }}>
            Sign In with New Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo} alt="Estate Planner" className="auth-logo" />
          <h1>Estate Planner</h1>
          <p>Create a new password</p>
        </div>
        {email && <p className="section-desc" style={{ textAlign: 'center', marginBottom: 16 }}>Resetting password for <strong>{email}</strong></p>}
        <form onSubmit={handleReset}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-group">
            <label>New Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required autoFocus />
          </div>
          <div className="form-group">
            <label>Confirm New Password</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
        </form>
        <p className="auth-footer">
          <Link to="/login">Back to Sign In</Link>
        </p>
      </div>
    </div>
  );
}
