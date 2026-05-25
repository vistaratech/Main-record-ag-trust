const XLSX = require('xlsx');
const ws = XLSX.utils.aoa_to_sheet([["Col A", "Col B", "Col C"], [1, 2, ""]]);
ws['C2'] = { t: 'n', f: "A2+B2" };
ws['!dataValidation'] = [
  { sqref: "C2:C1000", type: "list", allowBlank: true, formula1: '"Option1,Option2"' }
];
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
XLSX.writeFile(wb, "test.xlsx");
