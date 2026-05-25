import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateToDDMMYYYY } from '../../../lib/api';

interface Column {
  id: number;
  name: string;
  type: string;
  dropdownOptions?: string[];
  mandatory?: boolean;
  unique?: boolean;
}

interface Entry {
  id: number;
  cells?: Record<string, string>;
}

interface AddRecordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (cells: Record<string, string>) => void;
  columns: Column[];
  isSubmitting?: boolean;
  existingEntries?: Entry[];
}

// Only these types get duplicate-checked (not text/name/date/dropdown/checkbox etc.)
const DUPLICATE_CHECK_TYPES = new Set(['phone', 'email', 'number', 'currency', 'url']);

export function AddRecordModal({
  open, onClose, onSubmit, columns, isSubmitting, existingEntries = []
}: AddRecordModalProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const firstInputRef = useRef<HTMLElement | null>(null);
  // Track which (colId:value) combinations we've already toasted — prevents spam
  const toastedRef = useRef<Set<string>>(new Set());

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      const init: Record<string, string> = {};
      columns.forEach(col => {
        if (col.type !== 'formula') {
          init[col.id.toString()] = '';
        }
      });
      setValues(init);
      setDuplicates(new Set());
      toastedRef.current = new Set();
      setTimeout(() => {
        if (firstInputRef.current) firstInputRef.current.focus();
      }, 50);
    }
  }, [open, columns]);

  // Build fast lookup: colId → Set<lowercase value> for duplicate checks
  // AND colId → Array of unique original values for dropdown suggestions
  const { duplicateMap, dropdownMap } = useMemo(() => {
    const dupMap: Record<string, Set<string>> = {};
    const dropMap: Record<string, string[]> = {};
    const seenMap: Record<string, Set<string>> = {};

    existingEntries.forEach(entry => {
      if (!entry.cells) return;
      Object.entries(entry.cells).forEach(([colId, val]) => {
        if (!val || !val.trim()) return;
        const trimmed = val.trim();
        const lower = trimmed.toLowerCase();

        // For duplicate checking
        if (!dupMap[colId]) dupMap[colId] = new Set();
        dupMap[colId].add(lower);

        // For dropdown options (preserving first casing seen)
        if (!seenMap[colId]) seenMap[colId] = new Set();
        if (!dropMap[colId]) dropMap[colId] = [];
        if (!seenMap[colId].has(lower)) {
          seenMap[colId].add(lower);
          dropMap[colId].push(trimmed);
        }
      });
    });
    return { duplicateMap: dupMap, dropdownMap: dropMap };
  }, [existingEntries]);

  const handleChange = useCallback(
    (colId: string, val: string, colType: string, colName: string) => {
      setValues(prev => ({ ...prev, [colId]: val }));

      const col = columns.find(c => c.id.toString() === colId);
      const isUnique = !!col?.unique;

      // Only check types that make sense to be unique (or if explicitly marked as unique)
      if (!DUPLICATE_CHECK_TYPES.has(colType) && !isUnique) return;

      const trimmed = val.trim().toLowerCase();
      if (!trimmed) {
        setDuplicates(prev => { const n = new Set(prev); n.delete(colId); return n; });
        toastedRef.current.delete(colId);
        return;
      }

      const isDuplicate = duplicateMap[colId]?.has(trimmed) ?? false;

      setDuplicates(prev => {
        const n = new Set(prev);
        if (isDuplicate) n.add(colId); else n.delete(colId);
        return n;
      });

      const toastKey = `${colId}:${trimmed}`;
      if (isDuplicate && !toastedRef.current.has(toastKey)) {
        toastedRef.current.add(toastKey);
        toast.error(
          `${isUnique ? 'Unique field violation' : 'Duplicate'} ${colName}: "${val.trim()}" already exists in another record.`,
          {
            id: `dup-${colId}`,
            duration: 4500,
            position: 'top-right',
            style: {
              background: isUnique ? '#fef2f2' : '#fff7ed',
              color: isUnique ? '#991b1b' : '#92400e',
              border: isUnique ? '1px solid #ef4444' : '1px solid #f59e0b',
              fontWeight: 600,
              fontSize: '13px',
              maxWidth: '340px',
            },
            icon: isUnique ? '⛔' : '⚠️',
          }
        );
      } else if (!isDuplicate) {
        toastedRef.current.delete(toastKey);
      }
    },
    [duplicateMap, columns]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate mandatory and unique fields
    for (const col of columns) {
      const colIdStr = col.id.toString();
      const val = values[colIdStr];
      
      if (col.mandatory && col.type !== 'formula' && col.type !== 'auto_increment') {
        if (!val || val.trim() === '') {
          toast.error(`${col.name} is a mandatory field.`);
          return;
        }
      }
      
      if (col.unique && duplicates.has(colIdStr)) {
        toast.error(`Cannot save. ${col.name} must be unique, and "${val}" already exists.`);
        return;
      }
    }

    const cells: Record<string, string> = {};
    Object.entries(values).forEach(([k, v]) => {
      const col = columns.find(c => c.id.toString() === k);
      if (col?.type === 'formula') return;
      
      let finalVal = v.trim();
      if (col?.type === 'date' && finalVal !== '') {
        finalVal = formatDateToDDMMYYYY(finalVal);
      }
      
      if (finalVal !== '') {
        cells[k] = finalVal;
      }
    });
    onSubmit(cells);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  const hasDuplicates = duplicates.size > 0;
  const allCols = columns;

  return createPortal(
    <div className="row-detail-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div
        className="row-detail-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add Record"
      >
        {/* Header */}
        <div className="row-detail-header">
          <div className="row-detail-title">
            <Plus size={18} style={{ flexShrink: 0, color: 'var(--navy)' }} />
            <h2 style={{ fontSize: '18px', margin: 0, color: 'var(--navy)' }}>Add Record</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="row-detail-close" onClick={onClose} aria-label="Close" title="Close">✕</button>
          </div>
        </div>

        {/* Inline duplicate warning banner */}
        {hasDuplicates && (
          <div className="add-record-dup-banner" style={{
            background: Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique) ? '#fef2f2' : undefined,
            color: Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique) ? '#991b1b' : undefined,
            borderBottom: Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique) ? '1px solid #fca5a5' : undefined,
          }}>
            <AlertTriangle size={14} style={{ flexShrink: 0 }} />
            <span>
              {Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique)
                ? 'Highlighted fields are marked as UNIQUE and already exist. You cannot save until they are changed.'
                : 'Highlighted fields already exist in another record. You can still save if intended.'}
            </span>
          </div>
        )}

        {/* Form */}
        <form style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }} onSubmit={handleSubmit}>
          <div className="row-detail-body">
            {allCols.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>
                No columns found. Add columns first.
              </p>
            ) : (
              allCols.map((col, idx) => {
                const colIdStr = col.id.toString();
                const val = values[colIdStr] ?? '';
                const isFirst = idx === 0;
                const isDup = duplicates.has(colIdStr);
                const isFormula = col.type === 'formula';
                const isAutoIncr = col.type === 'auto_increment';
                const inputCls = `row-detail-input${isDup ? ' add-record-input--dup' : ''}${isFormula ? ' add-record-input--readonly' : ''}`;
                
                const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
                  handleChange(colIdStr, e.target.value, col.type, col.name);

                return (
                  <div key={col.id} className={`row-detail-field ${col.type}-field${isDup ? ' add-record-field--dup' : ''}`}>
                    <div className="row-detail-label-container">
                      <div className="row-detail-label-group">
                        <label className="row-detail-label" htmlFor={`ar-col-${col.id}`}>
                          {col.name}
                          {col.mandatory && <span style={{ color: 'var(--primary)', marginLeft: 4, fontSize: 14 }} title="Mandatory">*</span>}
                          {col.unique && <span style={{ color: 'var(--primary)', marginLeft: 4, fontSize: 13 }} title="Unique">★</span>}
                          {isFormula && <span style={{ color: 'var(--navy)', marginLeft: 4, opacity: 0.6, fontSize: 10 }} title="Calculated">ƒₓ</span>}
                        </label>
                        <span className="row-detail-type-badge">{col.type.replace('_', ' ')}</span>
                      </div>
                    </div>

                    <div className="row-detail-input-wrapper">
                      {isFormula ? (
                        <div className="add-record-readonly-box" style={{ padding: '0 14px', height: '44px', display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                          <span className="formula-icon" style={{ marginRight: '8px', opacity: 0.5 }}>ƒₓ</span>
                          <span className="formula-placeholder" style={{ color: 'var(--muted)', fontSize: '13px' }}>Computed automatically</span>
                        </div>
                      ) : isAutoIncr ? (
                        <div className="add-record-autoincrement-wrap" style={{ width: '100%' }}>
                          <input
                            type="number"
                            id={`ar-col-${col.id}`}
                            className={inputCls}
                            value={val}
                            onChange={onChange}
                            placeholder="Auto-generated if blank"
                            ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                          />
                          <div className="autoincrement-hint" style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>Override or leave blank for next sequence</div>
                        </div>
                      ) : col.type === 'dropdown' ? (
                        <select
                          id={`ar-col-${col.id}`}
                          className={`${inputCls} cell-dropdown`}
                          value={val}
                          onChange={onChange}
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                          style={{ paddingRight: '30px' }}
                        >
                          <option value="">-- Select --</option>
                          {(() => {
                            // If predefined options exist, use only those.
                            // If not, fall back to unique existing values in this column.
                            const predefined = col.dropdownOptions || [];
                            const combined = predefined.length > 0 
                              ? predefined 
                              : (dropdownMap[colIdStr] || []);
                              
                            return combined.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ));
                          })()}
                        </select>
                      ) : col.type === 'checkbox' ? (
                        <div className="add-record-checkbox-wrap" style={{ display: 'flex', alignItems: 'center', height: '44px' }}>
                          <input
                            type="checkbox"
                            id={`ar-col-${col.id}`}
                            className="row-detail-checkbox"
                            checked={val === 'true'}
                            onChange={e => handleChange(colIdStr, e.target.checked ? 'true' : 'false', col.type, col.name)}
                            ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                          <label htmlFor={`ar-col-${col.id}`} style={{ marginLeft: '10px', fontSize: '13px', color: 'var(--muted)', cursor: 'pointer' }}>
                            {val === 'true' ? 'Checked' : 'Unchecked'}
                          </label>
                        </div>
                      ) : col.type === 'date' ? (
                        <input type="text" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange} placeholder="DD-MM-YYYY"
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                          onKeyDown={(e) => {
                            if (e.key === 'Backspace' || e.key === 'Delete') {
                              e.preventDefault();
                            }
                          }}
                        />
                      ) : col.type === 'number' || col.type === 'currency' || col.type === 'rating' ? (
                        <input type="number" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange}
                          placeholder={col.type === 'rating' ? '1–5' : '0'}
                          min={col.type === 'rating' ? 1 : undefined}
                          max={col.type === 'rating' ? 5 : undefined}
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                      ) : col.type === 'email' ? (
                        <input type="email" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange} placeholder="email@example.com"
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                      ) : col.type === 'phone' ? (
                        <input type="tel" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange} placeholder="+91 XXXXX XXXXX"
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                      ) : col.type === 'url' ? (
                        <input type="url" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange} placeholder="https://"
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                      ) : (
                        <input type="text" id={`ar-col-${col.id}`} className={inputCls}
                          value={val} onChange={onChange} placeholder={`Enter ${col.name}…`}
                          ref={isFirst ? (el) => { firstInputRef.current = el; } : undefined}
                        />
                      )}
                      
                      {isDup && (
                        <div style={{ marginTop: '6px', fontSize: '11px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <AlertTriangle size={12} /> This value already exists in another record.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="row-detail-footer">
            <button type="button" className="row-detail-btn-close" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className={`row-detail-btn-save${hasDuplicates ? ' add-record-submit--warn' : ''}`}
              disabled={isSubmitting || allCols.length === 0 || Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique)}
            >
              {isSubmitting ? 'Saving…' : (hasDuplicates && !Array.from(duplicates).some(id => columns.find(c => c.id.toString() === id)?.unique)) ? 'Save Anyway' : 'Save Record'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
