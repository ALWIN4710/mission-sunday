/**
 * CSV Export Utility for Mission Sunday Sales & Reports
 * Includes UTF-8 BOM so Excel opens INR currency and date formats correctly.
 */

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Downloads data as a CSV file.
 * @param {string} filename - e.g. "sales-history-2026-10-24.csv"
 * @param {Array<Object>} data - array of records
 * @param {Array<{ key: string, label: string, format?: (val, row) => string|number }>} columns
 */
export function downloadCSV(filename, data, columns) {
  const headerRow = columns.map((c) => escapeCSV(c.label)).join(',');
  const dataRows = (data || []).map((row) =>
    columns
      .map((c) => {
        const rawVal = row[c.key];
        const formatted = c.format ? c.format(rawVal, row) : rawVal;
        return escapeCSV(formatted);
      })
      .join(',')
  );

  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads arbitrary pre-formatted CSV string content.
 * @param {string} filename
 * @param {string} csvString
 */
export function downloadRawCSV(filename, csvString) {
  const content = '\uFEFF' + (csvString.startsWith('\uFEFF') ? csvString.slice(1) : csvString);
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
