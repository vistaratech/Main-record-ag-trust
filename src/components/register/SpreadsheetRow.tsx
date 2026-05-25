import { evaluateFormula, compressImage, type Entry, type Column } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';
import { Calendar, ChevronDown, Image as ImageIcon, Mail, Phone, Globe, ListOrdered, IndianRupee, Maximize2, Bell } from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNotifications } from '../../lib/NotificationContext';

// ── Highlight matching text ──
const HighlightedText = React.memo(function HighlightedText({ text, searchTerm }: { text: string; searchTerm?: string }) {
  if (!searchTerm || !text) return <>{text}</>;
  const lower = text.toLowerCase();
  const sLower = searchTerm.toLowerCase();
  const idx = lower.indexOf(sLower);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="search-highlight">{text.slice(idx, idx + searchTerm.length)}</mark>
      {text.slice(idx + searchTerm.length)}
    </>
  );
});



// Isolated memo component so formula evaluation only runs when its inputs change
const FormulaCell = React.memo(({ idx, col, entry, registerColumns, onKeyDown }: {
  idx: number; col: Column; entry: Entry; registerColumns: Column[]; onKeyDown?: (e: React.KeyboardEvent) => void;
}) => {
  const result = evaluateFormula(col.formula || '', entry, registerColumns);
  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={0}
      className="cell-formula"
      onKeyDown={onKeyDown}
    >
      {result || '–'}
    </div>
  );
});

interface SpreadsheetTextInputProps {
  idx: number;
  col: Column;
  entry: Entry;
  visibleColumns: Column[];
  colIdx: number;
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void | boolean;
  type?: string;
  placeholder?: string;
  searchTerm?: string;
  readOnly?: boolean;
  suggestions?: string[];
  scrollToColumn?: (colIdx: number) => void;
}

// Currency cell: shows ₹ formatted display, edits as raw number
const CurrencyCell = React.memo(({ idx, col, entry, colIdx, totalRows, visibleColumns, handleCellChange, onKeyDown, readOnly, scrollToColumn }: SpreadsheetTextInputProps & { onKeyDown?: (e: React.KeyboardEvent) => void }) => {
  const rawValue = entry.cells?.[col.id.toString()] || '';
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(rawValue);

  useEffect(() => { setVal(rawValue); }, [rawValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' || e.key === 'Enter') { 
      setEditing(false); 
      e.currentTarget.blur(); 
      return;
    }

    const focusNext = (rowI: number, cId: number | string, cIdx: number) => {
      if (scrollToColumn) {
        scrollToColumn(cIdx);
      }
      setTimeout(() => {
        const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
        if (el) el.focus();
      }, 50);
    };

    if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx - 1, col.id, colIdx);
      }
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        setEditing(false);
        focusNext(idx + 1, col.id, colIdx);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows, scrollToColumn]);

  if (editing && !readOnly) {
    return (
      <input
        id={`cell-${idx}-${col.id}`}
        className="cell-input currency-editing"
        type="text"
        inputMode="decimal"
        value={val}
        autoFocus
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (val !== rawValue) {
            handleCellChange(entry.id, col.id.toString(), val);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            if (val !== rawValue) {
              handleCellChange(entry.id, col.id.toString(), val);
            }
          }
          handleKeyDown(e);
        }}
        placeholder="0.00"
      />
    );
  }

  return (
    <div
      data-cell={`cell-${idx}-${col.id}`}
      tabIndex={readOnly ? -1 : 0}
      className={`cell-currency ${readOnly ? 'cell-readonly' : ''}`}
      onClick={() => !readOnly && setEditing(true)}
      onFocus={() => !readOnly && setEditing(true)}
      onKeyDown={onKeyDown}
      title={readOnly ? "" : "Click to edit"}
    >
      {rawValue ? formatCurrency(rawValue) : <span className="cell-placeholder"><IndianRupee size={11} /> Amount</span>}
    </div>
  );
});

