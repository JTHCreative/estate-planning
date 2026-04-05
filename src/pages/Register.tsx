import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Passwords do not match'); return; }
    if (form.password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      await register(form.email, form.password, form.firstName, form.lastName);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Shield size={40} />
          <h1>Create Account</h1>
          <p>Start organizing your estate plan</p>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-msg">{error}</div>}
          <div className="form-row">
            <div className="form-group">
              <label>First Name</label>
              <input type="text" value={form.firstName} onChange={update('firstName')} required />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" value={form.lastName} onChange={update('lastName')} required />
            </div>
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" value={form.email} onChange={update('email')} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={form.password} onChange={update('password')} required />
          </div>
          <div className="form-group">
            <label>Confirm Password</label>
            <input type="password" value={form.confirm} onChange={update('confirm')} required />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
