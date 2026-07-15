import { supabase } from './supabase'

/**
 * Write an audit entry for an invoice.
 * Failures are logged but never thrown — the invoice save/update/cancel
 * itself has already succeeded by the time this is called, so logging
 * is best-effort and must not surface an error to the user.
 */
export async function logInvoiceActivity({ invoiceId, action, details, actor }) {
  try {
    const payload = {
      invoice_id: invoiceId,
      action,
      details: details || null,
      actor_id: actor?.id || null,
      actor_name: actor?.full_name || actor?.email || null
    }
    const { error } = await supabase.from('invoice_activity_logs').insert(payload)
    if (error) console.warn('[activity] failed to log', action, error.message)
  } catch (e) {
    console.warn('[activity] unexpected failure', e)
  }
}

/**
 * Compute a compact diff between the original DB items and the new
 * lineItems the user is saving. All names come from the SKU catalogue
 * (or the DB items' embedded sku join) so the diff is self-contained
 * and doesn't require a join at display time.
 */
export function buildEditDiff({ originalDbItems, newLineItems, skus }) {
  const skuNameById = new Map()
  for (const s of skus) skuNameById.set(s.id, s.sku_name)
  for (const it of originalDbItems || []) {
    if (it.sku_id && it.sku?.sku_name) skuNameById.set(it.sku_id, it.sku.sku_name)
  }

  const prevBySku = new Map()
  for (const it of originalDbItems || []) {
    if (!it.sku_id) continue
    prevBySku.set(it.sku_id, (prevBySku.get(it.sku_id) || 0) + (Number(it.quantity) || 0))
  }

  const nextBySku = new Map()
  for (const it of newLineItems || []) {
    if (!it.included || !it.sku_id) continue
    nextBySku.set(it.sku_id, (nextBySku.get(it.sku_id) || 0) + (Number(it.qty) || 0))
  }

  const items_added = []
  const items_removed = []
  const items_qty_changed = []

  for (const [skuId, nextQty] of nextBySku.entries()) {
    const prevQty = prevBySku.get(skuId)
    const name = skuNameById.get(skuId) || 'Unknown SKU'
    if (prevQty === undefined) {
      items_added.push({ sku_name: name, qty: nextQty })
    } else if (prevQty !== nextQty) {
      items_qty_changed.push({ sku_name: name, prev_qty: prevQty, next_qty: nextQty })
    }
  }

  for (const [skuId, prevQty] of prevBySku.entries()) {
    if (!nextBySku.has(skuId)) {
      const name = skuNameById.get(skuId) || 'Unknown SKU'
      items_removed.push({ sku_name: name, qty: prevQty })
    }
  }

  return { items_added, items_removed, items_qty_changed }
}
