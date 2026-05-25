import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Search, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { type Entry } from '../../../lib/api';

interface OtherModalsProps {
  // Rename Page
  renamePageModal: boolean;
  setRenamePageModal: (v: boolean) => void;
  renamePageValue: string;
  setRenamePageValue: (v: string) => void;
  renamePageId: number | null;
  pages: any[];
  deletePageMutation: any;
  renamePageMutation: any;
  columns: any[];


  // Date Picker
  dateModal: boolean;
  setDateModal: (v: boolean) => void;
  dateDay: string;
  setDateDay: (v: string) => void;
  dateMonth: string;
  setDateMonth: (v: string) => void;
  dateYear: string;
  setDateYear: (v: string) => void;
  handleDateSelect: (d?: string, m?: string, y?: string) => void;

  // Dropdown Cell
  dropdownModal: boolean;
  setDropdownModal: (v: boolean) => void;
  dropdownOptions: string[];
  dropdownEntryId: number | null;
  dropdownColumnId: number | null;
  localEntries: Entry[];
  handleCellChange: (entryId: number, columnId: string, value: string) => void;
  dropdownRect?: { top: number, bottom: number, left: number, width: number } | null;
  dateRect?: { top: number, bottom: number, left: number, width: number } | null;
  onAddDropdownOption?: (colId: number, newValue: string, entryId?: number) => void;
}

