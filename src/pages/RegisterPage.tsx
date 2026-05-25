import { useState, useRef, useCallback, useEffect, useMemo, useDeferredValue, useLayoutEffect } from 'react';
import toast from 'react-hot-toast';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getRegister, listRegisters, addColumn, deleteColumn, renameColumn, updateColumnDropdownOptions,
  duplicateColumn, moveColumn, reorderColumn, changeColumnType, clearColumnData, insertColumn, updateColumnWidth, updateColumnSummary,
  freezeColumn, hideColumn, setColumnMandatory, setColumnUnique,
  addEntry, updateEntry, updateEntryDirect, deleteEntry, duplicateEntry, bulkDeleteEntries, insertEntry,
  listRowHistory,
  restoreEntry, bulkRestoreEntries, restoreColumn,
  renamePage, deletePage,
  evaluateFormula,
  generateShareLink, addSharedUser, removeSharedUser,
  subscribeToMutationStatus, updateEntriesOrder, flushAllPendingWrites,
  updateEntryCellStyles, unlinkColumn, compressImage,
  formatDateToDDMMYYYY,
  type Entry, type CellStyle, type HistoryEntry,
} from '../lib/api';
// xlsx, jsPDF, and jspdf-autotable are now dynamically imported via useExport hook
import { useExport } from '../hooks/useExport';
import { useColumnStats } from '../hooks/useColumnStats';
import {
  Plus, ChevronDown, Calendar,
  Hash, FlaskConical, Pin, IndianRupee,
  Mail, Phone, Globe, Star, CheckSquare, Image as ImageIcon, ArrowLeft,
  Search, FileText, Download, ListOrdered, Maximize2, AlertCircle,
  X, Link as LinkIcon, Info, AlertTriangle, Trash2, ZoomIn, ZoomOut, Bell, Clock, Lock
} from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RegisterHeader } from '../components/register/RegisterHeader';
import { SpreadsheetRow } from '../components/register/SpreadsheetRow';
import { CellFormatToolbar } from '../components/register/CellFormatToolbar';
import { ExportModal } from '../components/register/modals/ExportModal';
import { ShareModal } from '../components/register/modals/ShareModal';
import { ColumnModals } from '../components/register/modals/ColumnModals';
import { OtherModals } from '../components/register/modals/OtherModals';
import { RegisterToolbar } from '../components/register/RegisterToolbar';
import { RegisterContextMenus } from '../components/register/menus/RegisterContextMenus';
import { RegisterSummaryRow } from '../components/register/RegisterSummaryRow';
import { AddRecordModal } from '../components/register/modals/AddRecordModal';
import { COL_TYPES } from '../lib/constants';
import { useNotifications } from '../lib/NotificationContext';
import { ColumnIcon } from '../components/register/ColumnIcon';
import { useAuth } from '../lib/auth';
import { firebaseLogWorkspaceAction } from '../lib/firebaseAuth';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'filled' | 'empty' | 'distinct' | 'none';


