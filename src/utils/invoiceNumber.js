// Helpers for prefix + number-series invoice numbers (e.g. "INV-APX-KA-" + "045").

// Longest series we accept. Keeps numbers far below Number.MAX_SAFE_INTEGER
// so parseInt never silently rounds.
export const MAX_SERIES_DIGITS = 9

/**
 * Parse the series part of an invoice number that was issued with `prefix`.
 * Only the text AFTER the prefix counts, and it must be all digits — so a
 * prefix that itself ends in digits (e.g. "APX-26/02") can't leak into the
 * number. Returns { num, width } or null if the invoice doesn't belong to
 * this prefix or its number is unusable.
 */
export function parseSeriesNumber(invoiceNumber, prefix) {
  const s = String(invoiceNumber || '')
  if (!prefix || !s.toUpperCase().startsWith(prefix.toUpperCase())) return null
  const digits = s.slice(prefix.length)
  if (!/^\d+$/.test(digits) || digits.length > MAX_SERIES_DIGITS) return null
  return { num: parseInt(digits, 10), width: digits.length }
}

/**
 * Validate the master's series value. Returns { num, width } or throws a
 * message the user can act on.
 */
export function parseMasterSeries(rawSeries) {
  const s = (rawSeries || '').trim() || '000'
  if (!/^\d+$/.test(s) || s.length > MAX_SERIES_DIGITS) {
    throw new Error(`Invoice number series in Company Master is invalid ("${s}"). Set it to the last invoice number used, e.g. 045.`)
  }
  return { num: parseInt(s, 10), width: s.length }
}
