/**
 * xlsxWorker.js — Web Worker for parsing Excel/CSV files off the main thread.
 * 
 * The main thread posts:
 *   { type: 'PARSE', payload: { buffer: ArrayBuffer, fileName: string } }
 *
 * The worker posts back:
 *   { type: 'RESULT', payload: { headers: string[], rows: Record<string,string>[], fileName: string } }
 *   { type: 'ERROR',  payload: { message: string } }
 *   { type: 'PROGRESS', payload: { pct: number, message: string } }
 */

// We load SheetJS via importScripts from a CDN.
// This keeps the worker self-contained and avoids bundler complexity.
importScripts('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');

self.onmessage = function (evt) {
  const { type, payload } = evt.data;
  if (type !== 'PARSE') return;

  try {
    const { buffer, fileName } = payload;

    self.postMessage({ type: 'PROGRESS', payload: { pct: 10, message: 'Reading file…' } });

    const wb = XLSX.read(buffer, { type: 'array', cellDates: true, dense: false });

    self.postMessage({ type: 'PROGRESS', payload: { pct: 40, message: 'Parsing sheet…' } });

    const wsName = wb.SheetNames[0];
    const ws = wb.Sheets[wsName];

    // ── Check for Metadata Sheet ──
    let metadata = null;
    const metaSheetName = wb.SheetNames.find(n => n.toLowerCase() === '_metadata_');
    if (metaSheetName) {
      const metaWs = wb.Sheets[metaSheetName];
      metadata = XLSX.utils.sheet_to_json(metaWs);
    }

    self.postMessage({ type: 'PROGRESS', payload: { pct: 60, message: 'Converting to JSON…' } });

    // ── Find Header Row ──
    // If metadata exists, we can find the row that matches those names to skip any decorative headings/blank rows.
    let headerRowIdx = 0;
    if (metadata && metadata.length > 0) {
      const metaNames = metadata.map(m => String(m['Column Name']).toLowerCase().trim());
      // Get the first 20 rows to scan for the header
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, range: 0, defval: '' });
      let maxMatches = -1;
      for (let i = 0; i < Math.min(aoa.length, 20); i++) {
        const row = aoa[i];
        if (!Array.isArray(row)) continue;
        const matches = row.filter(cell => cell && metaNames.includes(String(cell).toLowerCase().trim())).length;
        if (matches > maxMatches && matches > 0) {
          maxMatches = matches;
          headerRowIdx = i;
        }
      }
    }

    // ── Pre-process worksheet to extract original URLs from HYPERLINK formulas ──
    const refForPreprocess = ws['!ref'];
    if (refForPreprocess) {
      const range = XLSX.utils.decode_range(refForPreprocess);
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (cell && cell.f && typeof cell.f === 'string') {
            const trimmedFormula = cell.f.trim();
            if (/^HYPERLINK\(/i.test(trimmedFormula)) {
              const match = trimmedFormula.match(/^HYPERLINK\(\s*"([^"]+)"/i);
              if (match && match[1]) {
                let url = match[1];
                url = url.replace(/""/g, '"');
                if (url.includes('#urls=')) {
                  const hashPart = url.split('#urls=')[1];
                  try {
                    url = decodeURIComponent(hashPart);
                  } catch (e) {}
                }
                cell.v = url;
                cell.w = url;
              }
            }
          }
        }
      }
    }

    // sheet_to_json returns objects keyed by header name, starting from the detected header row
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, range: headerRowIdx });

    self.postMessage({ type: 'PROGRESS', payload: { pct: 85, message: `Loaded ${rows.length} rows…` } });

    // Extract header order from the sheet range so column order is preserved
    const ref = ws['!ref'];
    let headers = [];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: range.s.r, c: C });
        const cell = ws[cellAddr];
        headers.push(cell ? String(cell.v) : `Column ${C + 1}`);
      }
    } else if (rows.length > 0) {
      headers = Object.keys(rows[0]);
    }

    // ── Extract Native Data Validations (Dropdowns) ──
    try {
      const nativeValidations = ws['!dataValidation'];
      if (nativeValidations && nativeValidations.length > 0) {
        if (!metadata) metadata = [];
        
        nativeValidations.forEach(dv => {
          if (dv.type === 'list' && dv.formula1) {
            let options = [];
            // formula1 is often '"A,B,C"'
            if (dv.formula1.startsWith('"') && dv.formula1.endsWith('"')) {
              options = dv.formula1.slice(1, -1).split(',').map(s => s.trim());
            } else if (dv.formula1.includes(':') || /^[A-Z]+\d+$/.test(dv.formula1)) {
              // Range reference (e.g. $Z$1:$Z$10)
              try {
                const refRange = XLSX.utils.decode_range(dv.formula1.replace(/\$/g, ''));
                for (let r = refRange.s.r; r <= refRange.e.r; r++) {
                  for (let c = refRange.s.c; c <= refRange.e.c; c++) {
                    const cell = ws[XLSX.utils.encode_cell({ r, c })];
                    if (cell && cell.v !== undefined) {
                      const val = String(cell.v).trim();
                      if (val) options.push(val);
                    }
                  }
                }
              } catch (e) {
                console.warn('Failed to resolve range validation', dv.formula1);
              }
            }

            if (options.length > 0) {
              const sqrefs = dv.sqref.split(' ');
              sqrefs.forEach(ref => {
                try {
                  const r = XLSX.utils.decode_range(ref);
                  for (let C = r.s.c; C <= r.e.c; C++) {
                    const headerCellAddr = XLSX.utils.encode_cell({ r: headerRowIdx, c: C });
                    const headerCell = ws[headerCellAddr];
                    const headerName = headerCell ? String(headerCell.v) : `Column ${C + 1}`;

                    let existing = metadata.find(m => m['Column Name'] === headerName);
                    if (!existing) {
                      existing = { 'Column Name': headerName };
                      metadata.push(existing);
                    }
                    // Only set to dropdown if not already defined (e.g. by _metadata_ sheet)
                    if (!existing['Type']) {
                      existing['Type'] = 'dropdown';
                      existing['Dropdown Options'] = options.join(',');
                    }
                  }
                } catch (e) {}
              });
            }
          }
        });
      }
    } catch (err) {
      console.warn('Data validation extraction failed', err);
    }

    self.postMessage({ type: 'PROGRESS', payload: { pct: 100, message: 'Done!' } });

    self.postMessage({
      type: 'RESULT',
      payload: { headers, rows, fileName, metadata }
    });

  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      payload: { message: err instanceof Error ? err.message : String(err) }
    });
  }
};
