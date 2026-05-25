/**
 * useExport hook — Extracted from RegisterPage for code splitting.
 * 
 * All export libraries (xlsx, jsPDF, jspdf-autotable) are dynamically imported
 * so they're only downloaded when the user actually clicks Export.
 */
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { evaluateFormula, type Entry, type Column } from '../lib/api';
import { formatCurrency } from '../lib/formatters';
import type { ExportOptions } from '../components/register/modals/ExportModal';

type CalcType = 'sum' | 'average' | 'count' | 'min' | 'max' | 'filled' | 'empty' | 'distinct' | 'none';

interface UseExportParams {
  register: any;
  columns: Column[];
  displayEntries: Entry[];
  localEntries: Entry[];
  hiddenColumns: Set<number>;
  selectedRows: Set<number>;
  calcTypes: Record<number, CalcType>;
  colWidths: Record<number, number>;
  rowDownloadRange?: { start?: number; end?: number } | null;
  downloadableColumnIds?: Set<number> | null;
  selectedColumns?: Set<number>;
  isPreviewSelectedColumns?: boolean;
}

/** Shared helper: compute summary value for a column across entries */
function computeCalcValue(
  calcType: string,
  values: string[],
): string | number {
  let calcValue: string | number = 0;
  if (calcType === 'empty') {
    calcValue = values.filter(v => v.trim() === '').length;
  } else if (calcType === 'filled') {
    calcValue = values.filter(v => v.trim() !== '').length;
  } else if (calcType === 'count') {
    calcValue = values.filter(v => {
      const trimmed = v.trim();
      if (trimmed === '') return false;
      // Only skip values that are numbers with x/int suffix (e.g. "100x", "3000INT")
      if (/^\d[\d,.]*\s*(x|int)$/i.test(trimmed)) return false;
      // Count all other non-empty entries
      return true;
    }).length;
  } else if (calcType === 'distinct') {
    calcValue = new Set(values.filter(v => v.trim() !== '')).size;
  } else if (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max') {
    const nums: number[] = [];
    values.forEach(v => {
      if (v === 'true') { nums.push(1); return; }
      if (v === 'false') { nums.push(0); return; }
      const trimmed = v.trim();
      // Skip values with x/int suffix (e.g. "100x", "3000INT")
      if (/^\d[\d,.]*\s*(x|int)$/i.test(trimmed)) return;
      // Otherwise, strip non-numeric chars and try to parse
      const cleaned = trimmed.replace(/[^\d.-]/g, '');
      const n = parseFloat(cleaned);
      if (!isNaN(n)) {
        nums.push(n);
      }
    });

    if (calcType === 'sum') {
      calcValue = nums.reduce((a, b) => a + b, 0);
    } else if (calcType === 'average') {
      calcValue = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
    } else if (calcType === 'min') {
      calcValue = nums.length > 0 ? Math.min(...nums) : 0;
    } else if (calcType === 'max') {
      calcValue = nums.length > 0 ? Math.max(...nums) : 0;
    }
  }
  return calcValue;
}

const CALC_PREFIX: Record<string, string> = {
  sum: 'SUM: ', count: 'COUNT: ', distinct: 'DISTINCT: ',
  average: 'AVG: ', min: 'MIN: ', max: 'MAX: ',
};

