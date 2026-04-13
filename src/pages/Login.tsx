import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import logo from '../assets/logo.svg';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    setForgotMessage('');
    setForgotLoading(true);
    try {
      // Build the reset URL pointing to our app's reset-password page
      const baseUrl = window.location.href.split('#')[0];
      await sendPasswordResetEmail(auth, forgotEmail, {
        url: `${baseUrl}#/reset-password`,
        handleCodeInApp: true,
      });
      setForgotMessage('Password reset email sent! Check your inbox (and spam folder).');
      setForgotEmail('');
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/invalid-email') {
        // Don't reveal whether the email exists — show the same success message
        setForgotMessage('If an account exists with that email, a reset link has been sent.');
      } else {
        setForgotError(err?.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={logo} alt="Estate Planner" className="auth-logo" />
          <h1>Estate Planner</h1>
          <p>Securely manage your accounts & assets</p>
        </div>

        {!showForgot ? (
          <>
            <form onSubmit={handleSubmit}>
              {error && <div className="error-msg">{error}</div>}
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <p className="forgot-link">
              <button type="button" className="btn-link" onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotError(''); setForgotMessage(''); }}>
                Forgot Password?
              </button>
            </p>
            <p className="auth-footer">
              Don't have an account? <Link to="/register">Create one</Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleForgotPassword}>
              <p className="section-desc" style={{ marginBottom: 16 }}>
                Enter your email address and we'll send you a link to reset your password.
              </p>
              {forgotMessage && <div className="success-msg">{forgotMessage}</div>}
              {forgotError && <div className="error-msg">{forgotError}</div>}
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} required autoFocus />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={forgotLoading}>
                {forgotLoading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <p className="forgot-link">
              <button type="button" className="btn-link" onClick={() => setShowForgot(false)}>
                Back to Sign In
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
