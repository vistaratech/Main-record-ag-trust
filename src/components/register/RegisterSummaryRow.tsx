import React, { useMemo } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { type Column } from '../../lib/api';
import { formatCurrency } from '../../lib/formatters';

interface RegisterSummaryRowProps {
  visibleColumns: Column[];
  calcTypes: Record<number, string>;
  calcMenu: { colId: number; rect: DOMRect } | null;
  onCalcClick: (e: React.MouseEvent, colId: number) => void;
  onAddRecord: () => void;
  useColVirtual: boolean;
  virtualCols: any[];
  beforeVirtualCols?: { index: number }[];
  afterVirtualCols?: { index: number }[];
  paddingLeft: number;
  paddingRight: number;
  columnStats: Record<number, string | number>;
  frozenColumns: Set<number>;
  frozenLeftOffsets: Record<number, number>;
  colWidths: Record<number, number>;
  defaultColWidth: number;
  canEdit?: boolean;
}

export const RegisterSummaryRow: React.FC<RegisterSummaryRowProps> = ({
  visibleColumns,
  calcTypes,
  calcMenu,
  onCalcClick,
  onAddRecord,
  useColVirtual,
  virtualCols,
  beforeVirtualCols,
  afterVirtualCols,
  paddingLeft,
  paddingRight,
  columnStats,
  frozenColumns,
  frozenLeftOffsets,
  colWidths,
  defaultColWidth,
  canEdit = true
}) => {
  const hasAnyCalcValue = useMemo(() => {
    return Object.values(calcTypes).some(v => v && v !== 'none');
  }, [calcTypes]);

  const renderCells = () => {
    const elements: { type: 'cell' | 'pad-left' | 'pad-right', vc?: { index: number } }[] = [];
    if (useColVirtual && beforeVirtualCols && afterVirtualCols) {
      beforeVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
      if (paddingLeft > 0) elements.push({ type: 'pad-left' });
      virtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
      if (paddingRight > 0) elements.push({ type: 'pad-right' });
      afterVirtualCols.forEach(vc => elements.push({ type: 'cell', vc }));
    } else {
      visibleColumns.forEach((_, i) => elements.push({ type: 'cell', vc: { index: i } }));
    }

    return elements.map((el) => {
      if (el.type === 'pad-left') {
        return <td key="pad-left" className="spacer" style={{ width: paddingLeft, minWidth: paddingLeft, padding: 0, border: 'none', background: 'var(--table-bg)' }} />;
      }
      if (el.type === 'pad-right') {
        return <td key="pad-right" className="spacer" style={{ width: paddingRight, minWidth: paddingRight, padding: 0, border: 'none', background: 'var(--table-bg)' }} />;
      }

      const vc = el.vc!;
      const col = visibleColumns[vc.index];
      if (!col) return null;

      const calcType = calcTypes[col.id] || 'none';
      const hasCalc = calcType !== 'none';
      const calcValue = columnStats[col.id] ?? '-';
      
      const isFrozen = frozenColumns.has(col.id);
      const leftOffset = isFrozen ? (frozenLeftOffsets[col.id] || 0) : 0;
      const colW = colWidths[col.id] || defaultColWidth;

      const cellStyle: React.CSSProperties = isFrozen 
        ? { position: 'sticky', left: leftOffset, zIndex: 11, background: 'var(--table-bg)', width: colW, minWidth: colW, maxWidth: colW }
        : { width: colW, minWidth: colW, maxWidth: colW };

      return (
        <td
          key={col.id}
          className={`calc-cell-td${hasCalc ? ' calc-cell-has-value' : ''}${isFrozen ? ' frozen-col' : ''}`}
          style={cellStyle}
        >
          {hasCalc ? (
            <div className="calc-cell-content" onClick={(e) => onCalcClick(e, col.id)}>
              <span className="calc-dropdown-icon">
                <ChevronDown size={10} />
              </span>
              <span className="calc-label">
                {calcType === 'sum' && 'Σ '}
                {calcType === 'count' && 'N '}
                {calcType === 'distinct' && 'D '}
                {calcType === 'average' && 'μ '}
                {calcType.toUpperCase()}:
              </span>
              <span className="calc-value">
                {col.type === 'currency' && (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max')
                  ? formatCurrency(calcValue)
                  : calcValue}
              </span>
            </div>
          ) : (
            <div className="calc-cell-inner">
              {canEdit && (
                <button className="calc-add-btn" onClick={(e) => onCalcClick(e, col.id)} title="Add calculation">
                  <Plus size={12} />
                </button>
              )}
            </div>
          )}
        </td>
      );
    });
  };

  return (
    <tfoot>
      <tr className={`calc-row${hasAnyCalcValue ? ' calc-row-has-values' : ''}${calcMenu ? ' calc-row-expanded' : ''}`}>
        {/* Sticky S.No. Placeholder - Now with Add Record "+" button */}
        <td 
          className="sticky-col sticky-col-1 calc-cell-td" 
          style={{ 
            background: 'var(--table-bg)', 
            textAlign: 'center',
            position: 'sticky',
            left: 0,
            zIndex: 12,
            width: 64,
            minWidth: 64,
            maxWidth: 64
          }}
        >
          {canEdit && (
            <div className="calc-cell-inner">
              <button 
                className="calc-add-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  onAddRecord();
                }} 
                title="Add New Row"
                style={{
                  borderColor: 'var(--navy)',
                  background: 'rgba(30, 45, 120, 0.04)',
                  color: 'var(--navy)'
                }}
              >
                <Plus size={12} strokeWidth={3} />
              </button>
            </div>
          )}
        </td>

        {renderCells()}

        {/* Action Column Placeholder */}
        <td className="calc-cell-td actions" style={{ width: '50px', minWidth: '50px', background: 'var(--table-bg)', position: 'sticky', right: 0, zIndex: 13, borderLeft: '1px solid var(--border-v)' }} />
      </tr>
    </tfoot>
  );
};