const SpreadsheetTextInput = React.memo(({ idx, col, entry, visibleColumns, colIdx, totalRows, handleCellChange, type = 'text', placeholder, searchTerm, readOnly, suggestions, scrollToColumn }: SpreadsheetTextInputProps) => {
  let initialValue = entry.cells?.[col.id.toString()] || '';
  if (col.type === 'date' && initialValue.includes('/')) {
    initialValue = initialValue.replace(/\//g, '-');
  }
  const [val, setVal] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  // Compute filtered suggestions
  const filteredSuggestions = useMemo(() => {
    if (!focused || !val || val.length < 3 || readOnly || isDeleting || !suggestions || suggestions.length === 0) return [];
    const lower = val.toLowerCase();
    return suggestions.filter(s => s.toLowerCase().includes(lower) && s.toLowerCase() !== lower);
  }, [val, suggestions, focused, readOnly, isDeleting]);

  const showDropdown = filteredSuggestions.length > 0 && focused;

  // Update dropdown position when it should be shown
  useEffect(() => {
    if (showDropdown && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 160) });
    } else {
      setDropdownPos(null);
    }
  }, [showDropdown, val]);

  // Reset highlight when suggestions change
  useEffect(() => {
    setHighlightIdx(-1);
  }, [filteredSuggestions.length, val]);

  // Sync if the entry is replaced (e.g., after add-row optimistic swap)
  useEffect(() => {
    setVal(initialValue);
    setIsDeleting(false);
  }, [initialValue]);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return;
    const newVal = e.target.value;
    setIsDeleting(newVal.length < val.length);
    setVal(newVal);
  }, [readOnly, val.length]);

  const selectSuggestion = useCallback((suggestion: string) => {
    setVal(suggestion);
    setFocused(false);
    setHighlightIdx(-1);
    const prevVal = entry.cells?.[col.id.toString()] || '';
    if (suggestion !== prevVal) {
      handleCellChange(entry.id, col.id.toString(), suggestion);
    }
    // Re-focus input after selecting
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [entry, col.id, handleCellChange]);

  const onBlur = useCallback(() => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      setFocused(false);
      setIsDeleting(false);
      setHighlightIdx(-1);
      if (readOnly) return;

      const finalVal = val;
      const prevVal = entry.cells?.[col.id.toString()] || '';
      if (finalVal !== prevVal) {
        const success = handleCellChange(entry.id, col.id.toString(), finalVal);
        if (success === false) {
          setVal(prevVal);
        }
      }
    }, 150);
  }, [val, entry, col.id, handleCellChange, readOnly]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (col.type === 'date' && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      setFocused(false);
      setHighlightIdx(-1);
      e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string, cIdx: number) => {
      if (scrollToColumn) {
        scrollToColumn(cIdx);
      }
      setTimeout(() => {
        const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
        if (el) el.focus();
      }, 50);
    };

    // If dropdown is showing, ArrowDown/ArrowUp navigate suggestions
    if (showDropdown && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      e.stopPropagation();
      setHighlightIdx(prev => {
        const max = filteredSuggestions.length;
        if (e.key === 'ArrowDown') return prev < max - 1 ? prev + 1 : 0;
        return prev > 0 ? prev - 1 : max - 1;
      });
      return;
    }

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();

      // If a suggestion is highlighted, select it instead of navigating
      if (showDropdown && highlightIdx >= 0 && highlightIdx < filteredSuggestions.length) {
        selectSuggestion(filteredSuggestions[highlightIdx]);
        return;
      }

      const finalVal = val;
      const prevVal = entry.cells?.[col.id.toString()] || '';
      if (!readOnly && finalVal !== prevVal) {
        const success = handleCellChange(entry.id, col.id.toString(), finalVal);
        if (success === false) {
          setVal(prevVal);
          return;
        }
      }
      setFocused(false);
      setHighlightIdx(-1);
      if (e.shiftKey) {
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id, colIdx - 1);
        } else {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx > 0 ? idx - 1 : totalRows - 1, lastCol.id, visibleColumns.length - 1);
        }
      } else {
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id, colIdx + 1);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx < totalRows - 1 ? idx + 1 : 0, firstCol.id, 0);
        }
      }
    } else if (e.key === 'ArrowDown') {
      if (idx < totalRows - 1) {
        e.preventDefault();
        focusNext(idx + 1, col.id, colIdx);
      }
    } else if (e.key === 'ArrowUp') {
      if (idx > 0) {
        e.preventDefault();
        focusNext(idx - 1, col.id, colIdx);
      }
    }
  }, [idx, col.id, visibleColumns, colIdx, totalRows, readOnly, val, entry, handleCellChange, showDropdown, highlightIdx, filteredSuggestions, selectSuggestion, scrollToColumn]);



  const hasHighlight = !!searchTerm && !!val && val.toLowerCase().includes(searchTerm.toLowerCase());

  const handleFocus = useCallback(() => !readOnly && setFocused(true), [readOnly]);

  // Show highlighted overlay when search matches and not focused
  if (hasHighlight && !focused) {
    return (
      <div
        id={`cell-${idx}-${col.id}`}
        data-cell={`cell-${idx}-${col.id}`}
        className={`cell-input cell-input-highlight-wrap ${readOnly ? 'cell-readonly' : ''}`}
        tabIndex={readOnly ? -1 : 0}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
        style={{ cursor: readOnly ? 'default' : 'text' }}
      >
        <HighlightedText text={val} searchTerm={searchTerm} />
      </div>
    );
  }

  return (
    <>
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <input
        ref={inputRef}
        id={`cell-${idx}-${col.id}`}
        className={`cell-input ${readOnly ? 'cell-readonly' : ''}`}
        value={val}
        onChange={onChange}
        onBlur={onBlur}
        onFocus={handleFocus}
        onKeyDown={onKeyDown}
        type={type}
        placeholder={placeholder}
        inputMode={col.type === 'number' ? 'decimal' : undefined}
        autoComplete="off"
        readOnly={readOnly}
      />
      {showDropdown && dropdownPos && createPortal(
        <div
          className="cell-suggestions-dropdown"
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 10010,
          }}
        >
          {filteredSuggestions.slice(0, 8).map((s, i) => {
            const matchIdx = s.toLowerCase().indexOf(val.toLowerCase());
            return (
              <div
                key={s}
                className={`cell-suggestion-item ${i === highlightIdx ? 'highlighted' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                onMouseEnter={() => setHighlightIdx(i)}
              >
                {matchIdx >= 0 ? (
                  <>
                    {s.slice(0, matchIdx)}
                    <strong>{s.slice(matchIdx, matchIdx + val.length)}</strong>
                    {s.slice(matchIdx + val.length)}
                  </>
                ) : s}
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
    </>
  );
});

interface SpreadsheetRowProps {
  entry: Entry;
  idx: number;
  visibleColumns: Column[];
  /** The virtual columns from TanStack Virtual */
  virtualCols?: any[];
  /** Frozen columns before virtual window */
  beforeVirtualCols?: { index: number }[];
  /** Frozen columns after virtual window */
  afterVirtualCols?: { index: number }[];
  /** Horizontal left padding (px) to represent off-screen columns left of viewport */
  paddingLeft?: number;
  /** Horizontal right padding (px) to represent off-screen columns right of viewport */
  paddingRight?: number;
  /** Fixed row height for virtualized stability */
  rowHeight?: number;
  isSelected: boolean;
  toggleSelectRow: (id: number) => void;
  totalRows: number;
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  openDatePicker: (entryId: number, colId: number, currentVal: string, rect?: DOMRect) => void;
  openDropdown: (entryId: number, colId: number, options: string[], rect?: DOMRect) => void;
  isMenuOpen: boolean;
  toggleMenu: (id: number) => void;
  registerColumns: Column[];
  onRowDetail?: (entry: Entry) => void;
  onImagePreview?: (data: { url: string; entryId: number; colId: string }) => void;
  frozenColumns?: Set<number>;
  frozenLeftOffsets?: Record<number, number>;
  colWidths?: Record<number, number>;
  defaultColWidth?: number;
  onCellFormatClick?: (entryId: number, colId: string, rect: DOMRect) => void;
  searchTerm?: string;
  editableColumnIds?: Set<number> | null;
  columnSuggestions?: Record<string, string[]>;
  displayRowNumber?: number;
  scrollToColumn?: (colIdx: number) => void;
}

export const SpreadsheetRow = React.memo(function SpreadsheetRow(props: SpreadsheetRowProps) {
  const {
    entry,
    idx,
    visibleColumns,
    virtualCols,
    beforeVirtualCols,
    afterVirtualCols,
    paddingLeft = 0,
    paddingRight = 0,
    rowHeight,
    totalRows,
    handleCellChange,
    openDatePicker,
    openDropdown,
    isMenuOpen,
    toggleMenu,
    registerColumns,
    onRowDetail,
    onImagePreview,
    frozenColumns,
    frozenLeftOffsets,
    colWidths,
    defaultColWidth = 150,
    onCellFormatClick,
    searchTerm,
    editableColumnIds,
    columnSuggestions,
    displayRowNumber,
    scrollToColumn,
  } = props;
  const { reminders } = useNotifications();
  const hasPendingReminder = useMemo(() => {
    return reminders.some(r => r.rowId === entry.id && r.status === 'Pending' && r.registerId === String(entry.registerId));
  }, [reminders, entry.id, entry.registerId]);

  const elements: { type: 'cell' | 'pad-left' | 'pad-right', vc?: { index: number } }[] = [];
  if (virtualCols && beforeVirtualCols && afterVirtualCols) {
    beforeVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
    if (paddingLeft > 0) elements.push({ type: 'pad-left' });
    virtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
    if (paddingRight > 0) elements.push({ type: 'pad-right' });
    afterVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
  } else {
    visibleColumns.forEach((_, i) => elements.push({ type: 'cell', vc: { index: i } }));
  }


  const handleCellKeyDown = useCallback((e: React.KeyboardEvent, colId: number | string, colIdx: number) => {
    if (e.key === 'Escape') {
      if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
      return;
    }

    const focusNext = (rowI: number, cId: number | string, cIdx: number) => {
      if (scrollToColumn) {
        scrollToColumn(cIdx);
      }
      setTimeout(() => {
        const el = document.getElementById(`cell-${rowI}-${cId}`) || document.querySelector(`[data-cell="cell-${rowI}-${cId}"]`) as HTMLElement;
        if (el) el.focus();
      }, 50);
    };

    if (e.key === 'Tab' || e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        const prevCol = visibleColumns[colIdx - 1];
        if (prevCol) {
          focusNext(idx, prevCol.id, colIdx - 1);
        } else {
          const lastCol = visibleColumns[visibleColumns.length - 1];
          if (lastCol) focusNext(idx > 0 ? idx - 1 : totalRows - 1, lastCol.id, visibleColumns.length - 1);
        }
      } else {
        const nextCol = visibleColumns[colIdx + 1];
        if (nextCol) {
          focusNext(idx, nextCol.id, colIdx + 1);
        } else {
          const firstCol = visibleColumns[0];
          if (firstCol) focusNext(idx < totalRows - 1 ? idx + 1 : 0, firstCol.id, 0);
        }
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      focusNext(idx + 1, colId, colIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focusNext(idx - 1, colId, colIdx);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevCol = visibleColumns[colIdx - 1];
      if (prevCol) {
        focusNext(idx, prevCol.id, colIdx - 1);
      } else if (idx > 0) {
        const lastCol = visibleColumns[visibleColumns.length - 1];
        if (lastCol) focusNext(idx - 1, lastCol.id, visibleColumns.length - 1);
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextCol = visibleColumns[colIdx + 1];
      if (nextCol) {
        focusNext(idx, nextCol.id, colIdx + 1);
      } else if (idx < totalRows - 1) {
        const firstCol = visibleColumns[0];
        if (firstCol) focusNext(idx + 1, firstCol.id, 0);
      }
    }
  }, [idx, visibleColumns, totalRows, scrollToColumn]);

  const handleSerialClick = useCallback(() => {
    onRowDetail?.(entry);
  }, [entry, onRowDetail]);
  const { isSelected, toggleSelectRow } = props;

  const handleCheckboxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    toggleSelectRow(entry.id);
  }, [entry.id, toggleSelectRow]);

  return (
    <tr id={`row-${entry.id}`} data-entry-id={entry.id} className={isSelected ? 'row-selected' : ''} style={rowHeight ? { height: rowHeight, maxHeight: rowHeight } : undefined}>
      <td 
        className="serial" 
        style={{ cursor: 'pointer' }}
        onClick={handleSerialClick}
        title="Click to view details"
      >
        <div className="serial-inner">
          <button
            className={`row-menu-btn ${isMenuOpen ? 'menu-open' : ''}`}
            aria-label="Row Options"
            title="Row Options"
            onClick={(e) => {
              e.stopPropagation();
              toggleMenu(entry.id);
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '-1px', lineHeight: 1 }}>⋮</span>
          </button>
          <input
            type="checkbox"
            className="row-select-checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            tabIndex={-1}
          />
          <span className="serial-number">{displayRowNumber || entry.rowNumber}</span>
          {hasPendingReminder && (
          <span title="This row has a pending reminder">
            <Bell 
              size={12} 
              className="text-amber-500 fill-amber-500 animate-pulse" 
              style={{ 
                color: '#f59e0b',
                fill: '#f59e0b',
                marginLeft: '2px',
                flexShrink: 0
              }} 
            />
          </span>
          )}
        </div>
      </td>
      {elements.map((el) => {
        if (el.type === 'pad-left') {
          return <td key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none' }} />;
        }
        if (el.type === 'pad-right') {
          return <td key="pad-right" className="spacer" style={{ width: paddingRight, minWidth: paddingRight, padding: 0, border: 'none' }} />;
        }

        const vc = el.vc!;
        const col = visibleColumns[vc.index];
        if (!col) return null;
        
        const colIdx = vc.index; // Absolute index for navigation
        const isFrozen = frozenColumns?.has(col.id);
        const w = colWidths?.[col.id] || defaultColWidth;
        const cs = entry.cellStyles?.[col.id.toString()];
        let cellStyle: React.CSSProperties = { width: w, minWidth: w, maxWidth: w };
        
        // Apply user-defined cell formatting
        if (cs?.bgColor) cellStyle.background = cs.bgColor;
        if (cs?.textColor) cellStyle.color = cs.textColor;
        if (cs?.textAlign) cellStyle.textAlign = cs.textAlign;
        
        if (isFrozen) {
          const left = frozenLeftOffsets?.[col.id] || 50;
          cellStyle = { ...cellStyle, position: 'sticky', left, zIndex: 5, background: cs?.bgColor || 'var(--table-bg)' };
        }
        
        const isEditable = !editableColumnIds || editableColumnIds.has(col.id);
        
        const handleContextMenu = (e: React.MouseEvent) => {
          e.preventDefault();
          if (onCellFormatClick && isEditable) {
            onCellFormatClick(entry.id, col.id.toString(), (e.currentTarget as HTMLElement).getBoundingClientRect());
          }
        };
        
        return (
        <td key={col.id} className={isFrozen ? 'frozen-col' : ''} style={cellStyle} onContextMenu={handleContextMenu}>
          <div className="cell-inner-wrapper" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flex: 1 }}>
          {col.type === 'formula' ? (
            <FormulaCell idx={idx} col={col} entry={entry} registerColumns={registerColumns} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)} />
          ) : col.type === 'date' ? (
            <div className="cell-url-wrap cell-date-wrap">
              <SpreadsheetTextInput 
                idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange}
                placeholder="DD-MM-YYYY" searchTerm={searchTerm}
                readOnly={!isEditable}
                scrollToColumn={scrollToColumn}
              />
              {isEditable && (
                <button 
                  className="cell-url-link cell-date-picker-btn" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={(e) => openDatePicker(entry.id, col.id, entry.cells?.[col.id.toString()] || '', e.currentTarget.getBoundingClientRect())}
                  tabIndex={-1}
                >
                  <Calendar size={12} />
                </button>
              )}
            </div>
          ) : col.type === 'dropdown' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              tabIndex={isEditable ? 0 : -1} 
              className={`cell-dropdown ${!isEditable ? 'cell-readonly' : ''}`} 
              onClick={isEditable ? (e) => openDropdown(entry.id, col.id, col.dropdownOptions || [], e.currentTarget.getBoundingClientRect()) : undefined} 
              onKeyDown={(e) => { 
                if (!isEditable) return;
                if (e.key === ' ' || e.key === 'Enter' && e.ctrlKey) { 
                  e.preventDefault(); 
                  openDropdown(entry.id, col.id, col.dropdownOptions || [], e.currentTarget.getBoundingClientRect()); 
                } else handleCellKeyDown(e, col.id, colIdx); 
              }}
            >
              {entry.cells?.[col.id.toString()] ? <HighlightedText text={entry.cells[col.id.toString()]} searchTerm={searchTerm} /> : <span className="cell-placeholder"><ChevronDown size={12} /> {isEditable ? 'Select' : '—'}</span>}
            </div>
          ) : col.type === 'checkbox' ? (
            <div className={`cell-checkbox-wrap ${!isEditable ? 'cell-readonly' : ''}`}>
              <input
                id={`cell-${idx}-${col.id}`}
                type="checkbox"
                className="cell-checkbox"
                disabled={!isEditable}
                checked={entry.cells?.[col.id.toString()] === 'true'}
                onChange={(e) => handleCellChange(entry.id, col.id.toString(), e.target.checked ? 'true' : 'false')}
                onKeyDown={(e) => { if (e.key !== ' ') handleCellKeyDown(e, col.id, colIdx); }}
                title={col.name}
              />
            </div>
          ) : col.type === 'rating' ? (
            <div data-cell={`cell-${idx}-${col.id}`} tabIndex={isEditable ? 0 : -1} className={`cell-rating ${!isEditable ? 'cell-readonly' : ''}`} onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}>
              {[1, 2, 3, 4, 5].map(star => (
                <button 
                  key={star} 
                  disabled={!isEditable}
                  className={`star-btn ${(parseInt(entry.cells?.[col.id.toString()] || '0') >= star) ? 'active' : ''}`} 
                  onClick={() => handleCellChange(entry.id, col.id.toString(), star.toString())} 
                  title={isEditable ? `Rate ${star}` : `Rating: ${entry.cells?.[col.id.toString()] || '0'}`} 
                  tabIndex={-1}
                >★</button>
              ))}
            </div>
          ) : col.type === 'image' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              tabIndex={0} 
              className="cell-image-wrap" 
              onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
              onClick={() => {
                const val = entry.cells?.[col.id.toString()];
                if (val) onImagePreview?.({ url: val, entryId: entry.id, colId: col.id.toString() });
              }}
              title={entry.cells?.[col.id.toString()] ? "Click to view full image" : (isEditable ? "No image" : "")}
            >
              {entry.cells?.[col.id.toString()] ? (
                (() => {
                  const val = entry.cells[col.id.toString()];
                  const images = val.split('|||').filter(Boolean);
                  const firstImage = images[0];
                  const extraCount = images.length - 1;
                  return (
                    <div className="cell-image-inner" style={{ position: 'relative' }}>
                      <img 
                        src={firstImage} 
                        alt="img" 
                        className="cell-image-thumb" 
                      />
                      {extraCount > 0 && (
                        <div className="cell-image-badge" style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          background: 'var(--navy)',
                          color: 'white',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          zIndex: 2,
                          boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                        }}>
                          +{extraCount}
                        </div>
                      )}
                      <div className="cell-image-overlay">
                        <Maximize2 size={12} />
                      </div>
                    </div>
                  );
                })()
              ) : (
                isEditable ? (
                  <label className="cell-image-upload" title="Upload image" onClick={(e) => e.stopPropagation()}>
                     Add
                    <input type="file" accept="image/*" className="hidden-file-input" tabIndex={-1} onChange={(e) => { const f = e.target.files?.[0]; if (!f) return; compressImage(f).then(c => handleCellChange(entry.id, col.id.toString(), c)).catch(err => console.error(err)); }} />
                  </label>
                ) : (
                  <span className="cell-placeholder" style={{ fontSize: '10px', opacity: 0.5 }}>—</span>
                )
              )}
            </div>
          ) : col.type === 'email' ? (
            <div className="cell-url-wrap">
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="email" placeholder="name@example.com" searchTerm={searchTerm} readOnly={!isEditable} scrollToColumn={scrollToColumn} />
              {entry.cells?.[col.id.toString()] && <a href={`mailto:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Send email" tabIndex={-1}><Mail size={11} /></a>}
            </div>
          ) : col.type === 'phone' ? (
            <div className="cell-url-wrap">
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="tel" placeholder="+91 98765 43210" searchTerm={searchTerm} readOnly={!isEditable} scrollToColumn={scrollToColumn} />
              {entry.cells?.[col.id.toString()] && <a href={`tel:${entry.cells[col.id.toString()]}`} className="cell-url-link" title="Call" tabIndex={-1}><Phone size={11} /></a>}
            </div>
          ) : col.type === 'url' ? (
            <div className="cell-url-wrap">
              <SpreadsheetTextInput idx={idx} col={col} entry={entry} visibleColumns={visibleColumns} colIdx={colIdx} totalRows={totalRows} handleCellChange={handleCellChange} type="url" placeholder="https://..." searchTerm={searchTerm} readOnly={!isEditable} scrollToColumn={scrollToColumn} />
              {entry.cells?.[col.id.toString()] && <a href={entry.cells[col.id.toString()]} target="_blank" rel="noreferrer" className="cell-url-link" title="Open" tabIndex={-1}><Globe size={11} /></a>}
            </div>
          ) : col.type === 'auto_increment' ? (
            <div 
              data-cell={`cell-${idx}-${col.id}`} 
              className="cell-auto-increment-cell-readonly" 
              tabIndex={0} 
              title="Auto-generated ID (Read-only)" 
              onKeyDown={(e) => handleCellKeyDown(e, col.id, colIdx)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '0 8px', 
                color: '#64748b', 
                background: 'var(--table-bg)',
                height: '100%',
                fontSize: '12px',
                fontWeight: 500
              }}
            >
              <ListOrdered size={12} style={{ opacity: 0.6 }} />
              <span><HighlightedText text={entry.cells?.[col.id.toString()] || '–'} searchTerm={searchTerm} /></span>
            </div>
          ) : col.type === 'currency' ? (
            <CurrencyCell idx={idx} col={col} entry={entry} colIdx={colIdx} handleCellChange={handleCellChange} visibleColumns={visibleColumns} totalRows={totalRows} readOnly={!isEditable} scrollToColumn={scrollToColumn} />
          ) : (
            <SpreadsheetTextInput 
              idx={idx}
              col={col}
              entry={entry}
              visibleColumns={visibleColumns}
              colIdx={colIdx}
              totalRows={totalRows}
              handleCellChange={handleCellChange}
              searchTerm={searchTerm}
              readOnly={!isEditable}
              suggestions={columnSuggestions?.[col.id.toString()]}
              scrollToColumn={scrollToColumn}
            />
          )}
          {col.type !== 'formula' && col.type !== 'auto_increment' && isEditable && (
            <div 
              className="fill-handle" 
              data-row-idx={idx} 
              data-col-id={col.id} 
              data-entry-id={entry.id} 
            />
          )}
          </div>
        </td>
        );
      })}
      <td className="actions" style={{ width: '50px', minWidth: '50px', position: 'sticky', right: 0, zIndex: 1, background: 'var(--table-bg)', borderLeft: '1px solid var(--border-v)' }} />
    </tr>
  );
});
