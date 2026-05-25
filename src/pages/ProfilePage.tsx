import { useAuth } from '../lib/auth';

export default function ProfilePage() {
  const { user } = useAuth();
  
  return (
    <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%', height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--fg)', marginBottom: '24px' }}>Profile Settings</h1>
      
      <div style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', padding: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div style={{ width: '80px', height: '80px', background: 'var(--primary)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 600 }}>
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--fg)' }}>{user?.name || 'Admin User'}</h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '15px' }}>{user?.phone || 'No phone number provided'}</p>
          </div>
        </div>
        
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '24px', color: 'var(--fg)' }}>Account Details</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center' }}>
              <div style={{ color: 'var(--muted)', fontWeight: 500 }}>Full Name</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {user?.name || 'Admin User'}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center' }}>
              <div style={{ color: 'var(--muted)', fontWeight: 500 }}>Phone Number</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                {user?.phone || 'N/A'}
              </div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', alignItems: 'center' }}>
              <div style={{ color: 'var(--muted)', fontWeight: 500 }}>Role</div>
              <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)', display: 'inline-flex', width: 'fit-content' }}>
                Administrator
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
