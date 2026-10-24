/**
 * Monetary helpers — all storage is in integer paise.
 * 100 paise = ₹1
 */

/** Convert rupees (number/string) to paise integer */
const rupeesToPaise = (rupees) => Math.round(Number(rupees) * 100);

/** Convert paise integer to rupees (2 decimal places) */
const paiseToRupees = (paise) => (paise / 100).toFixed(2);

/** Format paise for display as ₹ string */
const formatINR = (paise) => {
  const amount = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
};

/** Safely add two paise amounts (both must be integers) */
const addPaise = (a, b) => Math.round(a + b);

/** Compute discount in paise from a percentage */
const applyDiscountPercent = (totalPaise, discountPercent) =>
  Math.round((totalPaise * discountPercent) / 100);

module.exports = {
  rupeesToPaise,
  paiseToRupees,
  formatINR,
  addPaise,
  applyDiscountPercent,
};
