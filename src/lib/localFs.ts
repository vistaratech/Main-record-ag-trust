import * as XLSX from 'xlsx';

// Polyfill for File System Access API types if needed
type FileSystemFileHandle = any;
type FileSystemDirectoryHandle = any;

export interface ExtractedExcelData {
  name: string;
  data: Record<string, string>[];
  metadata?: any[];
}

async function extractFilesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string = ''
): Promise<ExtractedExcelData[]> {
  let results: ExtractedExcelData[] = [];
  
  // @ts-ignore
  for await (const entry of dirHandle.values()) {
    if (entry.kind === 'file' && (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls') || entry.name.endsWith('.csv'))) {
      const fileHandle = entry as FileSystemFileHandle;
      const file = await fileHandle.getFile();
      
      const result = await new Promise<{ data: Record<string, string>[], metadata: any[] }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const buffer = evt.target?.result as ArrayBuffer;
            const wb = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: true });
            const ws = wb.Sheets[wb.SheetNames[0]];

            // Pre-process worksheet to extract original URLs from HYPERLINK formulas
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

            const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, string>[];
            
            let metadata: any[] = [];
            const metaSheetName = wb.SheetNames.find(n => n.toLowerCase() === '_metadata_');
            if (metaSheetName) metadata = XLSX.utils.sheet_to_json(wb.Sheets[metaSheetName]);

            // Native Data Validation extraction
            try {
              const nativeValidations = ws['!dataValidation'];
              if (nativeValidations && nativeValidations.length > 0) {
                nativeValidations.forEach((dv: any) => {
                  if (dv.type === 'list' && dv.formula1) {
                    let options: string[] = [];
                    if (dv.formula1.startsWith('"') && dv.formula1.endsWith('"')) {
                      options = dv.formula1.slice(1, -1).split(',').map((s: any) => s.trim());
                    } else if (dv.formula1.includes(':') || /^[A-Z]+\d+$/.test(dv.formula1)) {
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
                      } catch {}
                    }
                    if (options.length > 0) {
                      const sqrefs = dv.sqref.split(' ');
                      sqrefs.forEach((ref: any) => {
                        try {
                          const r = XLSX.utils.decode_range(ref);
                          for (let C = r.s.c; C <= r.e.c; C++) {
                            const headerCell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
                            const headerName = headerCell ? String(headerCell.v) : `Column ${C + 1}`;
                            let existing = metadata.find(m => m['Column Name'] === headerName);
                            if (!existing) { existing = { 'Column Name': headerName }; metadata.push(existing); }
                            if (!existing['Type']) { existing['Type'] = 'dropdown'; existing['Dropdown Options'] = options.join(','); }
                          }
                        } catch {}
                      });
                    }
                  }
                });
              }
            } catch {}

            resolve({ data: json, metadata });
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });
      
      const cleanName = entry.name.replace(/\.[^/.]+$/, '');
      const fullPathName = path ? `${path} - ${cleanName}` : cleanName;
      
      results.push({ name: fullPathName, data: result.data, metadata: result.metadata });
    } else if (entry.kind === 'directory') {
      const subPath = path ? `${path}/${entry.name}` : entry.name;
      const subResults = await extractFilesFromDirectory(entry, subPath);
      results = results.concat(subResults);
    }
  }
  
  return results;
}

export interface ExtractedFolder {
  folderName: string;
  files: ExtractedExcelData[];
}

export async function importLocalFolderToCloud(): Promise<ExtractedFolder | null> {
  try {
    // @ts-ignore
    const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
    const folderName = dirHandle.name;
    const extractedFiles = await extractFilesFromDirectory(dirHandle);
    return { folderName, files: extractedFiles };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return null;
    }
    console.error("Error reading folder:", error);
    alert("Failed to read folder contents. Please ensure browser permissions are granted.");
    return null;
  }
}
