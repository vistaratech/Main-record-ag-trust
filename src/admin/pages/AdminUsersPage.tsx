import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import {
  firebaseGetUsers, firebaseCreateUser, firebaseDeleteUser,
  firebaseUpdateUserStatus
} from '../../lib/firebaseAuth';
import {
  UserPlus, Trash2, UserCheck, UserX, Search, RefreshCw,
  Eye, EyeOff, Shield
} from 'lucide-react';

interface ServerUser {
  id: string; name: string; email: string; role: string; status: string;
  createdAt: string; loginHistory?: { type: string; timestamp: string }[];
  permissions?: any;
}

const s = {
  input: { width:'100%',padding:'10px 14px',borderRadius:'8px',border:'1.5px solid var(--border)',background:'var(--surface)',color:'var(--foreground)',fontSize:'14px',outline:'none',transition:'border-color 0.2s' } as React.CSSProperties,
  label: { display:'block',fontSize:'13px',color:'var(--foreground)',marginBottom:'6px',fontWeight:600 } as React.CSSProperties,
  badge: (bg:string,color:string, border:string='transparent') => ({ padding:'4px 10px',borderRadius:'6px',fontSize:'11px',fontWeight:700,background:bg,color,border:`1px solid ${border}`,display:'inline-block' }) as React.CSSProperties,
};

