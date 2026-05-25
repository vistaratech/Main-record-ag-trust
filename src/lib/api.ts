// REST API-backed client for SJVPS Record Book
// Connects securely to the Neon PostgreSQL Express backend

import { TEMPLATES, type Template, type TemplateColumn } from './templates';

// ==================== AUTH TYPES & MOCKS ====================
export interface User {
  id: number | string;
  phone?: string;
  email?: string;
  name: string | null;
  createdAt: string;
  role?: 'superadmin' | 'admin' | 'sheet_admin' | 'user';
  status?: 'active' | 'inactive';
  lastLogin?: string;
  permissions?: {
    canView?: boolean;
    canEdit?: boolean;
    canDownload?: boolean;
    isAdmin?: boolean;
    canCreateSheets?: boolean;
    viewRestrictions?: Record<string, number[]> | null;
    editRestrictions?: Record<string, number[]> | null;
    downloadRestrictions?: Record<string, number[]> | null;
    createRestrictions?: Record<string, boolean> | null;
    rowViewRestrictions?: Record<string, { start?: number; end?: number }> | null;
    rowEditRestrictions?: Record<string, { start?: number; end?: number }> | null;
    rowDownloadRestrictions?: Record<string, { start?: number; end?: number }> | null;
    fullSheetAccess?: boolean;
    allowedRegisters?: string[];
    allowedFolders?: string[];
  };
}

export interface SendOtpResponse { message: string; devOtp?: string; }
export interface VerifyOtpResponse { token: string; user: User; }

export async function sendOtp(phone: string): Promise<SendOtpResponse> {
  void phone;
  return { message: 'OTP sent', devOtp: '123456' };
}

export async function verifyOtp(phone: string, otp: string): Promise<VerifyOtpResponse> {
  void otp;
  return {
    token: 'mock-token',
    user: { id: 1, phone, name: 'Test User', createdAt: new Date().toISOString() },
  };
}

export async function getMe(): Promise<User> {
  return { id: 1, phone: '9999999999', name: 'Test User', createdAt: new Date().toISOString() };
}

// ==================== BUSINESSES ====================
export interface Business { id: number; name: string; ownerId: number; createdAt: string; }

export async function listBusinesses(): Promise<Business[]> {
  const res = await fetch('/api/businesses');
  if (!res.ok) throw new Error('Failed to fetch businesses');
  return res.json();
}

export async function createBusiness(name: string): Promise<Business> {
  const res = await fetch('/api/businesses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to create business');
  const bus = await res.json();
  await logAction(bus.id, 'Create Business', `Created business: ${name}`);
  return bus;
}

// ==================== FOLDERS ====================
export interface Folder {
  id: number;
  businessId: number;
  name: string;
  createdAt: string;
}

export async function listFolders(businessId: number): Promise<Folder[]> {
  const res = await fetch(`/api/folders?businessId=${businessId}`);
  if (!res.ok) throw new Error('Failed to fetch folders');
  return res.json();
}

export async function createFolder(businessId: number, name: string): Promise<Folder> {
  const res = await fetch('/api/folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId, name })
  });
  if (!res.ok) throw new Error('Failed to create folder');
  const folder = await res.json();
  await logAction(businessId, 'Create File', `Created file: ${name}`);
  return folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  const res = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete folder');
}

export async function renameFolder(folderId: number, newName: string): Promise<Folder> {
  const res = await fetch(`/api/folders/${folderId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName })
  });
  if (!res.ok) throw new Error('Failed to rename folder');
  return { id: folderId, name: newName } as any;
}


// ==================== REGISTERS ====================
export interface RegisterSummary {
  id: number; businessId: number; folderId?: number; name: string; icon: string; iconColor?: string;
  category: string; template: string; createdAt: string; updatedAt: string; entryCount: number;
  lastActivity?: string; deletedAt?: string;
}

export interface Column {
  id: number; registerId: number; name: string; type: string; position: number;
  dropdownOptions?: string[]; formula?: string; width?: number; summary?: string;
  linkedTo?: { registerId: number; columnId: number; role?: 'source' | 'target' };
  mandatory?: boolean;
  unique?: boolean;
}

export interface CellStyle {
  textColor?: string;
  bgColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface Entry {
  id: number; registerId: number; rowNumber: number;
  cells: Record<string, string>; createdAt: string; pageIndex?: number;
  cellStyles?: Record<string, CellStyle>;
}

export interface Page { id: number; name: string; index: number; }

export interface RegisterDetail extends RegisterSummary {
  columns: Column[]; entries: Entry[]; pages: Page[];
  shareLink?: string; sharedWith?: SharedUser[];
  deletedItems?: DeletedItem[];
  migrationCompleted?: boolean;
}

export interface SharedUser {
  id: number; name: string; phone: string; permission: 'view' | 'edit'; addedAt: string;
}

export interface DeletedItem {
  id: number;
  type: 'row' | 'column';
  deletedAt: string;
  registerName: string;
  registerId: number;
  // For rows
  entry?: Entry;
  originalIndex?: number;
  // For columns
  column?: Column;
  columnCellData?: Record<string, string>; // entryId -> cellValue
}

export interface HistoryEntry {
  id: number;
  businessId: number;
  action: string;
  details: string;
  timestamp: string;
  userName?: string;
  userId?: string | number;
  userEmail?: string;
  registerName?: string;
  registerId?: number;
  entryId?: number;
}

export interface SearchResult {
  registerId: number;
  registerName: string;
  folderId?: number;
  entryId: number;
  rowNumber: number;
  matchedText: string;
  matchedColumnId?: string;
  pageIndex?: number;
}

export async function searchAllRegisters(businessId: number, searchTerm: string): Promise<SearchResult[]> {
  const q = searchTerm.toLowerCase();
  if (!q) return [];

  const summaries = await listRegisters(businessId);
  const results: SearchResult[] = [];

  const allRegs = await Promise.all(summaries.map(s => getRegister(s.id).catch(() => null)));

  for (const reg of allRegs) {
    if (!reg || reg.deletedAt) continue;

    // Check if register name matches
    if (reg.name.toLowerCase().includes(q)) {
      results.push({
        registerId: reg.id,
        registerName: reg.name,
        folderId: reg.folderId,
        entryId: -1,
        rowNumber: -1,
        matchedText: reg.name,
      });
    }

    // Check entries
    for (const entry of reg.entries) {
      for (const colId in entry.cells) {
        const val = entry.cells[colId] || '';
        if (val.toLowerCase().includes(q)) {
          results.push({
            registerId: reg.id,
            registerName: reg.name,
            folderId: reg.folderId,
            entryId: entry.id,
            rowNumber: entry.rowNumber,
            matchedText: val,
            matchedColumnId: colId,
            pageIndex: entry.pageIndex,
          });
          break; // Stop checking this entry once we found a match
        }
      }
    }
  }

  return results;
}

// ── Memory cache and queues ───────────────────────────────────────────────────
const firestoreRegisterCache = new Map<number, RegisterDetail>();
const registerMutationQueues = new Map<string | number, Promise<any>>();
let pendingMutationsCount = 0;
const mutationListeners = new Set<(count: number) => void>();
let lastGeneratedId = 0;

function generateId(): number {
  const now = Date.now();
  lastGeneratedId = now <= lastGeneratedId ? lastGeneratedId + 1 : now;
  return lastGeneratedId;
}

export function subscribeToMutationStatus(callback: (count: number) => void) {
  mutationListeners.add(callback);
  callback(pendingMutationsCount);
  return () => mutationListeners.delete(callback);
}

function updateMutationCount(delta: number) {
  pendingMutationsCount += delta;
  mutationListeners.forEach(cb => cb(pendingMutationsCount));
}

async function runQueuedMutation<T>(registerId: number | string, op: () => Promise<T>): Promise<T> {
  const key = registerId.toString();
  const currentQueue = registerMutationQueues.get(key) || Promise.resolve();
  updateMutationCount(1);
  const next = currentQueue.then(op).finally(() => {
    updateMutationCount(-1);
  }).catch((err) => {
    console.error(`Mutation failed for register ${key}:`, err);
    throw err;
  });
  registerMutationQueues.set(key, next);
  return next;
}

/** Helper to populate auto-increment values for existing rows */
function populateAutoIncrement(reg: RegisterDetail, columnId: number) {
  const colIdStr = columnId.toString();
  let maxVal = 0;
  reg.entries.forEach(e => {
    const v = parseInt(e.cells?.[colIdStr] || '0', 10);
    if (!isNaN(v) && v > maxVal) maxVal = v;
  });
  reg.entries.forEach(e => {
    if (!e.cells) e.cells = {};
    if (!e.cells[colIdStr] || e.cells[colIdStr].trim() === '') {
      maxVal++;
      e.cells[colIdStr] = maxVal.toString();
    }
  });
}

/**
 * Updates the column name to include or remove currency symbols based on the type.
 * Ensures the header visually matches the column format.
 */
function updateColumnSymbol(col: Column, newType: string) {
  let cleanName = col.name.replace(/\s*\([₹$]\)$|\s*\(Rs\)$|\s*\(₹\)$/i, '').trim();
  if (newType === 'currency') {
    col.name = `${cleanName} (₹)`;
  } else {
    col.name = cleanName;
  }
}

/**
 * Re-calculates rowNumber for all entries in a register based on their order in the array.
 * rowNumber is absolute across all pages (1, 2, 3...).
 */
function renumberRows(reg: RegisterDetail) {
  reg.entries.forEach((e, i) => {
    e.rowNumber = i + 1;
  });
}

async function getRegDoc(registerId: number): Promise<RegisterDetail> {
  const cached = firestoreRegisterCache.get(registerId);
  if (cached) {
    return structuredClone(cached);
  }

  const res = await fetch(`/api/registers/${registerId}`);
  if (!res.ok) throw new Error('Register not found');
  const data = await res.json() as RegisterDetail;

  if (!data.columns) data.columns = [];
  data.columns.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!data.pages) data.pages = [];
  if (!data.sharedWith) data.sharedWith = [];
  if (!data.entries) data.entries = [];

  data.entries.forEach(e => { if (!e.cells) e.cells = {}; });
  renumberRows(data);

  firestoreRegisterCache.set(registerId, data);
  return structuredClone(data);
}

/**
 * Immediately persist a register to database.
 */
async function saveRegDocImmediate(reg: RegisterDetail): Promise<void> {
  firestoreRegisterCache.set(reg.id, reg);

  const res = await fetch(`/api/registers/${reg.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(reg)
  });

  if (!res.ok) throw new Error('Failed to save register to database');
}

