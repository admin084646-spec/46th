/** All money is stored in paise (integer). ₹1 = 100 paise. */

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return (paise || 0) / 100;
}

/** ₹1,234.50 */
export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((paise || 0) / 100);
}

/** 1,234.50 (no symbol) */
export function formatINRPlain(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format((paise || 0) / 100);
}
