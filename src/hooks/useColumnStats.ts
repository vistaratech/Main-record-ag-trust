/**
 * useColumnStats hook — Extracted from RegisterPage.
 *
 * Handles the single-pass column statistics calculation for
 * sum, average, count, min, max, filled, empty, distinct.
 */
import { useMemo } from 'react';
import { evaluateFormula, formatDateToDDMMYYYY, type Entry, type Column } from '../lib/api';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'filled' | 'empty' | 'distinct' | 'none';

interface UseColumnStatsParams {
  register: any;
  columns: Column[];
  visibleColumns: Column[];
  displayEntries: Entry[];
  selectedRows: Set<number>;
  calcTypes: Record<number, CalcType>;
}

export function useColumnStats({
  register,
  columns,
  visibleColumns,
  displayEntries,
  selectedRows,
  calcTypes,
}: UseColumnStatsParams): Record<number, string | number> {
  return useMemo(() => {
    if (!register || columns.length === 0) return {};

    const entriesToCalc = selectedRows.size > 0
      ? displayEntries.filter(e => selectedRows.has(e.id))
      : displayEntries;

    // Initialize stats accumulators for all columns
    const colStatsData: Record<number, { type: CalcType; sum: number; count: number; min: number; max: number; distinct: Set<string> }> = {};
    const visibleColIds = new Set(visibleColumns.map(c => c.id));

    columns.forEach(col => {
      if (!visibleColIds.has(col.id)) return;
      const calcType = calcTypes[col.id] || 'none';
      if (calcType === 'none') return;

      colStatsData[col.id] = {
        type: calcType,
        sum: 0,
        count: 0,
        min: Infinity,
        max: -Infinity,
        distinct: new Set<string>()
      };
    });

    const activeColIds = Object.keys(colStatsData).map(Number);
    if (activeColIds.length === 0) return {};

    // Map column IDs to objects for O(1) lookup
    const activeColsMap = new Map<number, any>();
    activeColIds.forEach(id => {
      const col = columns.find(c => c.id === id);
      if (col) activeColsMap.set(id, col);
    });

    // Single pass over entries to accumulate all stats
    const entryLen = entriesToCalc.length;
    for (let i = 0; i < entryLen; i++) {
      const e = entriesToCalc[i];
      for (let j = 0; j < activeColIds.length; j++) {
        const colId = activeColIds[j];
        const col = activeColsMap.get(colId);
        if (!col) continue;

        const s = colStatsData[colId];
        let val = '';
        if (col.type === 'formula') {
          val = evaluateFormula(col.formula || '', e, columns);
        } else {
          val = e.cells?.[colId.toString()] || '';
        }

        const trimmed = val.trim();

        if (s.type === 'empty') {
          if (trimmed === '') s.count++;
          continue;
        }
        if (s.type === 'filled') {
          if (trimmed !== '') s.count++;
          continue;
        }
        if (s.type === 'count') {
          if (trimmed !== '') {
            // Only skip values that are numbers with x/int suffix (e.g. "100x", "3000INT")
            if (/^\d[\d,.]*\s*(x|int)$/i.test(trimmed)) {
              continue;
            }
            // Count all other non-empty entries (text, numbers, anything)
            s.count++;
          }
          continue;
        }
        if (s.type === 'distinct') {
          if (trimmed !== '') s.distinct.add(trimmed);
          continue;
        }

        // Numeric calculations
        let n: number;
        if (val === 'true') n = 1;
        else if (val === 'false') n = 0;
        else if (col.type === 'date' && trimmed !== '') {
          const parts = trimmed.split(/[-/]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[2]);
            const dt = new Date(y, m, d);
            n = isNaN(dt.getTime()) ? 0 : dt.getTime();
          } else {
            n = 0;
          }
        } else {
          // Skip values with x/int suffix (e.g. "100x", "3000INT")
          if (/^\d[\d,.]*\s*(x|int)$/i.test(trimmed)) {
            continue;
          }
          // Strip non-numeric chars and try to parse
          const cleaned = val.replace(/[^\d.-]/g, '');
          const parsed = parseFloat(cleaned);
          if (isNaN(parsed)) {
            continue;
          }
          n = parsed;
        }

        s.sum += n;
        s.count++;
        if (trimmed !== '') {
          if (n < s.min) s.min = n;
          if (n > s.max) s.max = n;
        }
      }
    }

    // Finalize stats values
    const finalStats: Record<number, string | number> = {};
    activeColIds.forEach(colId => {
      const s = colStatsData[colId];
      const col = activeColsMap.get(colId);

      if (s.type === 'empty' || s.type === 'filled' || s.type === 'count') {
        finalStats[colId] = s.count;
      } else if (s.type === 'distinct') {
        finalStats[colId] = s.distinct.size;
      } else if (s.type === 'sum') {
        if (col?.type === 'date') {
          finalStats[colId] = '-';
        } else {
          finalStats[colId] = Number.isInteger(s.sum) ? s.sum : parseFloat(s.sum.toFixed(2));
        }
      } else if (s.type === 'average') {
        if (col?.type === 'date') {
          const avg = s.sum / (s.count || 1);
          finalStats[colId] = isNaN(avg) || avg === 0 ? '-' : formatDateToDDMMYYYY(new Date(avg));
        } else {
          const avg = s.count > 0 ? s.sum / s.count : 0;
          finalStats[colId] = Number.isInteger(avg) ? avg : parseFloat(avg.toFixed(2));
        }
      } else if (s.type === 'min') {
        const val = s.min === Infinity ? 0 : s.min;
        if (col?.type === 'date' && val > 0) {
          finalStats[colId] = formatDateToDDMMYYYY(new Date(val));
        } else {
          finalStats[colId] = val;
        }
      } else if (s.type === 'max') {
        const val = s.max === -Infinity ? 0 : s.max;
        if (col?.type === 'date' && val > 0) {
          finalStats[colId] = formatDateToDDMMYYYY(new Date(val));
        } else {
          finalStats[colId] = val;
        }
      }
    });

    return finalStats;
  }, [register, columns, visibleColumns, displayEntries, selectedRows, calcTypes]);
}