/**
 * Lightweight save helper for appends: updates the main document and ONLY writes
 * the affected last chunk to database.
 */
async function saveAddedEntryOnly(reg: RegisterDetail, newEntryIndex: number): Promise<void> {
  void newEntryIndex;
  await saveRegDocImmediate(reg);
}

async function flushPendingWrite(registerId: number): Promise<void> {
  const queue = registerMutationQueues.get(registerId);
  if (queue) await queue;
}

/**
 * Flush all pending debounced writes across all registers to database.
 */
export async function flushAllPendingWrites(): Promise<void> {
  await Promise.all(Array.from(registerMutationQueues.values()));
}

// Export so the query can bust the cache when needed
export function bustRegisterCache(registerId: number): void {
  flushPendingWrite(registerId);
  firestoreRegisterCache.delete(registerId);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function listRegisters(businessId: number): Promise<RegisterSummary[]> {
  const res = await fetch(`/api/registers?businessId=${businessId}`);
  if (!res.ok) throw new Error('Failed to fetch registers');
  return res.json();
}

export async function listDeletedRegisters(businessId: number): Promise<RegisterSummary[]> {
  const res = await fetch(`/api/registers/deleted?businessId=${businessId}`);
  if (!res.ok) throw new Error('Failed to fetch deleted registers');
  return res.json();
}

export async function getRegisterColumnsOnly(registerId: number): Promise<RegisterDetail> {
  if (firestoreRegisterCache.has(registerId)) {
    const cached = structuredClone(firestoreRegisterCache.get(registerId)!);
    cached.entries = []; // Strip entries to save memory/processing
    return cached;
  }
  const res = await fetch(`/api/registers/${registerId}/columns-only`);
  if (!res.ok) throw new Error('Failed to fetch register columns');
  return res.json();
}

export async function getRegister(registerId: number): Promise<RegisterDetail> {
  const reg = await getRegDoc(registerId);
  if (!reg.pages || reg.pages.length === 0) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
  if (!reg.entries) reg.entries = [];
  if (!reg.columns) reg.columns = [];
  reg.columns.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  let needsSave = false;
  if (!reg.migrationCompleted) {
    let isOutOfOrder = false;
    for (let i = 1; i < reg.entries.length; i++) {
      if (reg.entries[i].id < reg.entries[i - 1].id) {
        isOutOfOrder = true;
        break;
      }
    }

    if (isOutOfOrder) {
      reg.entries.sort((a, b) => a.id - b.id);
    }

    const seenIds = new Set<number>();
    reg.entries.forEach((e, idx) => {
      if (seenIds.has(e.id)) {
        needsSave = true;
        e.id = reg.id + 10000 + idx;
      }
      seenIds.add(e.id);
    });

    reg.entries.forEach((e, i) => { e.rowNumber = i + 1; });
    reg.migrationCompleted = true;
    needsSave = true;
  }

  if (reg.entryCount !== reg.entries.length) {
    reg.entryCount = reg.entries.length;
    needsSave = true;
  }

  // Dynamic sync for target linked columns to guarantee perfect parity with source
  for (const col of reg.columns) {
    if (col.linkedTo && col.linkedTo.role === 'target') {
      try {
        const sourceReg = await getRegDoc(col.linkedTo.registerId);
        const sourceCol = sourceReg.columns.find(c => c.id === col.linkedTo!.columnId);
        if (sourceCol) {
          if (col.name !== sourceCol.name) {
            col.name = sourceCol.name;
            needsSave = true;
          }
          if (col.type !== sourceCol.type) {
            col.type = sourceCol.type;
            needsSave = true;
          }
          if (JSON.stringify(col.dropdownOptions || null) !== JSON.stringify(sourceCol.dropdownOptions || null)) {
            col.dropdownOptions = sourceCol.dropdownOptions;
            needsSave = true;
          }

          const sourceColIdStr = sourceCol.id.toString();
          const targetColIdStr = col.id.toString();
          sourceReg.entries.forEach(sourceEntry => {
            const val = sourceEntry.cells?.[sourceColIdStr];
            let targetEntry = reg.entries.find(e => e.rowNumber === sourceEntry.rowNumber);
            if (!targetEntry) {
              targetEntry = {
                id: generateId(),
                registerId: registerId,
                rowNumber: sourceEntry.rowNumber,
                cells: {},
                createdAt: new Date().toISOString(),
                pageIndex: 0
              };
              reg.entries.push(targetEntry);
              needsSave = true;
            }
            if (!targetEntry.cells) {
              targetEntry.cells = {};
              needsSave = true;
            }
            if (targetEntry.cells[targetColIdStr] !== val) {
              if (val === undefined) {
                delete targetEntry.cells[targetColIdStr];
              } else {
                targetEntry.cells[targetColIdStr] = val;
              }
              needsSave = true;
            }
          });

          const maxSourceRow = Math.max(...sourceReg.entries.map(e => e.rowNumber), 0);
          reg.entries.forEach(targetEntry => {
            if (targetEntry.rowNumber > maxSourceRow && targetEntry.cells?.[targetColIdStr] !== undefined) {
              delete targetEntry.cells[targetColIdStr];
              needsSave = true;
            }
          });
        }
      } catch (err) {
        console.error('Failed to dynamically sync linked target column:', err);
      }
    }
  }

  if (needsSave) {
    await saveRegDocImmediate(reg);
  }

  return reg;
}

export async function createRegister(data: {
  businessId: number; folderId?: number; name: string; icon?: string; iconColor?: string;
  category?: string; template?: string;
  columns?: Array<{
    name: string;
    type: string;
    dropdownOptions?: string[];
    formula?: string;
    width?: number;
    summary?: string;
  }>;
}): Promise<RegisterSummary> {
  const newId = generateId();
  const newReg: RegisterDetail = {
    id: newId, businessId: data.businessId, folderId: data.folderId, name: data.name,
    icon: data.icon || 'file-text', iconColor: data.iconColor,
    category: data.category || 'general', template: data.template || data.name,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: 0,
    columns: (data.columns || []).map((c, i) => ({
      id: newId + i + 1, registerId: newId, name: c.name, type: c.type,
      position: i, dropdownOptions: c.dropdownOptions, formula: c.formula,
      width: c.width, summary: c.summary,
    })),
    entries: [], pages: [{ id: 1, name: 'Page 1', index: 0 }], sharedWith: [],
    migrationCompleted: true,
  };
  if (newReg.columns.length > 0) {
    for (let i = 0; i < 10; i++) {
      newReg.entries.push({
        id: newId + 5000 + i, registerId: newId, rowNumber: i + 1,
        cells: {}, createdAt: new Date().toISOString(), pageIndex: 0,
      });
    }
    newReg.entryCount = 10;
  }
  
  const res = await fetch('/api/registers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      businessId: data.businessId,
      folderId: data.folderId,
      name: data.name,
      icon: data.icon,
      iconColor: data.iconColor,
      category: data.category,
      template: data.template,
      columns: newReg.columns
    })
  });
  if (!res.ok) throw new Error('Failed to create register');
  
  await logAction(data.businessId, 'Create Register', `Created register: ${data.name}`, { registerId: newId, registerName: data.name });
  return newReg;
}

export async function deleteRegister(registerId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  reg.deletedAt = new Date().toISOString();
  await saveRegDocImmediate(reg);
  await logAction(reg.businessId, 'Trash Register', `Moved register to recycle bin: ${reg.name}`, { registerId, registerName: reg.name });
}