export default function AdminUsersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<ServerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  // Role is always 'user' by default for new accounts created here
  const [newRole, setNewRole] = useState<'user'|'sheet_admin'>('user');
  const [showNewPass, setShowNewPass] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetch_ = async () => {
    setLoading(true); setError('');
    try { const d = await firebaseGetUsers(); setUsers(d.users||[]); }
    catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetch_(); }, []);

  const handleCreate = async (e:React.FormEvent) => {
    e.preventDefault(); if(!newName||!newEmail||!newPass) return;
    setCreating(true); setError('');
    try {
      await firebaseCreateUser({ name:newName, email:newEmail, password:newPass, role:newRole });
      setNewName(''); setNewEmail(''); setNewPass(''); setNewRole('user'); setShowCreate(false); fetch_();
    } catch(e:any) { setError(e.message); } finally { setCreating(false); }
  };

  const handleDelete = async (id:string) => {
    if(!confirm('Delete this user?')) return;
    try { await firebaseDeleteUser(id); fetch_(); } catch(e:any) { alert(e.message); }
  };

  const handleToggleStatus = async (id:string, cur:string) => {
    try { await firebaseUpdateUserStatus(id, cur==='active'?'inactive':'active'); fetch_(); }
    catch(e:any) { alert(e.message); }
  };

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      {error && <div style={{background:'var(--destructive-bg)',border:'1px solid rgba(230,48,18,0.3)',borderRadius:'10px',padding:'12px 16px',marginBottom:'16px',color:'var(--destructive)',fontSize:'14px',fontWeight:500}}>{error}</div>}

      {/* Toolbar */}
      <div style={{display:'flex',gap:'12px',marginBottom:'20px',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1,background:'var(--surface)',borderRadius:'10px',padding:'0 14px',border:'1.5px solid var(--border)',boxShadow:'var(--shadow-sm)'}}>
          <Search size={16} color="var(--muted)"/>
          <input placeholder="Search users..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{flex:1,padding:'12px 0',border:'none',background:'transparent',color:'var(--foreground)',fontSize:'14px',outline:'none'}}/>
        </div>
        <button onClick={fetch_} style={{background:'var(--surface)',border:'1.5px solid var(--border)',color:'var(--navy)',cursor:'pointer',padding:'12px',borderRadius:'10px',display:'flex',boxShadow:'var(--shadow-sm)'}}><RefreshCw size={16}/></button>
        <button onClick={()=>setShowCreate(!showCreate)} style={{background:'linear-gradient(135deg, var(--brand-green), var(--brand-green-dark))',border:'none',color:'white',cursor:'pointer',padding:'0 20px',height:'44px',borderRadius:'10px',fontSize:'14px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px',boxShadow:'var(--shadow-button)'}}>
          <UserPlus size={16}/> Add User
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div style={{background:'var(--surface)',borderRadius:'12px',padding:'24px',marginBottom:'20px',border:'1px solid var(--border)',boxShadow:'var(--shadow-md)'}}>
          <h3 style={{margin:'0 0 16px',fontSize:'16px',fontWeight:800,color:'var(--foreground)'}}>Create New User</h3>
          <form onSubmit={handleCreate} style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
            <div><label style={s.label}>Name</label><input style={s.input} value={newName} onChange={e=>setNewName(e.target.value)} required placeholder="Full name"/></div>
            <div><label style={s.label}>Email</label><input type="email" style={s.input} value={newEmail} onChange={e=>setNewEmail(e.target.value)} required placeholder="user@example.com"/></div>
            <div><label style={s.label}>Password</label>
              <div style={{position:'relative'}}>
                <input type={showNewPass?'text':'password'} style={{...s.input,paddingRight:'36px'}} value={newPass} onChange={e=>setNewPass(e.target.value)} required placeholder="Min 6 chars"/>
                <button type="button" onClick={()=>setShowNewPass(!showNewPass)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:'var(--muted)',cursor:'pointer',display:'flex'}}>
                  {showNewPass?<EyeOff size={16}/>:<Eye size={16}/>}
                </button>
              </div>
            </div>
            <div>
              <label style={s.label}>Role</label>
              <select value={newRole} onChange={e=>setNewRole(e.target.value as any)} style={{...s.input,cursor:'pointer'}}>
                <option value="user">User</option>
              </select>
            </div>
            {/* Role dropdown for user or sheet_admin */}
            <div style={{gridColumn:'1/-1',display:'flex',gap:'12px',justifyContent:'flex-end',marginTop:'8px'}}>
              <button type="button" onClick={()=>setShowCreate(false)} style={{padding:'10px 20px',borderRadius:'8px',border:'1px solid var(--border)',background:'transparent',color:'var(--muted)',cursor:'pointer',fontSize:'14px',fontWeight:600}}>Cancel</button>
              <button type="submit" disabled={creating} style={{padding:'10px 24px',borderRadius:'8px',border:'none',background:'linear-gradient(135deg, var(--brand-green), var(--brand-green-dark))',color:'white',fontWeight:700,fontSize:'14px',cursor:'pointer',boxShadow:'var(--shadow-button)'}}>{creating?'...':'Create User'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div style={{background:'var(--surface)',borderRadius:'12px',overflow:'hidden',border:'1px solid var(--border)',boxShadow:'var(--shadow-md)'}}>
        {loading ? <div style={{padding:'50px',textAlign:'center',color:'var(--muted)'}}>Loading...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead><tr style={{borderBottom:'1.5px solid var(--border)',background:'var(--background)'}}>
              {['Name','Email','Role','Permissions','Status','Actions'].map(h=>(
                <th key={h} style={{padding:'14px 16px',textAlign:'left',fontSize:'12px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(u => {
                const p = u.permissions || { canView:true, canEdit:false, canDownload:false, isAdmin:false };
                const isSuperAdmin = u.role === 'superadmin';
                return (
                  <tr key={u.id} style={{borderBottom:'1px solid var(--border-light)',background:isSuperAdmin?'rgba(30,45,120,0.02)':'transparent',cursor:isSuperAdmin?'default':'pointer'}} onClick={() => !isSuperAdmin && navigate(`/admin/users/${u.id}`)}>
                    <td style={{padding:'14px 16px',color:'var(--foreground)',fontWeight:600,fontSize:'14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                        {u.name}
                        {isSuperAdmin && <span style={{fontSize:'10px',fontWeight:700,color:'#6366f1',background:'rgba(99,102,241,0.1)',padding:'2px 8px',borderRadius:'4px',border:'1px solid rgba(99,102,241,0.2)'}}>🔒 Protected</span>}
                      </div>
                    </td>
                    <td style={{padding:'14px 16px',color:'var(--muted)',fontSize:'14px'}}>{u.email}</td>
                    <td style={{padding:'14px 16px'}}>
                      <span style={s.badge(
                        u.role==='superadmin'?'rgba(30,45,120,0.1)':u.role==='admin'?'rgba(230,48,18,0.1)':u.role==='sheet_admin'?'rgba(99,102,241,0.1)':'var(--border-light)',
                        u.role==='superadmin'?'var(--navy)':u.role==='admin'?'var(--accent)':u.role==='sheet_admin'?'#6366f1':'var(--muted)',
                        u.role==='superadmin'?'rgba(30,45,120,0.2)':u.role==='admin'?'rgba(230,48,18,0.2)':u.role==='sheet_admin'?'rgba(99,102,241,0.2)':'var(--border)'
                      )}>{u.role === 'sheet_admin' ? 'Sheet Admin' : u.role}</span>
                    </td>
                    <td style={{padding:'14px 16px'}}>
                      <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                        {(isSuperAdmin || p.canView) && <span style={s.badge('var(--border-light)','var(--navy)')}>👁 View</span>}
                        {(isSuperAdmin || p.canEdit) && <span style={s.badge('rgba(76,175,26,0.1)','var(--brand-green)')}>✏ Edit</span>}
                        {(isSuperAdmin || p.canDownload) && <span style={s.badge('rgba(245,158,11,0.1)','#F59E0B')}>⬇ Download</span>}
                        {(isSuperAdmin || p.isAdmin) && <span style={s.badge('var(--destructive-bg)','var(--destructive)')}>🛡 Admin</span>}
                        {isSuperAdmin && <span style={s.badge('rgba(99,102,241,0.1)','#6366f1')}>⚡ Full Access</span>}
                      </div>
                    </td>
                    <td style={{padding:'14px 16px'}}>
                      <span style={s.badge(u.status==='active'?'rgba(76,175,26,0.1)':'var(--destructive-bg)',u.status==='active'?'var(--brand-green)':'var(--destructive)')}>{u.status||'active'}</span>
                    </td>
                    <td style={{padding:'14px 16px'}}>
                      {isSuperAdmin ? (
                        <div style={{fontSize:'12px',color:'var(--muted)',fontWeight:600,fontStyle:'italic',display:'flex',alignItems:'center',gap:'4px'}}>
                          <Shield size={14} color="#6366f1"/> Cannot modify
                        </div>
                      ) : (
                        <div style={{display:'flex',gap:'6px'}}>
                          <button onClick={(e)=>{e.stopPropagation(); navigate(`/admin/users/${u.id}`);}} title="Settings & Permissions" style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',padding:'6px',cursor:'pointer',color:'var(--navy)',display:'flex',boxShadow:'var(--shadow-sm)'}}>
                            <Shield size={14}/>
                          </button>
                          <button onClick={(e)=>{e.stopPropagation(); handleToggleStatus(u.id,u.status||'active');}} title={u.status==='active'?'Deactivate':'Activate'} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',padding:'6px',cursor:'pointer',color:u.status==='active'?'#F59E0B':'var(--brand-green)',display:'flex',boxShadow:'var(--shadow-sm)'}}>
                            {u.status==='active'?<UserX size={14}/>:<UserCheck size={14}/>}
                          </button>
                          <button onClick={(e)=>{e.stopPropagation(); handleDelete(u.id);}} disabled={u.email===user?.email} title="Delete" style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'6px',padding:'6px',cursor:'pointer',color:u.email===user?.email?'var(--border)':'var(--destructive)',display:'flex',boxShadow:'var(--shadow-sm)'}}><Trash2 size={14}/></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length===0 && <tr><td colSpan={6} style={{padding:'40px',textAlign:'center',color:'var(--muted)'}}>{search?'No matches':'No users'}</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
