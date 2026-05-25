import { useState, useEffect, useMemo } from 'react';

import { firebaseGetActivity, firebaseGetUsers } from '../../lib/firebaseAuth';
import { Activity, User, LogIn, LogOut, Shield, Trash2, Edit3, Download, Key, RefreshCw, Filter, X, Calendar, ChevronDown } from 'lucide-react';

const ICONS: Record<string, any> = {
  login: <LogIn size={14} color="#10b981"/>, logout: <LogOut size={14} color="#f59e0b"/>,
  admin_login: <Shield size={14} color="#ef4444"/>, register: <User size={14} color="#3b82f6"/>,
  create_user: <User size={14} color="#10b981"/>, delete_user: <Trash2 size={14} color="#ef4444"/>,
  update_user: <Edit3 size={14} color="#8b5cf6"/>, update_permissions: <Shield size={14} color="#f59e0b"/>,
  change_status: <User size={14} color="#f59e0b"/>, change_password: <Key size={14} color="#8b5cf6"/>,
  admin_change_password: <Key size={14} color="#ef4444"/>,
  download_request: <Download size={14} color="#3b82f6"/>,
  respond_download_request: <Download size={14} color="#10b981"/>,
  // Workspace actions
  edit_cells: <Edit3 size={14} color="#6366f1"/>,
  add_row: <Edit3 size={14} color="#10b981"/>,
  delete_row: <Trash2 size={14} color="#ef4444"/>,
  bulk_delete_rows: <Trash2 size={14} color="#ef4444"/>,
  add_column: <Edit3 size={14} color="#3b82f6"/>,
  delete_column: <Trash2 size={14} color="#f59e0b"/>,
  download_data: <Download size={14} color="#10b981"/>,
};

const ACTION_LABELS: Record<string, string> = {
  login: 'Login',
  logout: 'Logout',
  admin_login: 'Admin Login',
  register: 'Register',
  create_user: 'Create User',
  delete_user: 'Delete User',
  update_user: 'Update User',
  update_permissions: 'Update Permissions',
  change_status: 'Change Status',
  change_password: 'Change Password',
  admin_change_password: 'Admin Change Password',
  download_request: 'Download Request',
  respond_download_request: 'Respond Download Request',
  // Workspace actions
  edit_cells: 'Edit Cells',
  add_row: 'Add Row',
  delete_row: 'Delete Row',
  bulk_delete_rows: 'Bulk Delete Rows',
  add_column: 'Add Column',
  delete_column: 'Delete Column',
  download_data: 'Download Data',
};

