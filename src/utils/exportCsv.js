/**
 * Export data array to CSV with UTF-8 BOM so Excel opens Arabic text correctly.
 * 
 * @param {Array<object>} data - rows of objects
 * @param {Array<{key: string, label: string}>} columns - column definitions
 * @param {string} filename - name of the downloaded file without extension
 */
export function exportToCsv(data, columns, filename = 'report') {
  if (!data || !data.length || !columns || !columns.length) {
    alert('لا توجد بيانات متاحة للتصدير حسب الفلاتر الحالية');
    return;
  }

  // Header row
  const header = columns.map((col) => `"${(col.label || '').replace(/"/g, '""')}"`).join(',');

  // Data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        let val = '';
        if (typeof col.formatter === 'function') {
          val = col.formatter(item[col.key], item);
        } else {
          val = item[col.key] !== undefined && item[col.key] !== null ? String(item[col.key]) : '';
        }
        // Escape quotes
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel properly recognizes Arabic characters
  const csvContent = '\uFEFF' + [header, ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const dateStr = new Date().toISOString().split('T')[0];
  link.setAttribute('download', `${filename}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
