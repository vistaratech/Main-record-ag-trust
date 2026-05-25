import { useState, useEffect } from 'react';
import { X, FileSpreadsheet, FileText, FileDown, Type, List, CheckSquare, Square, Columns } from 'lucide-react';

export type ExportFormat = 'excel' | 'pdf';

export interface ExportOptions {
  format: ExportFormat;
  includeHeading: boolean;
  includeDateTime: boolean;
  selectedColumnIds: Set<number>;
  exportRows: 'all' | 'selected';
}

interface ExportModalProps {
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  columns: any[];
  hiddenColumns: Set<number>;
  selectedRowCount: number;
  totalRowCount: number;
}

export function ExportModal({ onClose, onExport, columns, hiddenColumns, selectedRowCount, totalRowCount }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [includeHeading, setIncludeHeading] = useState(true);
  const [includeDateTime, setIncludeDateTime] = useState(true);
  const [exportRows, setExportRows] = useState<'all' | 'selected'>(selectedRowCount > 0 ? 'selected' : 'all');
  
  // Initialize with visible columns only
  const [selectedColIds, setSelectedColIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const visibleColIds = new Set<number>();
    columns.forEach(c => {
      if (!hiddenColumns.has(c.id)) {
        visibleColIds.add(c.id);
      }
    });
    setSelectedColIds(visibleColIds);
  }, [columns, hiddenColumns]);

  const toggleColumn = (colId: number) => {
    const next = new Set(selectedColIds);
    if (next.has(colId)) next.delete(colId);
    else next.add(colId);
    setSelectedColIds(next);
  };

  const handleSelectAll = () => {
    const allColIds = new Set<number>();
    columns.forEach(c => {
      allColIds.add(c.id);
    });
    setSelectedColIds(allColIds);
  };

  const handleDeselectAll = () => {
    setSelectedColIds(new Set());
  };

  const handleExportClick = () => {
    onExport({
      format,
      includeHeading,
      includeDateTime,
      selectedColumnIds: selectedColIds,
      exportRows,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '520px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', borderRadius: '16px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', overflow: 'hidden', position: 'relative', background: '#fff' }}>
        <div className="modal-header" style={{ padding: '24px 24px 16px', borderBottom: 'none', flexShrink: 0, position: 'relative' }}>
          <div style={{ paddingRight: '40px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Export Data</h2>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>Configure how your register data should be downloaded.</p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              position: 'absolute', top: '24px', right: '24px', 
              background: '#f3f4f6', borderRadius: '50%', width: '36px', height: '36px',
              cursor: 'pointer', transition: 'all 0.2s', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 10
            }}
            onMouseOver={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseOut={(e) => e.currentTarget.style.background = '#f3f4f6'}
          >
            <X size={20} color="#374151" strokeWidth={2.5} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '0 24px 24px', overflowY: 'auto', flex: 1 }}>
          
          {/* Format Selection */}
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <FileDown size={14} /> Export Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div 
                onClick={() => setFormat('pdf')}
                style={{
                  padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px solid ${format === 'pdf' ? 'var(--primary)' : 'var(--border)'}`,
                  background: format === 'pdf' ? 'rgba(0, 45, 93, 0.05)' : '#fff',
                }}
              >
                <div style={{ color: format === 'pdf' ? 'var(--primary)' : 'var(--muted)' }}>
                  <FileText size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: format === 'pdf' ? 'var(--primary)' : 'var(--text-color)', fontSize: '14px' }}>PDF Document</div>
                </div>
              </div>
              
              <div 
                onClick={() => setFormat('excel')}
                style={{
                  padding: '14px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  border: `2px solid ${format === 'excel' ? 'var(--primary)' : 'var(--border)'}`,
                  background: format === 'excel' ? 'rgba(0, 45, 93, 0.05)' : '#fff',
                }}
              >
                <div style={{ color: format === 'excel' ? 'var(--primary)' : 'var(--muted)' }}>
                  <FileSpreadsheet size={22} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, color: format === 'excel' ? 'var(--primary)' : 'var(--text-color)', fontSize: '14px' }}>Excel Sheet</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Page Settings */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Type size={14} /> Document Settings
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div onClick={() => setIncludeHeading(!includeHeading)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: includeHeading ? 'rgba(0, 45, 93, 0.05)' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ color: includeHeading ? 'var(--primary)' : 'var(--muted)' }}>
                    {includeHeading ? <CheckSquare size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={2} />}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: includeHeading ? 600 : 500, color: includeHeading ? 'var(--primary-dark, #1e1b4b)' : 'var(--text-color)' }}>Include Heading</div>
                </div>

                <div onClick={() => setIncludeDateTime(!includeDateTime)} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: includeDateTime ? 'rgba(0, 45, 93, 0.05)' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ color: includeDateTime ? 'var(--primary)' : 'var(--muted)' }}>
                    {includeDateTime ? <CheckSquare size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={2} />}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: includeDateTime ? 600 : 500, color: includeDateTime ? 'var(--primary-dark, #1e1b4b)' : 'var(--text-color)' }}>Include Date & Time</div>
                </div>
              </div>
            </div>

            {/* Row Selection */}
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <List size={14} /> Rows to Export
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div onClick={() => setExportRows('all')} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: exportRows === 'all' ? 'rgba(0, 45, 93, 0.05)' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${exportRows === 'all' ? 'var(--primary)' : 'var(--muted)'}`, padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {exportRows === 'all' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: exportRows === 'all' ? 600 : 500, color: exportRows === 'all' ? 'var(--primary-dark, #1e1b4b)' : 'var(--text-color)' }}>All Rows <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>({totalRowCount})</span></div>
                </div>

                <div onClick={() => { if (selectedRowCount > 0) setExportRows('selected'); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: selectedRowCount === 0 ? 'not-allowed' : 'pointer', opacity: selectedRowCount === 0 ? 0.5 : 1, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '8px', background: exportRows === 'selected' ? 'rgba(0, 45, 93, 0.05)' : '#fff', transition: 'all 0.2s' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${exportRows === 'selected' ? 'var(--primary)' : 'var(--muted)'}`, padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {exportRows === 'selected' && <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)' }} />}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: exportRows === 'selected' ? 600 : 500, color: exportRows === 'selected' ? 'var(--primary-dark, #1e1b4b)' : 'var(--text-color)' }}>Selected Rows <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 400 }}>({selectedRowCount})</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Column Selection */}
          <div className="form-group" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '220px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <Columns size={14} /> Columns to Export
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={handleSelectAll} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>Select All</button>
                <span style={{ color: 'var(--border)' }}>|</span>
                <button onClick={handleDeselectAll} style={{ fontSize: '12px', fontWeight: 600, color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '4px' }}>None</button>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--primary)', background: 'rgba(0, 45, 93, 0.1)', padding: '2px 8px', borderRadius: '12px', marginLeft: '4px' }}>
                  {selectedColIds.size} / {columns.length}
                </span>
              </div>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflowY: 'auto', flex: 1, background: '#fff', padding: '4px 0' }}>
              {columns.map(col => {
                const isHidden = hiddenColumns.has(col.id);
                const isSelected = selectedColIds.has(col.id);
                return (
                  <div 
                    key={col.id} 
                    onClick={() => toggleColumn(col.id)}
                    style={{ 
                      display: 'flex', alignItems: 'center', padding: '12px 16px', 
                      borderBottom: '1px solid var(--border)', cursor: 'pointer', gap: '14px', 
                      background: isSelected ? 'rgba(0, 45, 93, 0.05)' : '#fff', 
                      transition: 'all 0.2s ease',
                      borderLeft: isSelected ? '4px solid var(--primary)' : '4px solid transparent'
                    }}
                    onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = '#f9fafb' }}
                    onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = '#fff' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? 'var(--primary)' : 'var(--muted)' }}>
                      {isSelected ? <CheckSquare size={22} strokeWidth={2.5} /> : <Square size={22} strokeWidth={2} />}
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '14px', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--primary-dark, #1e1b4b)' : 'var(--text-color)' }}>{col.name}</span>
                      {isHidden && <span style={{ fontSize: '11px', color: 'var(--muted)', background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px' }}>Hidden in View</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fafafa', flexShrink: 0 }}>
          <button className="modal-cancel-btn" onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 600 }}>Cancel</button>
          <button className="modal-confirm-btn" onClick={handleExportClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', borderRadius: '8px', fontWeight: 600, boxShadow: '0 4px 12px rgba(0, 45, 93, 0.2)' }}>
            <FileDown size={18} /> Download {format === 'pdf' ? 'PDF' : 'Excel'}
          </button>
        </div>
      </div>
    </div>
  );
}
