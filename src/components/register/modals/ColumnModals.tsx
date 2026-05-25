import { AlertCircle, X, Plus, AlertTriangle, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { 
  Calculator, PlusCircle, MinusCircle, XCircle, DivideCircle, 
  Percent, Settings2, Trash2 
} from 'lucide-react';
import { evaluateFormula, getRegister, linkColumn } from '../../../lib/api';
import type { RegisterSummary, Column as ApiColumn } from '../../../lib/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';

function FormulaBuilder({ formula, onChange, columns, entries, outputName, excludeId }: { formula: string, onChange: (v: string) => void, columns: any[], entries?: any[], outputName?: string, excludeId?: number | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');

  const insertText = (text: string) => {
    const input = inputRef.current;
    if (input) {
      const start = input.selectionStart || 0;
      const end = input.selectionEnd || 0;
      const val = formula;
      const newVal = val.substring(0, start) + text + val.substring(end);
      onChange(newVal);
      
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const newPos = start + text.length;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 10);
    } else {
      onChange(formula + text);
    }
  };
  const [presetType, setPresetType] = useState<'add' | 'sub' | 'mul' | 'div' | 'pct'>('add');
  
  // Selection state for presets
  const [selectedCols, setSelectedCols] = useState<number[]>([]); // For Add, Mul, Sub
  const [colA, setColA] = useState<number | null>(null); // For Div, Pct (numerator)
  const [colB, setColB] = useState<number | null>(null); // For Div, Pct (denominator)
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Sync selection state from existing formula
  useEffect(() => {
    if (!formula) return;
    
    // Detect preset type locally to avoid dependency on async state
    let detectedType: 'add' | 'sub' | 'mul' | 'div' | 'pct' | null = null;
    if (formula.includes('+')) {
      detectedType = 'add';
    } else if (formula.includes('-') && formula.includes('{')) {
      // Subtraction preset: {A} - {B} - {C}
      detectedType = 'sub';
    } else if (formula.includes('*') && !formula.includes('/')) {
      detectedType = 'mul';
    } else if (formula.includes('/') && !formula.includes('*100')) {
      detectedType = 'div';
    } else if (formula.includes('/') && formula.includes('*100')) {
      detectedType = 'pct';
    }

    if (detectedType) {
      setPresetType(detectedType);
    } else if (formula) {
      setMode('custom');
    }

    // Extract column names from formula like {Name}
    const matches = Array.from(formula.matchAll(/\{([^}]+)\}/g));
    const foundNames = matches.map(m => m[1]);
    const foundIds = foundNames.map(name => columns.find(c => c.name === name)?.id).filter(Boolean) as number[];

    if (foundIds.length > 0) {
      if (detectedType === 'div' || detectedType === 'pct') {
        setColA(foundIds[0]);
        setColB(foundIds[1] || null);
      } else {
        setSelectedCols(foundIds);
      }
    }
  }, []); // Only run once on mount to initialize UI from existing formula

  const generateFormula = (type: string, sCols: number[], a: number | null, b: number | null) => {
    const colName = (id: number) => {
      const c = columns.find(col => col.id === id);
      return c ? `{${c.name}}` : '';
    };

    let f = '';
    switch (type) {
      case 'add':
        f = sCols.map(id => colName(id)).filter(Boolean).join(' + ');
        break;
      case 'sub':
        f = sCols.map(id => colName(id)).filter(Boolean).join(' - ');
        break;
      case 'mul':
        f = sCols.map(id => colName(id)).filter(Boolean).join(' * ');
        break;
      case 'div':
        if (a && b) f = `${colName(a)} / ${colName(b)}`;
        break;
      case 'pct':
        if (a && b) f = `(${colName(a)} / ${colName(b)}) * 100`;
        break;
    }
    if (f !== formula) {
      onChange(f);
    }
  };

  const handlePresetChange = (type: any) => {
    setPresetType(type);
    generateFormula(type, selectedCols, colA, colB);
  };

  const toggleColSelection = (id: number) => {
    const isSelected = selectedCols.includes(id);
    const next = isSelected 
      ? selectedCols.filter(i => i !== id) 
      : [...selectedCols, id];
    setSelectedCols(next);
    generateFormula(presetType, next, colA, colB);
  };

  const removeColAtIndex = (index: number) => {
    const next = selectedCols.filter((_, i) => i !== index);
    setSelectedCols(next);
    generateFormula(presetType, next, colA, colB);
  };

  const setA = (id: number | null) => {
    setColA(id);
    generateFormula(presetType, selectedCols, id, colB);
  };

  const setB = (id: number | null) => {
    setColB(id);
    generateFormula(presetType, selectedCols, colA, id);
  };

  const [previewResult, setPreviewResult] = useState<string>('0');
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (!formula || !entries || entries.length === 0) {
      setPreviewResult('0');
      return;
    }

    debounceTimer.current = setTimeout(() => {
      const result = evaluateFormula(formula, entries[0], columns);
      setPreviewResult(result || '0');
    }, 200);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [formula, entries, columns]);

  const duplicateColsInFormula = columns.filter(c => c.id !== excludeId && formula.split(`{${c.name}}`).length > 2);

  return (
    <div className="formula-builder" style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-light)', borderRadius: '8px', border: '1px solid var(--border)' }}>
      <div className="formula-mode-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button 
          className={`mode-tab ${mode === 'preset' ? 'active' : ''}`} 
          onClick={() => setMode('preset')}
          style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: mode === 'preset' ? 'var(--navy)' : 'white', color: mode === 'preset' ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: mode === 'preset' ? 600 : 400 }}
        >
          Visual Builder (Preset)
        </button>
        <button 
          className={`mode-tab ${mode === 'custom' ? 'active' : ''}`} 
          onClick={() => setMode('custom')}
          style={{ flex: 1, padding: '8px', fontSize: '13px', borderRadius: '8px', border: '1px solid var(--border)', background: mode === 'custom' ? 'var(--navy)' : 'white', color: mode === 'custom' ? 'white' : 'var(--text-main)', cursor: 'pointer', fontWeight: mode === 'custom' ? 700 : 500, transition: 'all 0.2s' }}
        >
          Custom Formula (Advanced)
        </button>
      </div>

      {mode === 'preset' ? (
        <div className="preset-editor">
          <div className="preset-types" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '12px' }}>
            <button onClick={() => handlePresetChange('add')} className={`preset-btn ${presetType === 'add' ? 'active' : ''}`} style={presetBtnStyle(presetType === 'add')}>
              <PlusCircle size={14} /> Add
            </button>
            <button onClick={() => handlePresetChange('sub')} className={`preset-btn ${presetType === 'sub' ? 'active' : ''}`} style={presetBtnStyle(presetType === 'sub')}>
              <MinusCircle size={14} /> Sub
            </button>
            <button onClick={() => handlePresetChange('mul')} className={`preset-btn ${presetType === 'mul' ? 'active' : ''}`} style={presetBtnStyle(presetType === 'mul')}>
              <XCircle size={14} /> Mult
            </button>
            <button onClick={() => handlePresetChange('div')} className={`preset-btn ${presetType === 'div' ? 'active' : ''}`} style={presetBtnStyle(presetType === 'div')}>
              <DivideCircle size={14} /> Div
            </button>
            <button onClick={() => handlePresetChange('pct')} className={`preset-btn ${presetType === 'pct' ? 'active' : ''}`} style={presetBtnStyle(presetType === 'pct')}>
              <Percent size={14} /> %
            </button>
            <button onClick={() => setMode('custom')} className="preset-btn" style={presetBtnStyle(false)}>
              <Settings2 size={14} /> More
            </button>
          </div>

          {(presetType === 'add' || presetType === 'mul' || presetType === 'sub') && (
            <div className="col-selector" style={{ marginTop: '16px' }}>
              <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>
                Build your calculation step-by-step:
              </label>
              
              {/* Added Columns List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {selectedCols.length === 0 && (
                  <div style={{ padding: '12px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
                    No columns added yet. Use the search below to start.
                  </div>
                )}
                {selectedCols.map((id, index) => {
                  const col = columns.find(c => c.id === id);
                  if (!col) return null;
                  return (
                    <div key={`${id}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'white', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--navy)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
                        {index + 1}
                      </div>
                      <span style={{ flex: 1, fontSize: '13px', fontWeight: 500 }}>{col.name}</span>
                      {index > 0 && (
                        <div style={{ fontSize: '12px', fontWeight: 900, color: 'var(--primary)', padding: '0 8px' }}>
                          {presetType === 'add' ? '+' : presetType === 'mul' ? '×' : '-'}
                        </div>
                      )}
                      <button 
                        onClick={() => removeColAtIndex(index)}
                        style={{ padding: '4px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Search and Add Section */}
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input 
                      type="text" 
                      className="modal-input"
                      style={{ marginBottom: 0, paddingLeft: '32px', fontSize: '13px' }}
                      placeholder="Search columns to add..."
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                    />
                    <Settings2 size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {isDropdownOpen && (
                  <div style={{ 
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, 
                    marginTop: '4px', background: 'white', border: '1px solid var(--border)', 
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' 
                  }}>
                    {columns
                      .filter(c => c.id !== excludeId && c.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(c => (
                        <button
                          key={c.id}
                          onClick={() => {
                            toggleColSelection(c.id);
                            setSearchQuery('');
                            setIsDropdownOpen(false);
                          }}
                          style={{ 
                            width: '100%', padding: '10px 12px', textAlign: 'left', background: 'none', border: 'none', 
                            borderBottom: '1px solid var(--bg-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <PlusCircle size={14} color="var(--primary)" />
                          <span style={{ fontSize: '13px', color: 'var(--text-main)' }}>{c.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--muted)', background: 'var(--bg-light)', padding: '2px 4px', borderRadius: '4px' }}>{c.type}</span>
                        </button>
                      ))}
                    {columns.filter(c => c.id !== excludeId && c.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                      <div style={{ padding: '12px', fontSize: '12px', color: 'var(--muted)', textAlign: 'center' }}>No columns found</div>
                    )}
                  </div>
                )}
              </div>

              <button 
                className="modal-confirm-btn"
                style={{ width: '100%', marginTop: '12px', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '12px' }}
                onClick={() => setIsDropdownOpen(true)}
              >
                <Plus size={16} /> Add {selectedCols.length > 0 ? 'Another' : 'a'} Column
              </button>
            </div>
          )}

          {(presetType === 'div' || presetType === 'pct') && (
            <div className="dual-col-selector" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  {presetType === 'div' ? 'Dividend (Top)' : 'Value (Obtained)'}
                </label>
                <select 
                  className="modal-input" 
                  style={{ marginBottom: 0, padding: '4px', fontSize: '12px' }}
                  value={colA || ''} 
                  onChange={(e) => setA(Number(e.target.value))}
                >
                  <option value="">Select Column</option>
                  {columns.filter(c => c.id !== excludeId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
                  {presetType === 'div' ? 'Divisor (Bottom)' : 'Total (Out of)'}
                </label>
                <select 
                  className="modal-input" 
                  style={{ marginBottom: 0, padding: '4px', fontSize: '12px' }}
                  value={colB || ''} 
                  onChange={(e) => setB(Number(e.target.value))}
                >
                  <option value="">Select Column</option>
                  {columns.filter(c => c.id !== excludeId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="custom-editor">
          <label className="modal-label" style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Formula Expression</label>
          <textarea 
            ref={inputRef as any}
            className="modal-textarea" 
            value={formula} 
            onChange={(e) => onChange(e.target.value)} 
            placeholder="e.g. {Marks} / {Full Marks} * 100"
            style={{ minHeight: '100px', fontSize: '15px', fontWeight: 600, fontFamily: 'monospace', borderColor: duplicateColsInFormula.length > 0 ? '#ef4444' : undefined }}
          />
          
          {duplicateColsInFormula.length > 0 && (
            <div style={{ marginTop: '4px', fontSize: '12px', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <AlertTriangle size={14} /> 
              Warning: Columns cannot be used multiple times ({duplicateColsInFormula.map(c => `{${c.name}}`).join(', ')})
            </div>
          )}
          
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Operators:</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[
                { label: '+', value: '+' },
                { label: '-', value: '-' },
                { label: '*', value: '*' },
                { label: '/', value: '/' },
                { label: '(', value: '(' },
                { label: ')', value: ')' },
                { label: '.', value: '.' },
                { label: '^', value: '^' },
              ].map(op => (
                <button 
                  key={op.value} 
                  onClick={() => insertText(op.value)}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '14px', 
                    fontWeight: 800,
                    borderRadius: '6px', 
                    border: '1px solid var(--border)', 
                    background: 'white', 
                    cursor: 'pointer',
                    minWidth: '38px',
                    color: 'var(--navy)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  type="button"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-light)';
                    e.currentTarget.style.borderColor = 'var(--primary-light)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'white';
                    e.currentTarget.style.borderColor = 'var(--border)';
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>Select Columns to Insert:</label>
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '6px', 
              padding: '12px', 
              background: 'white', 
              border: '1px solid var(--border)', 
              borderRadius: '10px',
              minHeight: '160px',
              maxHeight: '250px',
              overflowY: 'auto',
              alignContent: 'flex-start',
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)'
            }}>
              {columns.filter(c => c.id !== excludeId).map(c => {
                const isUsed = formula.includes(`{${c.name}}`);
                return (
                  <button 
                    key={c.id} 
                    onClick={() => {
                      if (!isUsed) insertText(`{${c.name}}`);
                    }}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      fontWeight: 600,
                      borderRadius: '8px', 
                      border: isUsed ? '1px solid #fca5a5' : '1px solid var(--border)', 
                      background: isUsed ? '#fef2f2' : 'var(--bg-light)', 
                      cursor: isUsed ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s',
                      color: isUsed ? '#dc2626' : 'var(--navy)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      opacity: isUsed ? 0.8 : 1
                    }}
                    type="button"
                    onMouseEnter={(e) => {
                      if (!isUsed) {
                        e.currentTarget.style.background = 'white';
                        e.currentTarget.style.borderColor = 'var(--navy)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isUsed) {
                        e.currentTarget.style.background = 'var(--bg-light)';
                        e.currentTarget.style.borderColor = 'var(--border)';
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.boxShadow = 'none';
                      }
                    }}
                    title={isUsed ? 'Column already added' : `Insert ${c.name}`}
                  >
                    {c.name}
                  </button>
                );
              })}
              {columns.filter(c => c.id !== excludeId).length === 0 && (
                <div style={{ width: '100%', textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '20px' }}>
                  No other columns available to reference.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="formula-preview" style={{ marginTop: '16px', borderTop: '2px solid var(--border)', paddingTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 800, textTransform: 'uppercase' }}>
            Live Calculation Preview
          </label>
          <div style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: 600 }}>
            {outputName || 'New Column'} = {formula || '—'}
          </div>
        </div>
        
        <div style={{ background: 'white', padding: '14px', borderRadius: '12px', border: '1px solid var(--primary-light)', boxShadow: '0 4px 12px rgba(26,35,126,0.08)' }}>
          {entries && entries.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 600 }}>Testing with Row 1:</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {columns.filter(c => formula.includes(`{${c.name}}`)).slice(0, 3).map(c => (
                    <span key={c.id} style={{ fontSize: '11px', background: 'var(--bg-light)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                      {c.name}: <b>{entries[0].cells?.[c.id.toString()] || '0'}</b>
                    </span>
                  ))}
                  {columns.filter(c => formula.includes(`{${c.name}}`)).length > 3 && <span style={{ fontSize: '11px', color: 'var(--muted)' }}>...</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
                <span style={{ fontSize: '10px', color: 'var(--muted)', display: 'block', fontWeight: 600 }}>Result:</span>
                <span style={{ fontSize: '22px', fontWeight: 900, color: 'var(--navy)', lineHeight: 1 }}>
                  {previewResult}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '10px', fontSize: '13px', color: 'var(--muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <Calculator size={20} opacity={0.3} />
              <span>Add data to Row 1 to see calculation results.</span>
            </div>
          )}
        </div>
        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '11px', color: 'var(--muted)', lineHeight: 1.4 }}>
          <AlertCircle size={14} style={{ marginTop: '1px', flexShrink: 0 }} />
          <span>The formula calculates automatically as you type in any row. No manual refresh needed.</span>
        </div>
      </div>
    </div>
  );
}

const presetBtnStyle = (active: boolean) => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
  padding: '6px', fontSize: '11px', borderRadius: '6px', border: `1px solid ${active ? 'var(--navy)' : 'var(--border)'}`,
  background: active ? 'var(--navy)' : 'white', color: active ? 'white' : 'var(--text-main)',
  cursor: 'pointer', transition: 'all 0.2s'
});

function OptionsEditor({ value, onChange, columnData = [] }: { value: string, onChange: (v: string) => void, columnData?: string[] }) {
  const [opts, setOpts] = useState<string[]>(() => value ? value.split(',') : []);
  const lastSentValue = useRef(value);
  
  useEffect(() => {
    if (value !== lastSentValue.current) {
      setOpts(value ? value.split(',') : []);
      lastSentValue.current = value;
    }
  }, [value]);

  const updateOpts = (newOpts: string[]) => {
    setOpts(newOpts);
    const newStr = newOpts.join(',');
    lastSentValue.current = newStr;
    onChange(newStr);
  };

  return (
    <div className="options-editor-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <label className="modal-label" style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
          Predefined Options ({opts.length})
        </label>
        <button 
          type="button" 
          onClick={() => { if (confirm('Clear all options?')) updateOpts([]); }}
          style={{ fontSize: '11px', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
        >
          Clear All
        </button>
      </div>

      <div className="options-list-scroll" style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px', paddingRight: '4px' }}>
        {opts.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '8px', color: 'var(--muted)', fontSize: '12px', background: 'var(--bg-light)' }}>
            No predefined options yet. Add some below or pick from existing data.
          </div>
        ) : (
          opts.map((opt, i) => (
            <div key={i} className="options-editor-row" style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--bg-light)', color: 'var(--muted)', fontSize: '10px', fontWeight: 700 }}>
                {i + 1}
              </div>
              <input 
                className="modal-input" 
                style={{ marginBottom: 0, flex: 1, height: '36px', fontSize: '13px' }} 
                value={opt} 
                onChange={(e) => {
                  const newOpts = [...opts];
                  newOpts[i] = e.target.value;
                  updateOpts(newOpts);
                }} 
                placeholder="Option name" 
              />
              <button 
                type="button" 
                onClick={() => {
                  const newOpts = [...opts];
                  newOpts.splice(i, 1);
                  updateOpts(newOpts);
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '6px', opacity: 0.6, transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
              >
                <X size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <button 
        type="button" 
        onClick={() => updateOpts([...opts, `Option ${opts.length + 1}`])}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-light)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', cursor: 'pointer', color: 'var(--navy)', width: '100%', justifyContent: 'center', fontSize: '13px', fontWeight: 600, marginBottom: '20px', transition: 'all 0.2s' }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'white'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-light)'}
      >
        <Plus size={16} /> Add New Option
      </button>

      {columnData.length > 0 && (
        <div className="suggestions-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <label className="modal-label" style={{ margin: 0, fontSize: '11px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Suggestions from existing data
            </label>
            <button 
              type="button" 
              onClick={() => {
                const newOnes = columnData.filter(d => !opts.some(o => o.toLowerCase() === d.toLowerCase()));
                if (newOnes.length > 0) updateOpts([...opts, ...newOnes]);
              }}
              style={{ fontSize: '11px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
            >
              Add All
            </button>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
            These values are already present in this column. Click to add them as official options.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '120px', overflowY: 'auto', padding: '2px' }}>
            {columnData.map((data, idx) => {
              const isAlreadyOption = opts.some(o => o.toLowerCase() === data.toLowerCase());
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isAlreadyOption}
                  onClick={() => updateOpts([...opts, data])}
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '12px', 
                    borderRadius: '20px', 
                    border: '1px solid var(--border)', 
                    background: isAlreadyOption ? 'var(--bg-light)' : 'white',
                    color: isAlreadyOption ? 'var(--muted)' : 'var(--navy)',
                    cursor: isAlreadyOption ? 'default' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { if (!isAlreadyOption) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                  onMouseLeave={(e) => { if (!isAlreadyOption) e.currentTarget.style.borderColor = 'var(--border)'; }}
                >
                  {isAlreadyOption ? <Check size={12} /> : <Plus size={12} />}
                  {data}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface ColumnModalsProps {
  // New Column / Insert Column
  newColumnModal: boolean;
  setNewColumnModal: (v: boolean) => void;
  insertColModal: 'left' | 'right' | null;
  setInsertColModal: (v: 'left' | 'right' | null) => void;
  newColName: string;
  setNewColName: (v: string) => void;
  newColType: string;
  setNewColType: (v: string) => void;
  newColDropdownOpts: string;
  setNewColDropdownOpts: (v: string) => void;
  newColFormula: string;
  setNewColFormula: (v: string) => void;
  addColumnMutation: any;
  insertColumnMutation: any;

  // Rename Column
  renameColModal: boolean;
  setRenameColModal: (v: boolean) => void;
  renameColValue: string;
  setRenameColValue: (v: string) => void;
  renameColumnMutation: any;

  // Dropdown Config
  dropdownConfigModal: boolean;
  setDropdownConfigModal: (v: boolean) => void;
  dropdownConfigOptions: string;
  setDropdownConfigOptions: (v: string) => void;
  updateDropdownMutation: any;

  // Change Type
  changeTypeModal: boolean;
  setChangeTypeModal: (v: boolean) => void;
  changeTypeValue: string;
  setChangeTypeValue: (v: string) => void;
  changeColumnTypeMutation: any;
  
  linkColumnModal: boolean;
  setLinkColumnModal: (v: boolean) => void;
  
  activeModalColId: number | null;

  allRegisters?: RegisterSummary[];
  currentRegisterId?: number;

  COL_TYPES: any[];
  columns: any[];
  entries: any[];
}

export function ColumnModals(props: ColumnModalsProps) {
  const {
    newColumnModal, setNewColumnModal, insertColModal, setInsertColModal,
    newColName, setNewColName, newColType, setNewColType,
    newColDropdownOpts, setNewColDropdownOpts, newColFormula, setNewColFormula,
    addColumnMutation, insertColumnMutation,
    renameColModal, setRenameColModal, renameColValue, setRenameColValue, renameColumnMutation,
    dropdownConfigModal, setDropdownConfigModal, dropdownConfigOptions, setDropdownConfigOptions, updateDropdownMutation,
    changeTypeModal, setChangeTypeModal, changeTypeValue, setChangeTypeValue, changeColumnTypeMutation,
    linkColumnModal, setLinkColumnModal,
    activeModalColId,
    COL_TYPES, columns, entries,
    allRegisters, currentRegisterId
  } = props;

  return (
    <>
      {/* ── Add New Column ── */}
      {newColumnModal && (
        <div className="modal-overlay" onClick={() => setNewColumnModal(false)}>
          <div className={`modal-content ${newColType === 'formula' ? 'modal-content--formula' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add New Column</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && newColName.trim() && addColumnMutation.mutate()} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label" style={{ marginTop: '12px', display: 'block', marginBottom: '8px' }}>Options</label>
                <OptionsEditor 
                  value={newColDropdownOpts} 
                  onChange={setNewColDropdownOpts} 
                  columnData={[]} // No column data for new column
                />
              </>
            )}
            {newColType === 'formula' && (
              <FormulaBuilder 
                formula={newColFormula} 
                onChange={setNewColFormula} 
                columns={columns} 
                entries={entries}
                outputName={newColName}
                excludeId={activeModalColId}
              />
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setNewColumnModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => addColumnMutation.mutate()}>
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rename Column ── */}
      {renameColModal && (
        <div className="modal-overlay" onClick={() => setRenameColModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Rename Column</h3>
            <input className="modal-input" value={renameColValue} onChange={(e) => setRenameColValue(e.target.value)} placeholder="New column name" autoFocus />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setRenameColModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!renameColValue.trim()} onClick={() => renameColumnMutation.mutate()}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dropdown Config ── */}
      {dropdownConfigModal && (
        <div className="modal-overlay" onClick={() => setDropdownConfigModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Dropdown Options</h3>
            <label className="modal-label" style={{ marginBottom: '8px', display: 'block' }}>Options</label>
            <OptionsEditor 
              value={dropdownConfigOptions} 
              onChange={setDropdownConfigOptions} 
              columnData={(() => {
                if (activeModalColId == null || !entries) return [];
                const colIdStr = activeModalColId.toString();
                const seen = new Set<string>();
                const unique: string[] = [];
                entries.forEach(e => {
                  const val = e.cells?.[colIdStr]?.trim();
                  if (val && !seen.has(val.toLowerCase())) {
                    seen.add(val.toLowerCase());
                    unique.push(val);
                  }
                });
                return unique;
              })()}
            />
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setDropdownConfigModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => updateDropdownMutation.mutate()}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Change Type ── */}
      {changeTypeModal && (
        <div className="modal-overlay" onClick={() => setChangeTypeModal(false)}>
          <div className={`modal-content ${changeTypeValue === 'formula' ? 'modal-content--formula' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Change Column Type</h3>
            <p className="modal-p-text">Changing the type may affect existing data in this column.</p>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${changeTypeValue === t.id ? 'active' : ''}`} onClick={() => setChangeTypeValue(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {changeTypeValue === 'formula' && (
              <FormulaBuilder 
                formula={newColFormula} 
                onChange={setNewColFormula} 
                columns={columns} 
                entries={entries}
                outputName={newColName}
                excludeId={activeModalColId}
              />
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setChangeTypeModal(false)}>Cancel</button>
              <button className="modal-confirm-btn" onClick={() => changeColumnTypeMutation.mutate()}>Change Type</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Insert Column ── */}
      {insertColModal !== null && (
        <div className="modal-overlay" onClick={() => setInsertColModal(null)}>
          <div className={`modal-content ${newColType === 'formula' ? 'modal-content--formula' : ''}`} onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Insert Column {insertColModal === 'left' ? 'Left' : 'Right'}</h3>
            <label className="modal-label">Column Name</label>
            <input className="modal-input" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="e.g. Amount" autoFocus />
            <label className="modal-label">Column Type</label>
            <div className="type-chips">
              {COL_TYPES.map((t) => (
                <button key={t.id} className={`type-chip ${newColType === t.id ? 'active' : ''}`} onClick={() => setNewColType(t.id)}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
            {newColType === 'dropdown' && (
              <>
                <label className="modal-label" style={{ marginTop: '12px', display: 'block', marginBottom: '8px' }}>Options</label>
                <OptionsEditor 
                  value={newColDropdownOpts} 
                  onChange={setNewColDropdownOpts} 
                  columnData={(() => {
                    if (activeModalColId == null || !entries) return [];
                    const colIdStr = activeModalColId.toString();
                    const seen = new Set<string>();
                    const unique: string[] = [];
                    entries.forEach(e => {
                      const val = e.cells?.[colIdStr]?.trim();
                      if (val && !seen.has(val.toLowerCase())) {
                        seen.add(val.toLowerCase());
                        unique.push(val);
                      }
                    });
                    return unique;
                  })()}
                />
              </>
            )}
            {newColType === 'formula' && (
              <FormulaBuilder 
                formula={newColFormula} 
                onChange={setNewColFormula} 
                columns={columns} 
                outputName={newColName}
                excludeId={activeModalColId}
              />
            )}
            <div className="modal-actions">
              <button className="modal-cancel-btn" onClick={() => setInsertColModal(null)}>Cancel</button>
              <button className="modal-confirm-btn" disabled={!newColName.trim()} onClick={() => {
                // Pre-calculate position HERE (click-time snapshot) before modal state is cleared
                const targetCol = columns.find(c => c.id === activeModalColId);
                const pos = targetCol
                  ? (insertColModal === 'left' ? targetCol.position : targetCol.position + 1)
                  : columns.length;
                insertColumnMutation.mutate({
                  pos,
                  name: newColName,
                  type: newColType,
                  dropdownOpts: newColDropdownOpts,
                  formula: newColFormula,
                });
              }}>Insert Column</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Column ── */}
      {linkColumnModal && (
        <LinkColumnModal
          onClose={() => setLinkColumnModal(false)}
          allRegisters={allRegisters || []}
          currentRegisterId={currentRegisterId}
          sourceColumn={columns.find(c => c.id === activeModalColId)}
        />
      )}
    </>
  );
}

/** Self-contained Link Column modal — fetches target register columns on selection */
function LinkColumnModal({ onClose, allRegisters, currentRegisterId, sourceColumn }: {
  onClose: () => void;
  allRegisters: RegisterSummary[];
  currentRegisterId?: number;
  sourceColumn?: any;
}) {
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('');
  const [selectedColumnId, setSelectedColumnId] = useState<string>('');
  const [targetColumns, setTargetColumns] = useState<ApiColumn[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const queryClient = useQueryClient();

  // Filter out the current register so you can't link to yourself
  const availableRegisters = allRegisters.filter(r => r.id !== currentRegisterId);

  const linkMutation = useMutation({
    mutationFn: () => linkColumn(
      currentRegisterId!,
      sourceColumn.id,
      Number(selectedRegisterId),
      Number(selectedColumnId)
    ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['register', currentRegisterId] });
      queryClient.invalidateQueries({ queryKey: ['register', Number(selectedRegisterId)] });
      onClose();
    }
  });

  // When register selection changes, fetch that register's columns
  const handleRegisterChange = async (regIdStr: string) => {
    setSelectedRegisterId(regIdStr);
    setSelectedColumnId('');
    setTargetColumns([]);

    if (!regIdStr) return;

    setLoadingColumns(true);
    try {
      const reg = await getRegister(Number(regIdStr));
      setTargetColumns(reg.columns || []);
    } catch (err) {
      console.error('Failed to load register columns:', err);
      setTargetColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">Link Column</h3>
        <p className="modal-p-text">
          Link <strong>{sourceColumn?.name || 'this column'}</strong> to a column in another register. Changes here will reflect there, and new entries will be synced.
        </p>

        <label className="modal-label">Select Register</label>
        <select
          className="modal-input"
          value={selectedRegisterId}
          onChange={(e) => handleRegisterChange(e.target.value)}
          style={{ marginBottom: '16px' }}
        >
          <option value="" disabled>Select a register...</option>
          {availableRegisters.map(reg => (
            <option key={reg.id} value={reg.id.toString()}>
              {reg.name} ({reg.entryCount} entries)
            </option>
          ))}
        </select>

        {selectedRegisterId && (
          <>
            <label className="modal-label">Select Column</label>
            {loadingColumns ? (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }}></span>
                Loading columns...
              </div>
            ) : targetColumns.length > 0 ? (
              <select
                className="modal-input"
                value={selectedColumnId}
                onChange={(e) => setSelectedColumnId(e.target.value)}
                style={{ marginBottom: '8px' }}
              >
                <option value="" disabled>Select a column...</option>
                {targetColumns.map(col => (
                  <option key={col.id} value={col.id.toString()}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ padding: '12px', fontSize: '13px', color: 'var(--muted)', background: 'var(--bg-light)', borderRadius: '8px', textAlign: 'center' }}>
                No columns found in this register.
              </div>
            )}
          </>
        )}

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="modal-cancel-btn" onClick={onClose}>Cancel</button>
          <button
            className="modal-confirm-btn"
            disabled={!selectedRegisterId || !selectedColumnId || linkMutation.isPending}
            onClick={() => linkMutation.mutate()}
          >
            {linkMutation.isPending ? 'Linking...' : 'Link Column'}
          </button>
        </div>
      </div>
    </div>
  );
}