export async function permanentlyDeleteRegister(registerId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  const res = await fetch(`/api/registers/${registerId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete register permanently');
  
  firestoreRegisterCache.delete(registerId);
  await logAction(reg.businessId, 'Delete Register', `Permanently deleted register: ${reg.name}`, { registerId, registerName: reg.name });
}

export async function restoreRegister(registerId: number): Promise<void> {
  const reg = await getRegDoc(registerId);
  delete reg.deletedAt;
  await saveRegDocImmediate(reg);
  await logAction(reg.businessId, 'Restore Register', `Restored register: ${reg.name}`, { registerId, registerName: reg.name });
}

export async function renameRegister(registerId: number, newName: string): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const oldName = reg.name;
    reg.name = newName;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Rename Register', `Renamed register from "${oldName}" to "${newName}"`, { registerId, registerName: newName });
    return reg;
  });
}

export async function duplicateRegister(registerId: number): Promise<RegisterSummary> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const newId = generateId();
    const duplicated: RegisterDetail = {
      ...JSON.parse(JSON.stringify(reg)), id: newId, name: `${reg.name} (Copy)`,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), entryCount: reg.entries.length,
      migrationCompleted: true,
    };
    duplicated.columns = duplicated.columns.map((c: Column, i: number) => ({ ...c, id: newId + i + 1, registerId: newId }));
    duplicated.entries = duplicated.entries.map((e: Entry, i: number) => ({ ...e, id: newId + 1000 + i, registerId: newId }));
    duplicated.pages = duplicated.pages.map((p: Page, i: number) => ({ ...p, id: newId + 2000 + i }));
    
    await saveRegDocImmediate(duplicated);
    return duplicated;
  });
}

export async function moveRegisterToFolder(registerId: number, folderId: number | null): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (folderId !== null) {
      reg.folderId = folderId;
    } else {
      delete reg.folderId;
    }
    await saveRegDocImmediate(reg);
  });
}


// ── Excel Import: Column-type alias map ──────────────────────────────────────
// Maps common Excel header patterns → { type, dropdownOptions? }
// Keys are lowercase. Matching uses both exact and substring checks.
interface ColumnHint { type: string; dropdownOptions?: string[] }

const COLUMN_ALIASES: Record<string, ColumnHint> = {
  // ── Date fields ──
  'dob': { type: 'date' },
  'date of birth': { type: 'date' },
  'd.o.b': { type: 'date' },
  'date': { type: 'date' },
  'admission date': { type: 'date' },
  'joining date': { type: 'date' },
  'join date': { type: 'date' },
  'paid date': { type: 'date' },
  'due date': { type: 'date' },
  'start date': { type: 'date' },
  'end date': { type: 'date' },
  'expiry': { type: 'date' },
  'expiry date': { type: 'date' },

  // ── Grade / Standard / Class ──
  'grade': { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'class': { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'standard': { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'std': { type: 'dropdown', dropdownOptions: ['PRE-KG', 'LKG', 'UKG', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'] },
  'section': { type: 'dropdown', dropdownOptions: ['A', 'B', 'C', 'D', 'E'] },

  // ── Gender ──
  'gender': { type: 'dropdown', dropdownOptions: ['Male', 'Female', 'Other'] },
  'sex': { type: 'dropdown', dropdownOptions: ['Male', 'Female', 'Other'] },

  // ── Community / Caste ──
  'community': { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'com': { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'caste': { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },
  'category': { type: 'dropdown', dropdownOptions: ['OC', 'BC', 'MBC', 'SC', 'ST', 'Other'] },

  // ── Status ──
  'status': { type: 'dropdown', dropdownOptions: ['Active', 'Inactive', 'Pending'] },
  'old/new': { type: 'dropdown', dropdownOptions: ['OLD', 'NEW'] },
  'old / new': { type: 'dropdown', dropdownOptions: ['OLD', 'NEW'] },
  'sib stu': { type: 'checkbox' },
  'sibling': { type: 'checkbox' },

  // ── Religion ──
  'religion': { type: 'dropdown', dropdownOptions: ['Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Other'] },

  // ── Blood Group ──
  'blood group': { type: 'dropdown', dropdownOptions: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  'blood grp': { type: 'dropdown', dropdownOptions: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },

  // ── Payment mode ──
  'payment mode': { type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },
  'mode of payment': { type: 'dropdown', dropdownOptions: ['Cash', 'UPI', 'Card', 'Credit', 'Cheque'] },

  // ── Numeric fields ──
  's.no': { type: 'number' },
  's.no.': { type: 'number' },
  'sno': { type: 'number' },
  'sl no': { type: 'number' },
  'sl.no': { type: 'number' },
  'sl.no.': { type: 'number' },
  'serial': { type: 'number' },
  'serial no': { type: 'number' },
  'roll no': { type: 'number' },
  'roll number': { type: 'number' },
  'age': { type: 'number' },
  'amount': { type: 'number' },
  'total': { type: 'number' },
  'balance': { type: 'number' },
  'fees': { type: 'number' },
  'fee': { type: 'number' },
  'price': { type: 'number' },
  'qty': { type: 'number' },
  'quantity': { type: 'number' },
};

// Substring patterns checked when the exact alias lookup misses
const COLUMN_SUBSTRING_HINTS: { pattern: string; hint: ColumnHint }[] = [
  { pattern: 'date', hint: { type: 'date' } },
  { pattern: 'phone', hint: { type: 'text' } },
  { pattern: 'mobile', hint: { type: 'text' } },
  { pattern: 'contact', hint: { type: 'text' } },
  { pattern: 'number', hint: { type: 'text' } },  // fallback — could be roll no, phone no, etc.
  { pattern: 'address', hint: { type: 'text' } },
  { pattern: 'email', hint: { type: 'text' } },
  { pattern: 'remark', hint: { type: 'text' } },
  { pattern: 'note', hint: { type: 'text' } },
];

/**
 * Convert an Excel serial date number to a DD-MM-YYYY string.
 * Excel serial: days since 1900-01-01 (with the Lotus 1-2-3 leap year bug).
 */
function excelSerialToDateStr(serial: number): string {
  // Excel epoch: Jan 0 1900 (i.e. Dec 31 1899).
  // 25569 is the number of days between Jan 1 1900 and Jan 1 1970.
  const utcDays = serial - 25569;
  const ms = utcDays * 86400 * 1000;
  const d = new Date(ms);

  // Use UTC methods to avoid timezone shifts
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();

  return `${dd}-${mm}-${yyyy}`;
}

/**
 * Robustly convert any date-like value (string, number, Date) to DD-MM-YYYY.
 * Enforces consistency across import, display, and storage.
 */
export function formatDateToDDMMYYYY(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  // 1. Handle Excel Serial Dates
  if (typeof val === 'number' && looksLikeExcelSerial(val)) {
    return excelSerialToDateStr(val);
  }

  // 2. Handle JS Date object
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    return `${d}-${m}-${y}`;
  }

  // 3. Handle String input
  let s = String(val).trim();
  if (!s) return '';

  // Standardize separators to -
  s = s.replace(/[\/.]/g, '-');

  const parts = s.split('-');
  if (parts.length === 3) {
    let p1 = parts[0].padStart(2, '0');
    let p2 = parts[1].padStart(2, '0');
    let p3 = parts[2];

    // Handle YYYY/MM/DD or YYYY-MM-DD
    if (p1.length === 4) {
      return `${p3.padStart(2, '0')}-${p2}-${p1}`;
    }

    // Handle 2-digit years
    if (p3.length === 2) {
      const year = parseInt(p3);
      p3 = (year < 50 ? '20' : '19') + p3;
    }

    const n1 = parseInt(p1);
    const n2 = parseInt(p2);

    // If it's ambiguous (both <= 12), we might need to know the source.
    // The user explicitly stated that dates are coming in as MM/DD/YYYY incorrectly.
    // So if n1 <= 12 and n2 > 12, it's definitely MM/DD/YYYY -> Swap.
    // If both are <= 12, it's ambiguous, but we prioritize DD-MM-YYYY as the target.

    if (n1 <= 12 && n2 > 12) {
      // Clearly MM/DD/YYYY (e.g. 05/15/2023) -> Swap to DD-MM-YYYY (15-05-2023)
      return `${p2}-${p1}-${p3}`;
    }

    // Normal case or ambiguous: assume p1 is Day, p2 is Month.
    return `${p1}-${p2}-${p3}`;
  }

  // Final fallback: try native Date parsing
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  return s;
}


/** Check if a value looks like an Excel serial date (number between ~1 and ~60000). */
function looksLikeExcelSerial(val: unknown): boolean {
  if (typeof val !== 'number') return false;
  return val > 1 && val < 200000 && Number.isInteger(val);
}

/**
 * Resolve a column's type by:
 *  1. Exact template column match (case-insensitive)
 *  2. Exact alias map lookup
 *  3. Substring alias patterns
 *  4. Data-driven detection (sample actual values)
 */
function resolveColumnType(
  header: string,
  bestTemplate: Template | null,
  sampleValues: (string | number | boolean | null)[],
): { type: string; dropdownOptions?: string[]; formula?: string } {
  const lowerH = header.toLowerCase().trim();

  // 1. Exact case-insensitive template column match
  if (bestTemplate) {
    const tplCol = bestTemplate.columns.find(
      (c: TemplateColumn) => c.name.toLowerCase().trim() === lowerH,
    );
    if (tplCol) {
      return { type: tplCol.type, dropdownOptions: tplCol.dropdownOptions, formula: tplCol.formula };
    }
  }

  // 2. Exact alias map lookup
  if (COLUMN_ALIASES[lowerH]) {
    return { ...COLUMN_ALIASES[lowerH] };
  }

  // 3. Substring alias patterns
  for (const { pattern, hint } of COLUMN_SUBSTRING_HINTS) {
    if (lowerH.includes(pattern)) {
      return { ...hint };
    }
  }

  // Also check alias keys as substrings (e.g., header "STUDENT GRADE" contains "grade")
  for (const [aliasKey, aliasHint] of Object.entries(COLUMN_ALIASES)) {
    if (lowerH.includes(aliasKey) || aliasKey.includes(lowerH)) {
      return { ...aliasHint };
    }
  }

  // 4. Data-driven detection: sample non-empty values
  const nonEmpty = sampleValues
    .filter((v) => v !== null && v !== undefined && v !== '')
    .slice(0, 20); // sample up to 20 rows

  if (nonEmpty.length > 0) {
    // Check if most values look like dates (DD-MM-YYYY, YYYY-MM-DD, etc.)
    const datePattern = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/;
    const dateCount = nonEmpty.filter((v) => datePattern.test(String(v).trim())).length;
    if (dateCount >= nonEmpty.length * 0.6) {
      return { type: 'date' };
    }

    // Check if values are Excel serial dates (all numbers in a plausible date range)
    const serialDateCount = nonEmpty.filter((v) => looksLikeExcelSerial(v)).length;
    if (serialDateCount >= nonEmpty.length * 0.6) {
      return { type: 'date' };
    }

    // Check if all values are numbers
    const numCount = nonEmpty.filter((v) => !isNaN(Number(v))).length;
    if (numCount >= nonEmpty.length * 0.8) {
      return { type: 'number' };
    }
  }

  return { type: 'text' };
}

export const importExcelData = async (
  businessId: number,
  name: string,
  data: Record<string, string | number | boolean | null>[],
  folderId?: number,
  metadata?: any[]
): Promise<RegisterSummary> => {
  if (!data || data.length === 0) throw new Error("No data found in the spreadsheet");

  const headers = Object.keys(data[0]);

  // ── Find best-matching template (case-insensitive + alias-aware) ──
  let bestTemplate: Template | null = null;
  let maxMatches = 0;

  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  for (const cat in TEMPLATES) {
    for (const tpl of TEMPLATES[cat]) {
      if (!tpl.columns.length) continue; // skip "Blank Register"
      let matchCount = 0;
      for (const tc of tpl.columns) {
        const tcLower = tc.name.toLowerCase().trim();
        // Exact match or header-contains-template or template-contains-header
        if (normalizedHeaders.some(nh =>
          nh === tcLower ||
          nh.includes(tcLower) ||
          tcLower.includes(nh)
        )) {
          matchCount++;
        }
      }
      if (matchCount > maxMatches && matchCount >= 2) {
        maxMatches = matchCount;
        bestTemplate = tpl;
      }
    }
  }

  // ── Build column definitions ──
  // Filter out 'S.No.' if it's the first column (likely from a previous export)
  const filteredHeaders = headers.filter((h, i) => i > 0 || (h.toLowerCase() !== 's.no.' && h.toLowerCase() !== 's.no'));

  const columns = filteredHeaders.map((h, i) => {
    // Collect sample values for this column from the data
    const sampleValues = data.slice(0, 30).map(row => row[h]);

    let resolved: any;
    if (metadata) {
      const meta = metadata.find(m => m['Column Name'] === h);
      if (meta) {
        const parsedWidth = meta['Width'] ? parseInt(meta['Width']) : undefined;
        resolved = {
          type: meta['Type'] || 'text',
          dropdownOptions: meta['Dropdown Options'] ? meta['Dropdown Options'].split(',').filter(Boolean) : undefined,
          formula: meta['Formula'] || undefined,
          width: isNaN(parsedWidth as any) ? undefined : parsedWidth,
          summary: meta['Summary'] || undefined
        };
      }
    }

    if (!resolved) {
      resolved = resolveColumnType(h, bestTemplate, sampleValues);
    }

    return {
      name: h || `Column ${i + 1}`,
      type: resolved.type,
      dropdownOptions: resolved.dropdownOptions,
      formula: resolved.formula,
      width: resolved.width,
      summary: resolved.summary,
    };
  });

  const createdReg = await createRegister({ businessId, folderId, name, columns: columns as any }) as RegisterDetail;

  // Clear the 3 default empty rows that createRegister adds, then populate from Excel data.
  // Work with the cached copy directly — no redundant getRegDoc round-trip needed.
  createdReg.entries = [];

  // Identify if there is an S.No column to preserve row numbering
  const sNoHeader = headers.find((h, i) => i === 0 && (h.toLowerCase() === 's.no.' || h.toLowerCase() === 's.no' || h.toLowerCase() === 'sr.no' || h.toLowerCase() === 'sr.no.'));

  data.forEach((row, rowIndex) => {
    const cells: Record<string, string> = {};
    createdReg.columns.forEach((col) => {
      let val = row[col.name];
      if (val !== undefined && val !== null && val !== '') {
        // Use unified date formatter for consistency across import, display, and storage
        if (col.type === 'date') {
          val = formatDateToDDMMYYYY(val);
        }
        cells[col.id.toString()] = String(val);
      }
    });

    let rowNumber = rowIndex + 1;
    if (sNoHeader && row[sNoHeader]) {
      const parsed = parseInt(String(row[sNoHeader]));
      if (!isNaN(parsed)) rowNumber = parsed;
    }

    // Stable ID: use offset to avoid Number.MAX_SAFE_INTEGER precision loss.
    createdReg.entries.push({
      id: createdReg.id + 10000 + rowIndex,
      registerId: createdReg.id,
      rowNumber,
      cells,
      createdAt: new Date().toISOString(),
      pageIndex: 0,
    });
  });

  createdReg.entryCount = createdReg.entries.length;
  await saveRegDocImmediate(createdReg);
  return createdReg;
};

// ─── Formula Engine ──────────────────────────────────────────────────────────
// Supports: {Column Name} references, +  -  *  /  ()  ^  %  Math functions

function parseAndEval(expr: string): number {
  expr = expr.trim();
  let pos = 0;

  function peek(): string { return expr[pos] || ''; }
  function consume(): string { return expr[pos++] || ''; }
  function skipWS() { while (pos < expr.length && expr[pos] === ' ') pos++; }

  function parseExpr(): number { return parseAddSub(); }

  function parseAddSub(): number {
    let left = parseMulDiv();
    skipWS();
    while (peek() === '+' || peek() === '-') {
      const op = consume();
      skipWS();
      const right = parseMulDiv();
      left = op === '+' ? left + right : left - right;
      skipWS();
    }
    return left;
  }

  function parseMulDiv(): number {
    let left = parsePow();
    skipWS();
    while (peek() === '*' || peek() === '/') {
      const op = consume();
      skipWS();
      const right = parsePow();
      if (op === '/' && right === 0) return NaN;
      left = op === '*' ? left * right : left / right;
      skipWS();
    }
    return left;
  }

  function parsePow(): number {
    const base = parseUnary();
    skipWS();
    if (peek() === '^') {
      consume();
      skipWS();
      const exp = parseUnary();
      return Math.pow(base, exp);
    }
    return base;
  }

  function parseUnary(): number {
    skipWS();
    if (peek() === '-') { consume(); return -parsePrimary(); }
    if (peek() === '+') { consume(); return parsePrimary(); }
    return parsePrimary();
  }

  function parseNumber(): number {
    let num = '';
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) { num += consume(); }
    return parseFloat(num) || 0;
  }

  const MATH_FNS: Record<string, (a: number) => number> = {
    abs: Math.abs, sqrt: Math.sqrt, ceil: Math.ceil, floor: Math.floor,
    round: Math.round, log: Math.log, log10: Math.log10,
    sin: Math.sin, cos: Math.cos, tan: Math.tan,
  };

  function parsePrimary(): number {
    skipWS();
    if (peek() === '(') {
      consume();
      const val = parseExpr();
      skipWS();
      if (peek() === ')') consume();
      return val;
    }
    if (/[a-zA-Z]/.test(peek())) {
      let name = '';
      while (pos < expr.length && /[a-zA-Z0-9_]/.test(expr[pos])) { name += consume(); }
      skipWS();
      if (peek() === '(') {
        consume();
        const arg = parseExpr();
        skipWS();
        if (peek() === ')') consume();
        const fn = MATH_FNS[name.toLowerCase()];
        if (fn) return fn(arg);
        return 0;
      }
      return 0;
    }
    return parseNumber();
  }

  return parseExpr();
}

const _sortedColumnsCache = new WeakMap<any[], any[]>();
const _regexCache = new Map<string, RegExp>();
function getColumnRegex(name: string): RegExp {
  const cached = _regexCache.get(name);
  if (cached) return cached;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('\\{' + escaped + '\\}', 'gi');
  _regexCache.set(name, regex);
  return regex;
}

// Cache evaluated formulas per entry object to avoid redundant heavy calculations (especially in stats loops)
const _formulaResultCache = new WeakMap<Entry, Map<string, string>>();

export function evaluateFormula(formula: string, entry: Entry, columns: Column[]): string {
  if (!formula || formula.trim() === '') return '';

  // Check cache first
  let entryCache = _formulaResultCache.get(entry);
  if (!entryCache) {
    entryCache = new Map<string, string>();
    _formulaResultCache.set(entry, entryCache);
  }
  const cachedResult = entryCache.get(formula);
  if (cachedResult !== undefined) return cachedResult;

  try {
    let sorted = _sortedColumnsCache.get(columns);
    if (!sorted) {
      sorted = [...columns].sort((a, b) => b.name.length - a.name.length);
      _sortedColumnsCache.set(columns, sorted);
    }

    let expression = formula;
    // Check if formula contains any curly braces before doing expensive replacements
    if (!expression.includes('{')) {
      const result = parseAndEval(expression);
      return (typeof result === 'number' && isFinite(result)) ? result.toString() : '';
    }

    for (const col of sorted) {
      const colPlaceholder = `{${col.name}}`;
      if (!expression.toLowerCase().includes(colPlaceholder.toLowerCase())) continue;

      const regex = getColumnRegex(col.name);
      const rawVal = entry.cells?.[col.id.toString()] ?? '';
      let numStr: string;

      if (col.type === 'formula' && col.formula) {
        const nested = evaluateFormula(col.formula, entry, columns);
        numStr = (nested === '') ? '0' : nested;
      } else {
        // Strip currency symbols and commas first
        const cleaned = rawVal.replace(/[₹$,]/g, '').trim();
        // Ignore values with suffixes like "x" in calculations
        if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
          numStr = parseFloat(cleaned).toString();
        } else {
          numStr = '0';
        }
      }
      expression = expression.replace(regex, numStr);
    }

    expression = expression.replace(/\{[^}]*\}/g, '0');
    expression = expression.trim();
    if (expression === '') return '';

    let finalResult = '';
    const result = parseAndEval(expression);
    if (typeof result === 'number' && isFinite(result)) {
      if (Number.isInteger(result)) {
        finalResult = result.toString();
      } else {
        const fixed = parseFloat(result.toFixed(2));
        finalResult = fixed.toString();
      }
    }

    entryCache.set(formula, finalResult);
    return finalResult;
  } catch {
    entryCache.set(formula, '');
    return '';
  }
}


// ─── Column Operations ──────────────────────────────────────────────────────

export async function addColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.columns.sort((a, b) => a.position - b.position); // ensure canonical order
    const colId = generateId();
    const col: Column = {
      id: colId, registerId, name: data.name, type: data.type,
      position: reg.columns.length, dropdownOptions: data.dropdownOptions, formula: data.formula,
    };
    reg.columns.push(col);
    reg.columns.forEach((c, i) => c.position = i); // re-normalise
    if (data.type === 'auto_increment') {
      populateAutoIncrement(reg, colId);
    }
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Add Column', `Added column "${data.name}" (${data.type}) to "${reg.name}"`, { registerId, registerName: reg.name });
    return reg;
  });
}

export async function deleteColumn(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find(c => c.id.toString() === columnId.toString());
    if (!col) return reg;
    if (col.type === 'formula') {
      throw new Error('Formula columns cannot be deleted');
    }
    const colName = col.name;

    // Collect cell data for this column before removing
    const columnCellData: Record<string, string> = {};
    reg.entries.forEach((e) => {
      const val = e.cells?.[columnId.toString()];
      if (val !== undefined && val !== '') {
        columnCellData[e.id.toString()] = val;
      }
    });

    // Move to bin
    if (!reg.deletedItems) reg.deletedItems = [];
    reg.deletedItems.push({
      id: generateId(),
      type: 'column',
      deletedAt: new Date().toISOString(),
      registerName: reg.name,
      registerId: reg.id,
      column: { ...col },
      columnCellData,
    });

    reg.columns = reg.columns.filter((c) => c.id.toString() !== columnId.toString());
    reg.columns.sort((a, b) => a.position - b.position); // ensure canonical order before re-normalise
    reg.columns.forEach((c, i) => c.position = i);
    // Cleanup entry data
    reg.entries.forEach((e) => { if (e.cells) delete e.cells[columnId.toString()]; });
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Delete Column', `Deleted column "${colName}" from "${reg.name}"`, { registerId, registerName: reg.name });
    return reg;
  });
}

/**
 * Restore a previously deleted column with all its cell data.
 * Uses splice at the exact original position so the column lands
 * back in the correct slot, then re-normalises all positions.
 */
export async function restoreColumn(
  registerId: number,
  column: Column,
  cellData: Record<string, string>,  // entryId -> cellValue
): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);

    // Splice at the exact original index (clamped to current length)
    reg.columns.sort((a, b) => a.position - b.position); // ensure canonical order
    const insertAt = Math.min(column.position, reg.columns.length);
    reg.columns.splice(insertAt, 0, column);

    // Re-normalise positions so they're 0, 1, 2, …
    reg.columns.forEach((c, i) => c.position = i);

    // Restore cell data for this column across all entries
    const colIdStr = column.id.toString();
    reg.entries.forEach(e => {
      const val = cellData[e.id.toString()];
      if (val !== undefined) {
        if (!e.cells) e.cells = {};
        e.cells[colIdStr] = val;
      }
    });

    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function renameColumn(registerId: number, columnId: number, newName: string): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    const oldName = col.name;
    col.name = newName;
    updateColumnSymbol(col, col.type);
    const finalNewName = col.name;

    // Update any formulas referencing this column name
    if (oldName !== finalNewName) {
      const escapedOldName = oldName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\{${escapedOldName}\\}`, 'gi');
      reg.columns.forEach((c) => {
        if (c.type === 'formula' && c.formula) {
          c.formula = c.formula.replace(regex, `{${finalNewName}}`);
        }
      });
    }

    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Rename Column', `Renamed column "${oldName}" to "${finalNewName}" in "${reg.name}"`, { registerId, registerName: reg.name });
    return reg;
  });
}

