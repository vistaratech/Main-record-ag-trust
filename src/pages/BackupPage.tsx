import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  listBusinesses, listBackups, createBackup, restoreBackup, deleteBackup,
  listFolders, listRegisters, getRegister,
  type BackupMeta,
} from '../lib/api';
import JSZip from 'jszip';

import {
  ArrowLeft, CloudUpload, RotateCcw, Trash2, CheckCircle, AlertCircle,
  Database, FolderOpen, FileText, Clock, Lock, RefreshCw, Calendar, Check, Download,
} from 'lucide-react';

type Tab = 'backup' | 'restore';

const NAV = 'var(--navy)';
const NAV_DARK = 'var(--navy-dark)';
const ACCENT = 'var(--accent)'; // Blue
const PRIMARY = 'var(--primary)'; // Red
const SUCCESS = 'var(--secondary)'; // Green

export default function BackupPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('backup');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['backups', businessId],
    queryFn: () => listBackups(businessId!),
    enabled: !!businessId,
    staleTime: 0,
  });

  const lastBackup = backups[0] as BackupMeta | undefined;
  const daysSinceBackup = lastBackup
    ? Math.floor((Date.now() - new Date(lastBackup.createdAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const backupDue = daysSinceBackup === null || daysSinceBackup >= 3;

  const createMutation = useMutation({
    mutationFn: () => createBackup(businessId!),
    onSuccess: (meta) => {
      queryClient.invalidateQueries({ queryKey: ['backups', businessId] });
      showToast('success', `Backup "${meta.label}" created successfully!`);
    },
    onError: (e: Error) => showToast('error', e.message),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: string) => restoreBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      queryClient.invalidateQueries({ queryKey: ['folders', businessId] });
      setRestoringId(null);
      showToast('success', 'Data restored successfully! Refreshing…');
      setTimeout(() => navigate('/'), 2000);
    },
    onError: (e: Error) => { setRestoringId(null); showToast('error', e.message); },
  });

  const downloadAllMutation = useMutation({
    mutationFn: async () => {
      const zip = new JSZip();
      
      const [folders, registers] = await Promise.all([
        listFolders(businessId!),
        listRegisters(businessId!)
      ]);

      const { evaluateFormula } = await import('../lib/api');
      const XLSX = await import('xlsx');

      const folderMap = new Map<number, string>();
      folders.forEach(f => folderMap.set(f.id, f.name));

      const fullRegisters = await Promise.all(
        registers.map(async (r) => {
          try {
            return await getRegister(r.id);
          } catch (err) {
            console.error(`Failed to fetch register ${r.id}:`, err);
            return null;
          }
        })
      );

      for (const reg of fullRegisters) {
        if (!reg) continue;
        
        const cols = (reg.columns || []).sort((a, b) => a.position - b.position);
        const visibleCols = cols.filter(c => c.type !== 'image');
        const headerRow = ['S.No.', ...visibleCols.map(c => c.name)];
        const dataAOA: any[][] = [headerRow];

        (reg.entries || []).forEach((entry, idx) => {
          const rowData: any[] = [idx + 1];
          visibleCols.forEach(c => {
            const val = c.type === 'formula' 
              ? evaluateFormula(c.formula || '', entry, cols)
              : (entry.cells?.[c.id.toString()] || '');
            
            // Clean numeric values for Excel
            if (c.type === 'number' || c.type === 'currency' || c.type === 'formula') {
                const cleaned = val.toString().replace(/[^\d.-]/g, '');
                const n = parseFloat(cleaned);
                rowData.push(isNaN(n) ? val : n);
            } else {
                rowData.push(val);
            }
          });
          dataAOA.push(rowData);
        });

        const ws = XLSX.utils.aoa_to_sheet(dataAOA);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Records");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        const folderName = reg.folderId ? folderMap.get(reg.folderId) || 'Unorganized' : 'Unorganized';
        // Sanitize filename
        const safeRegName = reg.name.replace(/[\\/:*?"<>|]/g, '_');
        zip.file(`${folderName}/${safeRegName}.xlsx`, excelBuffer);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const now = new Date();
      const timestamp = `${now.getDate().toString().padStart(2, '0')}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;
      const filename = `AG Trust [${timestamp}].zip`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    },
    onSuccess: () => showToast('success', 'Full backup downloaded successfully!'),
    onError: (err: any) => showToast('error', `Download failed: ${err.message}`),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBackup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups', businessId] });
      setDeletingId(null);
      showToast('success', 'Backup deleted.');
    },
    onError: (e: Error) => { setDeletingId(null); showToast('error', e.message); },
  });

  return (
    <div style={{ flex: 1, background: '#F5F5F0', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
          background: toast.type === 'success' ? NAV : '#ef4444',
          color: 'white', padding: '12px 20px', borderRadius: '10px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px',
          fontSize: '14px', fontWeight: 500, maxWidth: '380px',
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Restore confirm dialog */}
      {restoringId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: '16px', padding: '32px', maxWidth: '380px', width: '90%', textAlign: 'center' }}>
            <AlertCircle size={48} color={PRIMARY} style={{ marginBottom: '16px' }} />
            <h2 style={{ margin: '0 0 12px', fontSize: '20px', fontWeight: 700, color: NAV }}>Restore this backup?</h2>
            <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px' }}>
              This will <strong>replace all your current data</strong> (registers, folders, and entries) with the backup. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setRestoringId(null)} style={{ padding: '10px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
              <button
                onClick={() => restoreMutation.mutate(restoringId)}
                disabled={restoreMutation.isPending}
                style={{ padding: '10px 24px', borderRadius: '8px', border: 'none', background: NAV, color: 'white', cursor: 'pointer', fontWeight: 600, opacity: restoreMutation.isPending ? 0.7 : 1 }}
              >
                {restoreMutation.isPending ? 'Restoring…' : 'Yes, Restore'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: NAV, padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px', color: 'white' }}>
        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
          <ArrowLeft size={22} />
        </button>
        <img src="/logo-transparent.png" alt="AG Trust" style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', padding: '3px' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Backup &amp; Restore</h1>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.7 }}>AG Trust · Record Book</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: NAV_DARK, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['backup', 'restore'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '14px', background: 'transparent', border: 'none',
              color: tab === t ? 'white' : 'rgba(255,255,255,0.5)',
              borderBottom: tab === t ? `3px solid ${ACCENT}` : '3px solid transparent',
              cursor: 'pointer', fontSize: '14px', fontWeight: 600,
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}
          >
            {t === 'backup' ? (
              <><Lock size={14} /> Back Up</>
            ) : (
              <><RefreshCw size={14} /> Restore</>
            )}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', maxWidth: '640px', margin: '0 auto', width: '100%' }}>

        {/* ── BACKUP TAB ── */}
        {tab === 'backup' && (
          <>
            {/* Status card */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '24px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(45,54,72,0.08)', border: '1px solid #E0E0DA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
                <div style={{ width: '56px', height: '56px', background: backupDue ? '#FDEEEB' : '#EEF2FF', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Database size={26} color={backupDue ? PRIMARY : NAV} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: NAV }}>
                    {lastBackup ? lastBackup.label : 'No backup yet'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#7A8195', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {lastBackup
                      ? daysSinceBackup === 0 ? <><Check size={14} color={SUCCESS} /> Backed up today</>
                      : `${daysSinceBackup} day${daysSinceBackup !== 1 ? 's' : ''} ago`
                      : 'Create your first backup now'}
                  </div>
                </div>
                {backupDue && (
                  <div style={{ background: 'rgba(229, 57, 53, 0.1)', color: PRIMARY, padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, flexShrink: 0, border: `1px solid ${PRIMARY}30` }}>
                    Due!
                  </div>
                )}
              </div>

              {lastBackup && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                  {[
                    { icon: <FileText size={16} color={NAV} />, label: 'Registers', value: lastBackup.registerCount, bg: '#E3F2FD' },
                    { icon: <FolderOpen size={16} color="#f59e0b" />, label: 'Folders', value: lastBackup.folderCount, bg: '#fffbeb' },
                    { icon: <Database size={16} color={NAV} />, label: 'Entries', value: lastBackup.totalEntries, bg: '#F5F7FA' },
                  ].map(item => (
                    <div key={item.label} style={{ background: item.bg, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>{item.icon}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color: NAV }}>{item.value}</div>
                      <div style={{ fontSize: '11px', color: '#4B5E7E' }}>{item.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  style={{
                    flex: 1, padding: '14px',
                    background: `linear-gradient(135deg, var(--navy), var(--navy-light))`,
                    color: 'white', border: 'none', borderRadius: '12px',
                    fontSize: '15px', fontWeight: 600, cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    opacity: createMutation.isPending ? 0.7 : 1, transition: 'opacity 0.2s',
                    boxShadow: '0 4px 12px rgba(13,42,92,0.15)',
                  }}
                >
                  <CloudUpload size={20} />
                  {createMutation.isPending ? 'Creating…' : 'Back Up Now'}
                </button>

                <button
                  onClick={() => downloadAllMutation.mutate()}
                  disabled={downloadAllMutation.isPending}
                  style={{
                    flex: 1, padding: '14px',
                    background: `#fff`,
                    color: 'var(--navy)', border: '1.5px solid var(--navy)', borderRadius: '12px',
                    fontSize: '15px', fontWeight: 600, cursor: downloadAllMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                    opacity: downloadAllMutation.isPending ? 0.7 : 1, transition: 'all 0.2s',
                  }}
                >
                  {downloadAllMutation.isPending ? (
                    <><RefreshCw size={20} className="animate-spin" /> Preparing ZIP...</>
                  ) : (
                    <><Download size={20} /> Download All (ZIP)</>
                  )}
                </button>
              </div>

              <p style={{ textAlign: 'center', fontSize: '12px', color: '#7E8DA6', marginTop: '12px', marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Calendar size={13} /> Reminder every 3 days if no backup is created
              </p>

            </div>

            {/* Backup history */}
            {backups.length > 0 && (
              <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700, color: NAV }}>Backup History</h3>
                {backups.map((b: BackupMeta, i: number) => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: i < backups.length - 1 ? '1px solid #EEF2F6' : 'none' }}>
                    <div style={{ width: '40px', height: '40px', background: '#E3F2FD', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <CheckCircle size={20} color={NAV} />
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: NAV, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
                      <div style={{ fontSize: '12px', color: '#A0A7B5', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                        <Clock size={11} />
                        {new Date(b.createdAt).toLocaleString('en-IN')} · {b.sizeKb} KB
                      </div>
                    </div>
                    <button
                      onClick={() => { if (confirm(`Delete backup "${b.label}"?`)) { setDeletingId(b.id); deleteMutation.mutate(b.id); } }}
                      disabled={deletingId === b.id}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px' }}
                      title="Delete backup"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── RESTORE TAB ── */}
        {tab === 'restore' && (
          <div style={{ background: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(45,54,72,0.08)', border: '1px solid #E0E0DA' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '16px', background: 'rgba(229, 57, 53, 0.05)', borderRadius: '12px', marginBottom: '20px', border: `1px solid var(--primary)` }}>
              <AlertCircle size={20} color={PRIMARY} style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ margin: 0, fontSize: '13px', color: '#92400e', lineHeight: 1.6 }}>
                Restoring will <strong>replace all current data</strong> with the selected backup. Make a backup first before restoring.
              </p>
            </div>

            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#A0A7B5' }}>Loading backups…</div>
            ) : backups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <Database size={48} color="#C8C8C0" style={{ marginBottom: '16px' }} />
                <p style={{ color: '#A0A7B5', fontSize: '15px', margin: '0 0 8px' }}>No backups available</p>
                <p style={{ color: '#C8C8C0', fontSize: '13px', margin: 0 }}>Go to the Back Up tab to create your first backup.</p>
              </div>
            ) : (
              backups.map((b: BackupMeta, i: number) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 0', borderBottom: i < backups.length - 1 ? '1px solid #F0F0EB' : 'none' }}>
                  <div style={{ width: '44px', height: '44px', background: '#EEF2FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Database size={20} color={NAV} />
                  </div>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: NAV, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
                    <div style={{ fontSize: '12px', color: '#A0A7B5', marginTop: '2px' }}>
                      {new Date(b.createdAt).toLocaleString('en-IN')} · {b.registerCount} registers · {b.totalEntries} entries
                    </div>
                  </div>
                  <button
                    onClick={() => setRestoringId(b.id)}
                    style={{
                      padding: '8px 16px', background: NAV, color: 'white',
                      border: 'none', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px',
                      flexShrink: 0, boxShadow: '0 2px 6px rgba(45,54,72,0.2)',
                    }}
                  >
                    <RotateCcw size={14} /> Restore
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
