/**
 * Pure suggestion helpers shared by the customer combobox in the device form
 * and the address-book filter bar. Kept framework-free so it can be unit-tested
 * without a DOM.
 */

/** Case-insensitive substring match; a blank query returns every option. */
export function filterCustomers(options: string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter((o) => o.toLowerCase().includes(needle))
}

/**
 * Whether to offer an explicit "create «query»" affordance: true when the user
 * typed something that isn't (case-insensitively) an existing customer.
 */
export function shouldOfferCreate(options: string[], query: string): boolean {
  const trimmed = query.trim()
  if (!trimmed) return false
  const needle = trimmed.toLowerCase()
  return !options.some((o) => o.toLowerCase() === needle)
}