export async function updateColumnDropdownOptions(registerId: number, columnId: number, options: string[]): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    col.dropdownOptions = options;
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function duplicateColumn(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.columns.sort((a, b) => a.position - b.position); // ensure canonical order
    const original = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!original) throw new Error('Column not found');
    const newColId = generateId();
    const newCol: Column = {
      ...original,
      id: newColId,
      name: `${original.name} (Copy)`,
      position: reg.columns.length,
    };
    reg.columns.push(newCol);
    reg.columns.forEach((c, i) => c.position = i); // re-normalise
    reg.entries.forEach((entry) => {
      const val = entry.cells?.[columnId.toString()];
      if (val !== undefined) {
        if (!entry.cells) entry.cells = {};
        entry.cells[newColId.toString()] = val;
      }
    });
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function moveColumn(registerId: number, columnId: number, direction: 'left' | 'right'): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.columns.sort((a, b) => a.position - b.position); // ensure array index === position
    const idx = reg.columns.findIndex((c) => c.id.toString() === columnId.toString());
    if (idx === -1) throw new Error('Column not found');
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx >= 0 && targetIdx < reg.columns.length) {
      [reg.columns[idx], reg.columns[targetIdx]] = [reg.columns[targetIdx], reg.columns[idx]];
      reg.columns.forEach((c, i) => c.position = i);
      await saveRegDocImmediate(reg);
    }
    return reg;
  });
}