export function OtherModals(props: OtherModalsProps) {
  const {
    renamePageModal, setRenamePageModal, renamePageValue, setRenamePageValue, renamePageId, pages, deletePageMutation, renamePageMutation,
    columns,
    dateModal, setDateModal, dateDay, dateMonth, dateYear, handleDateSelect,
    dropdownModal, setDropdownModal, dropdownOptions, dropdownEntryId, dropdownColumnId, localEntries, handleCellChange, onAddDropdownOption
  } = props;

  const [dropdownSearch, setDropdownSearch] = useState('');
  const [viewMonth, setViewMonth] = useState(new Date().getMonth() + 1);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [yearPageOffset, setYearPageOffset] = useState(0);

  useEffect(() => {
    if (dateModal) {
      // Initialize from existing date props if available, otherwise use today
      const m = dateMonth && !isNaN(Number(dateMonth)) ? Number(dateMonth) : (new Date().getMonth() + 1);
      const y = dateYear && !isNaN(Number(dateYear)) ? Number(dateYear) : new Date().getFullYear();
      setViewMonth(m);
      setViewYear(y);
      setShowYearPicker(false);
      setYearPageOffset(0);
    }
  }, [dateModal]);

  const daysInMonth = (m: number, y: number) => new Date(y, m, 0).getDate();
  const firstDayOfMonth = (m: number, y: number) => new Date(y, m - 1, 1).getDay();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Always use the latest options from the columns prop to ensure optimistic updates are reflected
  // AND fetch all unique existing values from that column across all entries (Excel/Sheets behavior)
  const liveDropdownOptions = useMemo(() => {
    if (!dropdownModal || dropdownColumnId == null) return [];

    let rawOptions: string[] = [];
    
    // 1. Get predefined options from the column definition
    if (columns) {
      const col = columns.find(c => c.id === dropdownColumnId);
      if (col?.dropdownOptions) rawOptions = [...col.dropdownOptions];
    }

    // If no predefined options, use the ones passed from the trigger (fallback)
    if (rawOptions.length === 0 && dropdownOptions.length > 0) {
      rawOptions = [...dropdownOptions];
    }

    // 2. Fetch all unique existing values from this column across all entries
    // ONLY if no predefined options are set. This gives users full control once they define options.
    if (rawOptions.length === 0) {
      const colIdStr = dropdownColumnId.toString();
      localEntries.forEach(entry => {
        const val = entry.cells?.[colIdStr];
        if (val && val.trim() !== '') {
          rawOptions.push(val.trim());
        }
      });
    }

    // Normalize and remove duplicates (case-insensitive for uniqueness check, but preserve first casing found)
    const seen = new Set<string>();
    const unique: string[] = [];
    rawOptions.forEach(opt => {
      if (typeof opt !== 'string') return;
      const trimmed = opt.trim();
      if (!trimmed) return;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(trimmed);
      }
    });
    return unique;
  }, [dropdownModal, columns, dropdownColumnId, dropdownOptions, localEntries]);

  // Reset search when modal opens/closes
  useEffect(() => {
    if (!dropdownModal) setDropdownSearch('');
  }, [dropdownModal]);

  const filteredOptions = liveDropdownOptions.filter((opt: string) => 
    opt.toLowerCase().includes(dropdownSearch.toLowerCase())
  );

  const exactMatch = liveDropdownOptions.some((opt: string) => opt.toLowerCase() === dropdownSearch.toLowerCase());


  return createPortal(
    <>
      {/* ── Rename Page ── */}
      {renamePageModal && (
        <div className="modal-overlay" onClick={() => setRenamePageModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Page</h3>
            <input className="modal-input" value={renamePageValue} onChange={(e) => setRenamePageValue(e.target.value)} placeholder="Page name" autoFocus />
            <div className="modal-actions">
              <button
                className={`modal-cancel-btn ${pages.length > 1 ? 'modal-delete-page-btn' : ''}`}
                onClick={() => {
                  if (pages.length > 1 && renamePageId !== null) {
                    if (confirm('Delete this page and its entries?')) {
                      deletePageMutation.mutate(renamePageId);
                      setRenamePageModal(false);
                    }
                  } else {
                    setRenamePageModal(false);
                  }
                }}
              >
                {pages.length > 1 ? 'Delete' : 'Cancel'}
              </button>
              <button className="modal-confirm-btn" disabled={!renamePageValue.trim()} onClick={() => renamePageMutation.mutate()}>Rename</button>
            </div>
          </div>
        </div>
      )}


      {/* ── Date Picker ── */}
      {dateModal && (
        <div className={props.dateRect ? "popover-overlay" : "modal-overlay"} onClick={() => setDateModal(false)}>
          <div 
            className="popover-content date-popover modern-date-picker" 
            onClick={(e) => e.stopPropagation()}
            style={props.dateRect ? (() => {
              const rect = props.dateRect;
              const modalWidth = 280;
              const estHeight = 320; 
              const spaceBelow = window.innerHeight - rect.bottom - 12;
              const spaceAbove = rect.top - 12;
              const showAbove = spaceBelow < estHeight && spaceAbove > spaceBelow;
              const maxHeight = showAbove ? spaceAbove : spaceBelow;

              let left = rect.left + (rect.width / 2) - (modalWidth / 2);
              left = Math.max(8, Math.min(left, window.innerWidth - modalWidth - 8));

              return {
                position: 'fixed',
                left: left,
                ...(showAbove 
                  ? { bottom: (window.innerHeight - rect.top) + 6 } 
                  : { top: rect.bottom + 6 }
                ),
                width: `${modalWidth}px`,
                maxHeight: `${maxHeight}px`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10005,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                padding: '12px'
              } as React.CSSProperties;
            })() : {}}
          >
            <div className="calendar-header">
              <button className="calendar-nav-btn" onClick={() => {
                if (viewMonth === 1) {
                  setViewMonth(12);
                  setViewYear(viewYear - 1);
                } else {
                  setViewMonth(viewMonth - 1);
                }
              }}><ChevronLeft size={16} /></button>
              
              <div className="calendar-title">
                <span className="calendar-month">{monthNames[viewMonth - 1]}</span>
                <span 
                  className="calendar-year calendar-year-clickable" 
                  onClick={() => { setShowYearPicker(!showYearPicker); setYearPageOffset(0); }}
                  title="Click to select year"
                >
                  {viewYear} ▾
                </span>
              </div>

              <button className="calendar-nav-btn" onClick={() => {
                if (viewMonth === 12) {
                  setViewMonth(1);
                  setViewYear(viewYear + 1);
                } else {
                  setViewMonth(viewMonth + 1);
                }
              }}><ChevronRight size={16} /></button>
            </div>

            {showYearPicker ? (
              <div className="year-picker-container">
                <div className="year-picker-nav">
                  <button className="calendar-nav-btn" onClick={() => setYearPageOffset(yearPageOffset - 1)}>
                    <ChevronLeft size={14} />
                  </button>
                  <span className="year-picker-range">
                    {viewYear - 6 + yearPageOffset * 12} – {viewYear + 5 + yearPageOffset * 12}
                  </span>
                  <button className="calendar-nav-btn" onClick={() => setYearPageOffset(yearPageOffset + 1)}>
                    <ChevronRight size={14} />
                  </button>
                </div>
                <div className="year-picker-grid">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const yr = viewYear - 6 + i + yearPageOffset * 12;
                    const isCurrent = yr === viewYear;
                    const isThisYear = yr === new Date().getFullYear();
                    return (
                      <button
                        key={yr}
                        className={`year-picker-item ${isCurrent ? 'selected' : ''} ${isThisYear ? 'current-year' : ''}`}
                        onClick={() => {
                          setViewYear(yr);
                          setShowYearPicker(false);
                        }}
                      >
                        {yr}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="calendar-weekdays">
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="calendar-weekday">{d}</div>
                  ))}
                </div>

                <div className="calendar-grid">
                  {Array.from({ length: firstDayOfMonth(viewMonth, viewYear) }).map((_, i) => (
                    <div key={`empty-${i}`} className="calendar-day empty" />
                  ))}
                  {Array.from({ length: daysInMonth(viewMonth, viewYear) }).map((_, i) => {
                    const d = i + 1;
                    const isSelected = d.toString() === dateDay && viewMonth.toString() === dateMonth && viewYear.toString() === dateYear;
                    const isToday = d === new Date().getDate() && viewMonth === (new Date().getMonth() + 1) && viewYear === new Date().getFullYear();
                    
                    return (
                      <button 
                        key={d} 
                        className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                        onClick={() => {
                          handleDateSelect(d.toString(), viewMonth.toString(), viewYear.toString());
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="calendar-footer">
              <button 
                className="calendar-today-btn" 
                onClick={() => {
                  const today = new Date();
                  handleDateSelect(
                    today.getDate().toString(), 
                    (today.getMonth() + 1).toString(), 
                    today.getFullYear().toString()
                  );
                }}
              >
                <CalendarIcon size={12} style={{ marginRight: 6 }} />
                Today
              </button>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className="calendar-clear-btn" 
                  onClick={() => {
                    handleDateSelect('', '', '');
                  }}
                >
                  Clear
                </button>
                <button className="calendar-cancel-btn" onClick={() => setDateModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dropdown Cell ── */}
      {dropdownModal && (
        <div className={props.dropdownRect ? "popover-overlay" : "modal-overlay"} onClick={() => setDropdownModal(false)}>
          <div 
            className={props.dropdownRect ? "popover-content dropdown-popover" : "modal-content"} 
            onClick={(e) => e.stopPropagation()}
            style={props.dropdownRect ? (() => {
              const rect = props.dropdownRect;
              const modalWidth = Math.max(rect.width, 220);
              const spaceBelow = window.innerHeight - rect.bottom - 12;
              const spaceAbove = rect.top - 12;
              
              // Estimate height of search (40px) + footer (40px) + items
              const estContentHeight = Math.min(liveDropdownOptions.length * 40 + 80, 400);
              
              // Decide placement
              const showAbove = spaceBelow < estContentHeight && spaceAbove > spaceBelow;
              const maxHeight = showAbove ? spaceAbove : spaceBelow;

              let left = rect.left;
              if (left + modalWidth > window.innerWidth - 8) {
                left = window.innerWidth - modalWidth - 8;
              }
              left = Math.max(8, left);

              return {
                position: 'fixed',
                left: left,
                ...(showAbove 
                  ? { bottom: (window.innerHeight - rect.top) + 6 } 
                  : { top: rect.bottom + 6 }
                ),
                width: `${modalWidth}px`,
                maxWidth: '320px',
                maxHeight: `${maxHeight}px`,
                display: 'flex',
                flexDirection: 'column',
                zIndex: 10005,
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)'
              } as React.CSSProperties;
            })() : {}}
          >
            {!props.dropdownRect && <h3 className="modal-title">Select Options</h3>}
            
            <div className="dropdown-search-container">
              <Search size={14} className="search-icon" />
              <input 
                className="dropdown-search-input" 
                placeholder="Search or add..." 
                value={dropdownSearch}
                onChange={(e) => setDropdownSearch(e.target.value)}
                autoFocus
              />
            </div>

            <div className="dropdown-modal-list">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((opt: string, idx: number) => {
                  const currentVal = dropdownEntryId ? localEntries.find((e) => e.id === dropdownEntryId)?.cells?.[dropdownColumnId?.toString() || ''] : '';
                  // Strict single choice: compare directly with currentVal
                  const isSelected = currentVal === opt;
                  
                  return (
                    <button
                      key={idx}
                      className={`dropdown-modal-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (dropdownEntryId != null && dropdownColumnId != null) {
                          // Single select behavior: clicking a new option replaces the current one.
                          // If clicking the already selected option, we deselect it.
                          const newVal = isSelected ? '' : opt;
                          handleCellChange(dropdownEntryId, dropdownColumnId.toString(), newVal);
                          setDropdownModal(false);
                        }
                      }}
                    >
                      <span>{opt}</span>
                      {isSelected && <Check size={14} className="check-icon" />}
                    </button>
                  );
                })
              ) : (
                <div className="dropdown-no-results">No matches found</div>
              )}

              {dropdownSearch.trim() && !exactMatch && (
                <button 
                  className="dropdown-modal-item add-new-opt"
                  onClick={() => {
                    if (dropdownColumnId != null && onAddDropdownOption) {
                      onAddDropdownOption(dropdownColumnId, dropdownSearch.trim(), dropdownEntryId || undefined);
                      setDropdownSearch('');
                      setDropdownModal(false);
                    }
                  }}
                >
                  <Plus size={14} className="plus-icon" />
                  <span>Add "{dropdownSearch}"</span>
                </button>
              )}
            </div>
            <div className="dropdown-popover-footer">
              <button 
                className="dropdown-clear-btn"
                onClick={() => {
                  if (dropdownEntryId != null && dropdownColumnId != null) {
                    handleCellChange(dropdownEntryId, dropdownColumnId.toString(), '');
                    setDropdownModal(false);
                  }
                }}
              >
                Clear Selection
              </button>
              {props.dropdownRect && (
                <button className="dropdown-done-btn" onClick={() => setDropdownModal(false)}>Done</button>
              )}
            </div>
          </div>
        </div>
      )}
    </>,
    document.body
  );
}
