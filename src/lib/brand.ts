export const BRAND_NAME = "Data 1 GH";

/**
 * Replaces any supplier name ("DataMart", "Data Mart", "datamartgh", ...) in
 * customer-facing text with our own brand so the storefront never exposes it.
 */
export function brandText<T extends string | null | undefined>(text: T): T {
  if (!text) return text;
  return text.replace(/data\s*mart(\s*gh)?/gi, BRAND_NAME) as T;
}