export async function updateColumnWidth(registerId: number, columnId: number, width: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (col) {
      col.width = width;
      await saveRegDocImmediate(reg);
    }
    return reg;
  });
}

export async function updateColumnSummary(registerId: number, columnId: number, summary: string): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (col) {
      col.summary = summary;
      await saveRegDocImmediate(reg);
    }
    return reg;
  });
}

export async function reorderColumn(registerId: number, columnId: number, targetIndex: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.columns.sort((a, b) => a.position - b.position); // ensure array index === position
    const idx = reg.columns.findIndex((c) => c.id.toString() === columnId.toString());
    if (idx === -1) throw new Error('Column not found');

    // Remove the column from its original position
    const [col] = reg.columns.splice(idx, 1);

    // Insert it at the target position
    const clampedTarget = Math.max(0, Math.min(targetIndex, reg.columns.length));
    reg.columns.splice(clampedTarget, 0, col);

    // Update the position properties
    reg.columns.forEach((c, i) => c.position = i);

    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function changeColumnType(
  registerId: number,
  columnId: number,
  newType: string,
  options?: { formula?: string; dropdownOptions?: string[] },
  preventSync?: boolean
): Promise<RegisterDetail> {
  const result = await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');

    const oldType = col.type;
    col.type = newType;
    updateColumnSymbol(col, newType);

    // Reset specific fields when changing type
    if (newType === 'formula') {
      col.formula = options?.formula;
    } else {
      col.formula = undefined;
    }

    if (newType === 'dropdown') {
      col.dropdownOptions = options?.dropdownOptions;
    } else {
      col.dropdownOptions = undefined;
    }

    // Dynamic Column Formatting Logic: Clean data when switching to currency
    if (newType === 'currency') {
      const colIdStr = columnId.toString();
      reg.entries.forEach(entry => {
        const val = entry.cells?.[colIdStr];
        if (val) {
          // Strip common currency symbols and commas to keep it numeric
          const cleaned = val.replace(/[₹$,]/g, '').trim();
          // If it looks like a valid number after cleaning, save it cleaned
          if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
            if (!entry.cells) entry.cells = {};
            entry.cells[colIdStr] = cleaned;
          }
        }
      });
    }

    // Auto-populate existing rows if switching TO auto_increment
    if (newType === 'auto_increment' && oldType !== 'auto_increment') {
      populateAutoIncrement(reg, columnId);
    }

    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Change Column Type', `Changed column "${col.name}" type from "${oldType}" to "${newType}" in "${reg.name}"`, { registerId, registerName: reg.name });
    return { reg, col };
  });

  const { reg, col } = result;

  if (!preventSync && col.linkedTo) {
    await changeColumnType(col.linkedTo.registerId, col.linkedTo.columnId, newType, options, true)
      .catch(e => console.error("Failed to sync column type change:", e));
  }

  return reg;
}

export async function setColumnMandatory(registerId: number, columnId: number, mandatory: boolean): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    (col as any).mandatory = mandatory;
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function setColumnUnique(registerId: number, columnId: number, unique: boolean): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id.toString() === columnId.toString());
    if (!col) throw new Error('Column not found');
    (col as any).unique = unique;
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function clearColumnData(registerId: number, columnId: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const colIdStr = columnId.toString();
    reg.entries.forEach((entry) => {
      if (entry.cells) delete entry.cells[colIdStr];
    });
    await saveRegDocImmediate(reg);
    return reg;
  });
}

export async function insertColumn(registerId: number, data: { name: string; type: string; dropdownOptions?: string[]; formula?: string }, position: number): Promise<RegisterDetail> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const colId = generateId();
    const col: Column = {
      id: colId, registerId, name: data.name, type: data.type,
      position, dropdownOptions: data.dropdownOptions, formula: data.formula,
    };
    updateColumnSymbol(col, data.type);
    reg.columns.sort((a, b) => a.position - b.position); // ensure array index === position
    reg.columns.splice(position, 0, col);
    reg.columns.forEach((c, i) => c.position = i);
    if (data.type === 'auto_increment') {
      populateAutoIncrement(reg, colId);
    }
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Add Column', `Added column "${data.name}" (${data.type}) to "${reg.name}"`, { registerId, registerName: reg.name });
    return reg;
  });
}

export async function freezeColumn(registerId: number, columnId: number, frozen: boolean): Promise<Column> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id === columnId);
    if (!col) return {} as any;
    (col as any).frozen = frozen;
    await saveRegDocImmediate(reg);
    return col;
  });
}

export async function hideColumn(registerId: number, columnId: number, hidden: boolean): Promise<Column> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find((c) => c.id === columnId);
    if (!col) return {} as any;
    (col as any).hidden = hidden;
    await saveRegDocImmediate(reg);
    return col;
  });
}

// ─── Entry Operations ────────────────────────────────────────────────────────

export async function addEntry(registerId: number, cells: Record<string, string> = {}, pageIndex: number = 0): Promise<Entry> {
  const result = await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const pageEntries = reg.entries.filter((e) => (e.pageIndex || 0) === pageIndex);

    // Auto-populate auto_increment columns
    const autoIncrCols = reg.columns.filter(c => c.type === 'auto_increment');
    for (const col of autoIncrCols) {
      const colIdStr = col.id.toString();
      if (!cells[colIdStr]) {
        let maxVal = 0;
        for (const e of pageEntries) {
          const v = parseInt(e.cells?.[colIdStr] || '0', 10);
          if (!isNaN(v) && v > maxVal) maxVal = v;
        }
        cells[colIdStr] = (maxVal + 1).toString();
      }
    }

    const entry: Entry = {
      id: generateId(), registerId, rowNumber: 0, // Assigned by renumberRows below
      cells, createdAt: new Date().toISOString(), pageIndex,
    };
    reg.entries.push(entry);
    renumberRows(reg); // Ensure sequence is correct
    reg.entryCount = reg.entries.length;
    reg.updatedAt = new Date().toISOString();
    await saveAddedEntryOnly(reg, reg.entries.length - 1);
    const preview = Object.entries(cells).slice(0, 3).map(([id, val]) => {
      const c = reg.columns.find(col => col.id.toString() === id);
      return `${c?.name || id}: ${val}`;
    }).join(', ');
    await logAction(reg.businessId, 'Add Row', `Added new row to "${reg.name}"${preview ? ` (${preview}...)` : ''}`, { registerId, registerName: reg.name, entryId: entry.id });
    return { entry, reg };
  });

  const { entry, reg } = result;

  // Sync linked columns
  for (const [colIdStr, value] of Object.entries(cells)) {
    if (value === undefined || value === null) continue;
    const col = reg.columns.find(c => c.id.toString() === colIdStr);
    if (col?.linkedTo) {
      await _syncLinkedColumn(col.linkedTo.registerId, col.linkedTo.columnId, entry.rowNumber, value);
    }
  }

  return entry;
}

