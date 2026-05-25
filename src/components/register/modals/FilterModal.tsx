import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, ChevronRight, Filter, Plus, ChevronDown } from 'lucide-react';
import { type Column } from '../../../lib/api';
import { ColumnIcon } from '../ColumnIcon';


export interface FilterRule {
  columnId: number;
  operator: string;
  value: string;
  value2?: string; // For "between" operators
  values?: string[]; // For multi-select operators
}

interface FilterModalProps {
  filterModal: boolean;
  setFilterModal: (v: boolean) => void;
  filters: FilterRule[];
  setFilters: (v: FilterRule[]) => void;
  setActiveFilters: (v: FilterRule[]) => void;
  columns: Column[];
  entries: any[];
}

/* ── Operator definitions per column type ── */
const TEXT_OPS = [
  { key: 'contains', label: 'Contains' },
  { key: 'equals', label: 'Is' },
  { key: 'multi_select', label: 'Is Any Of' },
  { key: 'empty', label: 'Is Empty' },
];

const NUMBER_OPS = [
  { key: 'between', label: 'In Between Numbers' },
  { key: 'gt', label: 'Greater Than' },
  { key: 'lt', label: 'Less Than' },
  { key: 'multi_select', label: 'Is Any Of' },
  { key: 'empty', label: 'Blank Value' },
];

const DATE_OPS = [
  { key: 'date_between', label: 'In Between Dates' },
  { key: 'date_is', label: 'Is' },
  { key: 'date_before', label: 'Is Before' },
  { key: 'date_after', label: 'Is After' },
  { key: 'multi_select', label: 'Is Any Of' },
  { key: 'empty', label: 'Is Empty' },
];

const DROPDOWN_OPS = [
  { key: 'equals', label: 'Is' },
  { key: 'multi_select', label: 'Is Any Of' },
  { key: 'empty', label: 'Is Empty' },
];

function getOpsForType(type: string) {
  switch (type) {
    case 'number':
    case 'formula':
    case 'currency':
    case 'auto_increment':
    case 'rating':
      return NUMBER_OPS;
    case 'date': return DATE_OPS;
    case 'dropdown': return DROPDOWN_OPS;
    default: return TEXT_OPS;
  }
}



const NO_VALUE_OPS = ['empty', 'not_empty'];
const BETWEEN_OPS = ['between', 'not_between', 'date_between', 'date_not_between'];
const MULTI_VALUE_OPS = ['multi_select'];

