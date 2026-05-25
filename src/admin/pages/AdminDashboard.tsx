import { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { useNavigate } from 'react-router-dom';
import { firebaseLogout } from '../../lib/firebaseAuth';
import { LayoutDashboard, Users, Activity, LogOut, BarChart3, Menu, X, ShieldAlert } from 'lucide-react';
import AdminUsersPage from './AdminUsersPage';
import AdminActivityPage from './AdminActivityPage';
import AdminDownloadRequestsPage from './AdminDownloadRequestsPage';
import AdminAnalyticsPage from './AdminAnalyticsPage';

export default function AdminDashboard() {
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users'|'activity'|'downloads'|'analytics'>('users');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Clear workspace mode when entering admin dashboard
  useEffect(() => {
    sessionStorage.removeItem('admin_workspace_mode');
  }, []);

  const handleLogout = async () => {
    try { await firebaseLogout(token!); } catch (e) {}
    sessionStorage.removeItem('admin_workspace_mode');
    logout();
    navigate('/admin/login');
  };

  const handleTabClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSidebarOpen(false); // auto-close on mobile
  };

  const navItems: { key: typeof activeTab; icon: any; label: string }[] = [
    { key: 'users', icon: <Users size={18}/>, label: 'Users & Roles' },
    { key: 'activity', icon: <Activity size={18}/>, label: 'Activity Log' },
    { key: 'downloads', icon: <ShieldAlert size={18}/>, label: 'Approval Requests' },
    { key: 'analytics', icon: <BarChart3 size={18}/>, label: 'Analytics' },
  ];

  return (
    <div style={{minHeight:'100vh',background:'var(--background)',display:'flex',position:'relative'}}>

      {/* Mobile topbar */}
      <div className="admin-mobile-topbar" style={{
        display:'none',position:'fixed',top:0,left:0,right:0,zIndex:1001,
        background:'var(--surface)',borderBottom:'1px solid var(--border)',
        padding:'10px 16px',alignItems:'center',justifyContent:'space-between',
        boxShadow:'var(--shadow-sm)'
      }}>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{background:'none',border:'none',color:'var(--foreground)',cursor:'pointer',padding:'4px',display:'flex'}}>
          {sidebarOpen ? <X size={22}/> : <Menu size={22}/>}
        </button>
        <h1 style={{margin:0,fontSize:'15px',fontWeight:800,color:'var(--foreground)',display:'flex',alignItems:'center',gap:'6px'}}>
          <LayoutDashboard size={16} color="var(--accent)"/> AG Admin
        </h1>
        <div style={{width:'30px'}}/>
      </div>

      {/* Backdrop for mobile */}
      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)} style={{
          display:'none',position:'fixed',inset:0,background:'rgba(0,0,0,0.4)',zIndex:1001,
        }}/>
      )}

      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} style={{
        width:'260px',background:'var(--surface)',borderRight:'1px solid var(--border)',
        display:'flex',flexDirection:'column',flexShrink:0,
        transition:'transform 0.3s ease',zIndex:1002
      }}>
        <div style={{padding:'20px',borderBottom:'1px solid var(--border)'}}>
          <h1 style={{margin:0,fontSize:'18px',color:'var(--foreground)',fontWeight:800,display:'flex',alignItems:'center',gap:'8px'}}>
            <LayoutDashboard size={20} color="var(--accent)"/> AG Admin
          </h1>
          <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {user?.email} ({user?.role === 'superadmin' ? 'Super Admin' : user?.role === 'admin' ? 'Admin' : 'User'})
          </div>
        </div>

        <div style={{padding:'20px 10px',flex:1,display:'flex',flexDirection:'column',gap:'6px'}}>
          {navItems.map(item => (
            <button key={item.key} onClick={() => handleTabClick(item.key)} style={{
              display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderRadius:'10px',border:'none',
              background:activeTab===item.key?'var(--border-light)':'transparent',
              color:activeTab===item.key?'var(--navy)':'var(--muted)',
              cursor:'pointer',textAlign:'left',fontWeight:600,fontSize:'14px',transition:'all 0.2s',width:'100%'
            }}>
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        <div style={{padding:'16px 10px',borderTop:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:'6px'}}>
          <button onClick={() => { sessionStorage.setItem('admin_workspace_mode', '1'); navigate('/'); setSidebarOpen(false); }} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderRadius:'10px',border:'none',background:'linear-gradient(135deg, var(--navy), var(--navy-light))',color:'white',cursor:'pointer',textAlign:'left',fontWeight:600,fontSize:'14px',boxShadow:'var(--shadow-button)',width:'100%'}}>
            <LayoutDashboard size={18}/> Main Workspace
          </button>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderRadius:'10px',border:'none',background:'var(--destructive-bg)',color:'var(--destructive)',cursor:'pointer',textAlign:'left',fontWeight:600,fontSize:'14px',width:'100%'}}>
            <LogOut size={18}/> Logout Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content" style={{flex:1,padding:'30px 40px',overflowY:'auto',height:'100vh',boxSizing:'border-box'}}>
        {activeTab === 'users' && <AdminUsersPage />}
        {activeTab === 'activity' && <AdminActivityPage />}
        {activeTab === 'downloads' && <AdminDownloadRequestsPage />}
        {activeTab === 'analytics' && <AdminAnalyticsPage />}
      </div>

      {/* Responsive CSS injected inline */}
      <style>{`
        @media (max-width: 768px) {
          .admin-mobile-topbar { display: flex !important; }
          .admin-sidebar-backdrop { display: block !important; }
          .admin-sidebar {
            position: fixed !important;
            top: 0; left: 0; bottom: 0;
            transform: translateX(-100%);
            box-shadow: 4px 0 24px rgba(0,0,0,0.15);
          }
          .admin-sidebar.open {
            transform: translateX(0) !important;
          }
          .admin-main-content {
            padding: 16px !important;
            padding-top: 60px !important;
            height: auto !important;
            min-height: 100vh;
          }
        }
        @media (max-width: 480px) {
          .admin-main-content {
            padding: 10px !important;
            padding-top: 56px !important;
          }
        }
      `}</style>
    </div>
  );
}
