import { Search, Filter, Trash2, Hash, FileText, Eye, Columns } from 'lucide-react';
import { memo } from 'react';
import type { Column } from '../../lib/api';
import { FilterModal, type FilterRule } from './modals/FilterModal';

interface RegisterToolbarProps {
  search: string;
  setSearch: (s: string) => void;
  filters: FilterRule[];
  activeFilters: FilterRule[];
  setFilters: (f: FilterRule[]) => void;
  setActiveFilters: (f: FilterRule[]) => void;
  filterModal: boolean;
  setFilterModal: (v: boolean) => void;
  addEntryMutation: any;
  setNewColName: (v: string) => void;
  setNewColType: (v: string) => void;
  setNewColDropdownOpts: (v: string) => void;
  setNewColFormula: (v: string) => void;
  setNewColumnModal: (v: boolean) => void;
  hiddenColumns: Set<number>;
  selectedRows: Set<number>;
  rowCount: number;
  columns: Column[];
  bulkDeleteMutation: any;
  setRowCountMutation?: any;
  setManageColsMenu: (v: { rect: DOMRect } | null) => void;
  entries: any[];
  canEdit?: boolean;
  allColumnsCount?: number;
  selectedColumns: Set<number>;
  isPreviewSelectedColumns: boolean;
  setIsPreviewSelectedColumns: (v: boolean) => void;
}

export const RegisterToolbar = memo(function RegisterToolbar({
  search, setSearch, filters, activeFilters, setFilters, setActiveFilters, filterModal, setFilterModal,
  hiddenColumns,
  selectedRows, rowCount, columns, bulkDeleteMutation,
  setManageColsMenu,
  entries,
  canEdit = true,
  allColumnsCount,
  selectedColumns,
  isPreviewSelectedColumns,
  setIsPreviewSelectedColumns
}: RegisterToolbarProps) {

  return (
    <div className="pages-actions-right">
      {/* Stats */}
      <span className="pab-stat" title={rowCount < entries.length ? `Showing ${rowCount} of ${entries.length} total rows` : `${rowCount} rows total`}>
        <Hash size={11} />
        {rowCount < entries.length ? `${rowCount} / ${entries.length}` : rowCount} rows
      </span>
      <span className="pab-stat" title={columns.length < (allColumnsCount || columns.length) ? `Showing ${columns.length} of ${allColumnsCount} total columns` : `${columns.length} columns total`}>
        <FileText size={11} />
        {columns.length < (allColumnsCount || columns.length) ? `${columns.length} / ${allColumnsCount}` : columns.length} cols
      </span>

      <div className="pab-divider" />

      {/* Search */}
      <div className={`pab-search${search ? ' active' : ''}`} id="pab-search-wrap">
        <Search size={13} className="pab-search-icon" />
        <input
          id="pab-search-input"
          className="pab-search-input"
          placeholder="Search records..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setSearch(''); }}
        />
        {search && (
          <button className="pab-search-clear" onClick={() => setSearch('')} title="Clear search">×</button>
        )}
      </div>

      {/* Preview Selected Columns Toggle */}
      {selectedColumns.size > 0 && (
        <button
          className={`pab-icon-btn${isPreviewSelectedColumns ? ' active' : ''}`}
          title={isPreviewSelectedColumns ? "Show all columns" : `Show only ${selectedColumns.size} selected columns`}
          onClick={() => setIsPreviewSelectedColumns(!isPreviewSelectedColumns)}
          aria-label="Preview Selected Columns"
          style={{ marginRight: '8px' }}
        >
          <Columns size={14} />
          <span className="pab-badge" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
            {selectedColumns.size}
          </span>
        </button>
      )}

      {/* Filter */}
      <div className="pab-filter-wrapper">
        <button
          className={`pab-icon-btn${activeFilters.length > 0 ? ' active' : ''}`}
          title={`Filter${activeFilters.length > 0 ? ` (${activeFilters.length} active)` : ''}`}
          onClick={() => setFilterModal(!filterModal)}
          aria-label="Filter"
        >
          <Filter size={14} />
          {activeFilters.length > 0 && <span className="pab-badge">{activeFilters.length}</span>}
        </button>

        <FilterModal
          filterModal={filterModal}
          setFilterModal={setFilterModal}
          filters={filters}
          setFilters={setFilters}
          setActiveFilters={setActiveFilters}
          columns={columns}
          entries={entries}
        />
      </div>

      <div className="pab-divider" />

      {/* Manage Columns - Eye Icon */}
      <button 
        className={`pab-icon-btn${hiddenColumns.size > 0 ? ' active' : ''}`} 
        title={`Manage columns (${hiddenColumns.size} hidden)`}
        onClick={(e) => setManageColsMenu({ rect: e.currentTarget.getBoundingClientRect() })}
        aria-label="Manage columns"
      >
        <Eye size={13} />
        {hiddenColumns.size > 0 && <span className="pab-badge">{hiddenColumns.size}</span>}
      </button>

      {/* Bulk delete */}
      {canEdit && selectedRows.size > 0 && (
        <button className="pab-icon-btn danger" title={`Delete ${selectedRows.size} rows`}
          onClick={() => { if (confirm(`Delete ${selectedRows.size} rows?`)) bulkDeleteMutation.mutate(); }}>
          <Trash2 size={13} />
          <span className="pab-badge">{selectedRows.size}</span>
        </button>
      )}
    </div>
  );
});
