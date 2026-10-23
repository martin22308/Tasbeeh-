import { CURRENCY, ARABIC_MONTHS } from '../constants';

/**
 * Format a number into Egyptian currency string
 * e.g. 1500 -> "1,500 ج.م"
 */
export function formatCurrency(amount) {
  const num = Number(amount || 0);
  if (isNaN(num)) return `0 ${CURRENCY}`;
  return `${num.toLocaleString('ar-EG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} ${CURRENCY}`;
}

/**
 * Format number with standard commas (using English or Arabic numerals based on preference)
 */
export function formatNumber(amount) {
  const num = Number(amount || 0);
  if (isNaN(num)) return '0';
  return num.toLocaleString('ar-EG');
}

/**
 * Format a date string or timestamp to Arabic readable date
 */
export function formatDate(dateInput) {
  if (!dateInput) return '-';
  try {
    const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (err) {
    return String(dateInput);
  }
}

/**
 * Format date as YYYY-MM-DD for HTML inputs
 */
export function formatDateForInput(dateInput) {
  if (!dateInput) return '';
  try {
    const d = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
}

/**
 * Format time or timestamp to readable Arabic time
 */
export function formatTime(timeInput) {
  if (!timeInput) return '-';
  if (typeof timeInput === 'string' && timeInput.length <= 5 && timeInput.includes(':')) {
    return timeInput;
  }
  try {
    const d = timeInput.toDate ? timeInput.toDate() : new Date(timeInput);
    if (isNaN(d.getTime())) return String(timeInput);
    return d.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(timeInput);
  }
}

/**
 * Return Arabic month label from number (1-12)
 */
export function getMonthName(monthNumber) {
  const found = ARABIC_MONTHS.find((m) => m.value === Number(monthNumber));
  return found ? found.label : `شهر ${monthNumber}`;
}