/**
 * Inserts a new entry at a specific index within the register's entry array.
 * Automatically shifts rowNumbers for subsequent entries in the same page.
 */
export async function insertEntry(registerId: number, cells: Record<string, string> = {}, pageIndex: number = 0, atIndex: number): Promise<Entry> {
  const result = await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const pageEntries = reg.entries.filter((e) => (e.pageIndex || 0) === pageIndex);

    // Auto-populate auto_increment columns
    const autoIncrCols = reg.columns.filter(c => c.type === 'auto_increment');
    for (const col of autoIncrCols) {
      const colIdStr = col.id.toString();
      if (!cells[colIdStr]) {
        let maxVal = 0;
        for (const e of pageEntries) {
          const v = parseInt(e.cells?.[colIdStr] || '0', 10);
          if (!isNaN(v) && v > maxVal) maxVal = v;
        }
        cells[colIdStr] = (maxVal + 1).toString();
      }
    }

    const entry: Entry = {
      id: generateId(), registerId, rowNumber: 0, // Assigned by renumberRows below
      cells, createdAt: new Date().toISOString(), pageIndex,
    };

    reg.entries.splice(atIndex, 0, entry);
    renumberRows(reg); // Ensure sequence is correct
    reg.entryCount = reg.entries.length;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    const preview = Object.entries(cells).slice(0, 3).map(([id, val]) => {
      const c = reg.columns.find(col => col.id.toString() === id);
      return `${c?.name || id}: ${val}`;
    }).join(', ');
    await logAction(reg.businessId, 'Insert Row', `Inserted row at position ${atIndex + 1} in "${reg.name}"${preview ? ` (${preview}...)` : ''}`, { registerId, registerName: reg.name, entryId: entry.id });
    return { entry, reg };
  });

  const { entry, reg } = result;

  // Sync linked columns
  for (const [colIdStr, value] of Object.entries(cells)) {
    if (value === undefined || value === null) continue;
    const col = reg.columns.find(c => c.id.toString() === colIdStr);
    if (col?.linkedTo) {
      await _syncLinkedColumn(col.linkedTo.registerId, col.linkedTo.columnId, entry.rowNumber, value);
    }
  }

  return entry;
}


export async function updateEntry(registerId: number, entryId: number, cells: Record<string, string>): Promise<Entry> {
  const result = await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const entry = reg.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Entry not found');

    // Security: Filter out any attempts to manually update auto_increment columns
    const autoColIds = new Set(reg.columns.filter(c => c.type === 'auto_increment').map(c => c.id.toString()));
    const safeCells = Object.fromEntries(
      Object.entries(cells).filter(([colId]) => !autoColIds.has(colId))
    );

    const oldCells = { ...entry.cells };

    entry.cells = { ...entry.cells, ...safeCells };
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);

    // Log edit details with before and after values
    const changes = Object.entries(safeCells)
      .filter(([id, val]) => (oldCells[id] || '') !== (val || ''))
      .map(([id, val]) => {
        const c = reg.columns.find(col => col.id.toString() === id);
        const colName = c?.name || id;
        const oldVal = oldCells[id] || '';
        const newVal = val || '';

        const formatVal = (v: string, type?: string) => {
          if (!v) return '""';
          if (type === 'image' || v.startsWith('data:image/')) {
            if (v.includes('|||')) {
              const count = v.split('|||').length;
              return `[${count} Image${count > 1 ? 's' : ''}]`;
            }
            return '[Image]';
          }
          if (v.length > 60) {
            return `"${v.slice(0, 60)}..."`;
          }
          return `"${v}"`;
        };

        return `${colName} was changed from ${formatVal(oldVal, c?.type)} to ${formatVal(newVal, c?.type)}`;
      }).join(', ');

    const details = changes
      ? `Updated row #${entry.rowNumber} in "${reg.name}": ${changes}`
      : `Updated row #${entry.rowNumber} in "${reg.name}"`;

    await logAction(reg.businessId, 'Edit Row', details, { registerId, registerName: reg.name, entryId });

    return { entry, reg };
  });

  const { entry, reg } = result;

  // Sync linked columns outside main mutation block
  for (const [colIdStr, value] of Object.entries(cells)) {
    const col = reg.columns.find(c => c.id.toString() === colIdStr);
    if (col?.linkedTo) {
      await _syncLinkedColumn(col.linkedTo.registerId, col.linkedTo.columnId, entry.rowNumber, value);
    }
  }

  return entry;
}

/**
 * Lightweight cell update: patches the in-memory cache and writes ONLY the
 * affected chunk to Firestore — instead of rewriting every chunk.
 * Used by the debounced cell-edit handler for maximum speed during rapid data entry.
 */
export async function updateEntryDirect(
  registerId: number,
  entryId: number,
  cells: Record<string, string>
): Promise<Entry | null> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const entryIndex = reg.entries.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) return null;

    const entry = reg.entries[entryIndex];

    // Security: Filter out any attempts to manually update auto_increment columns
    const autoColIds = new Set(
      reg.columns.filter(c => c.type === 'auto_increment').map(c => c.id.toString())
    );
    const safeCells = Object.fromEntries(
      Object.entries(cells).filter(([colId]) => !autoColIds.has(colId))
    );

    const oldCells = { ...entry.cells };
    entry.cells = { ...entry.cells, ...safeCells };
    reg.updatedAt = new Date().toISOString();
    // Update in-memory cache immediately so next mutation sees this state
    firestoreRegisterCache.set(reg.id, reg);

    // Lightweight persist: only update the single entry's cells via PATCH
    const patchRes = await fetch(`/api/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cells: safeCells, registerId })
    });
    if (!patchRes.ok) throw new Error('Failed to save cell update');

    // Log edit details
    const changes = Object.entries(safeCells)
      .filter(([id, val]) => (oldCells[id] || '') !== (val || ''))
      .map(([id, val]) => {
        const c = reg.columns.find(col => col.id.toString() === id);
        const colName = c?.name || id;
        const oldVal = oldCells[id] || '';
        const newVal = val || '';
        const formatVal = (v: string, type?: string) => {
          if (!v) return '""';
          if (type === 'image' || v.startsWith('data:image/')) {
            if (v.includes('|||')) { const count = v.split('|||').length; return `[${count} Image${count > 1 ? 's' : ''}]`; }
            return '[Image]';
          }
          if (v.length > 60) return `"${v.slice(0, 60)}..."`;
          return `"${v}"`;
        };
        return `${colName} was changed from ${formatVal(oldVal, c?.type)} to ${formatVal(newVal, c?.type)}`;
      }).join(', ');

    const details = changes
      ? `Updated row #${entry.rowNumber} in "${reg.name}": ${changes}`
      : `Updated row #${entry.rowNumber} in "${reg.name}"`;
    await logAction(reg.businessId, 'Edit Row', details, { registerId, registerName: reg.name, entryId });

    // ── Live Sync: push changes to linked target columns ──
    for (const [colIdStr, val] of Object.entries(safeCells)) {
      if ((oldCells[colIdStr] || '') === (val || '')) continue; // skip unchanged
      const col = reg.columns.find(c => c.id.toString() === colIdStr);
      if (col?.linkedTo && col.linkedTo.role === 'source') {
        // Fire-and-forget: sync to the target register asynchronously
        _syncLinkedColumn(col.linkedTo.registerId, col.linkedTo.columnId, entry.rowNumber, val);
      }
    }

    return entry;
  });
}

// Internal helper to sync
async function _syncLinkedColumn(targetRegisterId: number, targetColumnId: number, rowNumber: number, value: string) {
  return runQueuedMutation(targetRegisterId, async () => {
    const targetReg = await getRegDoc(targetRegisterId);
    let targetEntry = targetReg.entries.find(e => e.rowNumber === rowNumber);
    if (!targetEntry) {
      // Create a new entry to sync the row
      targetEntry = {
        id: generateId(),
        registerId: targetRegisterId,
        rowNumber,
        cells: {},
        createdAt: new Date().toISOString(),
        pageIndex: 0
      };
      targetReg.entries.push(targetEntry);
      targetReg.entryCount = targetReg.entries.length;
    }
    targetEntry.cells[targetColumnId.toString()] = value;
    targetReg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(targetReg);
  }).catch(e => console.error('Failed to sync linked column:', e));
}

export async function linkColumn(
  registerId: number,
  columnId: number,
  targetRegisterId: number,
  targetColumnId: number
): Promise<void> {
  // 1. Fetch source register to extract the column's entries and metadata
  let sourceEntriesData: { rowNumber: number; value: string }[] = [];
  let sourceColName = '';
  let sourceColType = '';
  let sourceColDropdownOptions: string[] | undefined;
  
  await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find(c => c.id === columnId);
    if (col) {
      col.linkedTo = { registerId: targetRegisterId, columnId: targetColumnId, role: 'source' };
      // Capture source column metadata
      sourceColName = col.name;
      sourceColType = col.type;
      sourceColDropdownOptions = col.dropdownOptions;
      // Gather existing values
      const colIdStr = columnId.toString();
      reg.entries.forEach(e => {
        const val = e.cells?.[colIdStr];
        if (val !== undefined) {
          sourceEntriesData.push({ rowNumber: e.rowNumber, value: val });
        }
      });
      await saveRegDocImmediate(reg);
    }
  });

  // 2. Update target register: set the metadata, sync name/type, and copy the entries
  await runQueuedMutation(targetRegisterId, async () => {
    const reg = await getRegDoc(targetRegisterId);
    const col = reg.columns.find(c => c.id === targetColumnId);
    if (col) {
      col.linkedTo = { registerId, columnId, role: 'target' };
      // Sync column name and type from source
      if (sourceColName) col.name = sourceColName;
      if (sourceColType) col.type = sourceColType;
      if (sourceColDropdownOptions) col.dropdownOptions = sourceColDropdownOptions;
      
      const targetColIdStr = targetColumnId.toString();
      sourceEntriesData.forEach(({ rowNumber, value }) => {
        let targetEntry = reg.entries.find(e => e.rowNumber === rowNumber);
        if (!targetEntry) {
          targetEntry = {
            id: generateId(),
            registerId: targetRegisterId,
            rowNumber,
            cells: {},
            createdAt: new Date().toISOString(),
            pageIndex: 0
          };
          reg.entries.push(targetEntry);
        }
        if (!targetEntry.cells) targetEntry.cells = {};
        targetEntry.cells[targetColIdStr] = value;
      });
      
      // Update target register entry count
      reg.entryCount = reg.entries.length;
      await saveRegDocImmediate(reg);
    }
  });
}


