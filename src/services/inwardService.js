/**
 * Inward Service - Business logic for vendor inward transactions
 */

import { supabase } from './supabase'

/**
 * Generate inward reference number: INW-YYYYMMDD-XXX
 */
export function generateInwardNumber() {
  const today = new Date()
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
  const randomSuffix = Math.random().toString(36).substr(2, 3).toUpperCase()
  return `INW-${dateStr}-${randomSuffix}`
}

/**
 * Save inward session for AI processing tracking
 */
export async function saveInwardSession(data) {
  const { data: session, error } = await supabase
    .from('inward_sessions')
    .insert({
      vendor_id: data.vendorId,
      invoice_image_url: data.imageUrl,
      ai_raw_response: data.aiResponse,
      ai_extracted_items: data.extractedItems,
      status: 'PROCESSING',
      created_by: data.userId
    })
    .select()
    .single()

  if (error) throw error
  return session
}

/**
 * Update inward session status
 */
export async function updateInwardSession(sessionId, updates) {
  const { error } = await supabase
    .from('inward_sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) throw error
}

/**
 * Confirm inward transaction and update inventory
 */
export async function confirmInward(data) {
  const {
    vendorId,
    items,
    invoiceNo,
    invoiceDate,
    notes,
    sessionId,
    userId
  } = data

  try {
    // Start transaction
    console.log('🚀 Starting inward confirmation process...')

    // 1. Generate reference number
    const referenceNo = generateInwardNumber()

    // 2. Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
    const taxAmount = items.reduce((sum, item) => {
      const gstRate = item.gst_rate || 18
      const taxableAmount = (item.quantity * item.rate) / (1 + gstRate / 100)
      return sum + (taxableAmount * gstRate / 100)
    }, 0)
    const grandTotal = subtotal

    // 3. Insert transaction header
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        transaction_type: 'INWARD',
        reference_no: referenceNo,
        transaction_date: invoiceDate || new Date().toISOString().slice(0, 10),
        vendor_id: vendorId,
        status: 'CONFIRMED',
        subtotal: subtotal,
        total_cgst: 0, // For inward, we don't calculate GST splits
        total_sgst: 0,
        total_igst: taxAmount,
        grand_total: grandTotal,
        notes: notes,
        created_by: userId
      })
      .select()
      .single()

    if (transactionError) throw transactionError

    // 4. Insert transaction items and update inventory
    const inventoryUpdates = []
    const costLogEntries = []
    const transactionItems = []

    for (const item of items) {
      // Insert transaction item
      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert({
          transaction_id: transaction.id,
          sku_id: item.sku_id,
          vendor_item_name: item.vendor_item_name,
          quantity_vendor_unit: item.quantity_vendor_unit,
          vendor_unit: item.vendor_unit,
          quantity: item.quantity_internal,
          unit: item.internal_unit,
          buying_cost_per_unit: item.rate,
          taxable_amount: (item.quantity * item.rate) / (1 + (item.gst_rate || 18) / 100),
          gst_rate: item.gst_rate || 18,
          cgst_amount: 0,
          sgst_amount: 0,
          igst_amount: ((item.quantity * item.rate) / (1 + (item.gst_rate || 18) / 100)) * (item.gst_rate || 18) / 100,
          total_amount: item.quantity * item.rate
        })

      if (itemError) throw itemError

      // Prepare inventory update
      inventoryUpdates.push({
        sku_id: item.sku_id,
        quantity_to_add: item.quantity_internal
      })

      // Prepare cost log entry
      costLogEntries.push({
        sku_id: item.sku_id,
        transaction_id: transaction.id,
        quantity: item.quantity_vendor_unit,
        vendor_unit: item.vendor_unit,
        internal_unit: item.internal_unit,
        buying_cost_per_unit: item.rate,
        total_cost: item.quantity * item.rate,
        conversion_factor: item.conversion_factor || 1,
        cost_per_internal_unit: item.rate / (item.conversion_factor || 1)
      })
    }

    // 5. Update inventory quantities
    for (const update of inventoryUpdates) {
      // First check if inventory record exists
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku_id', update.sku_id)
        .single()

      if (existingInventory) {
        // Update existing inventory
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            quantity: existingInventory.quantity + update.quantity_to_add,
            last_updated: new Date().toISOString()
          })
          .eq('sku_id', update.sku_id)

        if (invError) throw invError
      } else {
        // Create new inventory record
        const { error: invError } = await supabase
          .from('inventory')
          .insert({
            sku_id: update.sku_id,
            quantity: update.quantity_to_add,
            last_updated: new Date().toISOString()
          })

        if (invError) throw invError
      }
    }

    // 6. Insert buying cost log entries
    if (costLogEntries.length > 0) {
      const { error: costLogError } = await supabase
        .from('sku_buying_cost_log')
        .insert(costLogEntries)

      if (costLogError) throw costLogError
    }

    // 7. Update inward session status
    if (sessionId) {
      await updateInwardSession(sessionId, {
        status: 'COMPLETED',
        transaction_id: transaction.id
      })
    }

    console.log('✅ Inward confirmation completed:', referenceNo)
    return { transaction, referenceNo }

  } catch (error) {
    console.error('❌ Inward confirmation failed:', error)

    // Update session status to failed if we have a sessionId
    if (sessionId) {
      try {
        await updateInwardSession(sessionId, { status: 'FAILED' })
      } catch (updateError) {
        console.error('Failed to update session status:', updateError)
      }
    }

    throw error
  }
}