// Helper to normalize DD-MM-YYYY to YYYY-MM-DD for comparison
function parseDateString(dStr: string) {
  if (!dStr) return '';
  if (dStr.includes('/') || dStr.includes('-')) {
    const parts = dStr.split(/[/-]/);
    if (parts.length === 3) {
      // Ensure DD and MM are padded if they come in as 1 or 2 digits
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return dStr;
}

export default function RegisterPage() {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const registerId = Number(id) || 0;
  const queryClient = useQueryClient();
  const { addNotification, scheduleReminder, reminders, setReminders } = useNotifications();

  const registerReminders = useMemo(() => {
    return reminders.filter(r => r.registerId === String(registerId));
  }, [reminders, registerId]);

  const isAdminUserTop = useMemo(() => {
    return (user as any)?.permissions?.isAdmin === true || (user as any)?.permissions?.fullSheetAccess === true || (user as any)?.role === 'admin' || (user as any)?.role === 'superadmin' || (user as any)?.role === 'sheet_admin';
  }, [user]);

  // Helper to log workspace actions for activity tracking
  const _logWork = useCallback((action: string, details: string) => {
    if (user?.id) {
      firebaseLogWorkspaceAction(user.id as string, (user as any)?.name || user?.email || 'Unknown', action, details);
    }
  }, [user]);

  // Helper to parse column restriction strings like "1,3,5-8" into a Set of 0-indexed column indices
  const _parseColumnRestriction = (value: any): Set<number> | null => {
    if (Array.isArray(value)) return new Set(value);
    if (typeof value === 'string' && value.trim()) {
      const allowed = new Set<number>();
      const parts = value.split(',').map((s: string) => s.trim()).filter(Boolean);
      for (const p of parts) {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map(Number);
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = start; i <= end; i++) allowed.add(i - 1); // 0-indexed
          }
        } else {
          const num = Number(p);
          if (!isNaN(num)) allowed.add(num - 1);
        }
      }
      return allowed.size > 0 ? allowed : null;
    }
    return null;
  };

  const { data: register, isLoading, error } = useQuery({
    queryKey: ['register', registerId],
    queryFn: () => getRegister(Number(registerId)),
    enabled: !!registerId && !isNaN(Number(registerId)),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const isFullyRestricted = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).permissions?.fullSheetAccess || (user as any).role === 'admin' || (user as any).role === 'superadmin' || (user as any).role === 'sheet_admin') return false;
    
    // Check if sheet is explicitly allowed
    const allowedRegs = (user as any).permissions?.allowedRegisters;
    const allowedFolders = (user as any).permissions?.allowedFolders;

    // Check folder access first
    const folderId = (register as any)?.folderId;
    if (folderId) {
      if (!Array.isArray(allowedFolders) || !allowedFolders.map(String).includes(folderId.toString())) {
        return true; // Restricted if folder not approved
      }
    }

    if (Array.isArray(allowedRegs) && allowedRegs.map(String).includes(String(registerId))) {
      return false;
    }

    return true;
  }, [user, registerId]);

  const _canDownloadAny = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).role === 'superadmin' || (user as any).role === 'admin' || (user as any).role === 'sheet_admin') return true;
    
    const allowedRegs = (user as any).permissions?.allowedRegisters;
    if (!Array.isArray(allowedRegs) || !allowedRegs.map(String).includes(String(registerId))) return false;

    const dlRest = (user as any).permissions?.downloadRestrictions;
    // If downloadRestrictions[String(registerId)] is an empty array, it means download is disabled for this sheet
    if (dlRest && Array.isArray(dlRest[String(registerId)]) && dlRest[String(registerId)].length === 0) return false;
    
    return true;
  }, [user, registerId]);

  const _canEditAny = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).permissions?.fullSheetAccess || (user as any).role === 'admin' || (user as any).role === 'superadmin' || (user as any).role === 'sheet_admin') return true;
    
    const allowedRegs = (user as any).permissions?.allowedRegisters;
    if (!Array.isArray(allowedRegs) || !allowedRegs.map(String).includes(String(registerId))) return false;

    const editRest = (user as any).permissions?.editRestrictions;
    // If editRest[String(registerId)] is an empty array, it means edit is disabled for this sheet
    if (editRest && Array.isArray(editRest[String(registerId)]) && editRest[String(registerId)].length === 0) return false;
    
    return true;
  }, [user, registerId]);

  const _canCreateAny = _canEditAny;

  const _editableColumnIds = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).permissions?.fullSheetAccess || (user as any).role === 'admin' || (user as any).role === 'superadmin' || (user as any).role === 'sheet_admin') return null; // All columns editable
    
    const editRest = (user as any).permissions?.editRestrictions;
    if (!editRest || editRest[String(registerId)] === undefined) {
      return _canEditAny ? null : new Set<number>();
    }

    if (Array.isArray(editRest[String(registerId)])) {
      if (editRest[String(registerId)].length === 0) return new Set<number>();
      return new Set<number>(editRest[String(registerId)].map(Number));
    }

    return new Set<number>();
  }, [user, registerId, _canEditAny]);

  useEffect(() => {
    if (isFullyRestricted && id) {
      toast.error("You do not have permission to view this register.");
      navigate('/');
    }
  }, [isFullyRestricted, navigate, id]);

  // Row-level view restrictions
  const rowViewRange = useMemo(() => {
    if (!user || isAdminUserTop) return null; // null = show all rows
    const rvr = (user as any).permissions?.rowViewRestrictions;
    if (rvr && rvr[String(registerId)]) return rvr[String(registerId)];
    return null;
  }, [user, registerId, isAdminUserTop]);

  // Row-level edit restrictions
  const _rowEditRange = useMemo(() => {
    if (!user || isAdminUserTop) return null;
    const rer = (user as any).permissions?.rowEditRestrictions;
    if (rer && rer[String(registerId)]) return rer[String(registerId)];
    return null;
  }, [user, registerId, isAdminUserTop]);

  // Row-level download restrictions
  const rowDownloadRange = useMemo(() => {
    if (!user || isAdminUserTop) return null;
    const rdr = (user as any).permissions?.rowDownloadRestrictions;
    if (rdr && rdr[String(registerId)]) return rdr[String(registerId)];
    return null;
  }, [user, registerId, isAdminUserTop]);

  // Column-level download restrictions — only these columns can be exported
  const downloadableColumnIds = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).role === 'admin' || (user as any).role === 'superadmin' || (user as any).permissions?.fullSheetAccess) return null;
    
    const allowedRegs = (user as any).permissions?.allowedRegisters;
    if (Array.isArray(allowedRegs) && allowedRegs.map(String).includes(String(registerId))) {
      return null; // All columns downloadable if approved
    }
    return new Set<number>(); // No access
  }, [user, registerId]);

  // Column-level view restrictions — only these columns should be visible
  const _viewableColumnIds = useMemo(() => {
    if (!user || (user as any).permissions?.isAdmin || (user as any).permissions?.fullSheetAccess || (user as any).role === 'admin' || (user as any).role === 'superadmin' || (user as any).role === 'sheet_admin') return null; // null = all
    
    const allowedRegs = (user as any).permissions?.allowedRegisters;
    if (!Array.isArray(allowedRegs) || !allowedRegs.map(String).includes(String(registerId))) {
      return new Set<number>(); // No access
    }

    const colViewRest = (user as any).permissions?.columnViewRestrictions;
    if (!colViewRest || colViewRest[String(registerId)] === undefined) {
      return null; // All columns visible
    }

    if (Array.isArray(colViewRest[String(registerId)])) {
      if (colViewRest[String(registerId)].length === 0) return new Set<number>(); // None visible
      return new Set<number>(colViewRest[String(registerId)].map(Number));
    }
    
    return new Set<number>();
  }, [user, registerId]);

  const cachedRegister = queryClient.getQueryData(['register', registerId]) as any;

  // Fetch all registers for the Link Column feature
  const { data: allRegisters = [] } = useQuery({
    queryKey: ['registers', register?.businessId],
    queryFn: () => listRegisters(register!.businessId),
    enabled: !!register?.businessId,
    staleTime: 5 * 60 * 1000,
  });

  // ── State ──
  const [search, setSearch] = useState(() => localStorage.getItem(`rb_search_${registerId}`) || '');
  const [currentPageIndex, setCurrentPageIndex] = useState(() => {
    const saved = localStorage.getItem(`rb_page_${registerId}`);
    return saved ? parseInt(saved, 10) : 0;
  });
  const [localEntries, setLocalEntries] = useState<Entry[]>(cachedRegister?.entries || []);

  const [calcTypes, setCalcTypes] = useState<Record<number, CalcType>>(() => {
    if (cachedRegister?.columns) {
      const calcs: Record<number, CalcType> = {};
      cachedRegister.columns.forEach((col: any) => {
        if (col.summary) calcs[col.id] = col.summary as CalcType;
      });
      return calcs;
    }
    return {};
  });
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Add Record modal
  const [showAddRecordModal, setShowAddRecordModal] = useState(false);

  // Modals
  const [newColumnModal, setNewColumnModal] = useState(false);
  const [colMenuId, setColMenuId] = useState<number | null>(null);
  const [colMenuRect, setColMenuRect] = useState<DOMRect | null>(null);
  const [manageColsMenu, setManageColsMenu] = useState<{ rect: DOMRect } | null>(null);
  const [rowMenuId, setRowMenuId] = useState<number | null>(null);
  const [renameColModal, setRenameColModal] = useState(false);
  const [dropdownConfigModal, setDropdownConfigModal] = useState(false);
  const [changeTypeModal, setChangeTypeModal] = useState(false);
  const [linkColumnModal, setLinkColumnModal] = useState(false);
  const [insertColModal, setInsertColModal] = useState<'left' | 'right' | null>(null);
  const [linkInfoModal, setLinkInfoModal] = useState<{
    registerName: string;
    columnName: string;
    role: 'source' | 'target' | 'unknown';
    columnId: number;
    linkedRegisterId?: number;
  } | null>(null);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  
  // Smooth column drag-and-drop reordering
  const [draggedColumnId, setDraggedColumnId] = useState<number | null>(null);
  const [_dropTargetIdx, setDropTargetIdx] = useState<number | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const colHeaderRefs = useRef<Map<number, HTMLTableCellElement>>(new Map());
  const isDraggingCol = useRef(false);
  const [activeModalColId, setActiveModalColId] = useState<number | null>(null);
  const colVirtualizerRef = useRef<any>(null);

  const [dateModal, setDateModal] = useState(false);
  const [dropdownModal, setDropdownModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [renamePageModal, setRenamePageModal] = useState(false);
  const [filterModal, setFilterModal] = useState(false);

  const isLocalStorageInitializedRef = useRef(false);

  const [hiddenColumns, setHiddenColumns] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(`rb_hidden_cols_${registerId}`);
      if (saved) {
        isLocalStorageInitializedRef.current = true;
        return new Set(JSON.parse(saved));
      }
    } catch (e) {}
    return new Set();
  });
  const [frozenColumns, setFrozenColumns] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem(`rb_frozen_cols_${registerId}`);
      if (saved) {
        // We only really need one ref, but we can set it here too just in case
        isLocalStorageInitializedRef.current = true;
        return new Set(JSON.parse(saved));
      }
    } catch (e) {}
    return new Set();
  });

  useEffect(() => {
    if (registerId) {
      localStorage.setItem(`rb_hidden_cols_${registerId}`, JSON.stringify(Array.from(hiddenColumns)));
    }
  }, [hiddenColumns, registerId]);

  useEffect(() => {
    if (registerId) {
      localStorage.setItem(`rb_frozen_cols_${registerId}`, JSON.stringify(Array.from(frozenColumns)));
    }
  }, [frozenColumns, registerId]);
  const [sortColId, setSortColId] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc' | null>(null);
  const [detailViewEntry, setDetailViewEntry] = useState<Entry | null>(null);
  const detailViewEntryIdRef = useRef<number | null>(null);
  const scrollToRowIdRef = useRef<number | null>(null);
  useEffect(() => {
    detailViewEntryIdRef.current = detailViewEntry?.id || null;
    if (detailViewEntry) {
      setDetailEdits(detailViewEntry.cells || {});
      setDetailErrors({});
    } else {
      setDetailEdits({});
      setDetailErrors({});
    }
  }, [detailViewEntry]);

  const [detailEdits, setDetailEdits] = useState<Record<string, string>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string | null>>({});
  const detailErrorsRef = useRef<Record<string, string | null>>({});
  useEffect(() => {
    detailErrorsRef.current = detailErrors;
  }, [detailErrors]);
  const detailInputRefs = useRef<Map<number, HTMLElement>>(new Map());
  const [previewImage, setPreviewImage] = useState<{ url: string; entryId?: number; colId?: string } | null>(null);
  const [previewImageIndex, setPreviewImageIndex] = useState(0);
  const [isImgZoomed, setIsImgZoomed] = useState(false);
  const [showRowAuditTrail, setShowRowAuditTrail] = useState(false);
  const [rowAuditHistory, setRowAuditHistory] = useState<HistoryEntry[]>([]);
  const [rowAuditLoading, setRowAuditLoading] = useState(false);

  // Cell formatting toolbar
  const [formatCell, setFormatCell] = useState<{ entryId: number; colId: string; rect: DOMRect } | null>(null);

  // Reminders
  const [reminderModal, setReminderModal] = useState<{ entryId: number; colId: string } | null>(null);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [reminderStatus, setReminderStatus] = useState<'Pending' | 'Complete'>('Pending');
  const [showRemindersSummary, setShowRemindersSummary] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editRemMessage, setEditRemMessage] = useState('');
  const [editRemStatus, setEditRemStatus] = useState<'Pending' | 'Complete'>('Pending');
  const [editRemDate, setEditRemDate] = useState('');
  const [editRemTime, setEditRemTime] = useState('');
  const [editRemCellValue, setEditRemCellValue] = useState('');
  const [inlineCellValues, setInlineCellValues] = useState<Record<string, string>>({});


  // New column form (shared by Add Column and Insert Column)
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [newColDropdownOpts, setNewColDropdownOpts] = useState('');
  const [newColFormula, setNewColFormula] = useState('');

  // Change column type
  const [changeTypeValue, setChangeTypeValue] = useState('text');

  // Rename column
  const [renameColValue, setRenameColValue] = useState('');

  // Dropdown config
  const [dropdownConfigOptions, setDropdownConfigOptions] = useState('');

  // Filter
  const [filters, setFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string; values?: string[] }>>(() => {
    const saved = localStorage.getItem(`rb_filters_${registerId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [activeFilters, setActiveFilters] = useState<Array<{ columnId: number; operator: string; value: string; value2?: string; values?: string[] }>>(() => {
    const saved = localStorage.getItem(`rb_active_filters_${registerId}`);
    return saved ? JSON.parse(saved) : [];
  });

  const deferredSearch = useDeferredValue(search);
  const deferredActiveFilters = useDeferredValue(activeFilters);

  // Column Selection and Preview Mode
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(() => {
    try {
      const savedCols = localStorage.getItem(`rb_selected_cols_${registerId}`);
      if (savedCols) {
        return new Set(JSON.parse(savedCols));
      }
    } catch (e) {}
    return new Set();
  });
  const [isPreviewSelectedColumns, setIsPreviewSelectedColumns] = useState(() => {
    try {
      const savedPreview = localStorage.getItem(`rb_preview_selected_${registerId}`);
      if (savedPreview) {
        return savedPreview === 'true';
      }
    } catch (e) {}
    return false;
  });

  // Date picker for cell — refs to avoid re-render on open
  const [dateDay, setDateDay] = useState('');
  const [dateMonth, setDateMonth] = useState('');
  const [dateYear, setDateYear] = useState('');
  const dateEntryIdRef = useRef<number | null>(null);
  const dateColumnIdRef = useRef<number | null>(null);
  const dateRectRef = useRef<{ top: number, bottom: number, left: number, width: number } | null>(null);
  // Expose as stable getters for OtherModals
  const dateEntryId = dateEntryIdRef.current;
  const dateColumnId = dateColumnIdRef.current;
  const dateRect = dateRectRef.current;

  // Dropdown for cell — refs to avoid re-render on open
  const dropdownOptionsRef = useRef<string[]>([]);
  const dropdownEntryIdRef = useRef<number | null>(null);
  const dropdownColumnIdRef = useRef<number | null>(null);
  const dropdownRectRef = useRef<{ top: number, bottom: number, left: number, width: number } | null>(null);
  const dropdownOptions = dropdownOptionsRef.current;
  const dropdownEntryId = dropdownEntryIdRef.current;
  const dropdownColumnId = dropdownColumnIdRef.current;
  const dropdownRect = dropdownRectRef.current;

  // Share
  const [sharePhone, setSharePhone] = useState('');
  const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
  const [showExportModal, setShowExportModal] = useState(false);
  // Rename page
  const [renamePageId] = useState<number | null>(null);
  const [renamePageValue, setRenamePageValue] = useState('');

  const [calcMenu, setCalcMenu] = useState<{ colId: number; rect: DOMRect } | null>(null);

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Undo/Redo tracking has been removed to ensure reliable Firestore database updates.

  // Column widths state for custom resizing
  const [colWidths, setColWidths] = useState<Record<number, number>>({});

  // ── Data ──
  // Combined query above handles data fetching for the register
  const errorRef = useRef<any>(null);
  useEffect(() => {
    if (error) {
      errorRef.current = error;
      toast.error('Failed to load register data');
      addNotification({
        title: 'Data Load Error',
        message: 'Failed to load register data. Please try refreshing the page.',
        type: 'error',
        link: { registerId: String(registerId) }
      });
    }
  }, [error, addNotification, registerId]);

  // Note: cache busting removed — the in-memory cache is the source of truth.
  // Busting on every mount was causing data alteration on page refresh
  // because debounced writes might not have persisted yet.

  useEffect(() => {
    const unsubscribe = subscribeToMutationStatus((count) => {
      setIsSaving(count > 0);
    });
    return () => { unsubscribe(); };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Flush any pending debounced writes immediately before unloading
      const timers = debounceTimers.current;
      const pendingKeys = Object.keys(timers);
      const hasPending = pendingKeys.length > 0;
      if (hasPending) {
        // Fire all pending debounced writes synchronously
        pendingKeys.forEach(key => {
          clearTimeout(timers[key]);
          delete timers[key];
        });
        // Derive and fire pending cell diffs from localEntries vs React Query cache
        const currentRegData = queryClient.getQueryData(['register', registerId]) as any;
        if (currentRegData) {
          const localMap = new Map(localEntriesRef.current.map(le => [le.id, le]));
          for (const entry of currentRegData.entries || []) {
            const local = localMap.get(entry.id);
            if (!local) continue;
            const diff: Record<string, string> = {};
            for (const [colId, val] of Object.entries(local.cells || {})) {
              if ((entry.cells?.[colId] || '') !== (val || '')) {
                diff[colId] = val as string;
              }
            }
            if (Object.keys(diff).length > 0) {
              updateEntryDirect(registerId, entry.id, diff);
            }
          }
        }
      }
      if (isSaving || hasPending) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaving, registerId, queryClient]);

  // Stabilize references so child components only re-render when the actual data changes
  const columns = useMemo(() => {
    const all = [...(register?.columns || [])].sort((a, b) => a.position - b.position);
    if (!_viewableColumnIds) return all;
    return all.filter(c => _viewableColumnIds.has(c.id));
  }, [register?.columns, _viewableColumnIds]);
  const pages = useMemo(() => register?.pages || [{ id: 1, name: 'Page 1', index: 0 }], [register?.pages]);

  useEffect(() => {
    if (!isLocalStorageInitializedRef.current && columns.length > 0) {
      const nextHidden = new Set<number>();
      const nextFrozen = new Set<number>();
      columns.forEach((col: any) => {
        if (col.hidden) nextHidden.add(col.id);
        if (col.frozen) nextFrozen.add(col.id);
      });
      setHiddenColumns(nextHidden);
      setFrozenColumns(nextFrozen);
      isLocalStorageInitializedRef.current = true;
      // Note: we don't return here because we still want to update the refs below
    }

    // Keep refs in sync for handlers that need latest data in closures
    columnsRef.current = columns;
    visibleColumnsRef.current = columns.filter(c => !hiddenColumns.has(c.id));
  }, [columns, hiddenColumns, frozenColumns]);

  // Lock body scroll and handle back-button to close modal
  const modalOpenRef = useRef(false);
  useEffect(() => {
    if (detailViewEntry && !modalOpenRef.current) {
      modalOpenRef.current = true;
      document.body.classList.add('modal-open');
      // Push state to history so back button closes modal
      window.history.pushState({ modal: 'row-detail' }, '');
      
      const handlePopState = () => {
        // If we popped back and we were in a modal, close it
        setDetailViewEntry(null);
        setDetailEdits({});
        setDetailErrors({});
        modalOpenRef.current = false;
      };
      
      window.addEventListener('popstate', handlePopState);
      return () => {
        document.body.classList.remove('modal-open');
        window.removeEventListener('popstate', handlePopState);
        // Clean up history if modal closed via 'X' or Save
        if (modalOpenRef.current && window.history.state?.modal === 'row-detail') {
          modalOpenRef.current = false;
          window.history.back();
        }
      };
    } else if (!detailViewEntry && modalOpenRef.current) {
      modalOpenRef.current = false;
    }
  }, [detailViewEntry]);

  // Auto-initialize edit values when Row Detail view opens (but NOT when columns change mid-edit)
  const detailInitEntryIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (detailViewEntry && columns.length > 0) {
      // Only initialize when opening a new/different entry, not when columns update
      if (detailInitEntryIdRef.current !== detailViewEntry.id) {
        detailInitEntryIdRef.current = detailViewEntry.id;
        const init: Record<string, string> = {};
        columns.filter(c => c.type !== 'formula').forEach(c => {
          init[c.id.toString()] = detailViewEntry.cells?.[c.id.toString()] || '';
        });
        setDetailEdits(init);
      }
    } else {
      // Reset tracker when modal closes
      detailInitEntryIdRef.current = null;
    }
  }, [detailViewEntry, columns]);

  // Sync localEntries and column settings when registerId changes or new data arrives.
  // We do this during render (derived state) to prevent a white-screen flash.
  // By using cachedRegister, we can often show data immediately upon navigation.
  const lastSyncId = useRef<number | null>(null);
  const lastSyncData = useRef<any>(null);

  const dataToSync = register || (Number(registerId) !== lastSyncId.current ? cachedRegister : null);

  const hasPendingDebounce = Object.keys(debounceTimers.current).length > 0;
  if (Number(registerId) !== lastSyncId.current || (register && register !== lastSyncData.current && !hasPendingDebounce)) {
    if (Number(registerId) !== lastSyncId.current) {
      let loadedSelected: Set<number> = new Set();
      try {
        const savedCols = localStorage.getItem(`rb_selected_cols_${registerId}`);
        if (savedCols) {
          loadedSelected = new Set(JSON.parse(savedCols));
        }
      } catch (e) {}
      setSelectedColumns(loadedSelected);

      let loadedPreview = false;
      try {
        const savedPreview = localStorage.getItem(`rb_preview_selected_${registerId}`);
        if (savedPreview) {
          loadedPreview = savedPreview === 'true';
        }
      } catch (e) {}
      setIsPreviewSelectedColumns(loadedPreview);
    }
    lastSyncId.current = Number(registerId);
    lastSyncData.current = register;

    if (dataToSync) {
      setLocalEntries(dataToSync.entries || []);
      // Initialize column settings (widths, summaries) from saved data
      if (dataToSync.columns) {
        const widths: Record<number, number> = {};
        const calcs: Record<number, CalcType> = {};
        dataToSync.columns.forEach((col: any) => {
          if (col.width) widths[col.id] = col.width;
          if (col.summary) calcs[col.id] = col.summary as CalcType;
        });
        setColWidths(widths);
        setCalcTypes(calcs);
      }
      
      // Safety: reset page index if it's out of bounds for the current register data
      const totalEntries = dataToSync.entries?.length || 0;
      if (totalEntries > 0) {
        const lastPage = Math.floor((totalEntries - 1) / 500); // Assuming ~500 per page if not chunked, but we use pageIndex.
        // Actually, let's just reset if it's a new register switch
        if (registerId !== lastSyncId.current) {
             const saved = localStorage.getItem(`rb_page_${registerId}`);
             if (!saved) setCurrentPageIndex(0);
        }
      }
    } else if (registerId !== lastSyncId.current) {
      // Clear data for a new register if no cache exists, avoiding showing stale data
      setLocalEntries([]);
      setColWidths({});
      setCalcTypes({});
    }
  }

  // Also sync localEntriesRef on every local state change
  useEffect(() => {
    localEntriesRef.current = localEntries;
  }, [localEntries]);

  useEffect(() => {
    if (selectedColumns.size === 0) {
      setIsPreviewSelectedColumns(false);
    }
  }, [selectedColumns.size]);

  useEffect(() => {
    if (registerId) {
      localStorage.setItem(`rb_selected_cols_${registerId}`, JSON.stringify(Array.from(selectedColumns)));
    }
  }, [selectedColumns, registerId]);

  useEffect(() => {
    if (registerId) {
      localStorage.setItem(`rb_preview_selected_${registerId}`, isPreviewSelectedColumns ? 'true' : 'false');
    }
  }, [isPreviewSelectedColumns, registerId]);

  const handleCalcCellClick = (e: React.MouseEvent, colId: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCalcMenu({ colId, rect });
  };

  const handleImageDownload = useCallback(async (url: string) => {
    if (!url) return;
    try {
      // For data URLs or blobs, we can download directly
      if (url.startsWith('data:') || url.startsWith('blob:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = `record_image_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // For external URLs, try to fetch to avoid browser opening in new tab
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `record_image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Download failed:", err);
      // Fallback: just open in new tab if fetch fails (CORS)
      window.open(url, '_blank');
    }
  }, []);

  const updateCalcType = async (colId: number, type: string) => {
    setCalcTypes(prev => ({ ...prev, [colId.toString()]: type as CalcType }));
    setCalcMenu(null);
    try {
      await updateColumnSummary(registerId, colId, type);
    } catch (err) {
      toast.error('Failed to save summary setting');
    }
  };

  useEffect(() => {
    if (calcMenu) {
      const h = () => setCalcMenu(null);
      window.addEventListener('click', h);
      return () => window.removeEventListener('click', h);
    }
  }, [calcMenu]);

  // Persist filter state to localStorage
  useEffect(() => {
    if (!registerId) return;
    localStorage.setItem(`rb_search_${registerId}`, search);
    localStorage.setItem(`rb_page_${registerId}`, currentPageIndex.toString());
    localStorage.setItem(`rb_filters_${registerId}`, JSON.stringify(filters));
    localStorage.setItem(`rb_active_filters_${registerId}`, JSON.stringify(activeFilters));
  }, [search, currentPageIndex, filters, activeFilters, registerId]);

  // Reset page to 0 when filters or search change to avoid being stuck on an empty page
  const isInitialFilterRender = useRef(true);
  useEffect(() => {
    if (isInitialFilterRender.current) {
      isInitialFilterRender.current = false;
      return;
    }
    setCurrentPageIndex(0);
  }, [deferredSearch, deferredActiveFilters]);

  // Ctrl+F to focus search, Ctrl+S to flush & save all pending edits
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const el = document.getElementById('pab-search-input');
        if (el) { el.focus(); (el as HTMLInputElement).select(); }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Immediately fire all pending debounced writes
        const timers = debounceTimers.current;
        const pendingKeys = Object.keys(timers);
        if (pendingKeys.length > 0) {
          pendingKeys.forEach(key => {
            clearTimeout(timers[key]);
            delete timers[key];
          });
          // Collect all pending cell edits from localEntries and fire updateEntryDirect for each
          // The debounce timers captured closures with the values, so clearing them means
          // we need to re-derive the pending edits from localEntries vs the React Query cache
          const currentRegData = queryClient.getQueryData(['register', registerId]) as any;
          if (currentRegData) {
            const localMap = new Map(localEntriesRef.current.map(e => [e.id, e]));
            for (const entry of currentRegData.entries || []) {
              const local = localMap.get(entry.id);
              if (!local) continue;
              const diff: Record<string, string> = {};
              for (const [colId, val] of Object.entries(local.cells || {})) {
                if ((entry.cells?.[colId] || '') !== (val || '')) {
                  diff[colId] = val as string;
                }
              }
              if (Object.keys(diff).length > 0) {
                updateEntryDirect(registerId, entry.id, diff);
              }
            }
          }
        }
        // Wait for all queued mutations to complete
        flushAllPendingWrites().then(() => {
          toast.success('All changes saved!', { duration: 1500 });
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [registerId, queryClient]);

  // Apply row-level view restrictions before any search/filter/sort
  const rowFilteredEntries = useMemo(() => {
    if (!rowViewRange) return localEntries;
    const { start, end } = rowViewRange;
    return localEntries.filter(e => {
      const num = e.rowNumber;
      if (start !== undefined && num < start) return false;
      if (end !== undefined && num > end) return false;
      return true;
    });
  }, [localEntries, rowViewRange]);

  const entriesByPage = useMemo(() => {
    const pages: Record<number, Entry[]> = {};
    rowFilteredEntries.forEach((e) => {
      const pIdx = e.pageIndex || 0;
      if (!pages[pIdx]) pages[pIdx] = [];
      pages[pIdx].push(e);
    });
    return pages;
  }, [rowFilteredEntries]);

  const pageOffset = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < currentPageIndex; i++) {
      sum += (entriesByPage[i] || []).length;
    }
    return sum;
  }, [entriesByPage, currentPageIndex]);

  // Build paginated lookup from row-filtered entries
  const rowFilteredEntriesByPage = entriesByPage;

  // Filter + sort entries — memoized so it only recomputes when inputs change
  const displayEntries = useMemo(() => {
    const s = deferredSearch.toLowerCase().trim();
    
    // Pre-calculate filter values once before the loop
    const preparedFilters = deferredActiveFilters.map(f => ({
      ...f,
      lFilter: (f.value || '').toLowerCase(),
      nValue: parseFloat(f.value),
      nValue2: parseFloat(f.value2 || '0'),
      dValue: f.value, // Date filters use YYYY-MM-DD string
      dValue2: f.value2 || '',
      values: f.values || [],
    }));

    const filterLen = preparedFilters.length;
    const isSearching = !!s || filterLen > 0;
    
    // Safety check for pagination: if current page is empty but data exists, fallback to page 0
    let targetPage = currentPageIndex;
    if (!isSearching && !entriesByPage[targetPage] && entriesByPage[0]) {
      targetPage = 0;
    }
    
    const entriesToFilter = isSearching ? rowFilteredEntries : (entriesByPage[targetPage] || []);

    // Fast path: No search, no filters, no sorting.
    if (!isSearching && !sortColId) {
      return entriesToFilter;
    }

    let result = isSearching ? [] : [...entriesToFilter];

    if (isSearching) {
      const localLen = entriesToFilter.length;
      for (let i = 0; i < localLen; i++) {
        const e = entriesToFilter[i];

        // 2. Search filtering
        if (s) {
          let match = false;
          const cells = e.cells || {};
          for (const key in cells) {
            const val = cells[key];
            if (val && typeof val === 'string' && val.toLowerCase().includes(s)) {
              match = true;
              break;
            }
          }
          if (!match) continue;
        }

        // 3. Active Filters
        if (filterLen > 0) {
          let passFilters = true;
          for (let j = 0; j < filterLen; j++) {
            const f = preparedFilters[j];
            const val = (e.cells?.[f.columnId.toString()] || '').trim();
            const lVal = val.toLowerCase();

            let condition = true;
            switch (f.operator) {
              case 'contains': condition = lVal.includes(f.lFilter); break;
              case 'not_contains': condition = !lVal.includes(f.lFilter); break;
              case 'equals': condition = lVal === f.lFilter; break;
              case 'not_equals': condition = lVal !== f.lFilter; break;
              case 'starts_with': condition = lVal.startsWith(f.lFilter); break;
              case 'ends_with': condition = lVal.endsWith(f.lFilter); break;
              case 'eq': condition = parseFloat(val) === f.nValue; break;
              case 'gt': condition = parseFloat(val) > f.nValue; break;
              case 'gte': condition = parseFloat(val) >= f.nValue; break;
              case 'lt': condition = parseFloat(val) < f.nValue; break;
              case 'lte': condition = parseFloat(val) <= f.nValue; break;
              case 'between': {
                const n = parseFloat(val);
                condition = n >= f.nValue && n <= f.nValue2;
                break;
              }
              case 'not_between': {
                const n = parseFloat(val);
                condition = n < f.nValue || n > f.nValue2;
                break;
              }
              case 'date_is': condition = parseDateString(val) === f.dValue; break;
              case 'date_not': condition = parseDateString(val) !== f.dValue; break;
              case 'date_before': condition = parseDateString(val) < f.dValue; break;
              case 'date_after': condition = parseDateString(val) > f.dValue; break;
              case 'date_between': {
                const dVal = parseDateString(val);
                condition = dVal >= f.dValue && dVal <= f.dValue2;
                break;
              }
              case 'date_not_between': {
                const dVal = parseDateString(val);
                condition = dVal < f.dValue || dVal > f.dValue2;
                break;
              }
              case 'empty': condition = !val; break;
              case 'not_empty': condition = !!val; break;
              case 'multi_select': {
                if (!val) {
                  condition = f.values.includes('(Blanks)');
                } else {
                  condition = f.values.includes(val);
                }
                break;
              }
            }
            if (!condition) {
              passFilters = false;
              break;
            }
          }
          if (!passFilters) continue;
        }

        result.push(e);
      }
    }

    // 4. Client-side Sorting (ensures visual consistency even if backend hasn't updated)
    if (sortColId && sortDir) {
      const colDef = columns.find(c => c.id === sortColId);
      const colIdStr = sortColId.toString();
      result.sort((a, b) => {
        const aVal = a.cells?.[colIdStr] || '';
        const bVal = b.cells?.[colIdStr] || '';
        if (colDef?.type === 'date') {
          const dA = parseDateString(aVal);
          const dB = parseDateString(bVal);
          return sortDir === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        }
        if (colDef?.type === 'number' || colDef?.type === 'currency' || colDef?.type === 'formula') {
          const nA = parseFloat(aVal) || 0;
          const nB = parseFloat(bVal) || 0;
          return sortDir === 'asc' ? nA - nB : nB - nA;
        }
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });
    }

    return result;
  }, [localEntries, columns, deferredSearch, deferredActiveFilters, sortColId, sortDir, entriesByPage, currentPageIndex]);

  // ── Column Suggestions (Autocomplete) ──
  const columnSuggestions = useMemo(() => {
    const suggestions: Record<string, string[]> = {};
    columns.forEach(col => {
      // Only for text-based or related columns where autocomplete makes sense
      if (['text', 'email', 'phone', 'url', 'currency', 'auto_increment'].includes(col.type)) {
        const set = new Set<string>();
        const colIdStr = col.id.toString();
        // Use localEntries to get the most current state (including optimistic updates)
        localEntries.forEach(e => {
          const val = e.cells?.[colIdStr];
          if (val && val.trim()) set.add(val.trim());
        });
        // Sort alphabetically for a cleaner dropdown
        suggestions[colIdStr] = Array.from(set).sort((a, b) => a.localeCompare(b));
      }
    });
    return suggestions;
  }, [localEntries, columns]);
  
  // ── Helpers ──
  const cleanOptions = (opts: string[]) => {
    const seen = new Set<string>();
    return opts
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => {
        const lower = s.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      });
  };


  // ── Mutations ──
  const addColumnMutation = useMutation({
    mutationFn: () => addColumn(registerId, {
      name: newColName, type: newColType,
      dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
      formula: newColType === 'formula' ? newColFormula : undefined,
    }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      const dummyId = Date.now();
      if (prev) {
        const newCol = {
          id: dummyId, registerId, name: newColName, type: newColType,
          position: prev.columns ? prev.columns.length : 0,
          dropdownOptions: newColType === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
          formula: newColType === 'formula' ? newColFormula : undefined,
          createdAt: new Date().toISOString()
        };
        queryClient.setQueryData(['register', registerId], { ...prev, columns: [...(prev.columns || []), newCol] });
      }
      setNewColumnModal(false);
      return { prev, dummyId };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      // Force a re-fetch to ensure all sequential logic (auto-increment) is synced from server
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Column added successfully');

      // Reset form fields
      setNewColName('');
      setNewColType('text');
      setNewColDropdownOpts('');
      setNewColFormula('');

      // Auto-scroll to the new column
      const oldCols = columnsRef.current;
      const newCol = updatedReg.columns?.find((c: any) => !oldCols.some(old => old.id === c.id));
      if (newCol) {
        setTimeout(() => {
          const colIdx = visibleColumnsRef.current.findIndex(c => c.id === newCol.id);
          if (colIdx !== -1 && colVirtualizerRef.current) {
            colVirtualizerRef.current.scrollToIndex(colIdx, { align: 'center', behavior: 'smooth' });
          } else if (parentRef.current) {
            parentRef.current.scrollTo({ left: parentRef.current.scrollWidth, behavior: 'smooth' });
          }
        }, 150);
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to add column');
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });

  const deleteColumnMutation = useMutation({
    mutationFn: (colId: number) => deleteColumn(registerId, colId),
    onMutate: async (colId) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const previousRegister = queryClient.getQueryData(['register', registerId]) as any;
      const previousLocalEntries = [...localEntries];

      if (previousRegister) {
        const colIdStr = colId.toString();
        const col = previousRegister.columns?.find((c: any) => c.id.toString() === colIdStr);
        if (col?.type === 'formula') {
          throw new Error('Formula columns cannot be deleted');
        }
        
        if (col) {
          // Optimistically update cache
          const updatedReg = {
            ...previousRegister,
            columns: previousRegister.columns.filter((c: any) => c.id.toString() !== colIdStr),
            entries: (previousRegister.entries || []).map((e: any) => {
              const newCells = { ...e.cells };
              delete newCells[colIdStr];
              return { ...e, cells: newCells };
            })
          };
          queryClient.setQueryData(['register', registerId], updatedReg);
          setLocalEntries(updatedReg.entries || []);
        }
      }
      setColMenuId(null);
      return { previousRegister, previousLocalEntries };
    },
    onSuccess: () => {
      toast.success('Column deleted');
    },
    onError: (err: any, _colId, context) => {
      if (context?.previousRegister) queryClient.setQueryData(['register', registerId], context.previousRegister);
      if (context?.previousLocalEntries) setLocalEntries(context.previousLocalEntries);
      if (err?.message === 'Formula columns cannot be deleted') {
        toast.error('Formula columns cannot be deleted');
      } else {
        toast.error('Failed to delete column');
      }
    },
  });

  const unlinkColumnMutation = useMutation({
    mutationFn: (colId: number) => unlinkColumn(registerId, colId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      if (linkInfoModal?.linkedRegisterId) {
        queryClient.invalidateQueries({ queryKey: ['register', linkInfoModal.linkedRegisterId] });
      }
      toast.success('Column link successfully removed');
      setLinkInfoModal(null);
    },
    onError: () => {
      toast.error('Failed to remove column link');
    }
  });

  const renameColumnMutation = useMutation({
    mutationFn: () => renameColumn(registerId, activeModalColId!, renameColValue),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev && activeModalColId !== null) {
        const targetCol = prev.columns?.find((c: any) => c.id === activeModalColId);
        const oldName = targetCol?.name;

        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) => {
            if (c.id === activeModalColId) {
              return { ...c, name: renameColValue };
            }
            if (c.type === 'formula' && c.formula && oldName) {
              const escapedOldName = oldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const regex = new RegExp(`\\{${escapedOldName}\\}`, 'gi');
              return { ...c, formula: c.formula.replace(regex, `{${renameColValue}}`) };
            }
            return c;
          })
        });
      }
      setRenameColModal(false);
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Column renamed');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to rename column');
    },
    onSettled: () => { setRenameColValue(''); setActiveModalColId(null); },
  });

  const updateDropdownMutation = useMutation({
    mutationFn: () => updateColumnDropdownOptions(registerId, activeModalColId!, cleanOptions(dropdownConfigOptions.split(','))),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setDropdownConfigModal(false);
      setActiveModalColId(null);
      toast.success('Dropdown options updated');
    },
    onError: () => toast.error('Failed to update options'),
  });

  const addDropdownOptionMutation = useMutation({
    mutationFn: ({ colId, newValue }: { colId: number; newValue: string }) => {
      const col = (register?.columns || []).find((c: any) => c.id === colId);
      const existingOptions = col?.dropdownOptions || [];
      const updatedOptions = cleanOptions([newValue, ...existingOptions]);
      return updateColumnDropdownOptions(registerId, colId, updatedOptions);
    },
    onMutate: async ({ colId, newValue }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) => 
            c.id === colId ? { ...c, dropdownOptions: cleanOptions([newValue, ...(c.dropdownOptions || [])]) } : c
          )
        });
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      toast.success('Option added');
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to add option');
    },
  });

  const onAddDropdownOption = (colId: number, newValue: string, entryId?: number) => {
    addDropdownOptionMutation.mutate({ colId, newValue });
    
    // Also select it for the current entry immediately if entryId provided
    if (entryId != null) {
      setTimeout(() => {
        handleCellChange(entryId, colId.toString(), newValue);
      }, 0);
    }
  };

  const duplicateColumnMutation = useMutation({
    mutationFn: (colId: number) => duplicateColumn(registerId, colId),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setColMenuId(null);
      setLocalEntries(updatedReg.entries || []);
      toast.success('Column duplicated');

      // Auto-scroll to the duplicated column
      const oldCols = columnsRef.current;
      const newCol = updatedReg.columns?.find((c: any) => !oldCols.some(old => old.id === c.id));
      if (newCol) {
        setTimeout(() => {
          const colIdx = visibleColumnsRef.current.findIndex(c => c.id === newCol.id);
          if (colIdx !== -1 && colVirtualizerRef.current) {
            colVirtualizerRef.current.scrollToIndex(colIdx, { align: 'center', behavior: 'smooth' });
          } else if (parentRef.current) {
            parentRef.current.scrollTo({ left: parentRef.current.scrollWidth, behavior: 'smooth' });
          }
        }, 150);
      }
    },
    onError: () => toast.error('Failed to duplicate column'),
  });


  const moveColumnMutation = useMutation({
    mutationFn: ({ colId, dir }: { colId: number; dir: 'left' | 'right' }) => moveColumn(registerId, colId, dir),
    onMutate: async ({ colId, dir }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const cols = prev.columns.map((c: any) => ({ ...c }));
        const idx = cols.findIndex((c: any) => c.id === colId);
        const targetIdx = dir === 'left' ? idx - 1 : idx + 1;
        if (idx >= 0 && targetIdx >= 0 && targetIdx < cols.length) {
          [cols[idx], cols[targetIdx]] = [cols[targetIdx], cols[idx]];
          cols.forEach((c: any, i: number) => { c.position = i; });
          queryClient.setQueryData(['register', registerId], { ...prev, columns: cols });
        }
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to move column');
    },
    onSettled: () => setColMenuId(null),
  });

  const reorderColumnMutation = useMutation({
    mutationFn: ({ colId, targetIndex }: { colId: number; targetIndex: number }) => reorderColumn(registerId, colId, targetIndex),
    onMutate: async ({ colId, targetIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        const cols = prev.columns.map((c: any) => ({ ...c }));
        const idx = cols.findIndex((c: any) => c.id === colId);
        if (idx !== -1) {
          const [col] = cols.splice(idx, 1);
          const clampedTarget = Math.max(0, Math.min(targetIndex, cols.length));
          cols.splice(clampedTarget, 0, col);
          cols.forEach((c: any, i: number) => { c.position = i; });
          queryClient.setQueryData(['register', registerId], { ...prev, columns: cols });
        }
      }
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to reorder column');
    },
    onSettled: () => setColMenuId(null),
  });

  // ── Smooth column drag-and-drop handlers ──
  // Use refs so the mouse event closures always read the latest values
  const dragColIdRef = useRef<number | null>(null);
  const dropTargetIdxRef = useRef<number | null>(null);

  // These refs will be populated after visibleColumns/columns are defined
  const visibleColumnsRef = useRef<typeof columns>([]);
  const columnsRef = useRef<typeof columns>([]);
  const localEntriesRef = useRef<Entry[]>([]);

  const handleColDragMouseDown = useCallback((e: React.MouseEvent, colId: number) => {
    // Only left mouse button
    if (e.button !== 0) return;

    const th = (e.currentTarget as HTMLElement).closest('th') as HTMLTableCellElement;
    if (!th) return;

    e.preventDefault(); // Prevent text selection during drag

    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    let scrollRafId: number | null = null;
    let lastMouseX = 0;

    // Find the scrollable spreadsheet wrapper for auto-scroll
    const scrollContainer = th.closest('.spreadsheet-wrapper') as HTMLElement | null;

    // Auto-scroll loop: runs via requestAnimationFrame while dragging near edges
    const startAutoScroll = () => {
      if (scrollRafId !== null) return; // already running
      if (!scrollContainer) return;

      const edgeZone = 80; // px from edge to trigger scroll
      const maxSpeed = 30; // px per frame at the very edge

      const tick = () => {
        if (!isDraggingCol.current || !scrollContainer) { scrollRafId = null; return; }
        const rect = scrollContainer.getBoundingClientRect();
        const distFromLeft = lastMouseX - rect.left;
        const distFromRight = rect.right - lastMouseX;

        if (distFromLeft < edgeZone && distFromLeft > 0) {
          const speed = maxSpeed * (1 - distFromLeft / edgeZone);
          scrollContainer.scrollLeft -= speed;
        } else if (distFromRight < edgeZone && distFromRight > 0) {
          const speed = maxSpeed * (1 - distFromRight / edgeZone);
          scrollContainer.scrollLeft += speed;
        }
        scrollRafId = requestAnimationFrame(tick);
      };
      scrollRafId = requestAnimationFrame(tick);
    };

    const stopAutoScroll = () => {
      if (scrollRafId !== null) {
        cancelAnimationFrame(scrollRafId);
        scrollRafId = null;
      }
    };

    const cleanup = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      stopAutoScroll();

      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }
      document.querySelectorAll('.col-drop-indicator').forEach(el => el.remove());

      isDraggingCol.current = false;
      dragColIdRef.current = null;
      dropTargetIdxRef.current = null;
      setDraggedColumnId(null);
      setDropTargetIdx(null);
    };

    const onMouseMove = (ev: MouseEvent) => {
      if (!started) {
        const dist = Math.sqrt((ev.clientX - startX) ** 2 + (ev.clientY - startY) ** 2);
        if (dist < 5) return;
        started = true;
        isDraggingCol.current = true;
        dragColIdRef.current = colId;
        setDraggedColumnId(colId);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        // Create floating ghost
        const rect = th.getBoundingClientRect();
        const ghost = document.createElement('div');
        ghost.className = 'col-drag-ghost';
        ghost.textContent = th.textContent || '';
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${ev.clientX - rect.width / 2}px`;
        ghost.style.top = `${ev.clientY - rect.height / 2}px`;
        document.body.appendChild(ghost);
        dragGhostRef.current = ghost;
      }

      // Move ghost
      if (dragGhostRef.current) {
        const gw = dragGhostRef.current.offsetWidth;
        const gh = dragGhostRef.current.offsetHeight;
        dragGhostRef.current.style.left = `${ev.clientX - gw / 2}px`;
        dragGhostRef.current.style.top = `${ev.clientY - gh / 2}px`;
      }

      // Auto-scroll when near the edges of the spreadsheet container
      lastMouseX = ev.clientX;
      startAutoScroll();

      // Determine target column position
      const visCols = visibleColumnsRef.current;
      let bestIdx: number | null = null;
      colHeaderRefs.current.forEach((headerEl, _id) => {
        const rect = headerEl.getBoundingClientRect();
        if (ev.clientX >= rect.left && ev.clientX <= rect.right) {
          const colIdx = visCols.findIndex(c => c.id === _id);
          if (colIdx !== -1) {
            const midX = rect.left + rect.width / 2;
            bestIdx = ev.clientX < midX ? colIdx : colIdx + 1;
          }
        }
      });

      // Remove previous indicators
      document.querySelectorAll('.col-drop-indicator').forEach(el => el.remove());

      if (bestIdx !== null) {
        dropTargetIdxRef.current = bestIdx;
        setDropTargetIdx(bestIdx);

        // Build sorted column elements list
        const cols = Array.from(colHeaderRefs.current.entries());
        const sortedCols = visCols.map(vc => {
          const entry = cols.find(([id]) => id === vc.id);
          return entry ? entry[1] : null;
        }).filter(Boolean) as HTMLTableCellElement[];

        let indicatorLeft = 0;
        let indicatorTop = 0;
        let indicatorHeight = 0;

        if (bestIdx <= 0 && sortedCols[0]) {
          const r = sortedCols[0].getBoundingClientRect();
          indicatorLeft = r.left;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        } else if (bestIdx >= sortedCols.length && sortedCols[sortedCols.length - 1]) {
          const r = sortedCols[sortedCols.length - 1].getBoundingClientRect();
          indicatorLeft = r.right;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        } else if (sortedCols[bestIdx]) {
          const r = sortedCols[bestIdx].getBoundingClientRect();
          indicatorLeft = r.left;
          indicatorTop = r.top;
          indicatorHeight = r.height;
        }

        if (indicatorHeight > 0) {
          const indicator = document.createElement('div');
          indicator.className = 'col-drop-indicator';
          indicator.style.cssText = `
            position: fixed; left: ${indicatorLeft - 2}px; top: ${indicatorTop}px;
            width: 4px; height: ${indicatorHeight}px;
            background: var(--navy, #1a237e); border-radius: 2px;
            z-index: 9999; pointer-events: none;
          `;
          document.body.appendChild(indicator);
        }
      }
    };

    const onMouseUp = () => {
      if (started && isDraggingCol.current) {
        const currentDropIdx = dropTargetIdxRef.current;
        const currentDragId = dragColIdRef.current;
        const visCols = visibleColumnsRef.current;
        const allCols = columnsRef.current;

        if (currentDropIdx !== null && currentDragId !== null) {
          const draggedVisIdx = visCols.findIndex(c => c.id === currentDragId);

          if (draggedVisIdx !== -1 && currentDropIdx !== draggedVisIdx && currentDropIdx !== draggedVisIdx + 1) {
            let targetFullIdx: number;
            if (currentDropIdx >= visCols.length) {
              const lastVisCol = visCols[visCols.length - 1];
              targetFullIdx = allCols.findIndex(c => c.id === lastVisCol.id) + 1;
            } else {
              const targetVisCol = visCols[currentDropIdx];
              targetFullIdx = allCols.findIndex(c => c.id === targetVisCol.id);
            }
            const dragFullIdx = allCols.findIndex(c => c.id === currentDragId);
            if (dragFullIdx < targetFullIdx) targetFullIdx--;

            reorderColumnMutation.mutate({ colId: currentDragId, targetIndex: targetFullIdx });
          }
        }
      }
      cleanup();
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [reorderColumnMutation]);

  const updateColumnWidthMutation = useMutation({
    mutationFn: ({ colId, width }: { colId: number; width: number }) => updateColumnWidth(registerId, colId, width),
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (err) => {
      console.error('Failed to save column width:', err);
      toast.error('Failed to save column width');
    },
  });

  const handleColResizeMouseDown = useCallback((e: React.MouseEvent, colId: number) => {
    e.preventDefault();
    e.stopPropagation();
    const th = colHeaderRefs.current.get(colId);
    if (!th) return;

    const innerDiv = th.querySelector('.col-header-inner') as HTMLElement;
    if (!innerDiv) return;

    const startX = e.clientX;
    const startWidth = innerDiv.offsetWidth;

    let styleTag = document.getElementById('col-resize-style');
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'col-resize-style';
      document.body.appendChild(styleTag);
    }

    let dragLine = document.getElementById('col-resize-line');
    if (!dragLine) {
      dragLine = document.createElement('div');
      dragLine.id = 'col-resize-line';
      dragLine.style.position = 'fixed';
      dragLine.style.top = '0';
      dragLine.style.bottom = '0';
      dragLine.style.width = '2px';
      dragLine.style.backgroundColor = 'var(--primary)';
      dragLine.style.zIndex = '9999';
      dragLine.style.pointerEvents = 'none';
      document.body.appendChild(dragLine);
    }
    dragLine.style.left = `${startX}px`;

    const colIdx = visibleColumnsRef.current.findIndex(c => c.id === colId);

    const onMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
      if (styleTag && colIdx !== -1) {
        styleTag.textContent = `
          html body .spreadsheet tr > :nth-child(${colIdx + 2}) {
            width: ${newWidth}px !important;
            min-width: ${newWidth}px !important;
            max-width: ${newWidth}px !important;
          }
          html body .spreadsheet tr > :nth-child(${colIdx + 2}) .col-header-inner {
            width: ${newWidth}px !important;
            min-width: ${newWidth}px !important;
            max-width: ${newWidth}px !important;
          }
          html body .spreadsheet td:nth-child(${colIdx + 2}) {
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }
        `;
      }
      if (dragLine) {
        dragLine.style.left = `${ev.clientX}px`;
      }
    };

    const onMouseUp = (ev: MouseEvent) => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      
      const newWidth = Math.max(40, startWidth + (ev.clientX - startX));
      setColWidths(prev => ({ ...prev, [colId]: newWidth }));
      updateColumnWidthMutation.mutate({ colId, width: newWidth });
      
      if (styleTag) styleTag.textContent = ''; // Clear temp style
      if (dragLine) dragLine.remove();
      
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [updateColumnWidthMutation, registerId]);


  const changeColumnTypeMutation = useMutation({
    mutationFn: () => {
      if (activeModalColId === null) throw new Error('No column selected');
      return changeColumnType(registerId, activeModalColId, changeTypeValue, {
        formula: changeTypeValue === 'formula' ? newColFormula : undefined,
        dropdownOptions: changeTypeValue === 'dropdown' ? cleanOptions(newColDropdownOpts.split(',')) : undefined,
      });
    },
    onSuccess: (updatedReg) => {
      // We now receive the full register from the backend to ensure entries are synced (e.g. for auto_increment)
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      // Invalidate to ensure any formula or sequential changes are fully propagated
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });

      const col = columnsRef.current.find(c => c.id === activeModalColId);
      if (col?.linkedTo) {
        queryClient.invalidateQueries({ queryKey: ['register', col.linkedTo.registerId] });
      }
      
      setChangeTypeModal(false); 
      setActiveModalColId(null);
      setNewColFormula('');
      setNewColDropdownOpts('');
      toast.success('Column type updated successfully');
    },
    onError: (err: any) => {
      console.error('Failed to change column type:', err);
      toast.error('Failed to update column type. Please try again.');
    }
  });

  const clearColumnDataMutation = useMutation({
    mutationFn: (colId: number) => clearColumnData(registerId, colId),
    onMutate: async (colId) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const previousRegister = queryClient.getQueryData(['register', registerId]) as any;
      const previousLocalEntries = [...localEntries];

      if (previousRegister) {
        const colIdStr = colId.toString();
        // Optimistic update
        const updatedReg = {
          ...previousRegister,
          entries: (previousRegister.entries || []).map((e: any) => {
            const newCells = { ...e.cells };
            delete newCells[colIdStr];
            return { ...e, cells: newCells };
          })
        };
        queryClient.setQueryData(['register', registerId], updatedReg);
        setLocalEntries(updatedReg.entries || []);
      }
      setColMenuId(null);
      return { previousRegister, previousLocalEntries };
    },
    onSuccess: () => {
      toast.success('Column data cleared');
    },
    onError: (_err, _colId, context) => {
      if (context?.previousRegister) queryClient.setQueryData(['register', registerId], context.previousRegister);
      if (context?.previousLocalEntries) setLocalEntries(context.previousLocalEntries);
      toast.error('Failed to clear column data');
    },
  });

  const setColumnMandatoryMutation = useMutation({
    mutationFn: ({ colId, mandatory }: { colId: number; mandatory: boolean }) =>
      setColumnMandatory(registerId, colId, mandatory),
    onMutate: async ({ colId, mandatory }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) =>
            c.id === colId ? { ...c, mandatory } : c
          ),
        });
      }
      setColMenuId(null);
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to update mandatory setting');
    },
  });

  const setColumnUniqueMutation = useMutation({
    mutationFn: ({ colId, unique }: { colId: number; unique: boolean }) =>
      setColumnUnique(registerId, colId, unique),
    onMutate: async ({ colId, unique }) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      if (prev) {
        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: (prev.columns || []).map((c: any) =>
            c.id === colId ? { ...c, unique } : c
          ),
        });
      }
      setColMenuId(null);
      return { prev };
    },
    onSuccess: (updatedReg) => {
      queryClient.setQueryData(['register', registerId], updatedReg);
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to update unique setting');
    },
  });

  const insertColumnMutation = useMutation({
    mutationFn: (vars: { 
      pos: number,           // pre-calculated, snapshot at click time
      name: string, 
      type: string, 
      dropdownOpts: string, 
      formula: string 
    }) => {
      return insertColumn(registerId, {
        name: vars.name, type: vars.type,
        dropdownOptions: vars.type === 'dropdown' ? cleanOptions(vars.dropdownOpts.split(',')) : undefined,
        formula: vars.type === 'formula' ? vars.formula : undefined,
      }, vars.pos);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const prev = queryClient.getQueryData(['register', registerId]) as any;
      const dummyId = Date.now();
      if (prev) {
        const newCol = {
          id: dummyId,
          registerId,
          name: vars.name,
          type: vars.type,
          position: vars.pos,
          dropdownOptions: vars.type === 'dropdown' ? cleanOptions(vars.dropdownOpts.split(',')) : undefined,
          formula: vars.type === 'formula' ? vars.formula : undefined,
          createdAt: new Date().toISOString()
        };
        
        // Shift all columns at or after the insert position
        const newColumns = (prev.columns || []).map((c: any) => 
          c.position >= vars.pos ? { ...c, position: c.position + 1 } : c
        );
        newColumns.push(newCol);
        newColumns.sort((a: any, b: any) => a.position - b.position);

        queryClient.setQueryData(['register', registerId], {
          ...prev,
          columns: newColumns
        });
      }
      setInsertColModal(null);
      setActiveModalColId(null);
      return { prev, dummyId };
    },
    onSuccess: (updatedReg) => {
      // updatedReg from server is authoritative — no need to invalidate/refetch
      queryClient.setQueryData(['register', registerId], updatedReg);
      setLocalEntries(updatedReg.entries || []);
      toast.success('Column inserted successfully');

      // Reset form fields
      setNewColName('');
      setNewColType('text');
      setNewColDropdownOpts('');
      setNewColFormula('');

      // Auto-scroll to the newly inserted column
      const oldCols = columnsRef.current;
      const newCol = updatedReg.columns?.find((c: any) => !oldCols.some(old => old.id === c.id));
      if (newCol) {
        setTimeout(() => {
          const colIdx = visibleColumnsRef.current.findIndex(c => c.id === newCol.id);
          if (colIdx !== -1 && colVirtualizerRef.current) {
            colVirtualizerRef.current.scrollToIndex(colIdx, { align: 'center', behavior: 'smooth' });
          } else if (parentRef.current) {
            parentRef.current.scrollTo({ left: parentRef.current.scrollLeft + 200, behavior: 'smooth' });
          }
        }, 150);
      }
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['register', registerId], context.prev);
      toast.error('Failed to insert column');
    },
    onSettled: () => { setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula(''); },
  });


  const addEntryMutation = useMutation({
    mutationFn: (initialCells: Record<string, string> = {}) => addEntry(registerId, initialCells, currentPageIndex),
    onMutate: async (initialCells: Record<string, string> = {}) => {
      // Optimistic: add a temporary row instantly
      const currentPageRows = (entriesByPage[currentPageIndex] || []).length;
      const tempEntry: Entry = {
        id: Date.now(),
        registerId,
        rowNumber: pageOffset + currentPageRows + 1,
        cells: initialCells,
        createdAt: new Date().toISOString(),
        pageIndex: currentPageIndex,
      };
      setLocalEntries((prev) => [...prev, tempEntry]);
      return { tempId: tempEntry.id };
    },
    onSuccess: (newEntry, _vars, context) => {
      // Invalidate queries for linked columns
      if (_vars) {
        Object.keys(_vars).forEach(colId => {
          const col = columnsRef.current.find(c => c.id.toString() === colId);
          if (col?.linkedTo) {
            queryClient.invalidateQueries({ queryKey: ['register', col.linkedTo.registerId] });
          }
        });
      }

      // Replace temp entry with real entry from server
      setLocalEntries((prev) => prev.map((e) => e.id === context?.tempId ? newEntry : e));
      // Patch the cache: replace temp if present, otherwise append (upsert)
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const hasTempEntry = old.entries.some((e: any) => e.id === context?.tempId);
        const updatedEntries = hasTempEntry
          ? old.entries.map((e: any) => e.id === context?.tempId ? newEntry : e)
          : [...old.entries, newEntry];
        return { ...old, entries: updatedEntries, entryCount: updatedEntries.length };
      });
      // Close the Add Record modal on success
      setShowAddRecordModal(false);
    },
    onError: (_err, _vars, context) => {
      // Roll back temp entry
      setLocalEntries((prev) => prev.filter((e) => e.id !== context?.tempId));
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (entryId: number) => deleteEntry(Number(registerId), entryId),
    onMutate: async (entryId) => {
      // 1. Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });

      // 2. Snapshot the previous value
      const previousRegister = queryClient.getQueryData(['register', registerId]);
      const previousLocalEntries = [...localEntries];

      // 4. Optimistically update to the new value
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const entries = old.entries.filter((e: any) => e.id !== entryId);
        return { ...old, entries, entryCount: entries.length };
      });
      setLocalEntries(prev => prev.filter(e => e.id !== entryId));
      setRowMenuId(null);

      // 5. Return context object with snapshotted value
      return { previousRegister, previousLocalEntries };
    },
    onError: (_err, _entryId, context) => {
      // 6. If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousRegister) {
        queryClient.setQueryData(['register', registerId], context.previousRegister);
      }
      if (context?.previousLocalEntries) {
        setLocalEntries(context.previousLocalEntries);
      }
      toast.error('Failed to delete row');
    },
    onSettled: () => {
      // 7. Always refetch after error or success to ensure we are in sync with the server
      // queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      // We might not want to invalidate every time if it's slow, but it's safer.
      // For now let's just keep it optimistic.
    },
  });

  const duplicateEntryMutation = useMutation({
    mutationFn: (entryId: number) => duplicateEntry(registerId, entryId),
    onSuccess: (newEntry) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, entries: [...old.entries, newEntry], entryCount: old.entries.length + 1 };
      });
      setLocalEntries(prev => [...prev, newEntry]);
      setRowMenuId(null);
    },
  });

  const insertEntryMutation = useMutation({
    mutationFn: ({ atIndex, cells }: { atIndex: number, cells?: Record<string, string> }) => 
      insertEntry(registerId, cells || {}, currentPageIndex, atIndex),
    onSuccess: (newEntry, { atIndex }) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const newEntries = [...old.entries];
        newEntries.splice(atIndex, 0, newEntry);
        // Update rowNumbers for entries after this index on the same page
        const updatedEntries = newEntries.map(e => {
            if (e.id !== newEntry.id && e.rowNumber >= newEntry.rowNumber) {
                return { ...e, rowNumber: e.rowNumber + 1 };
            }
            return e;
        });
        return { ...old, entries: updatedEntries, entryCount: updatedEntries.length };
      });
      
      setLocalEntries(prev => {
        const next = [...prev];
        next.splice(atIndex, 0, newEntry);
        return next.map(e => {
            if (e.id !== newEntry.id && e.rowNumber >= newEntry.rowNumber) {
                return { ...e, rowNumber: e.rowNumber + 1 };
            }
            return e;
        });
      });
      setRowMenuId(null);
      toast.success('Row added successfully');

      // Focus the first editable cell of the new row
      setTimeout(() => {
        // Find the index of the new entry in the current view (displayEntries)
        const viewIndex = displayEntries.findIndex(e => e.id === newEntry.id);
        if (viewIndex !== -1) {
          const firstCol = visibleColumns.find(c => c.type !== 'formula' && c.type !== 'image');
          if (firstCol) {
            const el = document.getElementById(`cell-${viewIndex}-${firstCol.id}`) || document.querySelector(`[data-cell="cell-${viewIndex}-${firstCol.id}"]`) as HTMLElement;
            if (el) el.focus();
          }
        }
      }, 150); // Slightly longer timeout to ensure re-render and virtualizer update
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (entryIds: number[]) => bulkDeleteEntries(registerId, entryIds),
    onMutate: async (entryIds) => {
      await queryClient.cancelQueries({ queryKey: ['register', registerId] });
      const previousRegister = queryClient.getQueryData(['register', registerId]);
      const previousLocalEntries = [...localEntries];

      // Optimistic update
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const entries = old.entries.filter((e: any) => !entryIds.includes(e.id));
        return { ...old, entries, entryCount: entries.length };
      });
      setLocalEntries(prev => prev.filter(e => !entryIds.includes(e.id)));
      setSelectedRows(new Set());

      return { previousRegister, previousLocalEntries };
    },
    onSuccess: () => {
      toast.success('Rows deleted');
    },
    onError: (_err, _vars, context) => {
      if (context?.previousRegister) queryClient.setQueryData(['register', registerId], context.previousRegister);
      if (context?.previousLocalEntries) setLocalEntries(context.previousLocalEntries);
      toast.error('Failed to delete rows');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
    },
  });

  /* Unused: addPageMutation */

  const renamePageMutation = useMutation({
    mutationFn: () => renamePage(registerId, renamePageId!, renamePageValue),
    onSuccess: () => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((p: any) => p.id === renamePageId ? { ...p, name: renamePageValue } : p) };
      });
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setRenamePageModal(false);
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: (pageId: number) => deletePage(registerId, pageId),
    onSuccess: (_data, pageId) => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        const pages = old.pages.filter((p: any) => p.id !== pageId);
        const entries = old.entries.filter((e: any) => e.pageIndex !== old.pages.find((p: any) => p.id === pageId)?.index);
        return { ...old, pages, entries, entryCount: entries.length };
      });
      queryClient.invalidateQueries({ queryKey: ['register', registerId] });
      setCurrentPageIndex(0);
    },
  });

  const shareLinkMutation = useMutation({
    mutationFn: () => generateShareLink(registerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['register', registerId] }),
  });

  const addSharedUserMutation = useMutation({
    mutationFn: () => addSharedUser(registerId, sharePhone, sharePermission),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['register', registerId] }); setSharePhone(''); },
  });

  const removeSharedUserMutation = useMutation({
    mutationFn: (userId: number) => removeSharedUser(registerId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['register', registerId] }),
  });

  // ── Validation Helper ──
  const validateCellValue = useCallback((col: any, value: string): { isValid: boolean; error: string | null } => {
    if (!value || value.trim() === '') return { isValid: true, error: null };

    if (col.type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) return { isValid: false, error: 'Invalid email format' };
    } else if (col.type === 'phone') {
      const phoneRegex = /^[\d\s+()-]{7,20}$/;
      if (!phoneRegex.test(value)) return { isValid: false, error: 'Invalid phone format (e.g. +91 1234567890)' };
    } else if (col.type === 'date') {
      // Allow partial typing in grid, but full validation in modal or on blur
      const dateRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
      if (!dateRegex.test(value)) return { isValid: false, error: 'Use DD-MM-YYYY format' };
      
      const parts = value.split('-');
      const d = parseInt(parts[0]);
      const m = parseInt(parts[1]);
      const y = parseInt(parts[2]);
      if (m < 1 || m > 12) return { isValid: false, error: 'Invalid month (1-12)' };
      const daysInMonth = new Date(y, m, 0).getDate();
      if (d < 1 || d > daysInMonth) return { isValid: false, error: `Invalid day for this month (max ${daysInMonth})` };
      if (y < 1900 || y > 2100) return { isValid: false, error: 'Year must be between 1900-2100' };
    } else if (col.type === 'number' || col.type === 'currency') {
      const numericValue = value.replace(/[^0-9.-]/g, '');
      if (numericValue === '' || isNaN(parseFloat(numericValue))) return { isValid: false, error: 'Must be a valid number' };
    } else if (col.type === 'dropdown') {
      if (col.dropdownOptions && col.dropdownOptions.length > 0) {
         // Strict single choice: value must exactly match one of the options
         const isValidOption = col.dropdownOptions.includes(value);
         if (value.trim() !== '' && !isValidOption) return { isValid: false, error: `'${value}' is not a valid option` };
      }
    } else if (col.type === 'auto_increment') {
      return { isValid: false, error: 'System generated field' };
    }

    return { isValid: true, error: null };
  }, []);

  // ── Handlers ──
  const handleCellChange = useCallback((entryId: number, columnId: string, value: string) => {
    const col = columnsRef.current.find(c => c.id.toString() === columnId);
    if (!col) return;

    // ── Column-level Edit Permissions ──
    if (_editableColumnIds && !_editableColumnIds.has(col.id)) {
      toast.error(`You do not have permission to edit the "${col.name}" column.`);
      return false;
    }

    // ── Linked Target Column Read-only ──
    if ((col as any).linkedTo && (col as any).linkedTo.role === 'target') {
      toast.error(`"${col.name}" is a linked column (To). Data comes from the source register automatically.`);
      return false;
    }

    // ── System Columns Read-only ──
    if (col.type === 'auto_increment' || col.type === 'formula') return;

    // ── Mandatory Field Validation ──
    if ((col as any).mandatory && value.trim() === '') {
      toast.error(`${col.name} is a mandatory field and cannot be empty.`);
      return false; // Return false to indicate rejection
    }

    // ── Date Normalization (Universal Enforcement of DD-MM-YYYY) ──
    if (col.type === 'date' && value.trim() !== '') {
      value = formatDateToDDMMYYYY(value);
    }

    // ── Type-Based Validation ──
    const validation = validateCellValue(col, value);
    if (!validation.isValid) {
      if (value.trim() !== '') {
        // For grid editing, we show a warning but allow the change (save as is)
        if (col.type === 'date' && value.length >= 10) {
        toast(validation.error, { icon: <AlertTriangle size={16} color="var(--warning)" /> });
        } else if (col.type === 'dropdown' || col.type === 'email' || col.type === 'phone' || col.type === 'number' || col.type === 'currency') {
        toast(validation.error, { icon: <AlertTriangle size={16} color="var(--warning)" /> });
        }
      }
    }

    // ── Double Entry Detection & Unique Enforcement ──
    if (value.trim() !== '') {
      const isDuplicate = localEntriesRef.current.some(
        e => e.id !== entryId && e.cells?.[columnId]?.trim().toLowerCase() === value.trim().toLowerCase()
      );
      if (isDuplicate) {
        if ((col as any).unique) {
          toast.error(`${col.name} is a unique field. The value "${value}" already exists.`);
          return false; // Return false to indicate rejection
        } else {
          addNotification({
            title: 'Double Entry Detected',
            message: `The value "${value}" already exists in column "${col.name}".`,
            type: 'warning',
            link: {
              registerId: String(registerId),
              rowId: entryId,
            }
          });
        }
      }
    }

    // Sync with Row Detail Modal if open for this entry — DECOUPLED MODE
    if (detailViewEntryIdRef.current === entryId) {
      setDetailEdits(prev => ({ ...prev, [columnId]: value }));
      if (detailErrorsRef.current[columnId]) setDetailErrors(prev => ({ ...prev, [columnId]: null }));
      // Return early: do NOT update main state or firestore until "Save Changes" is clicked
      return; 
    }

    // 1. Update local state instantly (optimistic)
    setLocalEntries((prev) => prev.map((e) => {
      if (e.id === entryId) {
        // If it's a dropdown, ensure we only store the new value (strict single choice)
        const updatedCells = { ...e.cells, [columnId]: value };
        return { ...e, cells: updatedCells };
      }
      return e;
    }));

    // 2. Debounce the Firestore write — use lightweight single-chunk writer
    const key = `${entryId}-${columnId}`;

    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key]);
    debounceTimers.current[key] = setTimeout(() => {
      delete debounceTimers.current[key];

      updateEntryDirect(registerId, entryId, { [columnId]: value }).then(() => {
        const col = columnsRef.current.find(c => c.id.toString() === columnId);
        if (col?.linkedTo) {
          queryClient.invalidateQueries({ queryKey: ['register', col.linkedTo.registerId] });
        }
      });
    }, 600);
    return true;
  }, [registerId, queryClient, addNotification]);

  // ── Cell Formatting ──
  const onCellFormatClick = useCallback((entryId: number, colId: string, rect: DOMRect) => {
    setFormatCell({ entryId, colId, rect });
  }, []);

  const handleCellStyleChange = useCallback((style: Partial<CellStyle>) => {
    if (!formatCell) return;
    const { entryId, colId } = formatCell;

    let mergedStyle = style;

    // 1. Optimistic local update
    setLocalEntries((prev) => prev.map((e) => {
      if (e.id === entryId) {
        const existingStyles = e.cellStyles || {};
        const existingCellStyle = existingStyles[colId] || {};
        mergedStyle = { ...existingCellStyle, ...style };
        return {
          ...e,
          cellStyles: {
            ...existingStyles,
            [colId]: mergedStyle,
          },
        };
      }
      return e;
    }));

    // 2. Persist to Firestore
    updateEntryCellStyles(registerId, entryId, { [colId]: mergedStyle }).then(() => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          entries: old.entries.map((e: any) =>
            e.id === entryId
              ? { ...e, cellStyles: { ...(e.cellStyles || {}), [colId]: mergedStyle } }
              : e
          ),
        };
      });
    });
  }, [formatCell, registerId, queryClient]);

  const handleClearCellStyle = useCallback(() => {
    if (!formatCell) return;
    const { entryId, colId } = formatCell;

    setLocalEntries((prev) => prev.map((e) => {
      if (e.id === entryId) {
        const existingStyles = { ...(e.cellStyles || {}) };
        delete existingStyles[colId];
        return { ...e, cellStyles: existingStyles };
      }
      return e;
    }));

    updateEntryCellStyles(registerId, entryId, { [colId]: {} }).then(() => {
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          entries: old.entries.map((e: any) => {
            if (e.id === entryId) {
              const styles = { ...(e.cellStyles || {}) };
              delete styles[colId];
              return { ...e, cellStyles: styles };
            }
            return e;
          }),
        };
      });
    });
  }, [formatCell, registerId, queryClient]);

  // Excel-like sort: permanently reorders localEntries and persists to Firestore
  const handleSort = useCallback((colId: number, direction: 'asc' | 'desc') => {
    setSortColId(colId);
    setSortDir(direction);

    const colDef = columns.find(c => c.id === colId);
    const colIdStr = colId.toString();

    setLocalEntries(prev => {
      const sorted = [...prev].sort((a, b) => {
        // Only sort entries on the current page; leave other pages untouched
        const aPage = a.pageIndex || 0;
        const bPage = b.pageIndex || 0;
        if (aPage !== currentPageIndex || bPage !== currentPageIndex) return 0;

        const aVal = a.cells?.[colIdStr] || '';
        const bVal = b.cells?.[colIdStr] || '';

        if (colDef?.type === 'date') {
          const dA = parseDateString(aVal);
          const dB = parseDateString(bVal);
          return direction === 'asc' ? dA.localeCompare(dB) : dB.localeCompare(dA);
        }

        const aNum = parseFloat(aVal);
        const bNum = parseFloat(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return direction === 'asc' ? aNum - bNum : bNum - aNum;
        return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

      // Persist sorted order to Firestore
      queryClient.setQueryData(['register', registerId], (old: any) => {
        if (!old) return old;
        return { ...old, entries: sorted };
      });
      // Fire Firestore write via the mutation queue
      updateEntriesOrder(registerId, sorted).catch(err => {
        console.error('Failed to save sorted order:', err);
      });

      return sorted;
    });
  }, [columns, currentPageIndex, registerId, queryClient]);

  const openDatePicker = useCallback((entryId: number, colId: number, currentVal: string, rect?: DOMRect) => {
    // Support various separators like /, . or - for parsing
    const parts = (currentVal || '').split(/[./-]/);
    setDateDay(parts[0] || ''); setDateMonth(parts[1] || ''); setDateYear(parts[2] || '');
    dateEntryIdRef.current = entryId;
    dateColumnIdRef.current = colId;
    dateRectRef.current = rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
    setDateModal(true);
  }, []);

  const handleDateSelect = useCallback((d?: string, m?: string, y?: string) => {
    if (d === '' && m === '' && y === '') {
      setDateDay('');
      setDateMonth('');
      setDateYear('');
      if (dateEntryId != null && dateColumnId != null) {
        handleCellChange(dateEntryId, dateColumnId.toString(), '');
      }
      setDateModal(false);
      return;
    }

    // Basic day-month-year validation already happened in OtherModals or is passed in
    const finalD = d || dateDay;
    const finalM = m || dateMonth;
    const finalY = y || dateYear;
    
    // Sync state in case we need it for other UI
    if (d) setDateDay(d);
    if (m) setDateMonth(m);
    if (y) setDateYear(y);

    const dateStr = `${finalD.padStart(2, '0')}-${finalM.padStart(2, '0')}-${finalY}`;
    
    if (dateEntryId != null && dateColumnId != null) {
      const col = columns.find(c => c.id === dateColumnId);
      const validation = validateCellValue(col, dateStr);
      
      if (!validation.isValid) {
        toast(validation.error, { icon: <AlertTriangle size={16} color="var(--warning)" /> });
      }
      
      handleCellChange(dateEntryId, dateColumnId.toString(), dateStr);
    }
    setDateModal(false);
  }, [dateDay, dateMonth, dateYear, dateEntryId, dateColumnId, columns, handleCellChange, validateCellValue]);

  const openDropdown = useCallback((entryId: number, colId: number, options: string[], rect?: DOMRect) => {
    dropdownEntryIdRef.current = entryId;
    dropdownColumnIdRef.current = colId;
    dropdownOptionsRef.current = options;
    dropdownRectRef.current = rect ? { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width } : null;
    setDropdownModal(true);
  }, []);
  // ── Export Functions (extracted to useExport hook for code splitting) ──
  const {
    handleExportExcel,
    handleExportPDF,
    handleRowDownloadPDF,
    handleRowDownloadExcel,
    handleRowShareText,
  } = useExport({
    register,
    columns,
    displayEntries,
    localEntries,
    hiddenColumns,
    selectedRows,
    calcTypes,
    colWidths,
    rowDownloadRange,
    downloadableColumnIds,
    selectedColumns,
    isPreviewSelectedColumns,
  });





  const toggleSelectRow = useCallback((id: number) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
      return newSet;
    });
  }, []);

  const toggleMenu = useCallback((id: number) => {
    setRowMenuId(prev => (prev === id ? null : id));
  }, []);

  const handleTableMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('fill-handle')) {
      e.preventDefault();
      const rowIdx = parseInt(target.getAttribute('data-row-idx') || '-1');
      const colId = target.getAttribute('data-col-id');
      if (rowIdx < 0 || !colId) return;

      const startVal = localEntries[rowIdx]?.cells?.[colId] || '';
      let currentEndIdx = rowIdx;
      
      const onMouseMove = (ev: MouseEvent) => {
        const hoverTarget = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement;
        if (!hoverTarget) return;
        const cellWrapper = hoverTarget.closest('.cell-inner-wrapper');
        if (!cellWrapper) return;
        const handle = cellWrapper.querySelector('.fill-handle') as HTMLElement;
        if (!handle) return;
        
        const hColId = handle.getAttribute('data-col-id');
        const hRowIdx = parseInt(handle.getAttribute('data-row-idx') || '-1');
        
        if (hColId === colId && hRowIdx >= 0 && hRowIdx !== currentEndIdx) {
          currentEndIdx = hRowIdx;
          document.querySelectorAll('.drag-fill-target').forEach(el => el.classList.remove('drag-fill-target'));
          const min = Math.min(rowIdx, currentEndIdx);
          const max = Math.max(rowIdx, currentEndIdx);
          for (let i = min; i <= max; i++) {
            const el = document.querySelector(`.fill-handle[data-row-idx="${i}"][data-col-id="${colId}"]`)?.parentElement;
            if (el) el.classList.add('drag-fill-target');
          }
        }
      };
      
      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        document.querySelectorAll('.drag-fill-target').forEach(el => el.classList.remove('drag-fill-target'));
        
        if (currentEndIdx !== rowIdx) {
          const min = Math.min(rowIdx, currentEndIdx);
          const max = Math.max(rowIdx, currentEndIdx);
          for (let i = min; i <= max; i++) {
            if (i === rowIdx) continue;
            const entry = localEntries[i];
            if (entry && entry.cells?.[colId] !== startVal) {
              handleCellChange(entry.id, colId, startVal);
            }
          }
        }
      };
      
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  }, [localEntries, handleCellChange]);

  const visibleColumns = useMemo(() => {
    let visible = columns.filter((col) => !hiddenColumns.has(col.id));
    if (isPreviewSelectedColumns && selectedColumns.size > 0) {
      visible = visible.filter((col) => selectedColumns.has(col.id));
    }
    const frozen = visible.filter((col) => frozenColumns.has(col.id));
    const unfrozen = visible.filter((col) => !frozenColumns.has(col.id));
    return [...frozen, ...unfrozen];
  }, [columns, hiddenColumns, frozenColumns, isPreviewSelectedColumns, selectedColumns]);
  // Keep refs in sync for smooth drag handler closures
  visibleColumnsRef.current = visibleColumns;
  columnsRef.current = columns;

  // ── Fixed viewport grid: exactly 6 columns × 9 rows visible ──
  // Measure the actual container to compute column/row sizing dynamically
  const TARGET_COLS = 4;
  const TARGET_ROWS = 9;
  const SERIAL_COL_W = 50; // S.NO column width
  const HEADER_OVERHEAD = 42; // column header row height

  const [wrapperSize, setWrapperSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setWrapperSize((prev) =>
        prev.w === Math.round(width) && prev.h === Math.round(height)
          ? prev
          : { w: Math.round(width), h: Math.round(height) }
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Column width: fill 6 columns exactly into available width
  const defaultColWidth = useMemo(() => {
    if (wrapperSize.w > 0) {
      return Math.max(160, Math.floor((wrapperSize.w - SERIAL_COL_W) / TARGET_COLS));
    }
    return 240; 
  }, [wrapperSize.w]);

  // Row height: fixed compact height (27px)
  const dynamicRowHeight = 27;


  // stats recalculation depends directly on displayEntries for live updates

  // Column statistics (extracted to useColumnStats hook)
  const columnStats = useColumnStats({
    register,
    columns,
    visibleColumns,
    displayEntries,
    selectedRows,
    calcTypes,
  });


  // ── Virtualization ──
  // Always-on virtualization for both rows AND columns.
  // With 200+ columns, rendering all cols even for 30 visible rows = 6,000+ DOM nodes.
  // Column virtualization is the critical fix for large horizontal datasets.
  //
  // Threshold: virtualize whenever >50 rows OR >20 columns to keep the DOM lean.
  const VIRTUALIZATION_THRESHOLD = 50;
  const COL_VIRTUALIZATION_THRESHOLD = 20;
  const useVirtual = displayEntries.length > VIRTUALIZATION_THRESHOLD || visibleColumns.length > COL_VIRTUALIZATION_THRESHOLD;
  const useColVirtual = visibleColumns.length > COL_VIRTUALIZATION_THRESHOLD;

  const parentRef = useRef<HTMLDivElement>(null);

  // Read initial scroll synchronously so virtualizer can use it on first render
  const initialScrollRef = useRef<{ left: number, top: number } | null>(null);
  if (!initialScrollRef.current) {
    try {
      const saved = sessionStorage.getItem(`rb_scroll_${registerId}`);
      if (saved) {
        initialScrollRef.current = JSON.parse(saved);
      }
    } catch {}
    if (!initialScrollRef.current) initialScrollRef.current = { left: 0, top: 0 };
  }

  // Provide initialRect to virtualizers to prevent 0-item render when parent size is not yet observed
  const initialRect = typeof window !== 'undefined' ? { width: window.innerWidth, height: window.innerHeight } : { width: 1200, height: 800 };

  // ── Row virtualizer ──
  const rowVirtualizer = useVirtualizer({
    count: displayEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => dynamicRowHeight, [dynamicRowHeight]),
    overscan: 10,
    enabled: useVirtual,
    initialOffset: initialScrollRef.current?.top || 0,
    initialRect,
    getItemKey: useCallback((index: number) => {
      const entry = displayEntries[index];
      return entry ? entry.id : index;
    }, [displayEntries]),
  });

  // ── Scroll to row from ?row= URL parameter (global search navigation) ──
  // Step 1: Parse the URL param and set up the scroll target
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const rowParam = params.get('row');
    if (rowParam) {
      const entryId = Number(rowParam);
      scrollToRowIdRef.current = entryId;

      // Clear any active search/filters so the target row is visible
      setSearch('');
      setActiveFilters([]);

      // Find the correct page for this entry
      const targetEntry = localEntries.find(e => e.id === entryId);
      if (targetEntry) {
        const targetPage = targetEntry.pageIndex ?? 0;
        setCurrentPageIndex(targetPage);
      }

      // Clean up the URL param so refreshing doesn't re-scroll
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [location.search, localEntries]);

  // Step 2: Once displayEntries + virtualizer are ready, scroll to the target row
  useEffect(() => {
    const targetEntryId = scrollToRowIdRef.current;
    if (!targetEntryId || !displayEntries || displayEntries.length === 0) return;

    const rowIndex = displayEntries.findIndex(e => e.id === targetEntryId);
    if (rowIndex === -1) return;

    // Clear ref so we don't re-scroll
    scrollToRowIdRef.current = null;

    // Use a short timeout to let the virtualizer measure and settle
    const timerId = setTimeout(() => {
      try {
        rowVirtualizer.scrollToIndex(rowIndex, { align: 'center', behavior: 'smooth' });
      } catch { /* virtualizer may not be ready yet */ }

      // After scrolling, highlight the target row
      setTimeout(() => {
        const rowEl = document.getElementById(`row-${targetEntryId}`);
        if (rowEl) {
          rowEl.classList.add('search-target-row');
          setTimeout(() => rowEl.classList.remove('search-target-row'), 2500);
        }
      }, 500);
    }, 200);

    return () => clearTimeout(timerId);
  }, [displayEntries, rowVirtualizer]);

  // Scroll persistence on refresh/remount/register switch
  const isRestoringScroll = useRef(false);
  const lastRestoredRegisterId = useRef<number | null>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  useLayoutEffect(() => {
    // Only restore once per register ID, and only when we have data to scroll into
    if (parentRef.current && displayEntries.length > 0 && lastRestoredRegisterId.current !== registerId) {
      lastRestoredRegisterId.current = registerId;
      try {
        const saved = sessionStorage.getItem(`rb_scroll_${registerId}`);
        if (saved) {
          const { left, top } = JSON.parse(saved);
          if (!scrollToRowIdRef.current) {
            isRestoringScroll.current = true;
            // Native scroll for the DOM element
            parentRef.current.scrollTo(left, top);
            // Also notify virtualizers directly so their internal states sync immediately
            rowVirtualizer.scrollToOffset(top, { align: 'start' });
            colVirtualizer.scrollToOffset(left, { align: 'start' });
            // Allow a small window for the browser to emit the scroll event from scrollTo
            setTimeout(() => { isRestoringScroll.current = false; }, 100);
          }
        }
      } catch (e) {}
    }
  }, [displayEntries.length, registerId]);
  // Row virtualizer ──

  // Column virtualizer (horizontal) ──
  // Uses the same scroll container (parentRef) but scrolls horizontally.
  // The serial S.No column (50px) + actions column (44px) are rendered outside the virtualizer.
  const colVirtualizer = useVirtualizer({
    count: visibleColumns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback((idx: number) => {
      const col = visibleColumns[idx];
      return col ? (colWidths[col.id] || defaultColWidth) : defaultColWidth;
    }, [visibleColumns, colWidths, defaultColWidth]),
    horizontal: true,
    overscan: 5,
    enabled: useColVirtual,
    initialOffset: initialScrollRef.current?.left || 0,
    initialRect,
  });
  colVirtualizerRef.current = colVirtualizer;

  const virtualRows = useVirtual ? rowVirtualizer.getVirtualItems() : displayEntries.map((e, i) => ({ index: i, start: i * dynamicRowHeight, end: (i + 1) * dynamicRowHeight, size: dynamicRowHeight, key: e?.id ?? i, lane: 0 }));
  const virtualCols = useColVirtual ? colVirtualizer.getVirtualItems() : visibleColumns.map((_, i) => ({ index: i, start: 0, end: 0, size: colWidths[visibleColumns[i]?.id] || defaultColWidth, key: i, lane: 0 }));

  const totalVirtualHeight = useVirtual ? rowVirtualizer.getTotalSize() : displayEntries.length * dynamicRowHeight;
  const totalVirtualWidth = useColVirtual ? colVirtualizer.getTotalSize() : visibleColumns.reduce((sum, col) => sum + (colWidths[col.id] || defaultColWidth), 0);
  
  const paddingTop = useVirtual && virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom = useVirtual && virtualRows.length > 0 ? totalVirtualHeight - virtualRows[virtualRows.length - 1].end : 0;
  // Horizontal padding for the column virtualizer
  let paddingLeft = useColVirtual && virtualCols.length > 0 ? virtualCols[0].start : 0;
  let paddingRight = useColVirtual && virtualCols.length > 0 ? totalVirtualWidth - virtualCols[virtualCols.length - 1].end : 0;

  const beforeVirtualCols: { index: number }[] = [];
  const afterVirtualCols: { index: number }[] = [];

  if (useColVirtual && virtualCols.length > 0) {
    const firstIdx = virtualCols[0].index;
    const lastIdx = virtualCols[virtualCols.length - 1].index;

    visibleColumns.forEach((col, i) => {
      if (frozenColumns.has(col.id)) {
        if (i < firstIdx) {
          beforeVirtualCols.push({ index: i });
          paddingLeft -= (colWidths[col.id] || defaultColWidth);
        } else if (i > lastIdx) {
          afterVirtualCols.push({ index: i });
          paddingRight -= (colWidths[col.id] || defaultColWidth);
        }
      }
    });
  }

  const frozenLeftOffsets = useMemo(() => {
    const offsets: Record<number, number> = {};
    let left = 64; // S.No column (widened to fit checkbox & row options)
    for (const vc of visibleColumns) {
      if (frozenColumns.has(vc.id)) {
        offsets[vc.id] = left;
        left += colWidths[vc.id] || defaultColWidth;
      }
    }
    return offsets;
  }, [visibleColumns, frozenColumns, colWidths, defaultColWidth]);

  const handleLinkIconClick = useCallback(async (e: React.MouseEvent, col: any) => {
    e.stopPropagation();
    if (!col.linkedTo) return;
    
    const loadingToastId = toast.loading('Fetching link details...');
    try {
      const reg = await getRegister(col.linkedTo.registerId);
      const targetCol = reg.columns?.find((c: any) => c.id === col.linkedTo.columnId);
      
      toast.dismiss(loadingToastId);
      setLinkInfoModal({
        registerName: reg.name,
        columnName: targetCol ? targetCol.name : 'Unknown Column',
        role: col.linkedTo.role || 'unknown',
        columnId: col.id,
        linkedRegisterId: col.linkedTo.registerId
      });
    } catch (err) {
      console.error(err);
      toast.dismiss(loadingToastId);
      toast.error('Failed to load link details');
    }
  }, []);

  if (isLoading) return (
    <div className="content-area">
      <div className="book-loader-wrapper">
        <div className="book-loader">
          <div className="page" />
          <div className="page" />
          <div className="page" />
        </div>
        <span className="center-loader-text" style={{ marginTop: '20px' }}>Loading register…</span>
      </div>
    </div>
  );
  if (!register) return <div className="empty-state"><p>Register not found</p></div>;

  return (
    <div className="content-area">
      {/* ── Header ── */}
      <div className="register-header">
        <div className="register-header-left">
          <button className="register-header-back-btn" onClick={() => navigate('/')}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="register-header-title">{register.name}</h1>
          
          {_canEditAny && (
            <button className="pab-tab-action-btn primary header-add-btn" onClick={() => setShowAddRecordModal(true)}>
              <Plus size={12} /> Add Row
            </button>
          )}
        </div>

        <div className="register-header-right">
          <RegisterToolbar
            search={search}
            setSearch={setSearch}
            filters={filters}
            activeFilters={activeFilters}
            setFilters={setFilters}
            setActiveFilters={setActiveFilters}
            filterModal={filterModal}
            setFilterModal={setFilterModal}
            addEntryMutation={addEntryMutation}
            setNewColName={setNewColName}
            setNewColType={setNewColType}
            setNewColDropdownOpts={setNewColDropdownOpts}
            setNewColFormula={setNewColFormula}
            setNewColumnModal={setNewColumnModal}
            hiddenColumns={hiddenColumns}
            selectedRows={selectedRows}
            rowCount={displayEntries.length}
            columns={columns}
            bulkDeleteMutation={bulkDeleteMutation}
            setManageColsMenu={setManageColsMenu}
            entries={localEntries}
            canEdit={_canEditAny}
            allColumnsCount={register?.columns?.length || 0}
            selectedColumns={selectedColumns}
            isPreviewSelectedColumns={isPreviewSelectedColumns}
            setIsPreviewSelectedColumns={setIsPreviewSelectedColumns}
          />
          
          <RegisterHeader 
            register={register} 
            setShareModal={setShareModal} 
            handleOpenExport={() => setShowExportModal(true)}
            canDownload={_canDownloadAny}
            canEdit={_canEditAny}
            onViewReminders={() => setShowRemindersSummary(true)}
          />
        </div>
      </div>




      {/* ── Spreadsheet ── */}
      <div 
        ref={parentRef}
        className="spreadsheet-wrapper" 
        key={`grid-${columns.length}-${columns.map(c => c.id).join('-')}`}
        onMouseDown={_canEditAny ? handleTableMouseDown : undefined}
        onScroll={(e) => {
          if (isRestoringScroll.current) return;
          const target = e.currentTarget;
          const left = target.scrollLeft;
          const top = target.scrollTop;
          
          if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
          scrollTimeoutRef.current = setTimeout(() => {
            sessionStorage.setItem(`rb_scroll_${registerId}`, JSON.stringify({ left, top }));
          }, 150);
        }}
        style={{ '--dynamic-row-height': `${dynamicRowHeight}px` } as React.CSSProperties}
      >
        <table className={`spreadsheet ${_canEditAny ? '' : 'readonly-access'}`}>
          <thead>
            <tr>
              <th className="serial">
                <div 
                  className="serial-inner" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: selectedRows.size > 0 ? 'flex-start' : 'center', 
                    gap: '2px', 
                    width: '100%', 
                    height: '100%' 
                  }}
                >
                  {selectedRows.size > 0 && (
                    <>
                      <div style={{ width: '14px', flexShrink: 0 }} /> {/* Spacer matching row options ⋮ button */}
                      <input
                        type="checkbox"
                        className="row-select-checkbox"
                        checked={displayEntries.length > 0 && selectedRows.size === displayEntries.length}
                        ref={(el) => { if (el) el.indeterminate = selectedRows.size > 0 && selectedRows.size < displayEntries.length; }}
                        onChange={() => {
                          if (selectedRows.size === displayEntries.length) {
                            setSelectedRows(new Set());
                          } else {
                            setSelectedRows(new Set(displayEntries.map(e => e.id)));
                          }
                        }}
                        tabIndex={-1}
                        title="Select All"
                      />
                    </>
                  )}
                  <span style={{ fontSize: '11px', fontWeight: 700 }}>S.NO</span>
                </div>
              </th>
              {(() => {
                const elements: { type: 'cell' | 'pad-left' | 'pad-right', vc?: { index: number } }[] = [];
                if (useColVirtual) {
                  beforeVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
                  if (paddingLeft > 0) elements.push({ type: 'pad-left' });
                  virtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
                  if (paddingRight > 0) elements.push({ type: 'pad-right' });
                  afterVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
                } else {
                  visibleColumns.forEach((_, i) => elements.push({ type: 'cell', vc: { index: i } }));
                }

                return elements.map((el) => {
                  if (el.type === 'pad-left') {
                    return <th key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none' }} />;
                  }
                  if (el.type === 'pad-right') {
                    return <th key="pad-right" className="spacer" style={{ width: paddingRight, minWidth: paddingRight, padding: 0, border: 'none' }} />;
                  }

                  const vc = el.vc!;
                  const col = visibleColumns[vc.index];
                  if (!col) return null;
                  const IconComponent = <ColumnIcon type={col.type} size={12} />;

                  const isFrozen = frozenColumns.has(col.id);
                  const stickyLeft = isFrozen ? frozenLeftOffsets[col.id] : undefined;
                  const colW = colWidths[col.id] || defaultColWidth;

                  return (
                  <th
                    key={col.id}
                    className={`col-header-cell ${draggedColumnId === col.id ? 'dragging' : ''}${isFrozen ? ' frozen-col' : ''}`}
                    ref={(el) => {
                      if (el) colHeaderRefs.current.set(col.id, el);
                      else colHeaderRefs.current.delete(col.id);
                    }}
                    style={isFrozen
                      ? { position: 'sticky', left: stickyLeft, zIndex: 13, background: 'var(--border-light)', width: colW, minWidth: colW, maxWidth: colW }
                      : { width: colW, minWidth: colW, maxWidth: colW }
                    }
                  >
                    <div 
                      className="col-header-inner"
                      title="Click for options, Drag to reorder"
                      onMouseDown={(e) => handleColDragMouseDown(e, col.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (colMenuId === col.id) {
                          setColMenuId(null);
                          setColMenuRect(null);
                        } else {
                          const th = (e.currentTarget as HTMLElement).closest('th');
                          if (th) setColMenuRect(th.getBoundingClientRect());
                          setColMenuId(col.id);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <input
                        type="checkbox"
                        className="col-header-select-checkbox"
                        checked={selectedColumns.has(col.id)}
                        onChange={(e) => {
                          const next = new Set(selectedColumns);
                          if (e.target.checked) {
                            next.add(col.id);
                          } else {
                            next.delete(col.id);
                          }
                          setSelectedColumns(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        title="Select column"
                      />
                      {IconComponent}
                      <span className="col-header-name">
                        {col.name}
                        {(col as any).mandatory && (
                          <span title="Mandatory field" style={{ color: 'var(--primary)', fontWeight: 900, marginLeft: 2, fontSize: '13px' }}>*</span>
                        )}
                        {(col as any).unique && (
                          <span title="Unique field" style={{ color: 'var(--primary)', fontWeight: 900, marginLeft: 2, fontSize: '12px' }}>★</span>
                        )}
                        {col.type === 'formula' && <span className="col-formula-badge" title={col.formula}>Fx</span>}
                        {col.linkedTo && (
                          <>
                            <button 
                              onClick={(e) => handleLinkIconClick(e, col)}
                              onMouseDown={(e) => e.stopPropagation()}
                              title="Click to view link details"
                              style={{ 
                                background: 'none', 
                                border: 'none', 
                                padding: 0, 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                cursor: 'pointer',
                                marginLeft: '4px'
                              }}
                            >
                              <LinkIcon size={12} color="var(--primary)" />
                            </button>
                            {col.linkedTo.role === 'target' && (
                              <span title="Read-only — data synced from source" style={{ marginLeft: '2px', display: 'inline-flex', alignItems: 'center', opacity: 0.6 }}>
                                <Lock size={10} color="var(--muted)" />
                              </span>
                            )}
                          </>
                        )}
                      </span>
                      {sortColId === col.id && sortDir && (
                        <span className="sort-indicator" title={sortDir === 'asc' ? 'Sorted A→Z' : 'Sorted Z→A'}>
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                      {frozenColumns.has(col.id) && <Pin size={10} color="var(--muted)" className="frozen-pin" />}
                      <div
                        className="col-resize-handle"
                        onMouseDown={(e) => {
                          e.stopPropagation(); // Prevent triggering column options/drag when resizing
                          handleColResizeMouseDown(e, col.id);
                        }}
                      />
                    </div>
                  </th>
                )});
              })()}
              <th className="actions" style={{ width: '50px', minWidth: '50px', padding: 0, position: 'sticky', right: 0, zIndex: 14, background: 'var(--table-bg)', borderLeft: '1px solid var(--border-light)' }}>
                {_canEditAny && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNewColumnModal(true);
                    }}
                    title="Add Column"
                    style={{
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--muted)', width: '100%', height: '100%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    <Plus size={16} strokeWidth={2.5} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {/* Top row spacer for virtualized rows */}
            {paddingTop > 0 && (
              <tr>
                <td className="spacer" style={{ height: `${paddingTop}px`, padding: 0, border: 'none', lineHeight: 0 }} colSpan={visibleColumns.length + 4} />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const entry = displayEntries[virtualRow.index];
              if (!entry) return null;
              
              return (
                <SpreadsheetRow
                  key={virtualRow.key}
                  entry={entry}
                  idx={virtualRow.index}
                  displayRowNumber={(deferredSearch.trim() || deferredActiveFilters.length > 0) ? entry.rowNumber : (pageOffset + virtualRow.index + 1)}
                  visibleColumns={visibleColumns}
                  virtualCols={useColVirtual ? virtualCols : undefined}
                  beforeVirtualCols={useColVirtual ? beforeVirtualCols : undefined}
                  afterVirtualCols={useColVirtual ? afterVirtualCols : undefined}
                  paddingLeft={useColVirtual ? paddingLeft : 0}
                  paddingRight={useColVirtual ? paddingRight : 0}
                  scrollToColumn={useColVirtual ? (colIdx) => colVirtualizer.scrollToIndex(colIdx, { align: 'auto' }) : undefined}
                  isSelected={selectedRows.has(entry.id)}
                  toggleSelectRow={toggleSelectRow}
                  handleCellChange={(eid, cid, val) => {
                    if (_editableColumnIds && !_editableColumnIds.has(Number(cid))) return;
                    handleCellChange(eid, cid, val);
                  }}
                  openDatePicker={openDatePicker}
                  openDropdown={openDropdown}
                  isMenuOpen={rowMenuId === entry.id}
                  toggleMenu={toggleMenu}
                  registerColumns={columns}
                  onRowDetail={setDetailViewEntry}
                  onImagePreview={setPreviewImage}
                  frozenColumns={frozenColumns}
                  frozenLeftOffsets={frozenLeftOffsets}
                  colWidths={colWidths}
                  defaultColWidth={defaultColWidth}
                  totalRows={displayEntries.length}
                  rowHeight={dynamicRowHeight}
                  onCellFormatClick={onCellFormatClick}
                  searchTerm={deferredSearch || undefined}
                  editableColumnIds={_editableColumnIds}
                  columnSuggestions={columnSuggestions}
                />
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td className="spacer" style={{ height: `${paddingBottom}px`, padding: 0, border: 'none', lineHeight: 0 }} colSpan={visibleColumns.length + 4} />
              </tr>
            )}
            {/* Empty state when search/filter yields no results */}
            {displayEntries.length === 0 && (deferredSearch || deferredActiveFilters.length > 0) && (
              <tr>
                <td colSpan={visibleColumns.length + 3} style={{
                  textAlign: 'center', padding: '48px 20px', color: '#94a3b8',
                  fontSize: '14px', fontWeight: 500, background: 'var(--table-bg)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <Search size={32} style={{ opacity: 0.3 }} />
                    <span>No matching records found</span>
                    {deferredSearch && <span style={{ fontSize: '12px', color: '#b0b8c9' }}>Try a different search term or clear filters</span>}
                    <button
                      onClick={() => { setSearch(''); setActiveFilters([]); }}
                      style={{
                        marginTop: '8px', padding: '6px 16px', borderRadius: '6px',
                        border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
                        fontSize: '12px', color: '#475569', fontWeight: 500,
                      }}
                    >Clear search & filters</button>
                  </div>
                </td>
              </tr>
            )}
            {displayEntries.length === 0 && !deferredSearch && deferredActiveFilters.length === 0 && columns.length > 0 && [1, 2, 3].map((n) => (
              <tr key={`mock-${n}`} className="mock" onClick={_canEditAny ? () => setShowAddRecordModal(true) : undefined}>
                <td className="serial">
                  <div className="serial-inner">
                    <span>{n}</span>
                  </div>
                </td>
                {visibleColumns.map((col) => (
                  <td key={col.id}><div className="mock-cell-content">&nbsp;</div></td>
                ))}
                <td className="actions" style={{ width: '50px', minWidth: '50px', background: 'var(--table-bg)', borderLeft: '1px solid var(--border)' }} />
              </tr>
            ))}
          </tbody>
            {columns.length > 0 && (() => {
              return (
              <RegisterSummaryRow
                visibleColumns={visibleColumns}
                calcTypes={calcTypes}
                calcMenu={calcMenu}
                onCalcClick={handleCalcCellClick}
                onAddRecord={() => addEntryMutation.mutate({})}
                useColVirtual={useColVirtual}
                virtualCols={virtualCols}
                beforeVirtualCols={beforeVirtualCols}
                afterVirtualCols={afterVirtualCols}
                paddingLeft={paddingLeft}
                paddingRight={paddingRight}
                columnStats={columnStats}
                frozenColumns={frozenColumns}
                frozenLeftOffsets={frozenLeftOffsets}
                colWidths={colWidths}
                defaultColWidth={defaultColWidth}
                canEdit={_canEditAny}
              />
              );
            })()}
          </table>
        </div>

      {/* ── Floating Selection Toolbar ── */}
      {selectedRows.size > 0 && (
        <div className="selection-toolbar">
          <div className="selection-toolbar-info">
            <CheckSquare size={16} />
            <span><strong>{selectedRows.size}</strong> row{selectedRows.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="selection-toolbar-actions">
            <button
              className="selection-toolbar-btn excel"
              onClick={() => {
                const targetColIds = columns
                  .filter(c => {
                    if (hiddenColumns.has(c.id)) return false;
                    if (c.type === 'image') return false;
                    if (downloadableColumnIds && !downloadableColumnIds.has(c.id)) return false;
                    if (isPreviewSelectedColumns && selectedColumns.size > 0 && !selectedColumns.has(c.id)) return false;
                    return true;
                  })
                  .map(c => c.id);
                handleExportExcel({
                  format: 'excel',
                  exportRows: 'selected',
                  selectedColumnIds: new Set(targetColIds),
                  includeHeading: true,
                  includeDateTime: false,
                });
              }}
            >
              <Download size={14} /> Excel
            </button>
            <button
              className="selection-toolbar-btn pdf"
              onClick={() => {
                const targetColIds = columns
                  .filter(c => {
                    if (hiddenColumns.has(c.id)) return false;
                    if (c.type === 'image') return false;
                    if (downloadableColumnIds && !downloadableColumnIds.has(c.id)) return false;
                    if (isPreviewSelectedColumns && selectedColumns.size > 0 && !selectedColumns.has(c.id)) return false;
                    return true;
                  })
                  .map(c => c.id);
                handleExportPDF({
                  format: 'pdf',
                  exportRows: 'selected',
                  selectedColumnIds: new Set(targetColIds),
                  includeHeading: true,
                  includeDateTime: false,
                });
              }}
            >
              <FileText size={14} /> PDF
            </button>
            <button
              className="selection-toolbar-btn delete"
              onClick={() => {
                if (confirm(`Delete ${selectedRows.size} selected row(s)?`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedRows));
                }
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
            <button
              className="selection-toolbar-btn clear"
              onClick={() => setSelectedRows(new Set())}
              title="Clear selection"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {/* ── Context Menus ── */}
      <RegisterContextMenus 
        colMenuId={colMenuId} colMenuRect={colMenuRect} setColMenuId={setColMenuId} columns={columns}
        setActiveModalColId={setActiveModalColId}
        handleSort={handleSort}
        setRenameColValue={setRenameColValue} setRenameColModal={setRenameColModal}
        setChangeTypeValue={setChangeTypeValue} setChangeTypeModal={setChangeTypeModal}
        setDropdownConfigOptions={setDropdownConfigOptions} setDropdownConfigModal={setDropdownConfigModal} setLinkColumnModal={setLinkColumnModal}
        duplicateColumnMutation={duplicateColumnMutation}
        setNewColName={setNewColName} setNewColType={setNewColType} setNewColDropdownOpts={setNewColDropdownOpts} setNewColFormula={setNewColFormula}
        setInsertColModal={setInsertColModal} moveColumnMutation={moveColumnMutation}
        frozenColumns={frozenColumns} setFrozenColumns={setFrozenColumns} freezeColumn={freezeColumn} registerId={registerId}
        hiddenColumns={hiddenColumns} setHiddenColumns={setHiddenColumns} hideColumn={hideColumn}
        clearColumnDataMutation={clearColumnDataMutation} deleteColumnMutation={deleteColumnMutation}
        setColumnMandatoryMutation={setColumnMandatoryMutation}
        setColumnUniqueMutation={setColumnUniqueMutation}
        rowMenuId={rowMenuId} setRowMenuId={setRowMenuId}
        duplicateEntryMutation={duplicateEntryMutation} deleteEntryMutation={deleteEntryMutation}
        insertEntryMutation={insertEntryMutation}
        localEntries={localEntries}
        handleRowDownloadPDF={handleRowDownloadPDF}
        handleRowDownloadExcel={handleRowDownloadExcel}
        handleRowShareText={handleRowShareText}
        calcTypes={calcTypes}
        updateCalcType={updateCalcType}
        manageColsMenu={manageColsMenu}
        setManageColsMenu={setManageColsMenu}
        canEdit={_canEditAny}
        selectedColumns={selectedColumns}
        isPreviewSelectedColumns={isPreviewSelectedColumns}
      />

      {/* ── Modals ── */}
      <ColumnModals 
        newColumnModal={newColumnModal} setNewColumnModal={setNewColumnModal}
        insertColModal={insertColModal} setInsertColModal={setInsertColModal}
        newColName={newColName} setNewColName={setNewColName}
        newColType={newColType} setNewColType={setNewColType}
        newColDropdownOpts={newColDropdownOpts} setNewColDropdownOpts={setNewColDropdownOpts}
        newColFormula={newColFormula} setNewColFormula={setNewColFormula}
        addColumnMutation={addColumnMutation} insertColumnMutation={insertColumnMutation}
        renameColModal={renameColModal} setRenameColModal={setRenameColModal}
        renameColValue={renameColValue} setRenameColValue={setRenameColValue} renameColumnMutation={renameColumnMutation}
        dropdownConfigModal={dropdownConfigModal} setDropdownConfigModal={setDropdownConfigModal}
        dropdownConfigOptions={dropdownConfigOptions} setDropdownConfigOptions={setDropdownConfigOptions} updateDropdownMutation={updateDropdownMutation}
        changeTypeModal={changeTypeModal} setChangeTypeModal={setChangeTypeModal}
        changeTypeValue={changeTypeValue} setChangeTypeValue={setChangeTypeValue} changeColumnTypeMutation={changeColumnTypeMutation}
        linkColumnModal={linkColumnModal} setLinkColumnModal={setLinkColumnModal}
        activeModalColId={activeModalColId}
        COL_TYPES={COL_TYPES}
        columns={columns}
        entries={localEntries}
        allRegisters={allRegisters}
        currentRegisterId={registerId}
      />

      {linkInfoModal && (
        <div className="modal-overlay" onClick={() => { setLinkInfoModal(null); setShowUnlinkConfirm(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LinkIcon size={18} color="var(--primary)" /> Link Connection Details
            </h3>
            
            <div style={{ margin: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ background: 'var(--bg-light)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Connection Role</span>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: 700, 
                  color: linkInfoModal.role === 'source' ? '#16a34a' : linkInfoModal.role === 'target' ? '#2563eb' : 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '4px'
                }}>
                  {linkInfoModal.role === 'source' ? 'From Column (Source Column)' : linkInfoModal.role === 'target' ? 'To Column (Destination Column)' : 'Linked Column'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Linked Register</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy)', display: 'block', marginTop: '2px' }}>
                  📂 {linkInfoModal.registerName}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Linked Column</span>
                <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--navy)', display: 'block', marginTop: '2px' }}>
                  📊 {linkInfoModal.columnName}
                </span>
              </div>
            </div>

            {showUnlinkConfirm ? (
              <div style={{ 
                margin: '16px 0 0 0', 
                padding: '14px', 
                background: 'rgba(239, 68, 68, 0.06)', 
                border: '1px solid rgba(239, 68, 68, 0.2)', 
                borderRadius: '8px'
              }}>
                <h4 style={{ color: '#dc2626', fontSize: '13px', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <AlertTriangle size={16} /> Are you absolutely sure?
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--text-main)', margin: '0 0 12px 0', lineHeight: '1.4' }}>
                  Unlinking will disconnect the live data sync. The columns will stop mirroring each other. Existing values will remain, but the <strong>To Column</strong> will be unlocked for manual edits again.
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    className="modal-confirm-btn" 
                    style={{ flex: 1, background: '#dc2626', borderColor: '#dc2626', color: '#fff', fontSize: '12px', padding: '8px', fontWeight: 600 }}
                    onClick={() => unlinkColumnMutation.mutate(linkInfoModal.columnId)}
                    disabled={unlinkColumnMutation.isPending}
                  >
                    {unlinkColumnMutation.isPending ? 'Unlinking...' : 'Yes, Unlink'}
                  </button>
                  <button 
                    className="modal-cancel-btn" 
                    style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                    onClick={() => setShowUnlinkConfirm(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', gap: '8px' }}>
                <button 
                  className="modal-cancel-btn" 
                  style={{ 
                    flex: 1, 
                    borderColor: '#ef4444', 
                    color: '#ef4444', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '6px',
                    backgroundColor: 'transparent'
                  }} 
                  onClick={() => setShowUnlinkConfirm(true)}
                >
                  <Trash2 size={16} /> Unlink Column
                </button>
                <button className="modal-confirm-btn" style={{ flex: 1 }} onClick={() => setLinkInfoModal(null)}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {showExportModal && (() => {
        // Filter columns by download restrictions
        let exportableColumns = downloadableColumnIds
          ? columns.filter(c => downloadableColumnIds.has(c.id))
          : columns;

        if (isPreviewSelectedColumns && selectedColumns.size > 0) {
          exportableColumns = exportableColumns.filter(c => selectedColumns.has(c.id));
        }

        // Calculate permitted row count for download
        let exportRowCount = displayEntries.length;
        if (rowDownloadRange) {
          const start = (rowDownloadRange.start || 1) - 1;
          const end = rowDownloadRange.end || displayEntries.length;
          exportRowCount = Math.max(0, Math.min(end, displayEntries.length) - start);
        }
        return (
          <ExportModal
            onClose={() => setShowExportModal(false)}
            onExport={(options) => {
              if (options.format === 'excel') handleExportExcel(options);
              else handleExportPDF(options);
              setShowExportModal(false);
            }}
            columns={exportableColumns}
            hiddenColumns={hiddenColumns}
            selectedRowCount={selectedRows.size}
            totalRowCount={exportRowCount}
          />
        );
      })()}

      <ShareModal 
        shareModal={shareModal} setShareModal={setShareModal}
        register={register} sharePhone={sharePhone} setSharePhone={setSharePhone}
        sharePermission={sharePermission} setSharePermission={setSharePermission}
        shareLinkMutation={shareLinkMutation} addSharedUserMutation={addSharedUserMutation} removeSharedUserMutation={removeSharedUserMutation}
      />

      <OtherModals 
        renamePageModal={renamePageModal} setRenamePageModal={setRenamePageModal}
        renamePageValue={renamePageValue} setRenamePageValue={setRenamePageValue} renamePageId={renamePageId}
        pages={pages} deletePageMutation={deletePageMutation} renamePageMutation={renamePageMutation}
        dateModal={dateModal} setDateModal={setDateModal}
        dateDay={dateDay} setDateDay={setDateDay} dateMonth={dateMonth} setDateMonth={setDateMonth} dateYear={dateYear} setDateYear={setDateYear}
        handleDateSelect={handleDateSelect} dateRect={dateRect}
        dropdownModal={dropdownModal} setDropdownModal={setDropdownModal}
        dropdownOptions={dropdownOptions} dropdownEntryId={dropdownEntryId} dropdownColumnId={dropdownColumnId}
        dropdownRect={dropdownRect}
        localEntries={localEntries} handleCellChange={handleCellChange}
        columns={columns}
        onAddDropdownOption={onAddDropdownOption}
      />

      {/* ── Add Record Modal ── */}
      <AddRecordModal
        open={showAddRecordModal}
        onClose={() => setShowAddRecordModal(false)}
        columns={columns}
        isSubmitting={addEntryMutation.isPending}
        onSubmit={(cells) => addEntryMutation.mutate(cells)}
        existingEntries={localEntries}
      />

      {/* Row Detail View Modal (Direct Edit Mode) */}
      {/* Row Detail View Modal (Direct Edit Mode) */}
      {detailViewEntry && (() => {
        const isRowEditable = !_canEditAny ? false : (!_rowEditRange ? true : (() => {
          const num = detailViewEntry.rowNumber;
          const { start, end } = _rowEditRange;
          if (start !== undefined && num < start) return false;
          if (end !== undefined && num > end) return false;
          return true;
        })());

        const isRowDownloadable = _canDownloadAny && (() => {
          if (!rowDownloadRange) return true;
          const num = detailViewEntry.rowNumber;
          const { start, end } = rowDownloadRange;
          if (start !== undefined && num < start) return false;
          if (end !== undefined && num > end) return false;
          return true;
        })();

        return (
        <div className="row-detail-overlay" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); setShowRowAuditTrail(false); setRowAuditHistory([]); }}>
          <div className="row-detail-modal" onClick={e => e.stopPropagation()}>
            <div className="row-detail-header">
              <div className="row-detail-title">
                <span className="row-detail-badge">Row #{(localEntries.findIndex(e => e.id === detailViewEntry.id) + 1)}</span>
                <h2>Record Details</h2>
                <button
                  className="row-audit-trail-btn"
                  title="View row change history"
                  onClick={async () => {
                    if (showRowAuditTrail) {
                      setShowRowAuditTrail(false);
                      return;
                    }
                    setShowRowAuditTrail(true);
                    setRowAuditLoading(true);
                    try {
                      const history = await listRowHistory(registerId, detailViewEntry.id);
                      setRowAuditHistory(history);
                    } catch (err) {
                      console.error('Failed to load row history:', err);
                      setRowAuditHistory([]);
                    } finally {
                      setRowAuditLoading(false);
                    }
                  }}
                >
                  <Clock size={15} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {isRowDownloadable && (
                  <button
                    className="pab-tab-action-btn"
                    style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                    onClick={() => handleRowDownloadPDF(detailViewEntry.id)}
                    title="Download PDF"
                  >
                    <FileText size={14} /> PDF
                  </button>
                )}
                {isRowDownloadable && (
                  <button
                    className="pab-tab-action-btn"
                    style={{ borderColor: '#86efac', color: '#16a34a' }}
                    onClick={() => handleRowDownloadExcel(detailViewEntry.id)}
                    title="Download Excel"
                  >
                    <Download size={14} /> Excel
                  </button>
                )}
                <button className="row-detail-close" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); setShowRowAuditTrail(false); setRowAuditHistory([]); }} aria-label="Close">✕</button>
              </div>
            </div>

            {/* Row Audit Trail Panel */}
            {showRowAuditTrail && (
              <div className="row-audit-trail-panel">
                <div className="row-audit-trail-header">
                  <div className="row-audit-trail-title">
                    <Clock size={14} />
                    <span>Change History</span>
                  </div>
                  <button className="row-audit-trail-close" onClick={() => setShowRowAuditTrail(false)}>
                    <X size={14} />
                  </button>
                </div>
                <div className="row-audit-trail-content">
                  {rowAuditLoading ? (
                    <div className="row-audit-trail-loading">
                      <div className="row-audit-spinner" />
                      <span>Loading history…</span>
                    </div>
                  ) : rowAuditHistory.length === 0 ? (
                    <div className="row-audit-trail-empty">
                      <Clock size={28} style={{ opacity: 0.25 }} />
                      <p>No change history found for this row.</p>
                      <span>Changes will appear here after the next edit or save.</span>
                    </div>
                  ) : (
                    <div className="row-audit-timeline">
                      {rowAuditHistory.map((h, idx) => {
                        const dt = new Date(h.timestamp);
                        const dateStr = dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                        const timeStr = dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                        const isFirst = idx === 0;
                        const actionColor =
                          h.action === 'Edit Row' ? '#3b82f6' :
                          h.action === 'Add Row' || h.action === 'Insert Row' ? '#16a34a' :
                          h.action === 'Delete Row' ? '#dc2626' :
                          h.action === 'Restore Row' ? '#8b5cf6' : '#64748b';

                        return (
                          <div key={h.id} className={`row-audit-item ${isFirst ? 'latest' : ''}`}>
                            <div className="row-audit-item-dot" style={{ borderColor: actionColor }}>
                              <div className="row-audit-item-dot-inner" style={{ background: actionColor }} />
                            </div>
                            {idx < rowAuditHistory.length - 1 && <div className="row-audit-item-connector" />}
                            <div className="row-audit-item-content">
                              <div className="row-audit-item-top">
                                <span className="row-audit-action-badge" style={{ background: actionColor }}>{h.action}</span>
                                {isFirst && <span className="row-audit-latest-tag">Latest</span>}
                              </div>
                              <p className="row-audit-item-details">{h.details}</p>
                              <div className="row-audit-item-meta">
                                <span className="row-audit-meta-user">{h.userName || 'Unknown User'}</span>
                                <span className="row-audit-meta-sep">•</span>
                                <span className="row-audit-meta-date">{dateStr}</span>
                                <span className="row-audit-meta-sep">•</span>
                                <span className="row-audit-meta-time">{timeStr}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="row-detail-body">
              {(() => {
                const modalColumns = (isPreviewSelectedColumns && selectedColumns.size > 0)
                  ? columns.filter(col => selectedColumns.has(col.id))
                  : columns;

                const handleDetailKeyDown = (e: React.KeyboardEvent, currentId: number) => {
                  const currentIndex = modalColumns.findIndex(c => c.id === currentId);
                  
                  if (e.key === 'Enter' || (e.key === 'ArrowDown' && (e.target as HTMLElement).tagName !== 'SELECT')) {
                    e.preventDefault();
                    const nextCol = modalColumns[currentIndex + 1];
                    if (nextCol) {
                      detailInputRefs.current.get(nextCol.id)?.focus();
                    }
                  } else if (e.key === 'ArrowUp' && (e.target as HTMLElement).tagName !== 'SELECT') {
                    e.preventDefault();
                    const prevCol = modalColumns[currentIndex - 1];
                    if (prevCol) {
                      detailInputRefs.current.get(prevCol.id)?.focus();
                    }
                  }
                };

                return modalColumns.map((col) => {
                  const colKey = col.id.toString();
                  const val = detailEdits[colKey] ?? '';
                  const isFieldEditable = isRowEditable && (!_editableColumnIds || _editableColumnIds.has(col.id)) && col.type !== 'auto_increment' && col.type !== 'formula';

                  return (
                    <div className={`row-detail-field ${col.type}-field`} key={col.id}>
                      <div className="row-detail-label-container">
                        <div className="row-detail-label-group">
                          <label className="row-detail-label">
                            {col.name}
                            {col.type === 'formula' && <FlaskConical size={10} style={{ marginLeft: 4, opacity: 0.6 }} />}
                          </label>
                          <span className="row-detail-type-badge">{col.type.replace('_', ' ')}</span>
                        </div>
                        {_canEditAny && (
                          <button 
                            className="row-detail-col-btn" 
                            title="Column Settings"
                            onClick={() => {
                              setActiveModalColId(col.id);
                              setChangeTypeValue(col.type);
                              if (col.type === 'formula') setNewColFormula(col.formula || '');
                              if (col.type === 'dropdown') setNewColDropdownOpts((col.dropdownOptions || []).join(', '));
                              setChangeTypeModal(true);
                            }}
                          >
                            <ChevronDown size={12} />
                          </button>
                        )}
                      </div>
                      
                      <div className="row-detail-input-wrapper">
                        {col.type === 'dropdown' ? (
                          <div className="row-detail-input-wrapper">
                            <div 
                              className={`row-detail-input cell-dropdown ${detailErrors[colKey] ? 'invalid' : ''} ${!isFieldEditable ? 'cell-readonly' : ''}`}
                              tabIndex={isFieldEditable ? 0 : -1}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                              onKeyDown={(e) => {
                                if (!isFieldEditable) {
                                  handleDetailKeyDown(e, col.id);
                                  return;
                                }
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  openDropdown(detailViewEntry.id, col.id, col.dropdownOptions || [], rect as DOMRect);
                                } else handleDetailKeyDown(e, col.id);
                              }}
                              onClick={isFieldEditable ? (e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                openDropdown(detailViewEntry.id, col.id, col.dropdownOptions || [], rect as DOMRect);
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              } : undefined}
                            >
                              {val || 'Select options...'}
                            </div>
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        ) : col.type === 'checkbox' ? (
                          <div 
                            className={`row-detail-checkbox-wrapper ${!isFieldEditable ? 'cell-readonly' : ''}`}
                            tabIndex={isFieldEditable ? 0 : -1}
                            ref={(el) => {
                              if (el) detailInputRefs.current.set(col.id, el);
                              else detailInputRefs.current.delete(col.id);
                            }}
                            onKeyDown={(e) => {
                              if (!isFieldEditable) {
                                handleDetailKeyDown(e, col.id);
                                return;
                              }
                              if (e.key === ' ') {
                                e.preventDefault();
                                setDetailEdits(prev => ({ ...prev, [colKey]: (val === 'true' || val === 'Checked') ? 'false' : 'true' }));
                              } else {
                                handleDetailKeyDown(e, col.id);
                              }
                            }}
                            onClick={isFieldEditable ? () => setDetailEdits(prev => ({ ...prev, [colKey]: (val === 'true' || val === 'Checked') ? 'false' : 'true' })) : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={val === 'true' || val === 'Checked'}
                              disabled={!isFieldEditable}
                              readOnly
                            />
                            <span className="checkbox-label">{val === 'true' || val === 'Checked' ? 'Checked' : 'Unchecked'}</span>
                          </div>
                        ) : col.type === 'date' ? (
                          <div className="row-detail-input-wrapper">
                            <input 
                              type="text"
                              className={`row-detail-input cell-date ${detailErrors[colKey] ? 'invalid' : ''} ${!isFieldEditable ? 'cell-readonly' : ''}`} 
                              value={val}
                              placeholder={isFieldEditable ? "DD-MM-YYYY" : "—"}
                              autoComplete="off"
                              readOnly={!isFieldEditable}
                              onChange={(e) => {
                                if (!isFieldEditable) return;
                                setDetailEdits(prev => ({ ...prev, [colKey]: e.target.value }));
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              }}
                              onClick={isFieldEditable ? (e) => {
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                openDatePicker(detailViewEntry.id, col.id, val, rect as DOMRect);
                              } : undefined}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' || e.key === 'Delete') {
                                  e.preventDefault();
                                  return;
                                }
                                if (e.key === 'Enter' && isFieldEditable) {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  openDatePicker(detailViewEntry.id, col.id, val, rect as DOMRect);
                                } else {
                                  handleDetailKeyDown(e, col.id);
                                }
                              }}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                            />
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        ) : col.type === 'image' ? (
                          <div className="row-detail-image-field">
                            {val ? (
                              <div className="row-detail-image-container">
                                <div className="row-detail-img-wrapper" onClick={() => setPreviewImage({ url: val, entryId: detailViewEntry.id, colId: col.id.toString() })}>
                                  <img 
                                    src={val.split('|||')[0]} 
                                    alt="preview" 
                                    className="row-detail-img-preview" 
                                  />
                                  {val.split('|||').length > 1 && (
                                    <div className="cell-image-count-badge" style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 6px', borderRadius: '10px', fontSize: '10px', zIndex: 2 }}>
                                      +{val.split('|||').length - 1}
                                    </div>
                                  )}
                                  <div className="row-detail-img-overlay">
                                    <Maximize2 size={24} color="white" />
                                    <span>Quick Reveal</span>
                                  </div>
                                </div>
                                <div className="row-detail-image-actions">
                                  <button className="row-detail-img-btn" onClick={() => setPreviewImage({ url: val, entryId: detailViewEntry.id, colId: col.id.toString() })}>View Large</button>
                                  {val.split('|||').length === 1 && <button className="row-detail-img-btn" onClick={() => handleImageDownload(val.split('|||')[0])}>Download</button>}
                                  {isFieldEditable && <button className="row-detail-img-btn danger" onClick={() => setDetailEdits(prev => ({ ...prev, [colKey]: '' }))}>Remove All</button>}
                                </div>
                                
                                {isFieldEditable && (
                                  <label className="row-detail-add-btn">
                                    <input 
                                      type="file" 
                                      accept="image/*" 
                                      hidden 
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          compressImage(file)
                                            .then((newImg) => {
                                              setDetailEdits(prev => {
                                                const current = prev[colKey] ?? detailViewEntry.cells?.[colKey] ?? '';
                                                const updated = current ? `${current}|||${newImg}` : newImg;
                                                return { ...prev, [colKey]: updated };
                                              });
                                            })
                                            .catch(err => console.error(err));
                                        }
                                      }}
                                    />
                                    <Plus size={14} />
                                    <span>Add Another Image</span>
                                  </label>
                                )}
                              </div>
                            ) : (
                              isFieldEditable ? (
                                <label className="row-detail-image-upload">
                                  <input 
                                    type="file" 
                                    accept="image/*" 
                                    hidden 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        compressImage(file)
                                          .then((newImg) => {
                                            setDetailEdits(prev => ({ ...prev, [colKey]: newImg }));
                                          })
                                          .catch(err => console.error(err));
                                      }
                                    }}
                                  />
                                  <ImageIcon size={16} />
                                  <span>Upload Image</span>
                                </label>
                              ) : (
                                <div className="row-detail-input auto-increment-readonly" style={{ opacity: 0.5 }}>
                                  <ImageIcon size={16} style={{ marginRight: 6 }} />
                                  <span>No image</span>
                                </div>
                              )
                            )}
                          </div>
                        ) : col.type === 'formula' ? (
                          <div 
                            className="row-detail-formula-result"
                            tabIndex={0}
                            ref={(el) => {
                              if (el) detailInputRefs.current.set(col.id, el);
                              else detailInputRefs.current.delete(col.id);
                            }}
                            onKeyDown={(e) => handleDetailKeyDown(e, col.id)}
                            onClick={_canEditAny ? () => {
                              setActiveModalColId(col.id);
                              setNewColFormula(col.formula || '');
                              setChangeTypeValue(col.type);
                              setChangeTypeModal(true);
                            } : undefined}
                            title={_canEditAny ? "Click to edit formula" : undefined}
                          >
                            {evaluateFormula(col.formula || '', { ...detailViewEntry, cells: { ...detailViewEntry.cells, ...detailEdits } }, columns)}
                          </div>
                        ) : col.type === 'auto_increment' ? (
                          <div className="row-detail-input auto-increment-readonly">
                            <ListOrdered size={14} style={{ opacity: 0.5 }} />
                            <span>{val || '–'}</span>
                          </div>
                        ) : (
                          <div className="row-detail-input-wrapper">
                            <input
                              className={`row-detail-input ${detailErrors[colKey] ? 'invalid' : ''} ${!isFieldEditable ? 'cell-readonly' : ''}`}
                              value={val}
                              readOnly={!isFieldEditable}
                              ref={(el) => {
                                if (el) detailInputRefs.current.set(col.id, el);
                                else detailInputRefs.current.delete(col.id);
                              }}
                              onKeyDown={(e) => handleDetailKeyDown(e, col.id)}
                              onChange={e => {
                                if (!isFieldEditable) return;
                                setDetailEdits(prev => ({ ...prev, [colKey]: e.target.value }));
                                if (detailErrors[colKey]) setDetailErrors(prev => ({ ...prev, [colKey]: null }));
                              }}
                              placeholder={isFieldEditable ? `Enter ${col.name}…` : '—'}
                              type={col.type === 'email' ? 'email' : col.type === 'phone' ? 'tel' : 'text'}
                              inputMode={col.type === 'number' || col.type === 'currency' ? 'decimal' : undefined}
                              list={isFieldEditable ? `list-detail-${col.id}` : undefined}
                            />
                            {isFieldEditable && columnSuggestions[col.id.toString()]?.length > 0 && (
                              <datalist id={`list-detail-${col.id}`}>
                                {columnSuggestions[col.id.toString()].map((s, i) => (
                                  <option key={`${s}-${i}`} value={s} />
                                ))}
                              </datalist>
                            )}
                            {detailErrors[colKey] && (
                              <div className="row-detail-error-msg">
                                <AlertCircle size={10} />
                                {detailErrors[colKey]}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="row-detail-footer">
              <button className="row-detail-btn-close" onClick={() => { setDetailViewEntry(null); setDetailEdits({}); setDetailErrors({}); setShowRowAuditTrail(false); setRowAuditHistory([]); }}>{isRowEditable ? 'Cancel' : 'Close'}</button>
              {isRowEditable && (
                <button 
                  className="row-detail-btn-save" 
                  disabled={isSaving}
                  onClick={async () => {
                    if (!detailViewEntry) return;

                    const modalColumns = (isPreviewSelectedColumns && selectedColumns.size > 0)
                      ? columns.filter(col => selectedColumns.has(col.id))
                      : columns;

                    const errors: Record<string, string | null> = {};
                    let hasErrors = false;

                    modalColumns.forEach(col => {
                      // Fallback to existing value if not edited in this session
                      const val = detailEdits[col.id.toString()] ?? detailViewEntry.cells?.[col.id.toString()] ?? '';
                      
                      if ((col as any).mandatory && col.type !== 'formula' && col.type !== 'auto_increment' && val.trim() === '') {
                        errors[col.id.toString()] = "This field is mandatory and cannot be empty.";
                        hasErrors = true;
                      } else if ((col as any).unique && val.trim() !== '') {
                        const isDuplicate = localEntriesRef.current.some(
                          e => e.id !== detailViewEntry.id && e.cells?.[col.id.toString()]?.trim().toLowerCase() === val.trim().toLowerCase()
                        );
                        if (isDuplicate) {
                          errors[col.id.toString()] = `Unique field: The value "${val}" already exists.`;
                          hasErrors = true;
                        }
                      } 
                      
                      if (!errors[col.id.toString()]) {
                        const validation = validateCellValue(col, val);
                        if (!validation.isValid && val.trim() !== '') {
                          errors[col.id.toString()] = validation.error;
                          hasErrors = true;
                        }
                      }
                    });

                    // Check if we already showed these warnings
                    const hadErrorsBefore = Object.keys(detailErrors || {}).length > 0;
                    setDetailErrors(errors);

                    if (hasErrors && !hadErrorsBefore) {
                      toast("Some entries have formatting warnings. Click save again to confirm.", { icon: '⚠️' });
                      return;
                    }

                    // Batch all changes from the modal
                    const changedCells: Record<string, string> = {};
                    Object.entries(detailEdits).forEach(([colId, value]) => {
                      if (detailViewEntry.cells?.[colId] !== value) {
                        changedCells[colId] = value;
                      }
                    });

                    if (Object.keys(changedCells).length > 0) {
                      // 1. Update local state instantly (optimistic)
                      setLocalEntries(prev => prev.map(e => 
                        e.id === detailViewEntry.id ? { ...e, cells: { ...e.cells, ...changedCells } } : e
                      ));

                      // 2. Clear any pending debounces for these specific cells
                      Object.keys(changedCells).forEach(colId => {
                        const key = `${detailViewEntry.id}-${colId}`;
                        if (debounceTimers.current[key]) {
                          clearTimeout(debounceTimers.current[key]);
                          delete debounceTimers.current[key];
                        }
                      });

                      // 3. Persist batch to Firestore (non-blocking for UI)
                      setIsSaving(true);
                      updateEntry(registerId, detailViewEntry.id, changedCells).then(() => {
                        Object.keys(changedCells).forEach(colId => {
                          const col = columnsRef.current.find(c => c.id.toString() === colId);
                          if (col?.linkedTo) {
                            queryClient.invalidateQueries({ queryKey: ['register', col.linkedTo.registerId] });
                          }
                        });
                        
                        // 4. Patch queryClient cache
                        queryClient.setQueryData(['register', registerId], (old: any) => {
                          if (!old) return old;
                          return {
                            ...old,
                            entries: old.entries.map((e: any) =>
                              e.id === detailViewEntry.id ? { ...e, cells: { ...e.cells, ...changedCells } } : e
                            ),
                          };
                        });
                        toast.success("Changes saved successfully!");
                      }).catch(err => {
                        console.error("Failed to save:", err);
                        toast.error("Failed to save changes. Please check your connection.");
                      }).finally(() => {
                        setIsSaving(false);
                      });
                    } else {
                      toast.success("No changes to save.");
                    }
                    
                    // Close modal IMMEDIATELY for instant feel
                    setDetailViewEntry(null);
                    setDetailEdits({});
                    setDetailErrors({});
                    setShowRowAuditTrail(false);
                    setRowAuditHistory([]);
                  }}
                >
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {calcMenu && (
        <div className="context-popover-layer" onClick={() => setCalcMenu(null)}>
          <div 
            className="context-menu calc-dropdown-menu"
            style={{
              position: 'fixed',
              bottom: window.innerHeight - calcMenu.rect.top + 5,
              left: Math.min(calcMenu.rect.left, window.innerWidth - 180),
              zIndex: 1000,
              width: '180px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-section-label">Calculation Type</div>
            {[
              { id: 'sum', label: 'Sum (Σ)', icon: 'Σ' },
              { id: 'count', label: 'Count (N)', icon: 'N' },
              { id: 'distinct', label: 'Distinct (D)', icon: 'D' },
              { id: 'average', label: 'Average (Avg)', icon: 'μ' },
              { id: 'min', label: 'Minimum (Min)', icon: '↓' },
              { id: 'max', label: 'Maximum (Max)', icon: '↑' },
              { id: 'filled', label: 'Filled Cells', icon: '●' },
              { id: 'empty', label: 'Empty Cells', icon: '○' },
            ].map(opt => {
              const currentType = calcTypes[calcMenu.colId];
              const isActive = currentType === opt.id;
              return (
                <button 
                  key={opt.id}
                  className={`context-item ${isActive ? 'active' : ''}`} 
                  onClick={() => updateCalcType(calcMenu.colId, opt.id)}
                >
                  <span className="context-item-icon" style={{ fontSize: '12px', width: '16px', fontWeight: 800 }}>{opt.icon}</span>
                  <span className="context-item-label" style={{ fontWeight: isActive ? 700 : 400 }}>{opt.label}</span>
                  {isActive && <span style={{ marginLeft: 'auto', fontSize: '10px' }}>●</span>}
                </button>
              );
            })}
            
            <div className="context-divider" />
            
            <button className="context-item danger" onClick={() => updateCalcType(calcMenu.colId, 'none')}>
              <span className="context-item-label">Remove Calculation</span>
            </button>
          </div>
        </div>
      )}
      
      {/* ── Image Preview Modal ── */}
      {previewImage && previewImage.url && (() => {
        const urls = previewImage.url.includes('|||') ? previewImage.url.split('|||') : [previewImage.url];
        const currentUrl = urls[previewImageIndex] || urls[0];
        return (
        <div className="img-preview-overlay" onClick={() => { setPreviewImage(null); setIsImgZoomed(false); setPreviewImageIndex(0); }}>
          <div className="img-preview-content" onClick={e => e.stopPropagation()}>
            <div className="img-preview-header">
              <h3>Image Preview {urls.length > 1 ? `(${previewImageIndex + 1}/${urls.length})` : ''}</h3>
              <div className="img-preview-actions">
                {/* Previous Image */}
                {urls.length > 1 && (
                  <button 
                    className="img-preview-nav"
                    disabled={previewImageIndex === 0}
                    onClick={() => setPreviewImageIndex(prev => prev - 1)}
                  >
                    <ChevronDown size={20} style={{ transform: 'rotate(90deg)' }} />
                  </button>
                )}
                {/* Next Image */}
                {urls.length > 1 && (
                  <button 
                    className="img-preview-nav"
                    disabled={previewImageIndex === urls.length - 1}
                    onClick={() => setPreviewImageIndex(prev => prev + 1)}
                  >
                    <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
                  </button>
                )}
                
                <div className="img-preview-divider" />

                <button onClick={() => handleImageDownload(currentUrl)} className="img-download-btn" title="Download Image">
                  <Download size={18} />
                  Download
                </button>

                {previewImage.entryId !== undefined && previewImage.colId !== undefined && (
                  <>
                  <label className="img-preview-add" title="Add Image">
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          compressImage(file)
                            .then((newUrl) => {
                              const updated = [...urls, newUrl].join('|||');
                              handleCellChange(previewImage.entryId!, previewImage.colId!, updated);
                              setPreviewImage({ ...previewImage, url: updated });
                              setPreviewImageIndex(urls.length);
                            })
                            .catch(err => console.error(err));
                        }
                      }}
                    />
                    <Plus size={18} /> Add Image
                  </label>
                  <button 
                    className="img-preview-remove" 
                    onClick={() => {
                      if (urls.length > 1) {
                        const next = [...urls];
                        next.splice(previewImageIndex, 1);
                        const updated = next.join('|||');
                        handleCellChange(previewImage.entryId!, previewImage.colId!, updated);
                        setPreviewImage({ ...previewImage, url: updated });
                        setPreviewImageIndex(Math.max(0, previewImageIndex - 1));
                      } else {
                        handleCellChange(previewImage.entryId!, previewImage.colId!, '');
                        if (detailViewEntry?.id === previewImage.entryId) {
                          setDetailEdits(prev => ({ ...prev, [previewImage.colId!]: '' }));
                        }
                        setPreviewImage(null);
                        setIsImgZoomed(false);
                      }
                    }}
                    title="Remove Current Image"
                  >
                    <Trash2 size={18} /> Remove
                  </button>
                  </>
                )}
                <button className="img-preview-btn" onClick={() => setIsImgZoomed(!isImgZoomed)} title={isImgZoomed ? "Zoom Out" : "Zoom In"}>
                  {isImgZoomed ? <ZoomOut size={20} /> : <ZoomIn size={20} />}
                </button>
                <button className="img-preview-close" onClick={() => { setPreviewImage(null); setIsImgZoomed(false); setPreviewImageIndex(0); }}>✕</button>
              </div>
            </div>
            <div className="img-preview-body" onClick={() => setIsImgZoomed(!isImgZoomed)}>
              <img src={currentUrl} alt="Large preview" className={isImgZoomed ? 'zoomed' : ''} />
            </div>
          </div>
        </div>
        );
      })()}

      {/* Reminder Modal */}
      {reminderModal && (
        <div className="modal-overlay" onClick={() => setReminderModal(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '400px', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', background: '#fff' }}>
            <div className="modal-header" style={{ position: 'relative', padding: '20px 20px 12px', borderBottom: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--primary)" />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: 'var(--text-color)' }}>Set Reminder</h3>
              </div>
              <button 
                onClick={() => setReminderModal(null)} 
                style={{ 
                  position: 'absolute', top: '16px', right: '16px', 
                  background: '#f3f4f6', borderRadius: '50%', width: '32px', height: '32px',
                  cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 10
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
                onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
              >
                <X size={16} color="#374151" strokeWidth={2.5} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '0 20px 20px' }}>
              <div>
                <label className="modal-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-color)' }}>Reminder Date <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>(Optional)</span></label>
                <input type="date" className="modal-input" value={reminderDate} onChange={e => setReminderDate(e.target.value)} style={{ width: '100%', marginBottom: 0 }} />
              </div>
              
              <div>
                <label className="modal-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-color)' }}>Reminder Time <span style={{fontSize: '11px', color: 'var(--text-muted)'}}>(Optional)</span></label>
                <input type="time" className="modal-input" value={reminderTime} onChange={e => setReminderTime(e.target.value)} style={{ width: '100%', marginBottom: 0 }} />
              </div>

              <div>
                <label className="modal-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-color)' }}>Status <span style={{color: 'red'}}>*</span></label>
                <select 
                  className="modal-input" 
                  value={reminderStatus} 
                  onChange={e => setReminderStatus(e.target.value as 'Pending' | 'Complete')} 
                  style={{ width: '100%', marginBottom: 0, background: '#ffffff' }}
                >
                  <option value="Pending">Pending</option>
                  <option value="Complete">Complete</option>
                </select>
              </div>

              <div>
                <label className="modal-label" style={{ marginBottom: '6px', display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-color)' }}>Message / Description <span style={{color: 'red'}}>*</span></label>
                <textarea 
                  className="modal-textarea" 
                  value={reminderMessage} 
                  onChange={e => setReminderMessage(e.target.value)} 
                  placeholder="What should this reminder tell you?"
                  rows={3}
                  style={{ width: '100%', resize: 'none', marginBottom: 0 }}
                />
              </div>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#fafafa' }}>
              <button className="modal-cancel-btn" onClick={() => setReminderModal(null)}>Cancel</button>
              <button 
                className="modal-confirm-btn" 
                onClick={() => {
                  if (!reminderMessage) {
                    toast.error('Please enter a reminder message');
                    return;
                  }
                  
                  let triggerTime: number | undefined = undefined;
                  if (reminderDate && reminderTime) {
                    const dt = new Date(`${reminderDate}T${reminderTime}`);
                    if (isNaN(dt.getTime())) {
                      toast.error('Please enter a valid date and time');
                      return;
                    }
                    if (reminderStatus === 'Pending' && dt.getTime() < Date.now()) {
                      toast.error('Reminder time must be in the future for active/pending reminders');
                      return;
                    }
                    triggerTime = dt.getTime();
                  }

                  const existingIdx = reminders.findIndex(r => r.rowId === reminderModal.entryId && r.colId === reminderModal.colId && r.registerId === String(registerId));
                  if (existingIdx > -1) {
                    const updated = [...reminders];
                    updated[existingIdx] = {
                      ...updated[existingIdx],
                      triggerTime: triggerTime,
                      message: reminderMessage,
                      status: reminderStatus
                    };
                    setReminders(updated);
                    toast.success('Reminder updated successfully!');
                  } else {
                    scheduleReminder({
                      triggerTime: triggerTime,
                      message: reminderMessage,
                      registerId: String(registerId),
                      rowId: reminderModal.entryId,
                      colId: reminderModal.colId,
                      status: reminderStatus
                    });
                    toast.success('Reminder set successfully!');
                  }
                  setReminderModal(null);
                }}
              >
                Save Reminder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Cell Format Toolbar ── */}
      {formatCell && (
        <CellFormatToolbar
          position={{ top: formatCell.rect.top, left: formatCell.rect.left }}
          currentStyle={
            localEntries.find(e => e.id === formatCell.entryId)?.cellStyles?.[formatCell.colId] || {}
          }
          onStyleChange={handleCellStyleChange}
          onClearStyle={handleClearCellStyle}
          onClose={() => setFormatCell(null)}
          onAddReminder={() => {
            const existing = reminders.find(r => r.rowId === formatCell.entryId && r.colId === formatCell.colId && r.registerId === String(registerId));
            if (existing && existing.triggerTime) {
              const dt = new Date(existing.triggerTime);
              const yyyy = dt.getFullYear();
              const mm = String(dt.getMonth() + 1).padStart(2, '0');
              const dd = String(dt.getDate()).padStart(2, '0');
              setReminderDate(`${yyyy}-${mm}-${dd}`);
              
              const hh = String(dt.getHours()).padStart(2, '0');
              const min = String(dt.getMinutes()).padStart(2, '0');
              setReminderTime(`${hh}:${min}`);
              
              setReminderMessage(existing.message);
              setReminderStatus(existing.status);
            } else {
              setReminderDate('');
              setReminderTime('');
              setReminderMessage('');
              setReminderStatus('Pending');
            }
            setReminderModal({ entryId: formatCell.entryId, colId: formatCell.colId });
          }}
        />
      )}

      {/* Reminders Summary Modal */}
      {showRemindersSummary && (
        <div className="modal-overlay" onClick={() => { setShowRemindersSummary(false); setEditingReminderId(null); }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '650px', maxWidth: '90%', position: 'relative' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={18} color="var(--primary)" />
                <h3 style={{ margin: 0 }}>Active Reminders</h3>
              </div>
              <button 
                className="modal-close" 
                onClick={() => { setShowRemindersSummary(false); setEditingReminderId(null); }}
                style={{
                  position: 'absolute',
                  top: '16px',
                  right: '16px',
                  background: 'var(--border-color, #f3f4f6)',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  cursor: 'pointer',
                  zIndex: 10,
                  transition: 'background 0.2s'
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '450px', overflowY: 'auto' }}>
              {registerReminders.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Bell size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ margin: 0 }}>No reminders set for this register.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {registerReminders.map(r => {
                    const entry = localEntries.find(e => e.id === r.rowId);
                    const rowNum = entry ? (entry.rowNumber || localEntries.indexOf(entry) + 1) : 'Unknown Row';
                    const column = columns.find(c => c.id.toString() === r.colId);
                    const colName = column?.name || r.colId || 'General';
                    const currentCellValue = (r.colId && entry?.cells) ? entry.cells[r.colId] : '';
                    const isEditing = editingReminderId === r.id;
                    const registerName = register?.name || 'Register';

                    if (isEditing) {
                      return (
                        <div 
                          key={r.id} 
                          style={{ 
                            border: '2px solid var(--primary)', 
                            borderRadius: '12px', 
                            padding: '16px', 
                            background: '#f9fafb',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                              <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>Editing {registerName} (Row #{rowNum})</span>
                              <span className="badge badge-secondary" style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>Col: {colName}</span>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>Edit Mode</span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}>Reminder Date <span style={{fontSize: '10px', color: 'var(--text-muted)'}}>(Optional)</span></label>
                              <input 
                                type="date" 
                                className="modal-input" 
                                value={editRemDate} 
                                onChange={e => setEditRemDate(e.target.value)} 
                                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }} 
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}>Reminder Time <span style={{fontSize: '10px', color: 'var(--text-muted)'}}>(Optional)</span></label>
                              <input 
                                type="time" 
                                className="modal-input" 
                                value={editRemTime} 
                                onChange={e => setEditRemTime(e.target.value)} 
                                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }} 
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}>Reminder Message *</label>
                              <input 
                                type="text" 
                                className="modal-input" 
                                value={editRemMessage} 
                                onChange={e => setEditRemMessage(e.target.value)} 
                                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }} 
                                placeholder="Reminder message"
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}>Status *</label>
                              <select 
                                className="modal-input" 
                                value={editRemStatus} 
                                onChange={e => setEditRemStatus(e.target.value as 'Pending' | 'Complete')} 
                                style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }}
                              >
                                <option value="Pending">Pending</option>
                                <option value="Complete">Complete</option>
                              </select>
                            </div>
                          </div>

                          {column && (
                            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '8px' }}>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-color)', marginBottom: '4px' }}>
                                Respective Cell Value ({colName})
                              </label>
                              {column.type === 'dropdown' ? (
                                <select
                                  className="modal-input"
                                  value={editRemCellValue}
                                  onChange={e => setEditRemCellValue(e.target.value)}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }}
                                >
                                  <option value="">-- Select Option --</option>
                                  {column.dropdownOptions?.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : column.type === 'checkbox' ? (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 0' }}>
                                  <input
                                    type="checkbox"
                                    checked={editRemCellValue === 'true'}
                                    onChange={e => setEditRemCellValue(e.target.checked ? 'true' : 'false')}
                                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: '13px', color: 'var(--text-color)' }}>Checked</span>
                                </label>
                              ) : column.type === 'date' ? (
                                <input
                                  type="date"
                                  className="modal-input"
                                  value={parseDateString(editRemCellValue)}
                                  onChange={e => setEditRemCellValue(e.target.value)}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }}
                                />
                              ) : (
                                <input
                                  type="text"
                                  className="modal-input"
                                  value={editRemCellValue}
                                  onChange={e => setEditRemCellValue(e.target.value)}
                                  style={{ width: '100%', padding: '6px 10px', fontSize: '13px', borderRadius: '6px', border: '1px solid var(--border-color)', background: '#fff', marginBottom: 0 }}
                                  placeholder={`Enter cell value...`}
                                />
                              )}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                            <button 
                              onClick={() => setEditingReminderId(null)}
                              style={{ 
                                padding: '6px 12px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', 
                                border: '1px solid var(--border-color)', background: '#fff', cursor: 'pointer', color: 'var(--text-color)' 
                              }}
                            >
                              Cancel
                            </button>
                            <button 
                              onClick={() => {
                                if (!editRemMessage) {
                                  toast.error('Please enter a reminder message');
                                  return;
                                }
                                
                                let triggerTime: number | undefined = undefined;
                                if (editRemDate && editRemTime) {
                                  const dt = new Date(`${editRemDate}T${editRemTime}`);
                                  if (isNaN(dt.getTime())) {
                                    toast.error('Please enter a valid date and time');
                                    return;
                                  }
                                  if (editRemStatus === 'Pending' && dt.getTime() < Date.now()) {
                                    toast.error('Reminder time must be in the future for active/pending reminders');
                                    return;
                                  }
                                  triggerTime = dt.getTime();
                                }

                                const updated = reminders.map(rem => {
                                  if (rem.id === r.id) {
                                    return {
                                      ...rem,
                                      message: editRemMessage,
                                      status: editRemStatus,
                                      triggerTime: triggerTime
                                    };
                                  }
                                  return rem;
                                });
                                setReminders(updated);

                                const res = handleCellChange(r.rowId as number, r.colId as string, editRemCellValue);
                                if (res !== false) {
                                  toast.success('Reminder and respective cell updated successfully!');
                                }
                                setEditingReminderId(null);
                              }}
                              style={{ 
                                padding: '6px 12px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', 
                                border: 'none', background: 'var(--primary)', cursor: 'pointer', color: '#fff' 
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    }

                    const triggerDate = r.triggerTime ? new Date(r.triggerTime).toLocaleString() : 'No schedule set';
                    
                    return (
                      <div 
                        key={r.id} 
                        style={{ 
                          border: '1px solid var(--border-color)', 
                          borderRadius: '8px', 
                          padding: '12px', 
                          background: 'var(--card-bg, #ffffff)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <span className="badge badge-primary" style={{ fontSize: '11px', padding: '2px 8px' }}>{registerName} (Row #{rowNum})</span>
                            <span className="badge badge-secondary" style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)' }}>Col: {colName}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{triggerDate}</span>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span 
                              style={{ 
                                fontSize: '11px', 
                                padding: '2px 8px', 
                                borderRadius: '4px', 
                                background: r.status === 'Pending' ? '#fffbeb' : '#ecfdf5',
                                color: r.status === 'Pending' ? '#d97706' : '#059669',
                                fontWeight: 600
                              }}
                            >
                              {r.status}
                            </span>

                            <button 
                              onClick={() => {
                                setEditingReminderId(r.id);
                                setEditRemMessage(r.message || '');
                                setEditRemStatus(r.status || 'Pending');
                                if (r.triggerTime) {
                                  const dt = new Date(r.triggerTime);
                                  const yyyy = dt.getFullYear();
                                  const mm = String(dt.getMonth() + 1).padStart(2, '0');
                                  const dd = String(dt.getDate()).padStart(2, '0');
                                  setEditRemDate(`${yyyy}-${mm}-${dd}`);
                                  const hh = String(dt.getHours()).padStart(2, '0');
                                  const min = String(dt.getMinutes()).padStart(2, '0');
                                  setEditRemTime(`${hh}:${min}`);
                                } else {
                                  setEditRemDate('');
                                  setEditRemTime('');
                                }
                                setEditRemCellValue(currentCellValue);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--primary)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px',
                                fontSize: '12px',
                                fontWeight: 500
                              }}
                              title="Edit Reminder & Cell Value"
                            >
                              Edit
                            </button>

                            <button 
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this reminder?')) {
                                  const updated = reminders.filter(rem => rem.id !== r.id);
                                  setReminders(updated);
                                  toast.success('Reminder deleted successfully');
                                }
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--danger-color, #ef4444)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px'
                              }}
                              title="Delete Reminder"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)', fontWeight: 500 }}>
                            {r.message}
                          </p>
                          <div style={{ 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '6px', 
                            marginTop: '8px', 
                            background: '#fafafa', 
                            padding: '8px 12px', 
                            borderRadius: '6px', 
                            border: '1px solid #e5e7eb' 
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                                Respective Cell Value:
                              </span>
                              {inlineCellValues[r.id] !== undefined && inlineCellValues[r.id] !== currentCellValue && (
                                <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>Unsaved changes</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              {column?.type === 'dropdown' ? (
                                <select
                                  value={inlineCellValues[r.id] !== undefined ? inlineCellValues[r.id] : currentCellValue}
                                  onChange={e => setInlineCellValues(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  style={{ flex: 1, padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff' }}
                                >
                                  <option value="">-- Select Option --</option>
                                  {column.dropdownOptions?.map((opt: string) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : column?.type === 'checkbox' ? (
                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flex: 1 }}>
                                  <input
                                    type="checkbox"
                                    checked={(inlineCellValues[r.id] !== undefined ? inlineCellValues[r.id] : currentCellValue) === 'true'}
                                    onChange={e => setInlineCellValues(prev => ({ ...prev, [r.id]: e.target.checked ? 'true' : 'false' }))}
                                    style={{ cursor: 'pointer' }}
                                  />
                                  <span style={{ fontSize: '12px' }}>Checked</span>
                                </label>
                              ) : column?.type === 'date' ? (
                                <input
                                  type="date"
                                  value={parseDateString(inlineCellValues[r.id] !== undefined ? inlineCellValues[r.id] : currentCellValue)}
                                  onChange={e => setInlineCellValues(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  style={{ flex: 1, padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff' }}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={inlineCellValues[r.id] !== undefined ? inlineCellValues[r.id] : currentCellValue}
                                  onChange={e => setInlineCellValues(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  style={{ flex: 1, padding: '4px 8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #d1d5db', background: '#fff' }}
                                  placeholder="Enter cell value..."
                                />
                              )}
                              <button
                                onClick={() => {
                                  const valToSave = inlineCellValues[r.id] !== undefined ? inlineCellValues[r.id] : currentCellValue;
                                  const res = handleCellChange(r.rowId as number, r.colId as string, valToSave);
                                  if (res !== false) {
                                    setInlineCellValues(prev => {
                                      const next = { ...prev };
                                      delete next[r.id];
                                      return next;
                                    });
                                    toast.success('Cell value saved back to table successfully!');
                                  }
                                }}
                                style={{
                                  padding: '4px 12px',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  borderRadius: '4px',
                                  border: 'none',
                                  background: 'var(--primary)',
                                  color: '#fff',
                                  cursor: 'pointer',
                                  transition: 'background 0.2s'
                                }}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ marginTop: '16px' }}>
              <button className="modal-confirm-btn" onClick={() => { setShowRemindersSummary(false); setEditingReminderId(null); }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