export async function unlinkColumn(
  registerId: number,
  columnId: number
): Promise<void> {
  let targetRegisterId: number | undefined;
  let targetColumnId: number | undefined;

  // 1. Clear linkedTo on current column
  await runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const col = reg.columns.find(c => c.id === columnId);
    if (col && col.linkedTo) {
      targetRegisterId = col.linkedTo.registerId;
      targetColumnId = col.linkedTo.columnId;
      delete col.linkedTo;
      await saveRegDocImmediate(reg);
    }
  });

  // 2. Clear linkedTo on target/other column if found
  if (targetRegisterId !== undefined && targetColumnId !== undefined) {
    const finalTargetRegisterId: number = targetRegisterId;
    const finalTargetColumnId: number = targetColumnId;
    await runQueuedMutation(finalTargetRegisterId, async () => {
      const reg = await getRegDoc(finalTargetRegisterId);
      const col = reg.columns.find(c => c.id === finalTargetColumnId);
      if (col) {
        delete col.linkedTo;
        await saveRegDocImmediate(reg);
      }
    });
  }
}



export async function updateEntryCellStyles(registerId: number, entryId: number, cellStyles: Record<string, CellStyle>): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const entry = reg.entries.find((e) => e.id === entryId);
    if (!entry) throw new Error('Entry not found');
    entry.cellStyles = { ...(entry.cellStyles || {}), ...cellStyles };
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    return entry;
  });
}

export async function updateEntriesOrder(registerId: number, sortedEntries: Entry[]): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    // Overwrite the entire entries array with the new sorted array
    reg.entries = sortedEntries;
    renumberRows(reg); // Update row numbers to match the new order
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
  });
}

export async function deleteEntry(registerId: number, entryId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const entryIndex = reg.entries.findIndex((e) => e.id === entryId);
    if (entryIndex === -1) return;
    const entry = reg.entries[entryIndex];

    // Move to bin instead of permanent delete
    if (!reg.deletedItems) reg.deletedItems = [];
    reg.deletedItems.push({
      id: generateId(),
      type: 'row',
      deletedAt: new Date().toISOString(),
      registerName: reg.name,
      registerId: reg.id,
      entry: { ...entry },
      originalIndex: entryIndex,
    });

    reg.entries = reg.entries.filter((e) => e.id !== entryId);
    renumberRows(reg);
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Delete Row', `Deleted row #${entry.rowNumber} from "${reg.name}"`, { registerId, registerName: reg.name, entryId });
  });
}

/**
 * Restore a previously deleted entry at its original index, preserving the original ID and data.
 * Used by undo to exactly reconstruct deleted rows.
 */
export async function restoreEntry(registerId: number, entry: Entry, originalIndex?: number): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    // Insert at original position if provided, otherwise append
    if (originalIndex !== undefined && originalIndex >= 0 && originalIndex <= reg.entries.length) {
      reg.entries.splice(originalIndex, 0, entry);
    } else {
      reg.entries.push(entry);
    }
    reg.entryCount = reg.entries.length;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
    return entry;
  });
}

/**
 * Restore multiple previously deleted entries, preserving original IDs and data.
 * Entries are inserted in their original order. Used by undo for bulk delete.
 */
export async function bulkRestoreEntries(registerId: number, entries: { entry: Entry; index: number }[]): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    // Sort by index ascending so we insert in the right order
    const sorted = [...entries].sort((a, b) => a.index - b.index);
    for (const { entry, index } of sorted) {
      if (index >= 0 && index <= reg.entries.length) {
        reg.entries.splice(index, 0, entry);
      } else {
        reg.entries.push(entry);
      }
    }
    reg.entryCount = reg.entries.length;
    reg.updatedAt = new Date().toISOString();
    await saveRegDocImmediate(reg);
  });
}

export async function duplicateEntry(registerId: number, entryId: number): Promise<Entry> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const original = reg.entries.find((e) => e.id === entryId);
    if (!original) throw new Error('Entry not found');
    const duplicate: Entry = {
      id: generateId(), registerId, rowNumber: 0,
      cells: { ...original.cells }, createdAt: new Date().toISOString(), pageIndex: original.pageIndex,
    };
    reg.entries.push(duplicate);
    renumberRows(reg);
    reg.entryCount = reg.entries.length;
    await saveAddedEntryOnly(reg, reg.entries.length - 1);
    return duplicate;
  });
}

export async function bulkDeleteEntries(registerId: number, entryIds: number[]): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.deletedItems) reg.deletedItems = [];

    // Move each entry to bin
    const idsSet = new Set(entryIds);
    reg.entries.forEach((e, idx) => {
      if (idsSet.has(e.id)) {
        reg.deletedItems!.push({
          id: generateId(),
          type: 'row',
          deletedAt: new Date().toISOString(),
          registerName: reg.name,
          registerId: reg.id,
          entry: { ...e },
          originalIndex: idx,
        });
      }
    });

    reg.entries = reg.entries.filter((e) => !idsSet.has(e.id));
    renumberRows(reg); // Fix sequence after bulk delete
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
    await logAction(reg.businessId, 'Delete Rows', `Moved ${entryIds.length} rows to bin from "${reg.name}"`, { registerId, registerName: reg.name });
  });
}

// ─── Page Operations ─────────────────────────────────────────────────────────

export async function addPage(registerId: number, pageName?: string): Promise<Page> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.pages) reg.pages = [{ id: 1, name: 'Page 1', index: 0 }];
    const newPage: Page = { id: generateId(), name: pageName || `Page ${reg.pages.length + 1}`, index: reg.pages.length };
    reg.pages.push(newPage);
    await saveRegDocImmediate(reg);
    return newPage;
  });
}

export async function renamePage(registerId: number, pageId: number, newName: string): Promise<Page> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const page = reg.pages?.find((p) => p.id === pageId);
    if (!page) throw new Error('Page not found');
    page.name = newName;
    await saveRegDocImmediate(reg);
    return page;
  });
}

export async function deletePage(registerId: number, pageId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.pages || reg.pages.length <= 1) throw new Error('Cannot delete the only page');
    const targetPage = reg.pages.find((p) => p.id === pageId);
    if (!targetPage) throw new Error('Page not found');
    const targetPageIndex = targetPage.index;
    reg.pages = reg.pages.filter((p) => p.id !== pageId);
    reg.entries = reg.entries.filter((e) => (e.pageIndex || 0) !== targetPageIndex);
    reg.entryCount = reg.entries.length;
    await saveRegDocImmediate(reg);
  });
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

export async function generateShareLink(registerId: number): Promise<string> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    const link = `https://rekord.app/share/${registerId}/${Date.now().toString(36)}`;
    reg.shareLink = link;
    await saveRegDocImmediate(reg);
    return link;
  });
}

export async function addSharedUser(registerId: number, phone: string, permission: 'view' | 'edit'): Promise<SharedUser> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.sharedWith) reg.sharedWith = [];
    const user: SharedUser = {
      id: generateId(), name: `User ${phone.slice(-4)}`, phone, permission, addedAt: new Date().toISOString(),
    };
    reg.sharedWith.push(user);
    await saveRegDocImmediate(reg);
    return user;
  });
}

export async function removeSharedUser(registerId: number, userId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (reg.sharedWith) reg.sharedWith = reg.sharedWith.filter((u) => u.id !== userId);
    await saveRegDocImmediate(reg);
  });
}

// ─── Utilities (pure, no DB) ─────────────────────────────────────────────────

/** Manually trigger a save — kept for Ctrl+S compat (now a no-op since data is always in Firestore) */
export function saveToStorage(): boolean {
  return true;
}

export function generateCSV(register: RegisterDetail, pageIndex: number = 0): string {
  const cols = register.columns;
  const entries = register.entries.filter((e) => (e.pageIndex || 0) === pageIndex);
  const headers = ['S.No.', ...cols.map((c) => c.name)];
  const headerRow = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',');
  const dataRows = entries.map((entry) => {
    const row = [entry.rowNumber.toString(), ...cols.map((col) => {
      const val = entry.cells?.[col.id.toString()] || '';
      return `"${val.replace(/"/g, '""')}"`;
    })];
    return row.join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

export interface ColumnStats { sum: number; average: number; count: number; min: number; max: number; filled: number; empty: number; }

export function calculateColumnStats(entries: Entry[], columnId: string): ColumnStats {
  const values = entries.map((e) => e.cells?.[columnId]).filter((v) => v !== undefined && v !== null && v !== '');
  // Ignore values with "x" in column stats
  const numbers = values
    .filter(v => !String(v).toLowerCase().includes('x'))
    .map((v) => parseFloat(v!.replace(/[₹$,]/g, '')))
    .filter((n) => !isNaN(n));
  return {
    sum: numbers.reduce((a, b) => a + b, 0),
    average: numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0,
    count: values.length, min: numbers.length > 0 ? Math.min(...numbers) : 0,
    max: numbers.length > 0 ? Math.max(...numbers) : 0, filled: values.length,
    empty: entries.length - values.length
  };
}

export async function logAction(
  businessId: number,
  action: string,
  details: string,
  meta?: { registerId?: number; registerName?: string; entryId?: number }
): Promise<void> {
  try {
    const savedUser = JSON.parse(
      sessionStorage.getItem('recordbook_user') ||
      localStorage.getItem('recordbook_user') ||
      'null'
    );
    const entry = {
      businessId,
      action,
      details,
      timestamp: new Date().toISOString(),
      userName: savedUser?.name || 'User',
      userId: savedUser?.id || '',
      userEmail: savedUser?.email || '',
      registerId: meta?.registerId,
      registerName: meta?.registerName,
      entryId: meta?.entryId,
    };
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry)
    });
  } catch (err) {
    console.error('Failed to log action:', err);
  }
}

