import { useState, useEffect, useCallback, useMemo, useRef, memo, lazy, Suspense } from 'react';
import toast from 'react-hot-toast';
import { useNavigate, Routes, Route, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses, createBusiness, listRegisters, deleteRegister,
  renameRegister, duplicateRegister, importExcelData,
  type RegisterSummary,
} from '../lib/api';
// XLSX parsing is now done in a Web Worker (public/xlsxWorker.js) to prevent UI freezes
import { importLocalFolderToCloud } from '../lib/localFs';
import { Pencil, Copy, Trash2, Eye, Scissors, Save, BarChart3, CheckCircle2 } from 'lucide-react';
import { DashboardContent } from '../components/home/DashboardContent';
import { Sidebar } from '../components/home/Sidebar';
import { NotificationPanel } from '../components/common/NotificationPanel';
import { useNotifications } from '../lib/NotificationContext';
import { useAuth } from '../lib/auth';
import { RequestModal } from '../components/register/modals/RequestModal';

// Lazy-load heavy page components — only downloaded when navigated to
const RegisterPage = lazy(() => import('./RegisterPage'));
const TemplatesPage = lazy(() => import('./TemplatesPage'));
const HistoryPage = lazy(() => import('./HistoryPage'));
const RecycleBinPage = lazy(() => import('./RecycleBinPage'));
const ProfilePage = lazy(() => import('./ProfilePage'));
const BackupPage = lazy(() => import('./BackupPage'));

const RegisterPageWrapper = memo(() => {
  const { id } = useParams();
  return <RegisterPage key={id} />;
});


