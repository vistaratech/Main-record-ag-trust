import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { firebaseGetUsers, firebaseUpdatePermissions, firebaseAdminChangePassword, firebaseUpdateUser } from '../../lib/firebaseAuth';
import { listBusinesses, listRegisters, getRegisterColumnsOnly, listFolders, type RegisterDetail, type Folder, setColumnMandatory, setColumnUnique } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { ArrowLeft, FileText, Shield, Eye, Edit3, Download, EyeOff, Lock, ChevronDown, ChevronRight, X, Play, Check, Search, FolderOpen, Users } from 'lucide-react';
import { useNotifications } from '../../lib/NotificationContext';

export default function AdminUserSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { token } = useAuth();
  
  const [user, setUser] = useState<any>(null);
  const [registers, setRegisters] = useState<RegisterDetail[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newPw, setNewPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [sheetAccessGranted, setSheetAccessGranted] = useState<Record<string, boolean>>({});
  const [folderAccessGranted, setFolderAccessGranted] = useState<Record<string, boolean>>({});
  const [editRestrictions, setEditRestrictions] = useState<Record<string, any>>({});
  const [columnViewRestrictions, setColumnViewRestrictions] = useState<Record<string, any>>({});
  const [downloadRestrictions, setDownloadRestrictions] = useState<Record<string, any>>({});
  const [previewReg, setPreviewReg] = useState<RegisterDetail | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<number | string, boolean>>({});
  const [userRole, setUserRole] = useState<string>('user');
  const [expandedRegId, setExpandedRegId] = useState<number | null>(null);

  const [globalPerms, setGlobalPerms] = useState({ canView: true, canEdit: false, canDownload: false, isAdmin: false, fullSheetAccess: false, canCreateSheets: false });



  useEffect(() => {
    async function loadData() {
      try {
        const data = await firebaseGetUsers();
        const foundUser = (data.users || []).find((u: any) => u.id === id) as any;
        if (!foundUser) {
          addNotification({ title: 'Error', message: 'User not found', type: 'error' });
          navigate('/admin/dashboard');
          return;
        }
        // Protect superadmin — cannot edit superadmin settings
        if (foundUser.role === 'superadmin') {
          addNotification({ title: 'Protected', message: 'The Super Admin account cannot be modified. It has permanent full access.', type: 'error' });
          navigate('/admin/dashboard');
          return;
        }
        setUser(foundUser);
        setUserRole(foundUser.role || 'user');
        if ((foundUser as any).password) {
          setNewPw((foundUser as any).password);
        }
        
        const p = foundUser.permissions || {};
        setGlobalPerms({
          canView: p.canView ?? true,
          canEdit: p.canEdit ?? false,
          canDownload: p.canDownload ?? false,
          isAdmin: p.isAdmin ?? false,
          fullSheetAccess: p.fullSheetAccess ?? false,
          canCreateSheets: p.canCreateSheets ?? false
        });

        if (Array.isArray(p.allowedRegisters)) {
          const sag: Record<string, boolean> = {};
          p.allowedRegisters.forEach((rid: string) => {
            sag[rid] = true;
          });
          setSheetAccessGranted(sag);
        } else if (p.viewRestrictions && typeof p.viewRestrictions === 'object') {
          // Backward compatibility
          const sag: Record<string, boolean> = {};
          Object.keys(p.viewRestrictions).forEach(rid => {
            sag[rid] = true;
          });
          setSheetAccessGranted(sag);
        }

        if (Array.isArray(p.allowedFolders)) {
          const fag: Record<string, boolean> = {};
          p.allowedFolders.forEach((fid: string) => {
            fag[fid] = true;
          });
          setFolderAccessGranted(fag);
        }

        if (p.editRestrictions && typeof p.editRestrictions === 'object') {
          setEditRestrictions(p.editRestrictions);
        }

        if (p.columnViewRestrictions && typeof p.columnViewRestrictions === 'object') {
          setColumnViewRestrictions(p.columnViewRestrictions);
        }

        if (p.downloadRestrictions && typeof p.downloadRestrictions === 'object') {
          setDownloadRestrictions(p.downloadRestrictions);
        }

        const busList = await listBusinesses();
        const busId = busList[0]?.id || 1;
        const summs = await listRegisters(busId);
        const fullRegs = await Promise.all(summs.map(s => getRegisterColumnsOnly(s.id)));
        setRegisters(fullRegs.filter(Boolean) as RegisterDetail[]);
        
        const flds = await listFolders(busId);
        setFolders(flds);

      } catch (err) {
        addNotification({ title: 'Error', message: 'Failed to load user settings', type: 'error' });
      } finally {
        setLoading(false);
      }
    }
    if (id && token) loadData();
  }, [id, token, navigate, addNotification]);

  const handleSave = async (silent = false, overrides?: any) => {
    if (!user || !token) return;
    setSaving(true);
    try {
      const newPerms = {
        ...globalPerms,
        viewRestrictions: {},
        columnViewRestrictions: columnViewRestrictions,
        editRestrictions: editRestrictions,
        downloadRestrictions: downloadRestrictions,
        createRestrictions: {},
        rowViewRestrictions: {},
        rowEditRestrictions: {},
        rowDownloadRestrictions: {},
        allowedRegisters: Object.keys(sheetAccessGranted).filter(id => sheetAccessGranted[id]),
        allowedFolders: Object.keys(folderAccessGranted).filter(id => folderAccessGranted[id])
      };
      
      console.log('[SAVE] Updating permissions for:', user.name, newPerms);
      await firebaseUpdatePermissions(user.id, newPerms);
      if (!silent) addNotification({ title: 'Success', message: 'User settings saved successfully!', type: 'success' });
      setUser({ ...user, permissions: newPerms });
    } catch (err: any) {
      if (!silent) addNotification({ title: 'Error', message: err.message || 'Failed to save settings', type: 'error' });
      console.error('Save failed:', err);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const initialMount = useRef(true);
  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    if (loading) return;

    const timer = setTimeout(() => {
      handleSave(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    globalPerms, editRestrictions, columnViewRestrictions, downloadRestrictions, sheetAccessGranted, folderAccessGranted
  ]);

  const handleChangePassword = async () => {
    if (!token) return;
    if (!newPw || newPw.length < 6) { 
      addNotification({ title: 'Validation', message: 'Password must be at least 6 characters', type: 'error' });
      return; 
    }
    try {
      await firebaseAdminChangePassword(user.id, newPw);
      setNewPw('');
      addNotification({ title: 'Success', message: 'Password changed successfully', type: 'success' });
    } catch (err: any) {
      addNotification({ title: 'Error', message: err.message || 'Failed to change password', type: 'error' });
    }
  };




  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading user data...</div>;
  if (!user) return null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100, padding: '20px 40px', background: 'white', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => navigate('/admin/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: '20px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              User Settings: {user.name || user.email}
              {saving && <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--brand-green)', background: 'rgba(34,197,94,0.1)', padding: '2px 8px', borderRadius: '4px', animation: 'pulse 2s infinite' }}>Saving changes...</span>}
            </h1>
            <div style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>Configure roles, global access, and granular sheet permissions.</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '40px', flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Global Permissions */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} /> Global Permissions
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {[
                  { k: 'canCreateSheets', l: 'Can Create Folders & Sheets', icon: <FileText size={16}/>, desc: 'Can add new folders and sheets' },
                  { k: 'isAdmin', l: 'Admin Access', icon: <Shield size={16}/>, desc: 'Full admin access' }
                ].map(({ k, l, icon, desc }) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-light)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={(globalPerms as any)[k]} onChange={() => setGlobalPerms(p => ({ ...p, [k]: !(p as any)[k] }))} style={{ width: '18px', height: '18px', accentColor: 'var(--brand-green)' }} />
                    <span style={{ color: 'var(--foreground)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}>{icon} {l}</span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>{desc}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Password & Security */}
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Lock size={18} /> Password & Security
              </h3>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Password" style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', paddingRight: '36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '14px' }} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', display: 'flex' }}>
                    {showNewPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
                <button onClick={handleChangePassword} style={{ padding: '0 16px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, var(--navy), var(--navy-light))', color: 'white', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}>Update</button>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '12px', color: 'var(--muted)' }}>You can view or update the user's password here.</p>
            </div>
          </div>

          {/* Role Selector */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} /> User Role
            </h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {[
                { value: 'user', label: 'User', desc: 'Standard user with granular permissions. Use toggles below to control access.', color: 'var(--muted)', bg: 'var(--border-light)' },
                { value: 'admin', label: 'System Admin', desc: 'Full dashboard + workspace + download access. Can manage all users and settings.', color: 'var(--accent)', bg: 'rgba(230,48,18,0.1)' },
              ].map(r => (
                <button key={r.value} onClick={async () => {
                  if (userRole === r.value) return;
                  try {
                    const newPerms = r.value === 'admin'
                      ? { ...globalPerms, canView: true, canEdit: true, canDownload: true, isAdmin: true, fullSheetAccess: true, canCreateSheets: true }
                      : { ...globalPerms, fullSheetAccess: false, isAdmin: false };
                    await firebaseUpdateUser(user.id, { role: r.value });
                    await firebaseUpdatePermissions(user.id, { ...user.permissions, ...newPerms });
                    setUserRole(r.value);
                    setGlobalPerms(newPerms);
                    setUser({ ...user, role: r.value, permissions: { ...user.permissions, ...newPerms } });
                    addNotification({ title: 'Role Updated', message: `${user.name} is now a ${r.label}`, type: 'success' });
                  } catch (err: any) {
                    addNotification({ title: 'Error', message: err.message || 'Failed to update role', type: 'error' });
                  }
                }} style={{
                  flex: '1 1 200px', padding: '16px', borderRadius: '10px', cursor: 'pointer',
                  border: userRole === r.value ? `2px solid ${r.color}` : '2px solid var(--border)',
                  background: userRole === r.value ? r.bg : 'var(--surface)',
                  textAlign: 'left', transition: 'all 0.2s',
                }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: userRole === r.value ? r.color : 'var(--foreground)', marginBottom: '4px' }}>
                    {userRole === r.value && <Check size={14} style={{ marginRight: '6px' }} />}
                    {r.label}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{r.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Full Sheet & Folder Access Toggle */}
          <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: `1px solid ${(globalPerms as any).fullSheetAccess ? '#6366f1' : 'var(--border)'}`, boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Shield size={18} /> Full Sheet & Folder Access
                </h3>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', maxWidth: '500px' }}>
                  When enabled, this user can access <strong>all sheets and folders</strong> — view, edit, create sheets, create folders — without needing granular permissions below. When disabled, only the specific sheet permissions assigned below will apply.
                </p>
              </div>
              <button
                onClick={async () => {
                  const newVal = !(globalPerms as any).fullSheetAccess;
                  const newPerms = { ...globalPerms, fullSheetAccess: newVal };
                  try {
                    await firebaseUpdatePermissions(user.id, { ...user.permissions, ...newPerms });
                    setGlobalPerms(newPerms);
                    setUser({ ...user, permissions: { ...user.permissions, ...newPerms } });
                    addNotification({ title: newVal ? 'Full Access Enabled' : 'Full Access Disabled', message: newVal ? `${user.name} now has access to all sheets & folders` : `${user.name} now uses granular permissions only`, type: 'success' });
                  } catch (err: any) {
                    addNotification({ title: 'Error', message: err.message || 'Failed to toggle', type: 'error' });
                  }
                }}
                style={{
                  padding: '10px 24px', borderRadius: '10px', fontWeight: 700, fontSize: '14px',
                  cursor: 'pointer', border: 'none', transition: 'all 0.25s',
                  background: (globalPerms as any).fullSheetAccess
                    ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                    : 'var(--surface)',
                  color: (globalPerms as any).fullSheetAccess ? '#fff' : 'var(--muted)',
                  boxShadow: (globalPerms as any).fullSheetAccess ? '0 4px 15px rgba(99,102,241,0.3)' : 'inset 0 0 0 1px var(--border)',
                  minWidth: '160px',
                }}
              >
                {(globalPerms as any).fullSheetAccess ? (
                  <><Check size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> All Access ON</>
                ) : (
                  <><X size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Granular Only</>
                )}
              </button>
            </div>
            {(globalPerms as any).fullSheetAccess && (
              <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', fontSize: '12px', color: '#6366f1', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Check size={14} /> This user has full access to all sheets and folders. The granular permissions below are bypassed.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--navy)' }}>Granular Sheet Permissions</h3>
            <div style={{ position: 'relative', width: '300px' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
              <input
                type="text"
                placeholder="Search sheets..."
                value={searchQuery}

                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px 8px 36px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', outline: 'none' }}
              />
            </div>
          </div>
          
          {(() => {
            const filtered = registers.filter(r => r.name.toLowerCase().includes(searchQuery.toLowerCase()));
            const folderMap: Record<number, typeof filtered> = {};
            const unassigned: typeof filtered = [];
            for (const reg of filtered) {
              if ((reg as any).folderId) {
                if (!folderMap[(reg as any).folderId]) folderMap[(reg as any).folderId] = [];
                folderMap[(reg as any).folderId].push(reg);
              } else {
                unassigned.push(reg);
              }
            }

            const renderSheet = (reg: RegisterDetail) => {
              const cols = [...reg.columns].sort((a, b) => a.position - b.position);
              const allColIndices = cols.map((_, i) => i);
              const isExpanded = expandedRegId === reg.id;
              const hasAccess = globalPerms.isAdmin || sheetAccessGranted[reg.id] === true;

              return (
                <div key={reg.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid var(--border)', overflow: 'hidden', opacity: hasAccess ? 1 : 0.6 }}>
                  <div onClick={() => setExpandedRegId(isExpanded ? null : reg.id)} style={{ padding: '16px 20px', borderBottom: isExpanded ? '1px solid var(--border)' : 'none', cursor: 'pointer', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isExpanded ? <ChevronDown size={20} color="var(--muted)" /> : <ChevronRight size={20} color="var(--muted)" />}
                    <FileText size={20} color="var(--accent)" />
                    <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--navy)', flex: 1 }}>{reg.name} {!hasAccess && <span style={{fontSize: '12px', color: 'var(--destructive)', marginLeft: '8px'}}>(No Access)</span>}</h3>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      {hasAccess && (
                        <>
                          <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#8B5CF6', cursor: 'pointer', padding: '4px 8px', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '6px', border: '1px solid rgba(139, 92, 246, 0.2)' }}>
                            <input 
                              type="checkbox" 
                              checked={editRestrictions[reg.id] === undefined} 
                              onChange={() => setEditRestrictions(prev => {
                                const next = { ...prev };
                                if (next[reg.id] === undefined) next[reg.id] = [];
                                else delete next[reg.id];
                                return next;
                              })} 
                              style={{ width: '16px', height: '16px', accentColor: '#8B5CF6' }}
                            />
                            <Edit3 size={14} color="#8B5CF6" /> Edit
                          </label>

                          <label onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: '#0891b2', cursor: 'pointer', padding: '4px 8px', background: 'rgba(8, 145, 178, 0.05)', borderRadius: '6px', border: '1px solid rgba(8, 145, 178, 0.2)' }}>
                            <input 
                              type="checkbox" 
                              checked={downloadRestrictions[reg.id] === undefined} 
                              onChange={() => setDownloadRestrictions(prev => {
                                const next = { ...prev };
                                if (next[reg.id] === undefined) next[reg.id] = [];
                                else delete next[reg.id];
                                return next;
                              })} 
                              style={{ width: '16px', height: '16px', accentColor: '#0891b2' }}
                            />
                            <Download size={14} color="#0891b2" /> Download
                          </label>
                        </>
                      )}
                      <button disabled={globalPerms.isAdmin} onClick={(e) => { e.stopPropagation(); if (globalPerms.isAdmin) return; if (hasAccess) { setSheetAccessGranted(prev => ({ ...prev, [reg.id]: false })); } else { setSheetAccessGranted(prev => ({ ...prev, [reg.id]: true })); } }} style={{ padding: '6px 14px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: globalPerms.isAdmin ? 'not-allowed' : 'pointer', background: hasAccess ? '#dcfce7' : 'var(--surface)', color: hasAccess ? '#16a34a' : 'var(--muted)', borderColor: hasAccess ? '#86efac' : 'var(--border)' }}>
                        {hasAccess ? <><Check size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Access Granted</> : 'Grant Access'}
                      </button>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', background: 'var(--surface)', padding: '4px 10px', borderRadius: '20px', border: '1px solid var(--border)' }}>{cols.length} Columns</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '20px' }}>
                      <div style={{ padding: '12px', background: 'rgba(0,45,93,0.02)', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FileText size={14} /> Sheet Columns ({cols.length})
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--navy)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                              <input 
                                type="checkbox" 
                                checked={columnViewRestrictions[reg.id] === undefined || (Array.isArray(columnViewRestrictions[reg.id]) && columnViewRestrictions[reg.id].length === cols.length)} 
                                onChange={(e) => {
                                  setColumnViewRestrictions(prev => {
                                    const next = { ...prev };
                                    if (e.target.checked) {
                                      delete next[reg.id]; // undefined means all
                                    } else {
                                      next[reg.id] = []; // empty array means none
                                    }
                                    return next;
                                  });
                                }}
                                style={{ width: '14px', height: '14px', accentColor: '#3B82F6', cursor: 'pointer' }}
                              />
                              Select All Visible
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--navy)', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal' }}>
                              <input 
                                type="checkbox" 
                                checked={editRestrictions[reg.id] === undefined || (Array.isArray(editRestrictions[reg.id]) && editRestrictions[reg.id].length === cols.length)} 
                                onChange={(e) => {
                                  setEditRestrictions(prev => {
                                    const next = { ...prev };
                                    if (e.target.checked) {
                                      delete next[reg.id]; // undefined means all
                                    } else {
                                      next[reg.id] = []; // empty array means none
                                    }
                                    return next;
                                  });
                                }}
                                style={{ width: '14px', height: '14px', accentColor: '#8B5CF6', cursor: 'pointer' }}
                              />
                              Select All Editable
                            </label>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {cols.map((col, idx) => (
                            <div key={col.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', background: 'white', padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--navy)', fontWeight: 500 }}>
                              <span style={{ color: 'var(--muted)', fontWeight: 600, width: '24px', flexShrink: 0 }}>{idx + 1}.</span> 
                              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '20px' }}>{col.name}</span>
                              
                              <div style={{ display: 'flex', gap: '0px', alignItems: 'center', flexShrink: 0 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: (columnViewRestrictions[reg.id] === undefined || (Array.isArray(columnViewRestrictions[reg.id]) && columnViewRestrictions[reg.id].includes(col.id))) ? '#3B82F6' : 'var(--muted)', cursor: 'pointer', userSelect: 'none', width: '80px', transition: 'color 0.2s' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={columnViewRestrictions[reg.id] === undefined || (Array.isArray(columnViewRestrictions[reg.id]) && columnViewRestrictions[reg.id].includes(col.id))} 
                                    onChange={(e) => {
                                      setColumnViewRestrictions(prev => {
                                        const next = { ...prev };
                                        const current = next[reg.id];
                                        if (e.target.checked) {
                                          if (current === undefined) return prev;
                                          if (Array.isArray(current)) {
                                            const newArr = [...current, col.id];
                                            if (newArr.length === cols.length) delete next[reg.id];
                                            else next[reg.id] = newArr;
                                          }
                                        } else {
                                          if (current === undefined) {
                                            next[reg.id] = cols.map(c => c.id).filter(id => id !== col.id);
                                          } else if (Array.isArray(current)) {
                                            next[reg.id] = current.filter(id => id !== col.id);
                                          }
                                        }
                                        return next;
                                      });
                                    }}
                                    style={{ width: '15px', height: '15px', accentColor: '#3B82F6', cursor: 'pointer' }}
                                  />
                                  Visible
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: (editRestrictions[reg.id] === undefined || (Array.isArray(editRestrictions[reg.id]) && editRestrictions[reg.id].includes(col.id))) ? '#8B5CF6' : 'var(--muted)', cursor: 'pointer', userSelect: 'none', width: '90px', transition: 'color 0.2s' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={editRestrictions[reg.id] === undefined || (Array.isArray(editRestrictions[reg.id]) && editRestrictions[reg.id].includes(col.id))} 
                                    onChange={(e) => {
                                      setEditRestrictions(prev => {
                                        const next = { ...prev };
                                        const current = next[reg.id];
                                        if (e.target.checked) {
                                          if (current === undefined) return prev;
                                          if (Array.isArray(current)) {
                                            const newArr = [...current, col.id];
                                            if (newArr.length === cols.length) delete next[reg.id];
                                            else next[reg.id] = newArr;
                                          }
                                        } else {
                                          if (current === undefined) {
                                            next[reg.id] = cols.map(c => c.id).filter(id => id !== col.id);
                                          } else if (Array.isArray(current)) {
                                            next[reg.id] = current.filter(id => id !== col.id);
                                          }
                                        }
                                        return next;
                                      });
                                    }}
                                    style={{ width: '15px', height: '15px', accentColor: '#8B5CF6', cursor: 'pointer' }}
                                  />
                                  Editable
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: (col as any).mandatory ? 'var(--primary)' : 'var(--muted)', cursor: 'pointer', userSelect: 'none', width: '100px', transition: 'color 0.2s' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={!!(col as any).mandatory} 
                                    onChange={async () => {
                                      const newVal = !(col as any).mandatory;
                                      try {
                                        await setColumnMandatory(reg.id, col.id, newVal);
                                        setRegisters(prev => prev.map(r => r.id === reg.id ? { ...r, columns: r.columns.map(c => c.id === col.id ? { ...c, mandatory: newVal } : c) } : r));
                                        addNotification({ title: 'Updated', message: `Column "${col.name}" is now ${newVal ? 'mandatory' : 'optional'}`, type: 'success' });
                                      } catch (err) {
                                        addNotification({ title: 'Error', message: 'Failed to update column', type: 'error' });
                                      }
                                    }}
                                    style={{ width: '15px', height: '15px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                                  />
                                  Mandatory
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: (col as any).unique ? '#0891b2' : 'var(--muted)', cursor: 'pointer', userSelect: 'none', width: '90px', transition: 'color 0.2s' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={!!(col as any).unique} 
                                    onChange={async () => {
                                      const newVal = !(col as any).unique;
                                      try {
                                        await setColumnUnique(reg.id, col.id, newVal);
                                        setRegisters(prev => prev.map(r => r.id === reg.id ? { ...r, columns: r.columns.map(c => c.id === col.id ? { ...c, unique: newVal } : c) } : r));
                                        addNotification({ title: 'Updated', message: `Column "${col.name}" is now ${newVal ? 'unique' : 'not unique'}`, type: 'success' });
                                      } catch (err) {
                                        addNotification({ title: 'Error', message: 'Failed to update column', type: 'error' });
                                      }
                                    }}
                                    style={{ width: '15px', height: '15px', accentColor: '#0891b2', cursor: 'pointer' }}
                                  />
                                  Unique
                                </label>

                                <div style={{ width: '80px', textAlign: 'right' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--surface)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}>{col.type}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            };

            const folderIds = Object.keys(folderMap).map(Number);
            const usedFolders = folders.filter(f => folderIds.includes(f.id));
            const isSearching = searchQuery.trim().length > 0;

            return (
              <>
                {/* Unassigned sheets at the top */}
                {unassigned.length > 0 && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Unassigned Sheets
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {unassigned.map(reg => renderSheet(reg))}
                    </div>
                  </div>
                )}

                {/* Folders below */}
                {usedFolders.map(folder => {
                  const sheetsInFolder = folderMap[folder.id] || [];
                  // Closed by default; auto-open when searching and folder has matching sheets
                  const isFolderOpen = isSearching ? true : (expandedFolders[folder.id] === true);
                  return (
                    <div key={`folder-${folder.id}`} style={{ marginBottom: '8px' }}>
                      <div
                        onClick={() => setExpandedFolders(prev => ({ ...prev, [folder.id]: !isFolderOpen }))}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', cursor: 'pointer', background: '#fef3c7', borderRadius: '10px', border: '1px solid #fcd34d', marginBottom: isFolderOpen ? '8px' : 0 }}
                      >
                        {isFolderOpen ? <ChevronDown size={18} color="#92400e" /> : <ChevronRight size={18} color="#92400e" />}
                        <FolderOpen size={20} color="#f59e0b" />
                        <span style={{ fontWeight: 700, fontSize: '15px', color: '#92400e', flex: 1 }}>{folder.name}</span>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <button 
                            disabled={globalPerms.isAdmin} 
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              if (globalPerms.isAdmin) return; 
                              const hasAccess = folderAccessGranted[folder.id] === true;
                              setFolderAccessGranted(prev => ({ ...prev, [folder.id]: !hasAccess }));
                            }} 
                            style={{ 
                              padding: '6px 14px', borderRadius: '6px', border: '1px solid', fontSize: '12px', fontWeight: 600, cursor: globalPerms.isAdmin ? 'not-allowed' : 'pointer', 
                              background: folderAccessGranted[folder.id] ? '#dcfce7' : 'var(--surface)', color: folderAccessGranted[folder.id] ? '#16a34a' : 'var(--muted)', borderColor: folderAccessGranted[folder.id] ? '#86efac' : 'var(--border)' 
                            }}
                          >
                            {folderAccessGranted[folder.id] ? <><Check size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Access Granted</> : 'Grant Access'}
                          </button>
                          <span style={{ fontSize: '12px', color: '#92400e', background: '#fde68a', padding: '3px 10px', borderRadius: '12px' }}>{sheetsInFolder.length} sheets</span>
                        </div>
                      </div>
                      {isFolderOpen && (
                        <div style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {sheetsInFolder.map(reg => renderSheet(reg))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}

          {registers.length === 0 && <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>No sheets found in the system.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginTop: '10px' }}>
            <div style={{ background: 'white', borderRadius: '12px', padding: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: 'var(--navy)' }}>Login History & Activity</h3>
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {(user.loginHistory || []).slice(0, 50).map((h: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-light)', fontSize: '13px' }}>
                    <span style={{ color: h.type === 'login' ? 'var(--brand-green)' : 'var(--destructive)', fontWeight: 500 }}>
                      {h.type === 'login' ? 'Login' : 'Logout'}
                    </span>
                    <span style={{ color: 'var(--muted)' }}>{new Date(h.timestamp).toLocaleString()}</span>
                  </div>
                ))}
                {(!user.loginHistory || user.loginHistory.length === 0) && <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>No login history yet</p>}
              </div>
            </div>
          </div>

        </div>

        {previewReg && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setPreviewReg(null)}>
            <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '1000px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--navy)' }}>Preview: {previewReg.name}</h2>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                     Showing the first 5 rows of this register.
                  </p>
                </div>
                <button onClick={() => setPreviewReg(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><X size={24} /></button>
              </div>
              <div style={{ padding: '0', overflow: 'auto', flex: 1, position: 'relative' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '13px', whiteSpace: 'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--navy)', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10, minWidth: '60px' }}>
                        Row #
                      </th>
                      {(() => {
                        const cols = [...previewReg.columns].sort((a, b) => a.position - b.position);
                        return cols.map(col => (
                          <th key={col.id} style={{ padding: '10px 16px', textAlign: 'left', background: 'var(--surface)', borderBottom: '1px solid var(--border)', color: 'var(--navy)', fontWeight: 600, position: 'sticky', top: 0, zIndex: 10, minWidth: '120px' }}>
                            {col.name}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                        const cols = [...previewReg.columns].sort((a, b) => a.position - b.position);
                        const entries = (previewReg.entries || []).slice(0, 5);
                        
                        if (entries.length === 0) {
                          return <tr><td colSpan={cols.length + 1} style={{ padding: '30px', textAlign: 'center', color: 'var(--muted)' }}>No data available for preview.</td></tr>;
                        }

                        return entries.map((row, i) => {
                          const actualRowIndex = i;
                          const isEditableInUserView = editRestrictions[previewReg.id] === undefined;
                          
                          return (
                            <tr key={i} style={{ background: i % 2 === 0 ? 'white' : 'var(--background)' }}>
                              <td style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', color: 'var(--muted)', fontWeight: 500 }}>
                                {actualRowIndex + 1}
                              </td>
                              {cols.map((col) => {
                                const isEditable = isEditableInUserView;
                                return (
                                  <td key={col.id} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-light)', color: isEditable ? 'var(--navy)' : 'var(--muted)' }}>
                                    {isEditable ? (
                                      <input 
                                        type="text" 
                                        value={row.cells?.[col.id.toString()] || ''} 
                                        readOnly 
                                        style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--accent)', background: 'white', fontSize: '13px', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}
                                        title="Editable by this user"
                                      />
                                    ) : (
                                      <span style={{ display: 'inline-block', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', opacity: 0.6 }}>{row.cells?.[col.id.toString()] || '-'}</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
