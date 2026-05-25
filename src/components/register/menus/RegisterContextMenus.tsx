import { Hash, Calendar, ChevronDown, FlaskConical, Type as TypeIcon, SortAsc, SortDesc, Pencil, ArrowLeftRight, Copy, ArrowRight, ChevronsLeftRight, Pin, Eye, EyeOff, Eraser, Trash2, FileText, FileSpreadsheet, Share2, ArrowLeft, Link as LinkIcon, Plus } from 'lucide-react';
import { type Column } from '../../../lib/api';
import { ColumnIcon } from '../ColumnIcon';

interface RegisterContextMenusProps {
  // Column Menu
  colMenuId: number | null;
  colMenuRect: DOMRect | null;
  setColMenuId: (id: number | null) => void;
  setActiveModalColId: (id: number | null) => void;
  columns: Column[];
  handleSort: (colId: number, direction: 'asc' | 'desc') => void;
  setRenameColValue: (v: string) => void;
  setRenameColModal: (v: boolean) => void;
  setChangeTypeValue: (v: string) => void;
  setChangeTypeModal: (v: boolean) => void;
  setDropdownConfigOptions: (v: string) => void;
  setDropdownConfigModal: (v: boolean) => void;
  setLinkColumnModal: (v: boolean) => void;
  duplicateColumnMutation: any;
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  setNewColDropdownOpts: (v: string) => void;
  setNewColFormula: (v: string) => void;
  setInsertColModal: (v: 'left' | 'right' | null) => void;
  moveColumnMutation: any;
  frozenColumns: Set<number>;
  setFrozenColumns: (v: Set<number>) => void;
  freezeColumn: (regId: number, colId: number, freeze: boolean) => void;
  registerId: number;
  hiddenColumns: Set<number>;
  setHiddenColumns: (v: Set<number>) => void;
  hideColumn: (regId: number, colId: number, hide: boolean) => void;
  clearColumnDataMutation: any;
  deleteColumnMutation: any;
  setColumnMandatoryMutation: any;
  setColumnUniqueMutation: any;


  // Row Menu
  rowMenuId: number | null;
  setRowMenuId: (id: number | null) => void;
  duplicateEntryMutation: any;
  deleteEntryMutation: any;
  insertEntryMutation: any;
  localEntries: any[];
  handleRowDownloadPDF: (entryId: number) => void;
  handleRowDownloadExcel: (entryId: number) => void;
  handleRowShareText: (entryId: number) => void;
  // Calc
  calcTypes: Record<number, string>;
  updateCalcType: (colId: number, type: string) => void;
  // Manage Columns Dropdown
  manageColsMenu: { rect: DOMRect } | null;
  setManageColsMenu: (v: { rect: DOMRect } | null) => void;
  canEdit?: boolean;
  selectedColumns?: Set<number>;
  isPreviewSelectedColumns?: boolean;
}

