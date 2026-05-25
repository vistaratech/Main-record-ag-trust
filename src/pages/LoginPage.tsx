import { useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { firebaseLogin } from '../lib/firebaseAuth';
import { ArrowRight, Mail, Eye, EyeOff, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required'); return; }
    setLoading(true); setError('');
    try {
      const result = await firebaseLogin(email, password);
      login(result.token, result.user);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!email) { setError('Email is required'); return; }
      setError('');
      passwordRef.current?.focus();
    }
  };

  const handlePasswordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (email && password) {
        formRef.current?.requestSubmit();
      }
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo-wrap">
          <img src="/logo-transparent.png" alt="AG Trust Logo" className="login-logo-img" />
          <span className="login-logo-badge">Trusted Partner</span>
        </div>

        <h1 className="login-title">AG Trust</h1>
        <p className="login-sub">Sign in to your account</p>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleLogin} ref={formRef}>
          <label className="login-label">Email Address</label>
          <div className="login-input-group" style={{ paddingLeft: '12px' }}>
            <Mail size={18} style={{ marginRight: '8px', color: 'var(--muted)', flexShrink: 0 }} />
            <input
              className="login-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleEmailKeyDown}
              autoFocus
              style={{ paddingLeft: 0 }}
            />
          </div>

          <label className="login-label" style={{ marginTop: '16px' }}>Password</label>
          <div className="login-input-group" style={{ paddingLeft: '12px' }}>
            <Lock size={18} style={{ marginRight: '8px', color: 'var(--muted)', flexShrink: 0 }} />
            <input
              ref={passwordRef}
              className="login-input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handlePasswordKeyDown}
              style={{ paddingLeft: 0 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px 8px', color: 'var(--muted)', flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading} style={{ marginTop: '24px' }}>
            {loading ? <div className="spinner" /> : <><span>Login</span><ArrowRight size={16} /></>}
          </button>
        </form>

        <p className="login-devnote" style={{ marginTop: '20px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
          Your account must be created by an administrator. Contact your admin if you don't have access.
        </p>
      </div>
    </div>
  );
}