/**
 * Reverse an inward transaction
 */
export async function reverseInward(transactionId, reversalReason, userId) {
  try {
    console.log('🔄 Starting inward reversal process...')

    // 1. Get original transaction with items
    const { data: originalTx, error: txError } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items(*)
      `)
      .eq('id', transactionId)
      .single()

    if (txError) throw txError

    if (originalTx.status !== 'CONFIRMED') {
      throw new Error('Only CONFIRMED transactions can be reversed')
    }

    // 2. Generate reversal reference number
    const reversalRefNo = `REV-${originalTx.reference_no}`

    // 3. Insert reversal transaction
    const { data: reversalTx, error: reversalError } = await supabase
      .from('transactions')
      .insert({
        transaction_type: 'INWARD_REVERSAL',
        reference_no: reversalRefNo,
        transaction_date: new Date().toISOString().slice(0, 10),
        vendor_id: originalTx.vendor_id,
        status: 'CONFIRMED',
        parent_transaction_id: transactionId,
        subtotal: -originalTx.subtotal,
        total_cgst: -originalTx.total_cgst,
        total_sgst: -originalTx.total_sgst,
        total_igst: -originalTx.total_igst,
        grand_total: -originalTx.grand_total,
        reversal_reason: reversalReason,
        created_by: userId
      })
      .select()
      .single()

    if (reversalError) throw reversalError

    // 4. Insert reversal transaction items and update inventory
    for (const item of originalTx.transaction_items) {
      // Insert reversal item
      const { error: itemError } = await supabase
        .from('transaction_items')
        .insert({
          transaction_id: reversalTx.id,
          sku_id: item.sku_id,
          vendor_item_name: item.vendor_item_name,
          quantity_vendor_unit: -item.quantity_vendor_unit,
          vendor_unit: item.vendor_unit,
          quantity: -item.quantity,
          unit: item.unit,
          buying_cost_per_unit: item.buying_cost_per_unit,
          taxable_amount: -item.taxable_amount,
          gst_rate: item.gst_rate,
          cgst_amount: -item.cgst_amount,
          sgst_amount: -item.sgst_amount,
          igst_amount: -item.igst_amount,
          total_amount: -item.total_amount
        })

      if (itemError) throw itemError

      // Update inventory (subtract the quantity)
      const { error: invError } = await supabase
        .from('inventory')
        .update({
          quantity: supabase.sql`quantity - ${item.quantity}`,
          last_updated: new Date().toISOString()
        })
        .eq('sku_id', item.sku_id)

      if (invError) throw invError
    }

    // 5. Update original transaction status
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ status: 'REVERSED' })
      .eq('id', transactionId)

    if (updateError) throw updateError

    console.log('✅ Inward reversal completed:', reversalRefNo)
    return reversalTx

  } catch (error) {
    console.error('❌ Inward reversal failed:', error)
    throw error
  }
}

/**
 * Get inward transaction details
 */
export async function getInwardDetails(transactionId) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      vendors(vendor_name),
      transaction_items(
        *,
        skus(sku_code, sku_name, unit_of_measure)
      )
    `)
    .eq('id', transactionId)
    .single()

  if (error) throw error
  return data
}

/**
 * Get inward list with filters
 */
export async function getInwardList(filters = {}) {
  let query = supabase
    .from('transactions')
    .select(`
      *,
      vendors(vendor_name),
      transaction_items(id)
    `)
    .in('transaction_type', ['INWARD', 'INWARD_REVERSAL'])
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.startDate && filters.endDate) {
    query = query.gte('transaction_date', filters.startDate)
                   .lte('transaction_date', filters.endDate)
  }

  const { data, error } = await query

  if (error) throw error

  // Add item count to each transaction
  return data.map(tx => ({
    ...tx,
    items_count: tx.transaction_items.length
  }))
}