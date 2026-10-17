/** Single source of truth for receipt / footer business details. */

export const BUSINESS = {
  name: "Mittal's Shudh Shakahari Bhojanalaya",
  tagline: "Pure vegetarian · since 1998",
  addressLines: ["Shop No. 24, Main Market Road", "Model Town, Panipat", "Haryana 132103"],
  phone: "+91 98765 43210",
  gstin: null as string | null, // not registered — no tax is charged anywhere
  hours: "10:00 AM – 10:30 PM (daily)",
  avgForTwo: "₹500 for two (approx.)",
  note: "No GST / service tax is applicable. No extra charges.",
} as const;