export async function listHistory(businessId: number): Promise<HistoryEntry[]> {
  try {
    const res = await fetch(`/api/history?businessId=${businessId}`);
    if (!res.ok) throw new Error('Failed to fetch history');
    return res.json();
  } catch (err) {
    console.error('Failed to fetch history:', err);
    return [];
  }
}

export async function listRowHistory(registerId: number, entryId: number): Promise<HistoryEntry[]> {
  try {
    const res = await fetch(`/api/history/row?registerId=${registerId}&entryId=${entryId}`);
    if (!res.ok) throw new Error('Failed to fetch row history');
    return res.json();
  } catch (err) {
    console.error('Failed to fetch row history:', err);
    return [];
  }
}

// ── Bin Management (Rows & Columns) ──────────────────────────────────────────

/**
 * Get all deleted items (rows + columns) across all registers for a business.
 */
export async function getAllDeletedItems(businessId: number): Promise<DeletedItem[]> {
  const summaries = await listRegisters(businessId);
  // Also include soft-deleted registers' items
  const deletedRegs = await listDeletedRegisters(businessId);
  const allRegIds = [...summaries, ...deletedRegs].map(s => s.id);

  const allItems: DeletedItem[] = [];

  for (const regId of allRegIds) {
    try {
      const reg = await getRegDoc(regId);
      if (reg.deletedItems && reg.deletedItems.length > 0) {
        allItems.push(...reg.deletedItems);
      }
    } catch {
      // Skip registers that can't be loaded
    }
  }

  return allItems.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * Get deleted items for a specific register.
 */
export async function getRegisterDeletedItems(registerId: number): Promise<DeletedItem[]> {
  const reg = await getRegDoc(registerId);
  return (reg.deletedItems || []).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * Restore a deleted item (row or column) from the bin back to its register.
 */
export async function restoreDeletedItem(registerId: number, deletedItemId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.deletedItems) return;

    const itemIndex = reg.deletedItems.findIndex(i => i.id === deletedItemId);
    if (itemIndex === -1) return;

    const item = reg.deletedItems[itemIndex];

    if (item.type === 'row' && item.entry) {
      // Restore the row at its original index
      const insertAt = Math.min(item.originalIndex ?? reg.entries.length, reg.entries.length);
      reg.entries.splice(insertAt, 0, item.entry);
      reg.entryCount = reg.entries.length;
      await logAction(reg.businessId, 'Restore Row', `Restored row from bin in "${reg.name}"`, { registerId, registerName: reg.name });
    } else if (item.type === 'column' && item.column) {
      // Restore column at its original position
      const insertAt = Math.min(item.column.position, reg.columns.length);
      reg.columns.splice(insertAt, 0, item.column);
      reg.columns.forEach((c, i) => c.position = i);

      // Restore cell data
      if (item.columnCellData) {
        const colIdStr = item.column.id.toString();
        reg.entries.forEach(e => {
          const val = item.columnCellData![e.id.toString()];
          if (val !== undefined) {
            if (!e.cells) e.cells = {};
            e.cells[colIdStr] = val;
          }
        });
      }
      await logAction(reg.businessId, 'Restore Column', `Restored column "${item.column.name}" from bin in "${reg.name}"`, { registerId, registerName: reg.name });
    }

    // Remove from bin
    reg.deletedItems.splice(itemIndex, 1);
    renumberRows(reg);
    await saveRegDocImmediate(reg);
  });
}

/**
 * Permanently delete an item from the bin.
 */
export async function permanentlyDeleteItem(registerId: number, deletedItemId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    if (!reg.deletedItems) return;
    reg.deletedItems = reg.deletedItems.filter(i => i.id !== deletedItemId);
    await saveRegDocImmediate(reg);
  });
}

/**
 * Clear all deleted items from a register's bin.
 */
export async function emptyRegisterBin(registerId: number): Promise<void> {
  return runQueuedMutation(registerId, async () => {
    const reg = await getRegDoc(registerId);
    reg.deletedItems = [];
    await saveRegDocImmediate(reg);
  });
}

// ==================== BACKUPS ====================

export interface BackupMeta {
  id: string;
  businessId: number;
  createdAt: string;
  label: string;
  registerCount: number;
  folderCount: number;
  totalEntries: number;
  sizeKb: number;
}

export interface BackupSnapshot {
  meta: BackupMeta;
  registers: RegisterDetail[];
  folders: Folder[];
}

/**
 * Create a full backup of all registers and folders for a business.
 */
export async function createBackup(businessId: number, label?: string): Promise<BackupMeta> {
  const [summaries, folders] = await Promise.all([
    listRegisters(businessId),
    listFolders(businessId),
  ]);

  // Load full register details (including entries)
  const validRegisters: RegisterDetail[] = [];
  for (const s of summaries) {
    try {
      const reg = await getRegister(s.id);
      if (reg) validRegisters.push(reg);
    } catch (err) {
      console.error(`Failed to load register ${s.id} for backup:`, err);
    }
  }

  const totalEntries = validRegisters.reduce((sum, r) => sum + (r.entries?.length ?? 0), 0);
  const id = `backup_${Date.now()}`;
  const now = new Date().toISOString();

  const meta: BackupMeta = {
    id,
    businessId,
    createdAt: now,
    label: label || `Backup ${new Date(now).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    registerCount: validRegisters.length,
    folderCount: folders.length,
    totalEntries,
    sizeKb: 0,
  };

  const snapshot: BackupSnapshot = {
    meta,
    registers: validRegisters,
    folders,
  };

  const jsonSize = Math.round(JSON.stringify(snapshot).length / 1024);
  meta.sizeKb = jsonSize;

  const res = await fetch('/api/backups', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      businessId,
      label: meta.label,
      sizeBytes: jsonSize * 1024,
      data: snapshot
    })
  });

  if (!res.ok) throw new Error('Failed to create backup on backend');

  await logAction(businessId, 'Backup Created', `Created backup: ${meta.label} (${validRegisters.length} registers, ${totalEntries} entries)`);
  return meta;
}

/**
 * List all available backups for a business, newest first.
 */
export async function listBackups(businessId: number): Promise<BackupMeta[]> {
  try {
    const res = await fetch(`/api/backups?businessId=${businessId}`);
    if (!res.ok) throw new Error('Failed to fetch backups list');
    return res.json();
  } catch (err) {
    console.error('Failed to list backups:', err);
    return [];
  }
}

/**
 * Restore a backup — overwrites all current registers and folders with the backup snapshot.
 * WARNING: This is destructive. Current data will be replaced.
 */
export async function restoreBackup(backupId: string): Promise<void> {
  const res = await fetch(`/api/backups/${backupId}`);
  if (!res.ok) throw new Error('Backup not found');
  const backup = await res.json();
  const { meta, registers, folders } = backup.data as BackupSnapshot;

  if (!registers || registers.length === 0) {
    throw new Error('Failed to load registers from backup.');
  }

  // 1. Delete all existing folders and registers on backend
  const [existingRegs, existingFolders] = await Promise.all([
    listRegisters(meta.businessId),
    listFolders(meta.businessId)
  ]);

  // Delete all existing registers
  for (const r of existingRegs) {
    await fetch(`/api/registers/${r.id}`, { method: 'DELETE' });
  }

  // Delete all existing folders
  for (const f of existingFolders) {
    await fetch(`/api/folders/${f.id}`, { method: 'DELETE' });
  }

  // Clear cache completely before restoration
  firestoreRegisterCache.clear();

  // 2. Restore folders (with original IDs preserved!)
  for (const f of folders) {
    const fres = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, businessId: meta.businessId, name: f.name })
    });
    if (!fres.ok) {
      console.error(`Failed to restore folder ${f.id}:`, await fres.text());
    }
  }

  // 3. Restore registers (with original IDs, columns and entries preserved!)
  let restoredCount = 0;
  for (const reg of registers) {
    try {
      reg.businessId = meta.businessId;
      // First, create the register doc on backend with the original ID preserved!
      const creRes = await fetch('/api/registers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reg.id,
          businessId: reg.businessId,
          folderId: reg.folderId,
          name: reg.name,
          icon: reg.icon,
          iconColor: reg.iconColor,
          category: reg.category,
          template: reg.template,
          columns: [] // Create empty register first, we will overwrite columns/entries via PUT below
        })
      });

      if (!creRes.ok) {
        throw new Error(`Failed to create register base: ${await creRes.text()}`);
      }

      // Now save/overwrite the full detail (columns and entries)
      await saveRegDocImmediate(reg);
      restoredCount++;
    } catch (err) {
      console.error(`Failed to restore register ${reg.id}:`, err);
    }
  }

  // Final cache clear to ensure fresh state
  firestoreRegisterCache.clear();

  await logAction(meta.businessId, 'Backup Restored', `Restored backup: ${meta.label} (${restoredCount}/${registers.length} registers)`);

  if (restoredCount < registers.length) {
    throw new Error(`Restoration partial: only restored ${restoredCount} of ${registers.length} registers.`);
  }
}

/**
 * Delete a backup permanently.
 */
export async function deleteBackup(backupId: string): Promise<void> {
  const res = await fetch(`/api/backups/${backupId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete backup');
}

/**
 * Check if a new backup is due (every 3 days).
 * Returns true if no backup exists or last backup is older than 3 days.
 */
export async function isBackupDue(businessId: number): Promise<boolean> {
  const backups = await listBackups(businessId);
  if (backups.length === 0) return true;
  const lastBackup = new Date(backups[0].createdAt);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  return lastBackup < threeDaysAgo;
}

/**
 * Compress and resize an image before uploading to stay under Firestore's 1MB limit.
 * Resizes the image to a max width/height of 1000px and applies JPEG compression (quality 0.7).
 */
export function compressImage(file: File, maxWidth = 1000, maxHeight = 1000, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Bounding box calculation
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string); // Fallback to raw base64
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Convert to highly compressed JPEG base64
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      };
      img.onerror = () => {
        reject(new Error('Image failed to load'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('File reading failed'));
    };
    reader.readAsDataURL(file);
  });
}