export default function AdminActivityPage() {

  const [activities, setActivities] = useState<any[]>([]);
  const [users, setUsers] = useState<{id:string;name:string;email:string}[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterUser, setFilterUser] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [filterSingleDate, setFilterSingleDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const fetch_ = async () => {
    setLoading(true);
    try {
      const [actData, userData] = await Promise.all([
        firebaseGetActivity(500),
        firebaseGetUsers()
      ]);
      setActivities(actData.activities || []);
      setUsers((userData.users || []).map((u: any) => ({ id: u.id, name: u.name, email: u.email })));
    }
    catch { } finally { setLoading(false); }
  };
  useEffect(() => { fetch_(); }, []);

  // Unique action types from data
  const actionTypes = useMemo(() => {
    const types = new Set<string>();
    activities.forEach(a => types.add(a.action));
    return Array.from(types).sort();
  }, [activities]);

  // Unique users from data
  const activityUsers = useMemo(() => {
    const map = new Map<string, string>();
    activities.forEach(a => {
      if (a.userId && a.userName && !map.has(a.userId)) {
        map.set(a.userId, a.userName);
      }
    });
    // Also add known users
    users.forEach(u => {
      if (!map.has(u.id)) map.set(u.id, u.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [activities, users]);

  // Filtered activities
  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (filterUser !== 'all' && a.userId !== filterUser) return false;
      if (filterAction !== 'all' && a.action !== filterAction) return false;
      // Single date filter — match the exact day
      if (filterSingleDate) {
        const actDay = new Date(a.timestamp).toISOString().split('T')[0];
        if (actDay !== filterSingleDate) return false;
      }
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        from.setHours(0,0,0,0);
        if (new Date(a.timestamp) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23,59,59,999);
        if (new Date(a.timestamp) > to) return false;
      }
      return true;
    });
  }, [activities, filterUser, filterAction, filterDateFrom, filterDateTo, filterSingleDate]);

  const activeFilterCount = [filterUser !== 'all', filterAction !== 'all', !!filterSingleDate, !!filterDateFrom, !!filterDateTo].filter(Boolean).length;

  const clearFilters = () => {
    setFilterUser('all');
    setFilterAction('all');
    setFilterSingleDate('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
        <h2 style={{margin:0,fontSize:'18px',fontWeight:700,color:'var(--foreground)',display:'flex',alignItems:'center',gap:'10px'}}><Activity size={20} color="var(--navy)"/> Activity Log</h2>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          <button onClick={() => setShowFilters(!showFilters)} style={{
            background: showFilters || activeFilterCount > 0 ? 'var(--navy)' : 'var(--surface)',
            border:'1px solid var(--border)',
            color: showFilters || activeFilterCount > 0 ? 'white' : 'var(--navy)',
            cursor:'pointer',padding:'10px 16px',borderRadius:'8px',display:'flex',alignItems:'center',gap:'6px',
            boxShadow:'var(--shadow-sm)',fontSize:'13px',fontWeight:600,transition:'all 0.2s'
          }}>
            <Filter size={14}/>
            Filters
            {activeFilterCount > 0 && (
              <span style={{background:'var(--accent)',color:'white',borderRadius:'50%',width:'18px',height:'18px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700}}>{activeFilterCount}</span>
            )}
          </button>
          <button onClick={fetch_} style={{background:'var(--surface)',border:'1px solid var(--border)',color:'var(--navy)',cursor:'pointer',padding:'10px',borderRadius:'8px',display:'flex',boxShadow:'var(--shadow-sm)'}}><RefreshCw size={16}/></button>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
        {[
          { label: 'All', value: 'all', color: 'var(--navy)', bg: 'var(--border-light)' },
          { label: '🔑 Login/Logout', value: 'login', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: '✏️ Edits', value: 'edit_cells', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
          { label: '➕ New Entries', value: 'add_row', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: '🗑 Deletes', value: 'delete_row', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
          { label: '⬇ Downloads', value: 'download_data', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { label: '👤 User Changes', value: '_user_changes_', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: '🛡 Permissions', value: 'update_permissions', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' },
        ].map(chip => {
          const isActive = chip.value === 'all' ? filterAction === 'all' : filterAction === chip.value;
          return (
            <button
              key={chip.value}
              onClick={() => {
                if (chip.value === 'all') {
                  setFilterAction('all');
                } else if (chip.value === '_user_changes_') {
                  // Group filter: cycle through user-related actions
                  const userActions = ['create_user', 'delete_user', 'update_user', 'change_status'];
                  const currentIdx = userActions.indexOf(filterAction);
                  setFilterAction(userActions[(currentIdx + 1) % userActions.length]);
                } else {
                  setFilterAction(filterAction === chip.value ? 'all' : chip.value);
                }
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                border: isActive ? `1.5px solid ${chip.color}` : '1px solid var(--border)',
                background: isActive ? chip.bg : 'var(--surface)',
                color: isActive ? chip.color : 'var(--muted)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                transition: 'all 0.2s',
                boxShadow: isActive ? `0 2px 8px ${chip.bg}` : 'none',
              }}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{
          background:'var(--surface)',borderRadius:'12px',border:'1px solid var(--border)',
          padding:'16px 20px',marginBottom:'16px',boxShadow:'var(--shadow-md)',
          display:'flex',flexWrap:'wrap',gap:'16px',alignItems:'flex-end',
          animation:'fadeIn 0.2s ease'
        }}>
          {/* User Filter */}
          <div style={{flex:'1 1 180px',minWidth:'160px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px',display:'block'}}>
              <User size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> User
            </label>
            <div style={{position:'relative'}}>
              <select
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                style={{
                  width:'100%',padding:'10px 32px 10px 12px',borderRadius:'8px',
                  border:'1.5px solid var(--border)',background:'var(--background)',
                  color:'var(--foreground)',fontSize:'13px',fontWeight:500,
                  appearance:'none',cursor:'pointer',outline:'none'
                }}
              >
                <option value="all">All Users</option>
                {activityUsers.map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--muted)'}}/>
            </div>
          </div>

          {/* Action Filter */}
          <div style={{flex:'1 1 180px',minWidth:'160px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px',display:'block'}}>
              <Activity size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> Action Type
            </label>
            <div style={{position:'relative'}}>
              <select
                value={filterAction}
                onChange={e => setFilterAction(e.target.value)}
                style={{
                  width:'100%',padding:'10px 32px 10px 12px',borderRadius:'8px',
                  border:'1.5px solid var(--border)',background:'var(--background)',
                  color:'var(--foreground)',fontSize:'13px',fontWeight:500,
                  appearance:'none',cursor:'pointer',outline:'none'
                }}
              >
                <option value="all">All Actions</option>
                {actionTypes.map(t => (
                  <option key={t} value={t}>{ACTION_LABELS[t] || t.replace(/_/g,' ')}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:'var(--muted)'}}/>
            </div>
          </div>

          {/* Single Date */}
          <div style={{flex:'1 1 150px',minWidth:'140px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px',display:'block'}}>
              <Calendar size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> Specific Date
            </label>
            <input
              type="date"
              value={filterSingleDate}
              onChange={e => { setFilterSingleDate(e.target.value); if (e.target.value) { setFilterDateFrom(''); setFilterDateTo(''); } }}
              style={{
                width:'100%',padding:'9px 12px',borderRadius:'8px',
                border: filterSingleDate ? '1.5px solid var(--navy)' : '1.5px solid var(--border)',
                background: filterSingleDate ? 'rgba(30,41,82,0.04)' : 'var(--background)',
                color:'var(--foreground)',fontSize:'13px',fontWeight:500,outline:'none',
                boxSizing:'border-box'
              }}
            />
          </div>

          {/* Date From */}
          <div style={{flex:'1 1 150px',minWidth:'140px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px',display:'block'}}>
              <Calendar size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> From Date
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={e => { setFilterDateFrom(e.target.value); if (e.target.value) setFilterSingleDate(''); }}
              style={{
                width:'100%',padding:'9px 12px',borderRadius:'8px',
                border:'1.5px solid var(--border)',background:'var(--background)',
                color:'var(--foreground)',fontSize:'13px',fontWeight:500,outline:'none',
                boxSizing:'border-box'
              }}
            />
          </div>

          {/* Date To */}
          <div style={{flex:'1 1 150px',minWidth:'140px'}}>
            <label style={{fontSize:'11px',fontWeight:700,color:'var(--muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:'6px',display:'block'}}>
              <Calendar size={12} style={{marginRight:'4px',verticalAlign:'middle'}}/> To Date
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={e => { setFilterDateTo(e.target.value); if (e.target.value) setFilterSingleDate(''); }}
              style={{
                width:'100%',padding:'9px 12px',borderRadius:'8px',
                border:'1.5px solid var(--border)',background:'var(--background)',
                color:'var(--foreground)',fontSize:'13px',fontWeight:500,outline:'none',
                boxSizing:'border-box'
              }}
            />
          </div>

          {/* Clear */}
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{
              padding:'10px 16px',borderRadius:'8px',border:'1px solid var(--border)',
              background:'var(--destructive-bg)',color:'var(--destructive)',cursor:'pointer',
              fontSize:'12px',fontWeight:700,display:'flex',alignItems:'center',gap:'6px',
              height:'40px',alignSelf:'flex-end'
            }}>
              <X size={14}/> Clear
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
        <div style={{fontSize:'13px',color:'var(--muted)',fontWeight:500}}>
          Showing <strong style={{color:'var(--foreground)'}}>{filtered.length}</strong> of {activities.length} entries
          {activeFilterCount > 0 && <span style={{color:'var(--accent)',marginLeft:'6px'}}>({activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} active)</span>}
        </div>
      </div>

      <div style={{background:'var(--surface)',borderRadius:'12px',border:'1px solid var(--border)',overflow:'hidden',boxShadow:'var(--shadow-md)'}}>
        {loading ? <div style={{padding:'50px',textAlign:'center',color:'var(--muted)'}}>Loading...</div> : (
          <div style={{maxHeight:'calc(100vh - 260px)',overflowY:'auto'}}>
            {filtered.map(a => (
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:'14px',padding:'14px 18px',borderBottom:'1px solid var(--border-light)'}}>
                <div style={{width:'36px',height:'36px',borderRadius:'10px',background:'var(--background)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {ICONS[a.action] || <Activity size={16} color="var(--muted)"/>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',color:'var(--foreground)',fontWeight:600}}>{a.details}</div>
                  <div style={{fontSize:'12px',color:'var(--muted)',marginTop:'4px',display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}}>
                    <span style={{
                      background:'var(--border-light)',padding:'2px 8px',borderRadius:'4px',fontWeight:600,
                      color:'var(--navy)',fontSize:'11px'
                    }}>
                      {a.userName}
                    </span>
                    <span>•</span>
                    <span style={{
                      background:'rgba(99,102,241,0.08)',padding:'2px 8px',borderRadius:'4px',fontWeight:500,
                      color:'var(--primary)',fontSize:'11px'
                    }}>
                      {ACTION_LABELS[a.action] || a.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                <div style={{fontSize:'12px',color:'var(--muted)',whiteSpace:'nowrap',flexShrink:0,fontWeight:500,textAlign:'right'}}>
                  <div>{new Date(a.timestamp).toLocaleDateString()}</div>
                  <div style={{fontSize:'11px',opacity:0.8}}>{new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            ))}
            {filtered.length===0 && <div style={{padding:'40px',textAlign:'center',color:'var(--muted)'}}>
              {activeFilterCount > 0 ? 'No activity matches your filters' : 'No activity yet'}
            </div>}
          </div>
        )}
      </div>
    </div>
  );
}
