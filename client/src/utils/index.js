/**
 * Format paise as Indian Rupee string: ₹1,23,456.78
 */
export function formatINR(paise = 0) {
  const amount = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format paise as compact: ₹1.2K, ₹2.5L */
export function formatINRCompact(paise = 0) {
  const amount = paise / 100;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000)   return `₹${(amount / 1000).toFixed(1)}K`;
  return formatINR(paise);
}

/** Convert rupees to paise integer */
export function rupeesToPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

/** Format date as "24 Oct 2026, 1:05 AM" in IST */
export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format date as "24 Oct 2026" */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today as YYYY-MM-DD in IST */
export function todayIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return ist.toISOString().split('T')[0];
}

/** Payment method display */
export function paymentLabel(method) {
  const map = { cash: 'Cash', upi: 'UPI', other: 'Other' };
  return map[method] || method;
}

/** Status badge variant */
export function statusVariant(status) {
  const map = {
    completed:          'badge-green',
    cancelled:          'badge-red',
    partially_refunded: 'badge-yellow',
    fully_refunded:     'badge-red',
    pending:            'badge-yellow',
    approved:           'badge-green',
    rejected:           'badge-red',
  };
  return map[status] || 'badge-gray';
}

/** Status display label */
export function statusLabel(status) {
  const map = {
    completed:          'Completed',
    cancelled:          'Cancelled',
    partially_refunded: 'Partial Refund',
    fully_refunded:     'Refunded',
    pending:            'Pending',
    approved:           'Approved',
    rejected:           'Rejected',
  };
  return map[status] || status;
}

/** Extract error message from Axios error */
export function getErrorMessage(err) {
  return err?.response?.data?.message || err?.message || 'An unexpected error occurred.';
}

/** Generate a random idempotency key */
export function generateIdempotencyKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export { downloadCSV, downloadRawCSV } from './csv';
