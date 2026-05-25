// Format number with Indian currency style: ₹1,23,456.00
export function formatCurrency(val: string | number): string {
  const str = String(val).trim();
  if (!str) return '';

  // Extract leading number part (including sign, decimals, and thousands separators)
  // and trailing suffix (like "x", " units", etc.)
  const match = str.match(/^([+-]?[\d,]+(?:\.\d+)?)(.*)$/);
  
  if (!match) return str;

  const numStr = match[1].replace(/,/g, '');
  const suffix = match[2];
  const n = parseFloat(numStr);
  
  if (isNaN(n)) return str;
  
  const [intPart, decPart] = Math.abs(n).toFixed(2).split('.');
  
  // Indian grouping: last 3 digits, then every 2 digits
  let formatted = '';
  if (intPart.length <= 3) {
    formatted = intPart;
  } else {
    formatted = intPart.slice(-3);
    let remaining = intPart.slice(0, -3);
    while (remaining.length > 2) {
      formatted = remaining.slice(-2) + ',' + formatted;
      remaining = remaining.slice(0, -2);
    }
    if (remaining) formatted = remaining + ',' + formatted;
  }
  
  const decimalDisplay = decPart === '00' ? '' : `.${decPart}`;
  return `${n < 0 ? '-' : ''}₹${formatted}${decimalDisplay}${suffix}`;
}
