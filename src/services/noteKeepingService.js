import { supabase } from './supabase'

/**
 * Compute the next NK invoice number based on the company's note_keeping series.
 * Returns { invoiceNumber, nextSeries, company } — the caller is expected to
 * insert the invoice with `invoiceNumber` and then bump the master with
 * `nextSeries` on success.
 */
export async function nextNoteKeepingNumber() {
  const { data: company, error } = await supabase
    .from('companies')
    .select('id, note_keeping_prefix, note_keeping_number_series')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error) throw error

  const rawSeries = (company.note_keeping_number_series || '').trim()
  let baseSeries = rawSeries || '000'
  if (!rawSeries) {
    // Backfill from the highest existing NK invoice number if the seed is empty
    const { data: last } = await supabase
      .from('note_keeping_invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last?.invoice_number) {
      const m = last.invoice_number.match(/(\d+)$/)
      if (m) baseSeries = m[1]
    }
  }
  const currentNum = parseInt(baseSeries, 10) || 0
  const nextSeries = String(currentNum + 1).padStart(baseSeries.length, '0')
  const invoiceNumber = `${company.note_keeping_prefix || 'NK-'}${nextSeries}`
  return { invoiceNumber, nextSeries, company }
}

/**
 * Recompute the customer invoice series to match the current highest invoice
 * number for that prefix. Used after a customer invoice is converted to NK,
 * so the next new customer invoice re-uses the freed-up number.
 * If there are no customer invoices left with a numeric suffix, the series is
 * left as-is (we can't safely guess a seed).
 */
export async function recomputeCustomerInvoiceSeries() {
  const { data: company, error: compErr } = await supabase
    .from('companies')
    .select('id, invoice_prefix, invoice_number_series')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (compErr) throw compErr

  const { data: rows, error: listErr } = await supabase
    .from('customer_invoices')
    .select('invoice_number')
  if (listErr) throw listErr

  let maxNum = 0
  let width = (company.invoice_number_series || '000').length
  for (const r of rows || []) {
    const m = String(r.invoice_number || '').match(/(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (!Number.isNaN(n) && n > maxNum) {
        maxNum = n
        if (m[1].length > width) width = m[1].length
      }
    }
  }
  const newSeries = String(maxNum).padStart(width, '0')
  await supabase
    .from('companies')
    .update({ invoice_number_series: newSeries })
    .eq('id', company.id)
  return newSeries
}

/**
 * Best-effort activity log write for a note keeping invoice.
 */
export async function logNoteKeepingActivity({ invoiceId, action, details, actor }) {
  try {
    await supabase.from('note_keeping_activity_logs').insert({
      invoice_id: invoiceId,
      action,
      details: details || null,
      actor_id: actor?.id || null,
      actor_name: actor?.full_name || actor?.email || null
    })
  } catch (e) {
    console.warn('[nk-activity] failed to log', action, e)
  }
}