export function FilterModal({
  filterModal, setFilterModal,
  filters, setFilters, setActiveFilters,
  columns, entries
}: FilterModalProps) {
  // "add filter" wizard state
  const [addingFilter, setAddingFilter] = useState(false);
  const [colSearch, setColSearch] = useState('');
  const [selectedColId, setSelectedColId] = useState<number | null>(null);
  const [selectedOp, setSelectedOp] = useState<string | null>(null);
  const [val1, setVal1] = useState('');
  const [val2, setVal2] = useState('');
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [filterSearch, setFilterSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const filteredCols = useMemo(() => {
    if (!colSearch) return columns;
    const q = colSearch.toLowerCase();
    return columns.filter(c => c.name.toLowerCase().includes(q));
  }, [columns, colSearch]);
  
  const uniqueValues = useMemo(() => {
    if (!selectedColId) return [];
    const set = new Set<string>();
    const colIdStr = selectedColId.toString();
    entries.forEach(e => {
      const val = e.cells?.[colIdStr];
      if (val && val.trim()) set.add(val.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [selectedColId, entries]);

  const selectedCol = columns.find(c => c.id === selectedColId);
  const ops = selectedCol ? getOpsForType(selectedCol.type) : [];

  const resetWizard = () => {
    setAddingFilter(false);
    setColSearch('');
    setSelectedColId(null);
    setSelectedOp(null);
    setVal1('');
    setVal2('');
    setSelectedValues([]);
    setFilterSearch('');
  };

  // Close panel on outside click
  useEffect(() => {
    if (!filterModal) return;
    const handleClick = (e: MouseEvent) => {
      // Check if click is inside the panel or its parent wrapper
      const wrapper = (panelRef.current?.parentElement);
      if (wrapper && !wrapper.contains(e.target as Node)) {
        setFilterModal(false);
        resetWizard();
      }
    };
    // Use a short delay so the opening click doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 10);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [filterModal, setFilterModal]);

  // Close on Escape
  useEffect(() => {
    if (!filterModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFilterModal(false); resetWizard(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [filterModal, setFilterModal]);

  const handleAddFilter = () => {
    if (selectedColId === null || !selectedOp) return;
    
    // Validation
    if (!NO_VALUE_OPS.includes(selectedOp)) {
      if (MULTI_VALUE_OPS.includes(selectedOp)) {
        if (selectedValues.length === 0) return;
      } else {
        if (!val1.trim()) return;
        if (BETWEEN_OPS.includes(selectedOp) && !val2.trim()) return;
      }
    }

    const newFilter: FilterRule = {
      columnId: selectedColId,
      operator: selectedOp,
      value: val1.trim(),
      value2: BETWEEN_OPS.includes(selectedOp) ? val2.trim() : undefined,
      values: MULTI_VALUE_OPS.includes(selectedOp) ? [...selectedValues] : undefined,
    };
    const updated = [...filters, newFilter];
    setFilters(updated);
    setActiveFilters(updated);
    resetWizard();
    setFilterModal(false);
  };

  const handleRemoveFilter = (idx: number) => {
    const updated = filters.filter((_, i) => i !== idx);
    setFilters(updated);
    setActiveFilters(updated);
  };

  const handleApply = () => {
    setActiveFilters([...filters]);
    setFilterModal(false);
    resetWizard();
  };

  const handleClearClose = () => {
    setFilters([]);
    setActiveFilters([]);
    setFilterModal(false);
    resetWizard();
  };

  const getOpLabel = (opKey: string, colType: string) => {
    const allOps = getOpsForType(colType);
    return allOps.find(o => o.key === opKey)?.label || opKey;
  };

  const getInputType = (op: string, colType: string) => {
    if (colType === 'date' || op.startsWith('date_')) return 'date';
    if (['number', 'formula', 'currency', 'auto_increment', 'rating'].includes(colType)) return 'number';
    return 'text';
  };

  if (!filterModal) return null;

  return (
    <div className="filter-dropdown-panel" ref={panelRef} onClick={(e) => e.stopPropagation()}>

      {/* ── Header ── */}
      <div className="fdp-header">
        <div className="fdp-title">
          <Filter size={14} />
          <span>Filter Data</span>
        </div>
        <div className="fdp-header-actions">
          {filters.length > 0 && (
            <button className="fdp-clear-btn" onClick={() => { setFilters([]); setActiveFilters([]); }}>CLEAR ALL</button>
          )}
          <button className="fdp-close-btn" onClick={() => { setFilterModal(false); resetWizard(); }} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Active Filters List ── */}
      {filters.length > 0 && (
        <div className="fdp-active-list">
          {filters.map((f, idx) => {
            const col = columns.find(c => c.id === f.columnId);
            return (
              <div key={idx} className="fdp-chip">
                <ColumnIcon type={col?.type || 'text'} size={12} />
                <span className="fdp-chip-col">{col?.name}</span>
                <span className="fdp-chip-op">{getOpLabel(f.operator, col?.type || 'text')}</span>
                {!NO_VALUE_OPS.includes(f.operator) && !MULTI_VALUE_OPS.includes(f.operator) && (
                  <span className="fdp-chip-val">"{f.value}"</span>
                )}
                {MULTI_VALUE_OPS.includes(f.operator) && f.values && (
                  <span className="fdp-chip-val">({f.values.length} selected)</span>
                )}
                {BETWEEN_OPS.includes(f.operator) && f.value2 && (
                  <span className="fdp-chip-val">to "{f.value2}"</span>
                )}
                <button className="fdp-chip-remove" onClick={() => handleRemoveFilter(idx)} aria-label="Remove filter">
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add Filter Wizard ── */}
      {!addingFilter ? (
        <button className="fdp-add-btn" onClick={() => setAddingFilter(true)}>
          <Plus size={13} /> Add Filter
        </button>
      ) : (
        <div className="fdp-wizard">
          <div className="fdp-wizard-header">
            <span>{selectedColId === null ? 'SELECT COLUMN' : 'SELECT OPERATOR'}</span>
            <button className="fdp-wizard-close" onClick={resetWizard}><X size={13} /></button>
          </div>

          <div className="fdp-wizard-content" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* Step 1: Column Selection */}
            {selectedColId === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                <div className="fdp-col-search">
                  <Search size={14} color="#999" />
                  <input
                    placeholder="SEARCH COLUMNS..."
                    value={colSearch}
                    onChange={(e) => setColSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="fdp-col-list">
                  {filteredCols.map(c => {
                    return (
                      <button key={c.id} className="fdp-col-item" onClick={() => setSelectedColId(c.id)}>
                        <ColumnIcon type={c.type} size={16} />
                        <span className="fdp-col-name">{c.name}</span>
                        <ChevronRight size={14} className="fdp-col-arrow" />
                      </button>
                    );
                  })}
                  {filteredCols.length === 0 && (
                    <div className="fdp-no-options">No columns found</div>
                  )}
                </div>
              </div>
            ) : (
              /* Step 2: Operator Selection OR Value Config */
              <div className="fdp-op-selection">
                {/* Back to Column Selection */}
                <div className="fdp-selection-header" onClick={() => { setSelectedColId(null); setSelectedOp(null); }}>
                  <ChevronDown size={14} className="fdp-back-arrow" style={{ transform: 'rotate(90deg)' }} />
                  <span className="fdp-selected-col-name">{selectedCol?.name}</span>
                </div>

                {selectedOp === null ? (
                  /* Combined Step 2: Searchable Values & List Operators */
                  <div className="fdp-step2-combined" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    <div className="fdp-step2-scroll" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                      <div className="fdp-multi-container">
                        <div className="fdp-search-wrapper">
                          <Search className="fdp-search-icon" size={14} />
                          <input 
                            type="text" 
                            className="fdp-search-input" 
                            placeholder="SEARCH VALUES..."
                            value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)}
                          />
                          {filterSearch && (
                            <button className="fdp-search-clear" onClick={() => setFilterSearch('')}>
                              <X size={14} />
                            </button>
                          )}
                        </div>

                        <div className="fdp-multi-actions">
                          <button 
                            className="fdp-multi-action-btn"
                            onClick={() => {
                              const all = uniqueValues.filter(v => v.toLowerCase().includes((filterSearch || '').toLowerCase()));
                              if (!filterSearch || '(blanks)'.includes(filterSearch.toLowerCase())) {
                                all.push('(Blanks)');
                              }
                              setSelectedValues(Array.from(new Set([...selectedValues, ...all])));
                            }}
                          >
                            SELECT ALL
                          </button>
                          <button 
                            className="fdp-multi-action-btn"
                            onClick={() => setSelectedValues([])}
                          >
                            CLEAR ALL
                          </button>
                        </div>

                        <div className="fdp-multi-list">
                          {(!filterSearch || '(blanks)'.includes(filterSearch.toLowerCase())) && (
                            <label className="fdp-multi-item">
                              <input
                                type="checkbox"
                                checked={selectedValues.includes('(Blanks)')}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedValues(['(Blanks)', ...selectedValues]);
                                  else setSelectedValues(selectedValues.filter(v => v !== '(Blanks)'));
                                }}
                              />
                              <span>(BLANKS)</span>
                            </label>
                          )}
                          {(selectedCol?.type === 'dropdown' ? (selectedCol.dropdownOptions || []) : uniqueValues)
                            .filter(opt => !filterSearch || opt.toLowerCase().includes(filterSearch.toLowerCase()))
                            .map(opt => (
                            <label key={opt} className="fdp-multi-item">
                              <input
                                type="checkbox"
                                checked={selectedValues.includes(opt)}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedValues([...selectedValues, opt]);
                                  else setSelectedValues(selectedValues.filter(v => v !== opt));
                                }}
                              />
                              <span>{opt.toUpperCase()}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="fdp-section-label" style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', padding: '0 8px 8px' }}>
                        FILTER BY CONDITION
                      </div>
                      {/* List Operators */}
                      <div className="fdp-op-list">
                        {ops.filter(o => o.key !== 'multi_select').map(op => (
                          <button key={op.key} className="fdp-op-item" onClick={() => setSelectedOp(op.key)}>
                            <div className="fdp-radio-circle" />
                            <span>{op.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="fdp-wizard-actions" style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', marginTop: 0, flexShrink: 0, backgroundColor: 'white' }}>
                      <button className="fdp-cancel-btn" onClick={() => { setSelectedColId(null); setSelectedValues([]); setFilterSearch(''); }}>BACK</button>
                      <button
                        className="fdp-confirm-btn"
                        disabled={selectedValues.length === 0}
                        onClick={() => {
                          const newFilter: FilterRule = {
                            columnId: selectedColId!,
                            operator: 'multi_select',
                            value: '',
                            values: [...selectedValues],
                          };
                          const updated = [...filters, newFilter];
                          setFilters(updated);
                          setActiveFilters(updated);
                          resetWizard();
                          setFilterModal(false);
                        }}
                      >
                        APPLY FILTER
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Step 3: Configure Value (for advanced operators) */
                  <div className="fdp-value-config" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, padding: 0 }}>
                    <div style={{ padding: '16px', overflowY: 'auto', flex: 1 }}>
                      <div className="fdp-op-display" onClick={() => setSelectedOp(null)} style={{ cursor: 'pointer' }}>
                        <div className="fdp-radio-circle selected" />
                        <span>{ops.find(o => o.key === selectedOp)?.label}</span>
                      </div>

                      <div className="fdp-value-area">
                        {selectedCol?.type === 'dropdown' ? (
                          <select
                            className="fdp-input"
                            value={val1}
                            onChange={(e) => setVal1(e.target.value)}
                            autoFocus
                          >
                            <option value="">SELECT VALUE...</option>
                            {(selectedCol.dropdownOptions || []).map(opt => (
                              <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                            ))}
                          </select>
                        ) : (
                          <>
                            <input
                              className="fdp-input"
                              type={getInputType(selectedOp, selectedCol?.type || 'text')}
                              placeholder={BETWEEN_OPS.includes(selectedOp) ? 'FROM VALUE...' : 'ENTER VALUE...'}
                              value={val1}
                              onChange={(e) => setVal1(e.target.value)}
                              autoFocus
                            />
                            {BETWEEN_OPS.includes(selectedOp) && (
                              <input
                                className="fdp-input"
                                type={getInputType(selectedOp, selectedCol?.type || 'text')}
                                placeholder="TO VALUE..."
                                value={val2}
                                onChange={(e) => setVal2(e.target.value)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="fdp-wizard-actions" style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', marginTop: 0, flexShrink: 0, backgroundColor: 'white' }}>
                      <button className="fdp-cancel-btn" onClick={() => setSelectedOp(null)}>BACK</button>
                      <button
                        className="fdp-confirm-btn"
                        disabled={
                          (!NO_VALUE_OPS.includes(selectedOp) && !val1) ||
                          (BETWEEN_OPS.includes(selectedOp) && !val2)
                        }
                        onClick={handleAddFilter}
                      >
                        APPLY FILTER
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {filters.length === 0 && !addingFilter && (
        <div className="fdp-empty">
          <Filter size={32} strokeWidth={1.5} color="#eee" />
          <p style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '11px', color: '#ccc', marginTop: '12px' }}>
            No filters applied
          </p>
        </div>
      )}

      {/* ── Footer ── */}
      {!addingFilter && (
        <div className="fdp-footer">
          <button className="fdp-cancel-btn" style={{ border: 'none' }} onClick={handleClearClose}>CANCEL</button>
          <button className="fdp-apply-btn" onClick={handleApply}>
            DONE {filters.length > 0 && `(${filters.length})`}
          </button>
        </div>
      )}
    </div>
  );
}