export interface ImportSession {
  folderName: string;
  files: { name: string; status: 'waiting' | 'uploading' | 'success' | 'error' }[];
}

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<number | null>(null);
  const [renameModal, setRenameModal] = useState(false);
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [importSession, setImportSession] = useState<ImportSession | null>(null);
  const [clipboard, setClipboard] = useState<{ id: number, type: 'move' | 'copy' } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => localStorage.getItem('sidebar-collapsed') === 'true');
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const { unreadCount } = useNotifications();
  const [requestModal, setRequestModal] = useState<{ type: 'download' | 'delete_register'; isOpen: boolean; regId?: number; regName?: string }>({ type: 'delete_register', isOpen: false });

  const isSuperAdmin = user?.role === 'superadmin';
  const toggleCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar-collapsed', String(next));
      return next;
    });
  }, []);

  // ── Resizable sidebar ──
  const SIDEBAR_MIN = 200;
  const SIDEBAR_MAX = 480;
  const SIDEBAR_DEFAULT = 260;
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(parsed) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, parsed)) : SIDEBAR_DEFAULT;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = ev.clientX - dragStartX.current;
      const newWidth = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta));
      setSidebarWidth(newWidth);
    };
    const onMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Persist to localStorage
      setSidebarWidth((w) => { localStorage.setItem('sidebar-width', String(w)); return w; });
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  useEffect(() => {
    if (businesses && businesses.length === 0) {
      createBusiness('My Business').then(() => queryClient.invalidateQueries({ queryKey: ['businesses'] }));
    }
  }, [businesses, queryClient]);

  const { data: registers } = useQuery({
    queryKey: ['registers', businessId],
    queryFn: () => listRegisters(businessId!),
    enabled: !!businessId,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteRegister,
    onSuccess: (_, deletedId) => { 
      queryClient.setQueryData(['registers', businessId], (old: import('../lib/api').RegisterSummary[] | undefined) => {
        return (old || []).filter(r => r.id !== deletedId);
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); 
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] }); 
      setMenuId(null); 
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => renameRegister(id, name),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['registers', businessId] }); setRenameModal(false); },
  });

  const duplicateMutation = useMutation({
    mutationFn: duplicateRegister,
    onSuccess: (newReg) => {
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
      setMenuId(null);
      navigate(`/register/${newReg.id}`);
    },
  });

  const excelMutation = useMutation({
    mutationFn: ({ name, data, metadata }: { name: string; data: Record<string, string>[]; metadata?: any[] }) => 
      importExcelData(businessId!, name, data, undefined, metadata),
    onSuccess: (newReg) => {
      queryClient.setQueryData(['registers', businessId], (old: RegisterSummary[] | undefined) => {
        const safeOld = old || [];
        if (safeOld.find((r: RegisterSummary) => r.id === newReg.id)) return safeOld;
        return [...safeOld, { ...newReg, entryCount: newReg.entryCount || 0 }];
      });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
    onError: (err: Error) => alert(err.message),
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const toastId = toast.loading(
      <div className="toast-flex">
        <BarChart3 size={16} />
        <span>Parsing "{file.name.replace(/\.[^/.]+$/, '')}"…</span>
      </div>
    );

    const reader = new FileReader();
    reader.onload = (evt) => {
      const buffer = evt.target?.result as ArrayBuffer;
      if (!buffer) { toast.error('Failed to read file', { id: toastId }); return; }

      try {
        // Spin up the web worker to parse off the main thread
        const worker = new Worker('/xlsxWorker.js');
        worker.postMessage({ type: 'PARSE', payload: { buffer, fileName: file.name } }, [buffer]);

        worker.onmessage = (ev) => {
          const { type, payload } = ev.data;
          if (type === 'PROGRESS') {
            toast.loading(
              <div className="toast-flex">
                <BarChart3 size={16} />
                <span>{payload.message}</span>
              </div>,
              { id: toastId }
            );
          } else if (type === 'RESULT') {
            worker.terminate();
            const { rows, metadata } = payload as { headers: string[]; rows: Record<string, string>[]; fileName: string; metadata?: any[] };
            const name = file.name.replace(/\.[^/.]+$/, '');
            toast.loading(
              <div className="toast-flex">
                <Save size={16} />
                <span>Saving {rows.length} rows…</span>
              </div>,
              { id: toastId }
            );
            excelMutation.mutate({ name, data: rows, metadata }, {
              onSuccess: (newReg) => {
                toast.success(
                  <div className="toast-flex">
                    <CheckCircle2 size={16} />
                    <span>Imported {rows.length} rows</span>
                  </div>,
                  { id: toastId }
                );
                navigate(`/register/${newReg.id}`);
              },
              onError: (err: Error) => {
                toast.error(err.message || 'Import failed', { id: toastId });
              }
            });
          } else if (type === 'ERROR') {
            worker.terminate();
            toast.error(`Parse error: ${payload.message}`, { id: toastId });
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          toast.error(`Worker error: ${err.message}`, { id: toastId });
        };
      } catch {
        toast.error('Failed to start parser. Trying fallback…', { id: toastId });
        // Fallback: dynamic XLSX import (no worker)
        import('xlsx').then((XLSX) => {
          try {
            const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false });
            const ws = wb.Sheets[wb.SheetNames[0]];

            // Pre-process worksheet to extract original URLs from HYPERLINK formulas
            const refForPreprocess = ws['!ref'];
            if (refForPreprocess) {
              const range = XLSX.utils.decode_range(refForPreprocess);
              for (let R = range.s.r; R <= range.e.r; R++) {
                for (let C = range.s.c; C <= range.e.c; C++) {
                  const addr = XLSX.utils.encode_cell({ r: R, c: C });
                  const cell = ws[addr];
                  if (cell && cell.f && typeof cell.f === 'string') {
                    const trimmedFormula = cell.f.trim();
                    if (/^HYPERLINK\(/i.test(trimmedFormula)) {
                      const match = trimmedFormula.match(/^HYPERLINK\(\s*"([^"]+)"/i);
                      if (match && match[1]) {
                        let url = match[1];
                        url = url.replace(/""/g, '"');
                        if (url.includes('#urls=')) {
                          const hashPart = url.split('#urls=')[1];
                          try {
                            url = decodeURIComponent(hashPart);
                          } catch (e) {}
                        }
                        cell.v = url;
                        cell.w = url;
                      }
                    }
                  }
                }
              }
            }

            const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
            const metaWs = wb.Sheets[wb.SheetNames.find(n => n.toLowerCase() === '_metadata_') || ''];
            let metadata: any[] = metaWs ? XLSX.utils.sheet_to_json(metaWs) : [];

            // Native Data Validation extraction fallback
            try {
              const nativeValidations = ws['!dataValidation'];
              if (nativeValidations && nativeValidations.length > 0) {
                nativeValidations.forEach((dv: any) => {
                  if (dv.type === 'list' && dv.formula1) {
                    let options: string[] = [];
                    if (dv.formula1.startsWith('"') && dv.formula1.endsWith('"')) {
                      options = dv.formula1.slice(1, -1).split(',').map((s: string) => s.trim());
                    } else if (dv.formula1.includes(':') || /^[A-Z]+\d+$/.test(dv.formula1)) {
                      try {
                        const refRange = XLSX.utils.decode_range(dv.formula1.replace(/\$/g, ''));
                        for (let r = refRange.s.r; r <= refRange.e.r; r++) {
                          for (let c = refRange.s.c; c <= refRange.e.c; c++) {
                            const cell = ws[XLSX.utils.encode_cell({ r, c })];
                            if (cell && cell.v !== undefined) {
                              const val = String(cell.v).trim();
                              if (val) options.push(val);
                            }
                          }
                        }
                      } catch {}
                    }
                    if (options.length > 0) {
                      const sqrefs = dv.sqref.split(' ');
                      sqrefs.forEach((ref: string) => {
                        try {
                          const r = XLSX.utils.decode_range(ref);
                          for (let C = r.s.c; C <= r.e.c; C++) {
                            const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
                            const headerName = headerCell ? String(headerCell.v) : `Column ${C + 1}`;
                            let existing = metadata.find(m => m['Column Name'] === headerName);
                            if (!existing) { existing = { 'Column Name': headerName }; metadata.push(existing); }
                            if (!existing['Type']) { existing['Type'] = 'dropdown'; existing['Dropdown Options'] = options.join(','); }
                          }
                        } catch {}
                      });
                    }
                  }
                });
              }
            } catch {}

            excelMutation.mutate({ name: file.name.replace(/\.[^/.]+$/, ''), data: rows, metadata }, {
              onSuccess: (newReg) => { toast.success('Imported!', { id: toastId }); navigate(`/register/${newReg.id}`); },
              onError: (err: Error) => toast.error(err.message, { id: toastId })
            });
          } catch {
            toast.error('Failed to parse Excel file.', { id: toastId });
          }
        });
      }
    };
    reader.readAsArrayBuffer(file);
  }, [excelMutation, navigate]);

  const handleFolderUpload = useCallback(async () => {
    if (!businessId) return;
    try {
      const result = await importLocalFolderToCloud();
      if (!result || result.files.length === 0) return;
      
      const { folderName, files } = result;
      setImportSession({
        folderName,
        files: files.map(f => ({ name: f.name, status: 'waiting' }))
      });
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setImportSession(prev => prev ? {
          ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f)
        } : null);

        try {
          await excelMutation.mutateAsync({ name: file.name, data: file.data, metadata: file.metadata });
          setImportSession(prev => prev ? {
            ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'success' } : f)
          } : null);
        } catch (e) {
          console.error(`Failed to import ${file.name}`, e);
          setImportSession(prev => prev ? {
            ...prev, files: prev.files.map((f, idx) => idx === i ? { ...f, status: 'error' } : f)
          } : null);
        }
      }
      
    } catch (e) {
      console.error(e);
      alert('An error occurred during import.');
    }
  }, [businessId, excelMutation]);

  const filtered = useMemo(() => {
    return registers?.filter((r) => {
      if (!r.name.toLowerCase().includes(search.toLowerCase())) return false;
      // fullSheetAccess, sheet_admin, admin, superadmin can see all sheets
      if (user && ((user as any).permissions?.fullSheetAccess || (user as any).permissions?.isAdmin || (user as any).role === 'superadmin' || (user as any).role === 'admin' || (user as any).role === 'sheet_admin')) {
        return true;
      }
      if (user) {
        const allowedRegs = (user as any).permissions?.allowedRegisters;
        const allowedFolders = (user as any).permissions?.allowedFolders;
        
        // Check folder access first (if register belongs to a folder)
        if (r.folderId) {
          const folderIdStr = r.folderId.toString();
          if (!Array.isArray(allowedFolders) || !allowedFolders.map(String).includes(folderIdStr)) {
            return false;
          }
        }

        // ONLY show if register is explicitly in the approved list
        if (Array.isArray(allowedRegs) && allowedRegs.map(String).includes(r.id.toString())) {
          return true;
        }

        return false;
      }
      return true;
    });
  }, [registers, search, user]);

  return (
    <div className="app-layout">
      <Sidebar
        importSession={importSession}
        onClearImport={() => setImportSession(null)}
        businesses={businesses}
        filtered={filtered}
        search={search}
        setSearch={setSearch}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        menuId={menuId}
        setMenuId={setMenuId}
        onInputFolder={handleFolderUpload}
        onInputExcel={handleFileUpload}
        clipboard={clipboard}
        setClipboard={setClipboard}
        sidebarWidth={sidebarWidth}
        isCollapsed={isSidebarCollapsed}
        toggleCollapse={toggleCollapse}
        unreadCount={unreadCount}
        onToggleNotifications={() => setIsNotificationsOpen(!isNotificationsOpen)}
      />

      <NotificationPanel 
        isOpen={isNotificationsOpen} 
        onClose={() => setIsNotificationsOpen(false)} 
      />

      {/* ── Draggable resize handle ── */}
      {!isSidebarCollapsed && (
        <div
          className="sidebar-resize-handle"
          onMouseDown={onResizeStart}
          onDoubleClick={() => { setSidebarWidth(SIDEBAR_DEFAULT); localStorage.setItem('sidebar-width', String(SIDEBAR_DEFAULT)); }}
          title="Drag to resize sidebar · Double-click to reset"
        />
      )}

      <Suspense fallback={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--muted-light)', fontSize: 14 }}>
          <div style={{ textAlign: 'center' }}>
            <div className="loading-spinner" style={{ width: 32, height: 32, margin: '0 auto 12px', border: '3px solid var(--border)', borderTopColor: 'var(--navy)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
            Loading…
          </div>
        </div>
      }>
        <Routes>
          <Route index element={
            <DashboardContent
              filtered={filtered}
              excelMutation={excelMutation}
              handleFileUpload={handleFileUpload}
              onInputFolder={handleFolderUpload}
            />
          } />
          <Route path="register/:id" element={<RegisterPageWrapper />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="templates/:categoryId" element={<TemplatesPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="recycle-bin" element={<RecycleBinPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="backup" element={<BackupPage />} />
        </Routes>
      </Suspense>

      {/* ── Register Context Menu ── */}
      {menuId !== null && (
        <div className="modal-overlay" onClick={() => setMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">{filtered?.find((r) => r.id === menuId)?.name || 'Register'}</div>
            <button className="context-item" onClick={() => { navigate(`/register/${menuId}`); setMenuId(null); }}>
              <Eye size={16} />Open Register
            </button>
            <button className="context-item" onClick={() => {
              const reg = filtered?.find((r) => r.id === menuId);
              setRenameId(menuId); setRenameValue(reg?.name || ''); setMenuId(null); setRenameModal(true);
            }}>
              <Pencil size={16} />Rename
            </button>
            <button className="context-item" onClick={() => duplicateMutation.mutate(menuId)}>
              <Copy size={16} />Duplicate
            </button>
            <button className="context-item" onClick={() => { setClipboard({ id: menuId, type: 'copy' }); setMenuId(null); }}>
              <Copy size={16} />Copy
            </button>
            <button className="context-item" onClick={() => { setClipboard({ id: menuId, type: 'move' }); setMenuId(null); }}>
              <Scissors size={16} />Move
            </button>
            <button className="context-item danger" onClick={() => {
              const reg = filtered?.find((r) => r.id === menuId);
              if (isSuperAdmin) {
                if (confirm(`Delete this register "${reg?.name}"?`)) deleteMutation.mutate(menuId);
              } else {
                setRequestModal({ type: 'delete_register', isOpen: true, regId: menuId, regName: reg?.name });
              }
              setMenuId(null);
            }}>
              <Trash2 size={16} />
              {isSuperAdmin ? 'Delete' : 'Request Deletion'}
            </button>
          </div>
        </div>
      )}

      {/* ── Register Rename Modal ── */}
      {renameModal && (
        <div className="modal-overlay" onClick={() => setRenameModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Register</h3>
            <input
              className="modal-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Register name"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && renameId && renameValue.trim() && renameMutation.mutate({ id: renameId, name: renameValue.trim() })}
            />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setRenameModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!renameValue.trim()} onClick={() => renameId && renameMutation.mutate({ id: renameId, name: renameValue.trim() })}>
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Request Modal */}
      <RequestModal 
        isOpen={requestModal.isOpen}
        onClose={() => setRequestModal(prev => ({ ...prev, isOpen: false }))}
        type={requestModal.type}
        registerName={requestModal.regName || 'Unknown Register'}
        registerId={requestModal.regId}
      />
    </div>
  );
}
