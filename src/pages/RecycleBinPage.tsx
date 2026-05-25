import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listBusinesses, listDeletedRegisters, restoreRegister, permanentlyDeleteRegister,
  getAllDeletedItems, restoreDeletedItem, permanentlyDeleteItem,
  type RegisterSummary, type DeletedItem
} from '../lib/api';
import {
  Trash2, ArrowLeft, RefreshCw, XCircle, FileText, Rows3, Columns3, Copy, Eye,
  ChevronDown, ChevronUp, Search
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type TabType = 'registers' | 'items';
type FilterType = 'all' | 'row' | 'column';

export default function RecycleBinPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('registers');
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: businesses } = useQuery({ queryKey: ['businesses'], queryFn: listBusinesses });
  const businessId = businesses?.[0]?.id;

  // Registers tab
  const { data: deletedRegisters, isLoading: loadingRegisters } = useQuery({
    queryKey: ['deletedRegisters', businessId],
    queryFn: () => listDeletedRegisters(businessId!),
    enabled: !!businessId,
  });

  // Items tab (rows + columns)
  const { data: deletedItems, isLoading: loadingItems } = useQuery({
    queryKey: ['deletedItems', businessId],
    queryFn: () => getAllDeletedItems(businessId!),
    enabled: !!businessId && activeTab === 'items',
  });

  const filteredItems = useMemo(() => {
    if (!deletedItems) return [];
    let items = deletedItems;
    if (filterType !== 'all') items = items.filter(i => i.type === filterType);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(i => {
        if (i.registerName.toLowerCase().includes(q)) return true;
        if (i.type === 'column' && i.column?.name.toLowerCase().includes(q)) return true;
        if (i.type === 'row' && i.entry) {
          return Object.values(i.entry.cells || {}).some(v => v.toLowerCase().includes(q));
        }
        return false;
      });
    }
    return items;
  }, [deletedItems, filterType, searchTerm]);

  // Mutations
  const restoreRegMutation = useMutation({
    mutationFn: restoreRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] });
      queryClient.invalidateQueries({ queryKey: ['registers', businessId] });
    },
  });

  const deleteRegMutation = useMutation({
    mutationFn: permanentlyDeleteRegister,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedRegisters', businessId] });
    },
  });

  const restoreItemMutation = useMutation({
    mutationFn: ({ registerId, itemId }: { registerId: number; itemId: number }) =>
      restoreDeletedItem(registerId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedItems', businessId] });
      queryClient.invalidateQueries({ queryKey: ['register'] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: ({ registerId, itemId }: { registerId: number; itemId: number }) =>
      permanentlyDeleteItem(registerId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deletedItems', businessId] });
    },
  });

  const handleCopyData = (item: DeletedItem) => {
    let text = '';
    if (item.type === 'row' && item.entry) {
      text = Object.entries(item.entry.cells || {}).map(([, v]) => v).filter(Boolean).join('\t');
    } else if (item.type === 'column' && item.columnCellData) {
      text = Object.values(item.columnCellData).filter(Boolean).join('\n');
    }
    navigator.clipboard.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTimeSince = (dateStr: string) => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
  };

  const rowCount = deletedItems?.filter(i => i.type === 'row').length ?? 0;
  const colCount = deletedItems?.filter(i => i.type === 'column').length ?? 0;

  return (
    <div className="rbin-page">
      {/* Header */}
      <div className="rbin-header">
        <button className="rbin-back" onClick={() => navigate('/')}>
          <ArrowLeft size={18} />
        </button>
        <div className="rbin-header-text">
          <h1>Recycle Bin</h1>
          <p>Restore or permanently delete items</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rbin-tabs">
        <button
          className={`rbin-tab${activeTab === 'registers' ? ' active' : ''}`}
          onClick={() => setActiveTab('registers')}
        >
          <FileText size={14} />
          Registers
          {deletedRegisters && deletedRegisters.length > 0 && (
            <span className="rbin-badge">{deletedRegisters.length}</span>
          )}
        </button>
        <button
          className={`rbin-tab${activeTab === 'items' ? ' active' : ''}`}
          onClick={() => setActiveTab('items')}
        >
          <Trash2 size={14} />
          Rows & Columns
          {deletedItems && deletedItems.length > 0 && (
            <span className="rbin-badge">{deletedItems.length}</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="rbin-body">
        {activeTab === 'registers' && (
          <>
            {loadingRegisters ? (
              <div className="rbin-empty"><div className="rbin-spinner" /></div>
            ) : !deletedRegisters || deletedRegisters.length === 0 ? (
              <div className="rbin-empty">
                <Trash2 size={44} style={{ opacity: 0.15 }} />
                <p>No deleted registers</p>
              </div>
            ) : (
              <div className="rbin-grid">
                {deletedRegisters.map((reg: RegisterSummary) => (
                  <div key={reg.id} className="rbin-card">
                    <div className="rbin-card-icon" style={{ color: reg.iconColor || 'var(--navy)' }}>
                      <FileText size={22} />
                    </div>
                    <div className="rbin-card-info">
                      <h3>{reg.name}</h3>
                      <span className="rbin-meta">
                        {reg.entryCount} rows · Deleted {getTimeSince(reg.deletedAt!)}
                      </span>
                    </div>
                    <div className="rbin-card-actions">
                      <button className="rbin-btn restore" onClick={() => restoreRegMutation.mutate(reg.id)}>
                        <RefreshCw size={13} /> Restore
                      </button>
                      <button className="rbin-btn danger" onClick={() => {
                        if (confirm('Permanently delete this register? This cannot be undone.'))
                          deleteRegMutation.mutate(reg.id);
                      }}>
                        <XCircle size={13} /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'items' && (
          <>
            {/* Filters */}
            <div className="rbin-filters">
              <div className="rbin-filter-chips">
                <button className={`rbin-chip${filterType === 'all' ? ' active' : ''}`} onClick={() => setFilterType('all')}>
                  All ({(deletedItems?.length ?? 0)})
                </button>
                <button className={`rbin-chip${filterType === 'row' ? ' active' : ''}`} onClick={() => setFilterType('row')}>
                  <Rows3 size={12} /> Rows ({rowCount})
                </button>
                <button className={`rbin-chip${filterType === 'column' ? ' active' : ''}`} onClick={() => setFilterType('column')}>
                  <Columns3 size={12} /> Columns ({colCount})
                </button>
              </div>
              <div className="rbin-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Search deleted items..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loadingItems ? (
              <div className="rbin-empty"><div className="rbin-spinner" /></div>
            ) : filteredItems.length === 0 ? (
              <div className="rbin-empty">
                <Trash2 size={44} style={{ opacity: 0.15 }} />
                <p>{searchTerm ? 'No items match your search' : 'No deleted rows or columns'}</p>
              </div>
            ) : (
              <div className="rbin-items-list">
                {filteredItems.map((item) => {
                  const isExpanded = expandedItem === item.id;
                  const cellEntries = item.type === 'row' && item.entry
                    ? Object.entries(item.entry.cells || {}).filter(([, v]) => v)
                    : [];
                  const colDataEntries = item.type === 'column' && item.columnCellData
                    ? Object.entries(item.columnCellData).filter(([, v]) => v)
                    : [];

                  return (
                    <div key={item.id} className={`rbin-item${isExpanded ? ' expanded' : ''}`}>
                      <div className="rbin-item-main" onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                        <div className={`rbin-item-type ${item.type}`}>
                          {item.type === 'row' ? <Rows3 size={14} /> : <Columns3 size={14} />}
                        </div>
                        <div className="rbin-item-info">
                          <div className="rbin-item-title">
                            {item.type === 'row' ? (
                              <>Row #{item.entry?.rowNumber ?? '?'}</>
                            ) : (
                              <>Column: <strong>{item.column?.name ?? '?'}</strong> ({item.column?.type})</>
                            )}
                          </div>
                          <div className="rbin-item-sub">
                            from <strong>{item.registerName}</strong> · {getTimeSince(item.deletedAt)}
                          </div>
                        </div>
                        <div className="rbin-item-preview-count">
                          {item.type === 'row' && <span>{cellEntries.length} cells</span>}
                          {item.type === 'column' && <span>{colDataEntries.length} values</span>}
                        </div>
                        <div className="rbin-item-expand">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="rbin-item-detail">
                          {/* Data Preview */}
                          <div className="rbin-data-preview">
                            <div className="rbin-data-header">
                              <Eye size={12} /> Data Preview
                            </div>
                            {item.type === 'row' && cellEntries.length > 0 && (
                              <div className="rbin-data-grid">
                                {cellEntries.map(([colId, val]) => (
                                  <div key={colId} className="rbin-data-cell">
                                    <span className="rbin-data-key">Col #{colId}</span>
                                    <span className="rbin-data-val">{val}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {item.type === 'column' && colDataEntries.length > 0 && (
                              <div className="rbin-data-list">
                                {colDataEntries.slice(0, 10).map(([entryId, val]) => (
                                  <div key={entryId} className="rbin-data-row">
                                    <span className="rbin-data-val">{val}</span>
                                  </div>
                                ))}
                                {colDataEntries.length > 10 && (
                                  <div className="rbin-data-more">+{colDataEntries.length - 10} more values</div>
                                )}
                              </div>
                            )}
                            {cellEntries.length === 0 && colDataEntries.length === 0 && (
                              <div className="rbin-data-empty">No data</div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="rbin-item-actions">
                            <button className="rbin-btn copy" onClick={() => handleCopyData(item)}>
                              <Copy size={13} /> {copiedId === item.id ? 'Copied!' : 'Copy Data'}
                            </button>
                            <button className="rbin-btn restore" onClick={() =>
                              restoreItemMutation.mutate({ registerId: item.registerId, itemId: item.id })
                            }>
                              <RefreshCw size={13} /> Restore
                            </button>
                            <button className="rbin-btn danger" onClick={() => {
                              if (confirm('Permanently delete this item? This cannot be undone.'))
                                deleteItemMutation.mutate({ registerId: item.registerId, itemId: item.id });
                            }}>
                              <XCircle size={13} /> Delete Forever
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .rbin-page {
          flex: 1;
          background: #f8fafc;
          height: 100vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          font-family: 'Inter', -apple-system, sans-serif;
        }

        /* ── Header ── */
        .rbin-header {
          background: #fff;
          padding: 20px 28px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 16px;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .rbin-back {
          width: 36px; height: 36px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          background: #fff;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: #64748b;
          transition: all 0.15s;
        }
        .rbin-back:hover { background: #f1f5f9; color: #1e293b; border-color: #cbd5e1; }
        .rbin-header-text h1 { font-size: 18px; font-weight: 700; color: #1e293b; margin: 0; }
        .rbin-header-text p { font-size: 13px; color: #94a3b8; margin: 2px 0 0; }

        /* ── Tabs ── */
        .rbin-tabs {
          display: flex;
          gap: 0;
          background: #fff;
          border-bottom: 1px solid #e2e8f0;
          padding: 0 28px;
        }
        .rbin-tab {
          padding: 12px 20px;
          font-size: 13px;
          font-weight: 600;
          color: #64748b;
          background: none;
          border: none;
          border-bottom: 2px solid transparent;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.15s;
        }
        .rbin-tab:hover { color: #1e293b; }
        .rbin-tab.active {
          color: var(--navy, #1e2d78);
          border-bottom-color: var(--navy, #1e2d78);
        }
        .rbin-badge {
          background: #ef4444;
          color: #fff;
          font-size: 10px;
          font-weight: 700;
          padding: 1px 6px;
          border-radius: 10px;
          min-width: 18px;
          text-align: center;
        }

        /* ── Body ── */
        .rbin-body {
          padding: 24px 28px;
          flex: 1;
          max-width: 960px;
          margin: 0 auto;
          width: 100%;
        }

        /* ── Filters ── */
        .rbin-filters {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .rbin-filter-chips { display: flex; gap: 6px; }
        .rbin-chip {
          padding: 5px 12px;
          font-size: 12px;
          font-weight: 600;
          border-radius: 16px;
          border: 1px solid #e2e8f0;
          background: #fff;
          color: #64748b;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: all 0.15s;
        }
        .rbin-chip:hover { border-color: #cbd5e1; color: #1e293b; }
        .rbin-chip.active {
          background: var(--navy, #1e2d78);
          color: #fff;
          border-color: var(--navy, #1e2d78);
        }
        .rbin-search {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          margin-left: auto;
          min-width: 200px;
          color: #94a3b8;
        }
        .rbin-search input {
          border: none;
          outline: none;
          font-size: 12px;
          background: transparent;
          color: #1e293b;
          flex: 1;
          font-family: inherit;
        }

        /* ── Empty state ── */
        .rbin-empty {
          text-align: center;
          padding: 60px 0;
          color: #94a3b8;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .rbin-empty p { margin: 0; font-size: 14px; }
        .rbin-spinner {
          width: 28px; height: 28px;
          border: 3px solid #e2e8f0;
          border-top-color: var(--navy, #1e2d78);
          border-radius: 50%;
          animation: rbin-spin 0.6s linear infinite;
        }
        @keyframes rbin-spin { to { transform: rotate(360deg); } }

        /* ── Register Cards ── */
        .rbin-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 16px;
        }
        .rbin-card {
          background: #fff;
          border-radius: 10px;
          padding: 16px 18px;
          border: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: all 0.15s;
        }
        .rbin-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); border-color: #cbd5e1; }
        .rbin-card-icon {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .rbin-card-info { flex: 1; min-width: 0; }
        .rbin-card-info h3 {
          font-size: 14px; font-weight: 600; color: #1e293b;
          margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .rbin-meta { font-size: 11px; color: #94a3b8; }
        .rbin-card-actions { display: flex; gap: 6px; flex-shrink: 0; }

        /* ── Items List ── */
        .rbin-items-list { display: flex; flex-direction: column; gap: 8px; }
        .rbin-item {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.15s;
        }
        .rbin-item:hover { border-color: #cbd5e1; }
        .rbin-item.expanded { border-color: #93c5fd; box-shadow: 0 2px 12px rgba(37,99,235,0.06); }
        .rbin-item-main {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          cursor: pointer;
          user-select: none;
        }
        .rbin-item-main:hover { background: #fafbfc; }
        .rbin-item-type {
          width: 32px; height: 32px;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          font-size: 14px;
        }
        .rbin-item-type.row { background: #fef3c7; color: #d97706; }
        .rbin-item-type.column { background: #dbeafe; color: #2563eb; }
        .rbin-item-info { flex: 1; min-width: 0; }
        .rbin-item-title { font-size: 13px; font-weight: 600; color: #1e293b; }
        .rbin-item-sub { font-size: 11px; color: #94a3b8; margin-top: 1px; }
        .rbin-item-sub strong { color: #64748b; font-weight: 600; }
        .rbin-item-preview-count {
          font-size: 11px; color: #94a3b8;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .rbin-item-expand { color: #94a3b8; flex-shrink: 0; }

        /* ── Expanded Detail ── */
        .rbin-item-detail {
          border-top: 1px solid #f1f5f9;
          padding: 12px 16px;
          background: #fafbfc;
          animation: rbin-slideDown 0.2s ease;
        }
        @keyframes rbin-slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .rbin-data-preview {
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 14px;
          margin-bottom: 12px;
        }
        .rbin-data-header {
          font-size: 11px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: flex;
          align-items: center;
          gap: 4px;
          margin-bottom: 8px;
        }
        .rbin-data-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
          gap: 6px;
        }
        .rbin-data-cell {
          background: #f8fafc;
          border-radius: 6px;
          padding: 6px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rbin-data-key {
          font-size: 9px;
          font-weight: 700;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .rbin-data-val {
          font-size: 12px;
          color: #1e293b;
          word-break: break-word;
        }
        .rbin-data-list { display: flex; flex-direction: column; gap: 4px; }
        .rbin-data-row {
          padding: 4px 10px;
          background: #f8fafc;
          border-radius: 4px;
          font-size: 12px;
          color: #1e293b;
        }
        .rbin-data-more {
          font-size: 11px;
          color: #94a3b8;
          padding: 4px 0;
          text-align: center;
        }
        .rbin-data-empty {
          font-size: 12px;
          color: #cbd5e1;
          text-align: center;
          padding: 8px;
        }

        /* ── Actions ── */
        .rbin-item-actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .rbin-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.15s;
          font-family: inherit;
        }
        .rbin-btn.restore {
          background: #eff6ff;
          color: #2563eb;
        }
        .rbin-btn.restore:hover { background: #dbeafe; }
        .rbin-btn.danger {
          background: #fef2f2;
          color: #dc2626;
        }
        .rbin-btn.danger:hover { background: #fee2e2; }
        .rbin-btn.copy {
          background: #f0fdf4;
          color: #16a34a;
        }
        .rbin-btn.copy:hover { background: #dcfce7; }
      `}</style>
    </div>
  );
}