export function RegisterContextMenus(props: RegisterContextMenusProps) {
  const {
    colMenuId, colMenuRect, setColMenuId, setActiveModalColId, columns, handleSort,
    setRenameColValue, setRenameColModal, setChangeTypeValue, setChangeTypeModal,
    setDropdownConfigOptions, setDropdownConfigModal, setLinkColumnModal, duplicateColumnMutation,
    setNewColName, setNewColType, setNewColDropdownOpts, setNewColFormula, setInsertColModal,
    moveColumnMutation, frozenColumns, setFrozenColumns, freezeColumn, registerId,
    hiddenColumns, setHiddenColumns, hideColumn, clearColumnDataMutation, deleteColumnMutation,
    setColumnMandatoryMutation, setColumnUniqueMutation,
    rowMenuId, setRowMenuId, duplicateEntryMutation, deleteEntryMutation, insertEntryMutation, localEntries,
    handleRowDownloadPDF, handleRowDownloadExcel, handleRowShareText,
    calcTypes, updateCalcType,
    manageColsMenu, setManageColsMenu,
    canEdit = true,
    selectedColumns,
    isPreviewSelectedColumns
  } = props;

  const isPreviewActive = !!(isPreviewSelectedColumns && selectedColumns && selectedColumns.size > 0);
  const rowExportDesc = isPreviewActive ? 'Selected columns only' : 'All columns included';

  return (
    <>
      {/* ── Column Context Menu ── */}
      {colMenuId !== null && (
        <div className="context-popover-layer" onClick={() => setColMenuId(null)}>
          <div
            className="context-menu context-menu-wide context-menu-column"
            style={colMenuRect ? { top: colMenuRect.bottom + 4, left: colMenuRect.left } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-title">
              {(() => {
                const col = columns.find((c) => c.id === colMenuId);
                return (
                  <>
                    <ColumnIcon type={col?.type} size={14} /> {col?.name || 'Column'}
                    <span className="context-type-badge">{col?.type}</span>
                  </>
                );
              })()}
            </div>

            <div className="context-section-label">Sort</div>
            <button className="context-item" onClick={() => { handleSort(colMenuId!, 'asc'); setColMenuId(null); }}>
              <SortAsc size={16} /> Sort A → Z
            </button>
            <button className="context-item" onClick={() => { handleSort(colMenuId!, 'desc'); setColMenuId(null); }}>
              <SortDesc size={16} /> Sort Z → A
            </button>

            {canEdit && (
              <>
                <div className="context-divider" />
                <div className="context-section-label">Edit</div>
                <button className="context-item" onClick={() => {
                  setRenameColValue(columns.find((c) => c.id === colMenuId)?.name || '');
                  setActiveModalColId(colMenuId);
                  setRenameColModal(true); setColMenuId(null);
                }}>
                  <Pencil size={16} /> Rename Column
                </button>
                <button className="context-item" onClick={() => {
                  const col = columns.find((c) => c.id === colMenuId);
                  setChangeTypeValue(col?.type || 'text');
                  setNewColName(col?.name || '');
                  setNewColFormula(col?.formula || '');
                  setNewColDropdownOpts(col?.dropdownOptions?.join(', ') || '');
                  setActiveModalColId(colMenuId);
                  setChangeTypeModal(true); setColMenuId(null);
                }}>
                  <ArrowLeftRight size={16} /> Change Column Type
                </button>
                <button className="context-item" onClick={() => {
                  setActiveModalColId(colMenuId);
                  setLinkColumnModal(true);
                  setColMenuId(null);
                }}>
                  <LinkIcon size={16} /> Link
                </button>
                <button className="context-item" onClick={() => {
                  const col = columns.find((c) => c.id === colMenuId);
                  const isMandatory = !!(col as any)?.mandatory;
                  setColumnMandatoryMutation.mutate({ colId: colMenuId!, mandatory: !isMandatory });
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', color: 'var(--primary)' }}>＊</span> Mandatory Field
                    </span>
                    {!!(columns.find((c) => c.id === colMenuId) as any)?.mandatory && (
                      <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '10px', fontWeight: 700 }}>ON</span>
                    )}
                  </span>
                </button>
                <button className="context-item" onClick={() => {
                  const col = columns.find((c) => c.id === colMenuId);
                  const isUnique = !!(col as any)?.unique;
                  setColumnUniqueMutation.mutate({ colId: colMenuId!, unique: !isUnique });
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', color: 'var(--primary)' }}>★</span> Unique Field
                    </span>
                    {!!(columns.find((c) => c.id === colMenuId) as any)?.unique && (
                      <span style={{ background: 'var(--primary)', color: 'white', borderRadius: '10px', padding: '1px 8px', fontSize: '10px', fontWeight: 700 }}>ON</span>
                    )}
                  </span>
                </button>
                {columns.find((c) => c.id === colMenuId)?.type === 'dropdown' && (
                  <button className="context-item" onClick={() => {
                    const col = columns.find((c) => c.id === colMenuId);
                    setDropdownConfigOptions(col?.dropdownOptions?.join(', ') || '');
                    setActiveModalColId(colMenuId);
                    setDropdownConfigModal(true); setColMenuId(null);
                  }}>
                    <ChevronDown size={16} /> Edit Dropdown Options
                  </button>
                )}
              </>
            )}

            {canEdit && (
              <>
                <div className="context-divider" />
                <div className="context-section-label">Insert & Copy</div>
                <button className="context-item" onClick={() => duplicateColumnMutation.mutate(colMenuId)}>
                  <Copy size={16} /> Duplicate Column
                </button>
                <button className="context-item" onClick={() => {
                  setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
                  setActiveModalColId(colMenuId);
                  setInsertColModal('left'); setColMenuId(null);
                }}>
                  <ArrowLeft size={16} /> Insert Column Left
                </button>
                <button className="context-item" onClick={() => {
                  setNewColName(''); setNewColType('text'); setNewColDropdownOpts(''); setNewColFormula('');
                  setActiveModalColId(colMenuId);
                  setInsertColModal('right'); setColMenuId(null);
                }}>
                  <ArrowRight size={16} /> Insert Column Right
                </button>

                <div className="context-divider" />
                <div className="context-section-label">Arrange</div>
                <button className="context-item"
                  disabled={columns.findIndex((c) => c.id === colMenuId) === 0}
                  onClick={() => moveColumnMutation.mutate({ colId: colMenuId, dir: 'left' })}
                >
                  <ChevronsLeftRight size={16} /> Move Left
                </button>
                <button className="context-item"
                  disabled={columns.findIndex((c) => c.id === colMenuId) === columns.length - 1}
                  onClick={() => moveColumnMutation.mutate({ colId: colMenuId, dir: 'right' })}
                >
                  <ChevronsLeftRight size={16} /> Move Right
                </button>
              </>
            )}
            <button className="context-item" onClick={() => {
              const newFrozen = new Set(frozenColumns);
              const isFrozen = newFrozen.has(colMenuId);
              if (isFrozen) newFrozen.delete(colMenuId); else newFrozen.add(colMenuId);
              setFrozenColumns(newFrozen);
              freezeColumn(registerId, colMenuId, !isFrozen);
              setColMenuId(null);
            }}>
              <Pin size={16} /> {frozenColumns.has(colMenuId) ? 'Unfreeze Column' : 'Freeze / Pin Column'}
            </button>
            <button className="context-item" onClick={() => {
              const newHidden = new Set(hiddenColumns);
              newHidden.add(colMenuId);
              setHiddenColumns(newHidden);
              hideColumn(registerId, colMenuId, true);
              setColMenuId(null);
            }}>
              <EyeOff size={16} /> Hide Column
            </button>

            <div className="context-divider" />
            <div className="context-section-label">Footer Calculation</div>
            <div className="context-item-row" style={{ padding: '6px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {['sum', 'count', 'distinct', 'average', 'none'].map((type) => {
                const isActive = type === 'none' 
                  ? (!calcTypes[colMenuId!] || calcTypes[colMenuId!] === 'none')
                  : calcTypes[colMenuId!] === type;
                return (
                  <button 
                    key={type}
                    className={`context-item-mini ${isActive ? 'active' : ''}`} 
                    style={{ 
                      padding: '4px 10px', 
                      fontSize: '11px', 
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: isActive ? 'var(--primary-light)' : 'white',
                      color: isActive ? 'var(--primary)' : 'inherit',
                      borderColor: isActive ? 'var(--primary)' : 'var(--border)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.2s'
                    }}
                    onClick={() => {
                      updateCalcType(colMenuId!, type);
                      setColMenuId(null);
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>

            {canEdit && (
              <>
                <div className="context-divider" />
                <button className="context-item danger" onClick={() => { if (confirm('Clear all data?')) clearColumnDataMutation.mutate(colMenuId); }}>
                  <Eraser size={16} /> Clear Column Data
                </button>
                {columns.find((c) => c.id === colMenuId)?.type !== 'formula' ? (
                  <button className="context-item danger" onClick={() => { if (confirm('Delete column?')) deleteColumnMutation.mutate(colMenuId); }}>
                    <Trash2 size={16} /> Delete Column
                  </button>
                ) : (
                  <button 
                    className="context-item danger" 
                    disabled 
                    style={{ opacity: 0.5, cursor: 'not-allowed' }} 
                    title="Formula columns cannot be deleted"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 size={16} /> Delete Column
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Row Context Menu ── */}
      {rowMenuId !== null && (
        <div className="modal-overlay" onClick={() => setRowMenuId(null)}>
          <div className="context-menu" onClick={(e) => e.stopPropagation()}>
            <div className="context-title">Row Actions</div>

            <button className="context-item" onClick={() => { handleRowDownloadPDF(rowMenuId); setRowMenuId(null); }}>
              <FileText size={16} />
              <div className="context-item-info">
                <span>Download as PDF</span>
                <span className="context-item-desc">{rowExportDesc}</span>
              </div>
            </button>
            <button className="context-item" onClick={() => { handleRowDownloadExcel(rowMenuId); setRowMenuId(null); }}>
              <FileSpreadsheet size={16} />
              <div className="context-item-info">
                <span>Download as Excel</span>
                <span className="context-item-desc">{rowExportDesc}</span>
              </div>
            </button>
            <button className="context-item" onClick={() => { handleRowShareText(rowMenuId); setRowMenuId(null); }}>
              <Share2 size={16} />
              <div className="context-item-info">
                <span>Share as Text</span>
                <span className="context-item-desc">{rowExportDesc}</span>
              </div>
            </button>

            <div className="context-divider" />

            {canEdit && (
              <>
                <button className="context-item" onClick={() => duplicateEntryMutation.mutate(rowMenuId)}>
                  <Copy size={16} /> Duplicate Record
                </button>

                <button className="context-item" onClick={() => {
                  const idx = localEntries.findIndex(e => e.id === rowMenuId);
                  if (idx !== -1) {
                    insertEntryMutation.mutate({ atIndex: idx + 1 });
                  }
                }}>
                  <Plus size={16} />
                  <div className="context-item-info">
                    <span>Add Row Below</span>
                    <span className="context-item-desc">Insert empty row at #{(localEntries.findIndex(e => e.id === rowMenuId) + 2)}</span>
                  </div>
                </button>

                <div className="context-divider" />

                <button className="context-item danger" onClick={() => { if (confirm('Delete row?')) deleteEntryMutation.mutate(rowMenuId); }}>
                  <Trash2 size={16} /> Delete
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* ── Manage Columns Dropdown ── */}
      {manageColsMenu !== null && (
        <div className="context-popover-layer" style={{ zIndex: 10000 }} onClick={() => setManageColsMenu(null)}>
          <div
            className="context-menu"
            style={manageColsMenu ? { 
              position: 'fixed',
              top: manageColsMenu.rect.bottom + 6, 
              left: Math.max(10, Math.min(manageColsMenu.rect.left - 180, window.innerWidth - 230)),
              width: '220px',
              maxHeight: '380px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-lg)',
              border: '1px solid var(--border)',
              padding: '0',
              overflow: 'hidden',
              animation: 'dropdownIn 0.15s ease-out'
            } : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="context-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Manage Columns</span>
              <span className="context-type-badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                {columns.length - hiddenColumns.size} / {columns.length}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
              <button 
                className="context-item-mini"
                style={{ flex: 1, padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                onClick={() => {
                  const newHidden = new Set<number>();
                  setHiddenColumns(newHidden);
                  columns.forEach(c => hideColumn(registerId, c.id, false));
                }}
              >
                Show All
              </button>
              <button 
                className="context-item-mini"
                style={{ flex: 1, padding: '4px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer' }}
                onClick={() => {
                  const newHidden = new Set(columns.map(c => c.id));
                  setHiddenColumns(newHidden);
                  columns.forEach(c => hideColumn(registerId, c.id, true));
                }}
              >
                Hide All
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0', minHeight: '100px' }}>
              {(() => {
                const hiddenList = columns.filter(col => hiddenColumns.has(col.id));
                if (hiddenList.length === 0) {
                  return (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: '12px' }}>
                      <EyeOff size={24} style={{ opacity: 0.2, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 500 }}>All columns are visible</div>
                    </div>
                  );
                }
                return (
                  <>
                    <div style={{ padding: '4px 8px 8px' }}>
                      <button 
                        style={{ width: '100%', padding: '6px', fontSize: '11px', fontWeight: 600, background: 'var(--navy)', color: 'white', borderRadius: '4px', border: 'none' }}
                        onClick={() => {
                          setHiddenColumns(new Set());
                          // You might need a bulk unhide function here or loop
                          hiddenList.forEach(col => hideColumn(registerId, col.id, false));
                        }}
                      >
                        Show All Columns
                      </button>
                    </div>
                    {hiddenList.map(col => (
                      <div 
                        key={col.id} 
                        className="manage-cols-item"
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '10px', 
                          padding: '10px 12px', 
                          cursor: 'pointer',
                          borderRadius: '6px',
                          margin: '2px 4px',
                          transition: 'background 0.15s'
                        }}
                        onClick={() => {
                          const newHidden = new Set(hiddenColumns);
                          newHidden.delete(col.id);
                          setHiddenColumns(newHidden);
                          hideColumn(registerId, col.id, false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--muted)' }}>
                          <Eye size={12} />
                        </div>
                        <span style={{ fontSize: '13px', flex: 1, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--foreground)' }}>
                          {col.name}
                        </span>
                        <div className="unhide-badge" style={{ fontSize: '10px', color: 'var(--navy)', fontWeight: 700, padding: '2px 6px', background: 'rgba(30,45,120,0.06)', borderRadius: '4px' }}>
                          Unhide
                        </div>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