export function useExport({
  register,
  columns,
  displayEntries,
  localEntries,
  hiddenColumns,
  selectedRows,
  calcTypes,
  colWidths,
  rowDownloadRange,
  downloadableColumnIds,
  selectedColumns,
  isPreviewSelectedColumns,
}: UseExportParams) {

  const handleExportExcel = useCallback(async (options: ExportOptions) => {
    if (!register) return;

    const visibleColumns = columns.filter((col) =>
      !hiddenColumns.has(col.id) &&
      options.selectedColumnIds.has(col.id) &&
      (!downloadableColumnIds || downloadableColumnIds.has(col.id))
    );
    const headerRow = ['S.No.', ...visibleColumns.map(c => c.name)];

    if (headerRow.length === 0) {
      toast.error('No columns selected for export.');
      return;
    }

    let entriesToExport = options.exportRows === 'selected'
      ? displayEntries.filter(e => selectedRows.has(e.id))
      : displayEntries;

    // Apply row download range restrictions
    if (rowDownloadRange && options.exportRows !== 'selected') {
      const start = (rowDownloadRange.start || 1) - 1;
      const end = rowDownloadRange.end || entriesToExport.length;
      entriesToExport = entriesToExport.slice(start, end);
    }

    if (entriesToExport.length === 0) {
      toast.error('No rows to export.');
      return;
    }

    // Dynamic import — only loads when user actually exports
    const XLSX = await import('xlsx');

    const dataAOA: any[][] = [];

    if (options.includeHeading) {
      dataAOA.push([register.name || 'Export']);
    }
    if (options.includeDateTime) {
      dataAOA.push([`Exported on ${new Date().toLocaleString()}`]);
    }
    if (options.includeHeading || options.includeDateTime) {
      dataAOA.push([]); // blank row
    }

    dataAOA.push(headerRow);

    entriesToExport.forEach((entry) => {
      const rowData: any[] = [entry.rowNumber.toString()];
      visibleColumns.forEach(c => {
        let val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');

        if (c.type === 'image' && val) {
          const urls = val.includes('|||') ? val.split('|||') : [val];
          const cleanUrls = urls.map(url => {
            if (url.startsWith('data:image/')) {
              return null;
            }
            return url.trim().replace(/\s+/g, '%20');
          }).filter(Boolean) as string[];

          if (cleanUrls.length === 0) {
            val = '[Local Photo (Base64)]';
          } else if (cleanUrls.length === 1) {
            const escapedUrl = cleanUrls[0].replace(/"/g, '""');
            val = { f: `HYPERLINK("${escapedUrl}", "View Photo")`, t: 's', v: 'View Photo' };
          } else {
            const escapedUrl = cleanUrls[0].replace(/"/g, '""');
            val = {
              f: `HYPERLINK("${escapedUrl}", "View Photo 1 (+${cleanUrls.length - 1} more)")`,
              t: 's',
              v: `View Photo 1 (+${cleanUrls.length - 1} more)`
            };
          }
        }

        if (c.type === 'number' || c.type === 'currency' || c.type === 'formula') {
          const original = val.toString();
          if (c.type === 'currency') {
            rowData.push(formatCurrency(original).replace('₹', ''));
          } else if (original.toLowerCase().includes('x')) {
            rowData.push(original);
          } else {
            const cleaned = original.replace(/[^\d.-]/g, '');
            const n = parseFloat(cleaned);
            rowData.push(isNaN(n) ? original : n);
          }
        } else if (c.type === 'date' && val) {
          const parts = val.split(/[-/]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[2]);
            const dt = new Date(y, m, d);
            if (!isNaN(dt.getTime())) {
              rowData.push({ v: dt, t: 'd', z: 'dd-mm-yyyy' });
            } else {
              rowData.push(val);
            }
          } else {
            rowData.push(val);
          }
        } else {
          rowData.push(val);
        }
      });
      dataAOA.push(rowData);
    });

    // ── Add Summation/Footer Row ──
    const footerRow: any[] = ['TOTALS'];
    let hasAnyCalc = false;
    visibleColumns.forEach(c => {
      const calcType = calcTypes[c.id] || 'none';
      if (calcType === 'none') { footerRow.push(''); return; }

      hasAnyCalc = true;
      const values = entriesToExport.map(entry => {
        if (c.type === 'formula') return evaluateFormula(c.formula || '', entry, columns);
        return entry.cells?.[c.id.toString()] || '';
      });

      const calcValue = computeCalcValue(calcType, values);
      const prefix = CALC_PREFIX[calcType] || '';
      let displayValue = calcValue;
      if (c.type === 'currency' && (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max')) {
        displayValue = formatCurrency(calcValue).replace('₹', '');
      }
      footerRow.push(`${prefix}${displayValue}`);
    });

    if (hasAnyCalc) {
      dataAOA.push(footerRow);
    }

    try {
      const ws = XLSX.utils.aoa_to_sheet(dataAOA);

      const getColLetter = (n: number) => {
        let s = '';
        while (n >= 0) {
          s = String.fromCharCode(n % 26 + 65) + s;
          n = Math.floor(n / 26) - 1;
        }
        return s;
      };

      ws['!dataValidation'] = [];

      visibleColumns.forEach((c, cIdx) => {
        const colLetter = getColLetter(cIdx + 1);

        if (c.type === 'dropdown' && c.dropdownOptions && c.dropdownOptions.length > 0) {
          const validationFormula = `"${c.dropdownOptions.join(',')}"`;
          if (validationFormula.length <= 255) {
            ws['!dataValidation'].push({
              sqref: `${colLetter}2:${colLetter}2000`,
              type: 'list',
              allowBlank: true,
              showDropDown: true,
              formula1: validationFormula
            });
          }
        }
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sheet1");

      // ── Add Hidden Metadata Sheet for round-trip preservation ──
      const metadataAOA: any[][] = [
        ['Column Name', 'Type', 'Dropdown Options', 'Formula', 'Width', 'Summary']
      ];
      visibleColumns.forEach(c => {
        metadataAOA.push([
          c.name,
          c.type,
          c.dropdownOptions ? c.dropdownOptions.join(',') : '',
          c.formula || '',
          colWidths[c.id] || '',
          calcTypes[c.id] || 'none'
        ]);
      });
      const metaWs = XLSX.utils.aoa_to_sheet(metadataAOA);
      XLSX.utils.book_append_sheet(wb, metaWs, "_metadata_");

      if (!wb.Workbook) wb.Workbook = {};
      if (!wb.Workbook.Sheets) wb.Workbook.Sheets = [];
      wb.Workbook.Sheets = [
        { name: "Sheet1", Hidden: 0 },
        { name: "_metadata_", Hidden: 1 }
      ];

      XLSX.writeFile(wb, `${register.name || 'Export'}.xlsx`);
    } catch (err) {
      console.error("Export Error: ", err);
      alert("Failed to export Excel file.");
    }
  }, [register, columns, displayEntries, hiddenColumns, selectedRows, calcTypes, colWidths, rowDownloadRange]);


  const handleExportPDF = useCallback(async (options: ExportOptions) => {
    if (!register) return;

    const visibleCols = columns.filter((col) =>
      !hiddenColumns.has(col.id) &&
      options.selectedColumnIds.has(col.id) &&
      (!downloadableColumnIds || downloadableColumnIds.has(col.id))
    );
    const headerRow = ['S.No.', ...visibleCols.map(c => c.name)];

    if (headerRow.length === 0) {
      toast.error('No columns selected for export.');
      return;
    }

    let entriesToExport = options.exportRows === 'selected'
      ? displayEntries.filter(e => selectedRows.has(e.id))
      : displayEntries;

    // Apply row download range restrictions
    if (rowDownloadRange && options.exportRows !== 'selected') {
      const start = (rowDownloadRange.start || 1) - 1;
      const end = rowDownloadRange.end || entriesToExport.length;
      entriesToExport = entriesToExport.slice(start, end);
    }

    if (entriesToExport.length === 0) {
      toast.error('No rows to export.');
      return;
    }

    // Dynamic import — only loads when user actually exports
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const bodyRows = entriesToExport.map((entry) => {
      return [
        entry.rowNumber.toString(),
        ...visibleCols.map(c => {
          const cellValue = c.type === 'formula'
            ? evaluateFormula(c.formula || '', entry, columns)
            : (entry.cells?.[c.id.toString()] || '');
          
          if (c.type === 'image') {
            if (!cellValue) return '';
            const urls = cellValue.includes('|||') ? cellValue.split('|||') : [cellValue];
            const cleanUrls = urls.filter(url => !url.startsWith('data:image/'));
            if (cleanUrls.length === 0) {
              return '[Local Photo]';
            }
            return cleanUrls.length === 1 ? 'View Photo' : `View Photo (+${cleanUrls.length - 1} more)`;
          }
          if (c.type === 'currency') return formatCurrency(cellValue).replace('₹', '');
          return cellValue;
        })
      ];
    });

    // ── Add Summation/Footer Row ──
    const footerRow: string[] = ['TOTALS'];
    let hasAnyCalc = false;
    visibleCols.forEach(c => {
      const calcType = calcTypes[c.id] || 'none';
      if (calcType === 'none') { footerRow.push(''); return; }

      hasAnyCalc = true;
      const values = entriesToExport.map(entry => {
        if (c.type === 'formula') return evaluateFormula(c.formula || '', entry, columns);
        return entry.cells?.[c.id.toString()] || '';
      });

      const calcValue = computeCalcValue(calcType, values);
      const prefix = CALC_PREFIX[calcType] || '';
      let displayValue = calcValue;
      if (c.type === 'currency' && (calcType === 'sum' || calcType === 'average' || calcType === 'min' || calcType === 'max')) {
        displayValue = formatCurrency(calcValue).replace('₹', '');
      }
      footerRow.push(`${prefix}${displayValue}`);
    });

    try {
      const doc = new jsPDF({ orientation: headerRow.length > 6 ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

      let currentY = 18;

      if (options.includeHeading) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(register.name || 'Export', 14, currentY);
        currentY += 6;
      }
      if (options.includeDateTime) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} at ${new Date().toLocaleTimeString()}`, 14, currentY);
        doc.setTextColor(0, 0, 0);
        currentY += 4;
      }
      if (options.includeHeading || options.includeDateTime) {
        currentY += 4;
      }

      const allBodyRows = hasAnyCalc ? [...bodyRows, footerRow] : bodyRows;

      autoTable(doc, {
        startY: currentY,
        head: [headerRow],
        body: allBodyRows,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 45, 93], // Navy Blue
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          cellPadding: 3,
        },
        bodyStyles: {
          fontSize: 8,
          cellPadding: 3,
          valign: 'middle',
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        styles: {
          lineColor: [200, 200, 200],
          lineWidth: 0.2,
          overflow: 'linebreak',
          minCellWidth: 10,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
        },
        margin: { left: 10, right: 10 },
        didDrawPage: (data: any) => {
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(150);
          doc.text(
            `Page ${data.pageNumber} of ${pageCount}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: 'center' }
          );
        },
      });

      doc.save(`${register.name || 'Export'}.pdf`);
    } catch (err) {
      console.error('PDF Export Error:', err);
      alert('Failed to export PDF file.');
    }
  }, [register, columns, displayEntries, hiddenColumns, selectedRows, calcTypes, rowDownloadRange]);


  const handleRowDownloadPDF = useCallback(async (entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => {
      if (hiddenColumns.has(col.id)) return false;
      if (downloadableColumnIds && !downloadableColumnIds.has(col.id)) return false;
      if (isPreviewSelectedColumns && selectedColumns && selectedColumns.size > 0 && !selectedColumns.has(col.id)) return false;
      return true;
    });
    const rowIdx = entry.rowNumber;

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(register.name || 'Record', 14, 18);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(`Row ${rowIdx} • Exported on ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 14, 24);
      doc.setTextColor(0, 0, 0);

      const bodyRows = [
        ['S.No.', rowIdx.toString()],
        ...visibleCols.map(c => {
          const val = c.type === 'formula'
            ? evaluateFormula(c.formula || '', entry, columns)
            : (entry.cells?.[c.id.toString()] || '');
          
          let displayVal = val;
          if (c.type === 'image') {
            if (!val) {
              displayVal = '';
            } else {
              const urls = val.includes('|||') ? val.split('|||') : [val];
              const cleanUrls = urls.filter(url => !url.startsWith('data:image/'));
              if (cleanUrls.length === 0) {
                displayVal = '[Local Photo]';
              } else {
                displayVal = cleanUrls.length === 1 ? 'View Photo' : `View Photo (+${cleanUrls.length - 1} more)`;
              }
            }
          } else if (c.type === 'currency') {
            displayVal = formatCurrency(val).replace('₹', '');
          }
          return [c.name, displayVal];
        })
      ];

      autoTable(doc, {
        startY: 30,
        head: [['Field', 'Value']],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [0, 45, 93], textColor: 255, fontStyle: 'bold', fontSize: 9, halign: 'left', valign: 'middle' },
        bodyStyles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { lineColor: [200, 200, 200], lineWidth: 0.2, overflow: 'linebreak' },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, fillColor: [245, 247, 250] }, 1: { cellWidth: 'auto' } },
        margin: { left: 14, right: 14 },
      });

      doc.save(`${register.name || 'Record'}_Row${rowIdx}.pdf`);
    } catch (err) {
      console.error('Row PDF Error:', err);
      alert('Failed to export row as PDF.');
    }
  }, [register, localEntries, columns, hiddenColumns, downloadableColumnIds, selectedColumns, isPreviewSelectedColumns]);


  const handleRowDownloadExcel = useCallback(async (entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => {
      if (hiddenColumns.has(col.id)) return false;
      if (downloadableColumnIds && !downloadableColumnIds.has(col.id)) return false;
      if (isPreviewSelectedColumns && selectedColumns && selectedColumns.size > 0 && !selectedColumns.has(col.id)) return false;
      return true;
    });
    const rowIdx = entry.rowNumber;

    const XLSX = await import('xlsx');

    try {
      const headerRow = ['S.No.', ...visibleCols.map(c => c.name)];
      const dataRow = [entry.rowNumber.toString(), ...visibleCols.map(c => {
        let val = c.type === 'formula'
          ? evaluateFormula(c.formula || '', entry, columns)
          : (entry.cells?.[c.id.toString()] || '');

        if (c.type === 'image' && val) {
          const urls = val.includes('|||') ? val.split('|||') : [val];
          const cleanUrls = urls.map(url => {
            if (url.startsWith('data:image/')) {
              return null;
            }
            return url.trim().replace(/\s+/g, '%20');
          }).filter(Boolean) as string[];

          if (cleanUrls.length === 0) {
            val = '[Local Photo (Base64)]';
          } else if (cleanUrls.length === 1) {
            const escapedUrl = cleanUrls[0].replace(/"/g, '""');
            val = { f: `HYPERLINK("${escapedUrl}", "View Photo")`, t: 's', v: 'View Photo' };
          } else {
            const escapedUrl = cleanUrls[0].replace(/"/g, '""');
            val = {
              f: `HYPERLINK("${escapedUrl}", "View Photo 1 (+${cleanUrls.length - 1} more)")`,
              t: 's',
              v: `View Photo 1 (+${cleanUrls.length - 1} more)`
            };
          }
        }

        if (c.type === 'number' || c.type === 'currency') {
          const original = val.toString();
          if (c.type === 'currency') {
            return formatCurrency(original).replace('₹', '');
          }
          if (original.toLowerCase().includes('x')) {
            return original;
          }
          const cleaned = original.replace(/[^\d.-]/g, '');
          const n = parseFloat(cleaned);
          return isNaN(n) ? original : n;
        } else if (c.type === 'date' && val) {
          const parts = val.split(/[-/]/);
          if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parseInt(parts[2]);
            const dt = new Date(y, m, d);
            if (!isNaN(dt.getTime())) {
              return { v: dt, t: 'd', z: 'dd-mm-yyyy' };
            }
          }
        }
        return val;
      })];

      const ws = XLSX.utils.aoa_to_sheet([headerRow, dataRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Row Data');
      XLSX.writeFile(wb, `${register.name || 'Record'}_Row${rowIdx}.xlsx`);
    } catch (err) {
      console.error('Row Excel Error:', err);
      alert('Failed to export row as Excel.');
    }
  }, [register, localEntries, columns, hiddenColumns, downloadableColumnIds, selectedColumns, isPreviewSelectedColumns]);


  const handleRowShareText = useCallback((entryId: number) => {
    if (!register) return;
    const entry = localEntries.find(e => e.id === entryId);
    if (!entry) return;
    const visibleCols = columns.filter(col => {
      if (hiddenColumns.has(col.id)) return false;
      if (downloadableColumnIds && !downloadableColumnIds.has(col.id)) return false;
      if (isPreviewSelectedColumns && selectedColumns && selectedColumns.size > 0 && !selectedColumns.has(col.id)) return false;
      return true;
    });

    const lines = visibleCols.map(c => {
      const val = c.type === 'formula'
        ? evaluateFormula(c.formula || '', entry, columns)
        : (entry.cells?.[c.id.toString()] || '—');
      
      const displayVal = c.type === 'currency' ? formatCurrency(val).replace('₹', '') : val;
      return `${c.name}: ${displayVal}`;
    });

    const text = `${register.name}\n${'─'.repeat(30)}\n${lines.join('\n')}`;

    navigator.clipboard.writeText(text).then(() => {
      alert('Row copied to clipboard!');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      alert('Row copied to clipboard!');
    });
  }, [register, localEntries, columns, hiddenColumns, downloadableColumnIds, selectedColumns, isPreviewSelectedColumns]);


  return {
    handleExportExcel,
    handleExportPDF,
    handleRowDownloadPDF,
    handleRowDownloadExcel,
    handleRowShareText,
  };
}
