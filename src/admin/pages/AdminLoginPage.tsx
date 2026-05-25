import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { firebaseAdminLogin } from '../../lib/firebaseAuth';
import { ArrowRight, Mail, Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true); setError('');
    try {
      const result = await firebaseAdminLogin(email, password);
      login(result.token, result.user);
      navigate('/admin/dashboard');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-page" style={{ background: '#0b0f1a' }}>
      <div className="login-card" style={{ borderTop: '4px solid #ef4444' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldAlert size={32} color="#ef4444" />
          </div>
        </div>

        <h1 className="login-title">Admin Portal</h1>
        <p className="login-sub">Sign in to the administrative dashboard</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin}>
          <label className="login-label">Admin Email</label>
          <div className="login-input-group" style={{ paddingLeft: '12px' }}>
            <Mail size={18} style={{ marginRight: '8px', color: 'var(--muted)', flexShrink: 0 }} />
            <input className="login-input" type="email" placeholder="admin@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} autoFocus style={{ paddingLeft: 0 }} />
          </div>

          <label className="login-label" style={{ marginTop: '16px' }}>Password</label>
          <div className="login-input-group" style={{ paddingLeft: '12px' }}>
            <Lock size={18} style={{ marginRight: '8px', color: 'var(--muted)', flexShrink: 0 }} />
            <input className="login-input" type={showPassword ? 'text' : 'password'}
              placeholder="Enter admin password"
              value={password} onChange={(e) => setPassword(e.target.value)} style={{ paddingLeft: 0 }} />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                color: 'var(--muted)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
              tabIndex={-1}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}
            style={{ marginTop: '24px', background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
            {loading ? <div className="spinner" /> : <><span>Secure Login</span><ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="login-devnote" style={{ marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
