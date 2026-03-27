/**
 * Inward Service - Business logic for vendor inward transactions
 * Uses: vendor_inwards, vendor_inward_items, inventory, vendors, skus tables
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
 * Confirm inward transaction and update inventory
 */
export async function confirmInward(data) {
  const {
    vendorId,
    items,
    invoiceNo,
    invoiceDate,
    notes,
    userId
  } = data

  try {
    console.log('Starting inward confirmation process...')

    // 1. Generate inward number
    const inwardNumber = generateInwardNumber()

    // 2. Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)
    const taxAmount = items.reduce((sum, item) => {
      const gstRate = item.gst_rate || 18
      return sum + (item.quantity * item.rate * gstRate / 100)
    }, 0)
    const grandTotal = subtotal + taxAmount

    // 3. Insert vendor_inwards header
    const { data: inward, error: inwardError } = await supabase
      .from('vendor_inwards')
      .insert({
        inward_number: inwardNumber,
        vendor_id: vendorId,
        inward_date: invoiceDate || new Date().toISOString().slice(0, 10),
        status: 'CONFIRMED',
        subtotal: subtotal,
        total_gst_amount: taxAmount,
        total_amount: grandTotal,
        notes: notes || null,
        created_by: userId
      })
      .select()
      .single()

    if (inwardError) throw inwardError

    // 4. Insert vendor_inward_items and update inventory
    for (const item of items) {
      const amount = item.quantity * item.rate
      const gstRate = item.gst_rate || 18

      // Insert inward item
      const { error: itemError } = await supabase
        .from('vendor_inward_items')
        .insert({
          inward_id: inward.id,
          sku_id: item.sku_id,
          vendor_item_name: item.vendor_item_name || null,
          quantity: item.quantity,
          unit: item.unit || item.vendor_unit || 'PCS',
          rate: item.rate,
          amount: amount,
          gst_rate: gstRate
        })

      if (itemError) throw itemError

      // Update inventory - check if record exists first
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku_id', item.sku_id)
        .single()

      if (existingInventory) {
        // Update existing inventory
        const newStock = (existingInventory.current_stock || 0) + item.quantity
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            current_stock: newStock,
            available_stock: newStock - (existingInventory.reserved_stock || 0),
            last_purchase_cost: item.rate,
            last_purchase_date: invoiceDate || new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString()
          })
          .eq('sku_id', item.sku_id)

        if (invError) throw invError
      } else {
        // Create new inventory record
        const { error: invError } = await supabase
          .from('inventory')
          .insert({
            sku_id: item.sku_id,
            current_stock: item.quantity,
            reserved_stock: 0,
            available_stock: item.quantity,
            average_cost: item.rate,
            last_purchase_cost: item.rate,
            last_purchase_date: invoiceDate || new Date().toISOString().slice(0, 10),
            updated_at: new Date().toISOString()
          })

        if (invError) throw invError
      }
    }

    console.log('Inward confirmation completed:', inwardNumber)
    return { inward, inwardNumber }

  } catch (error) {
    console.error('Inward confirmation failed:', error)
    throw error
  }
}

/**
 * Reverse an inward transaction
 */
export async function reverseInward(inwardId, reversalReason, userId) {
  try {
    console.log('Starting inward reversal process...')

    // 1. Get original inward with items
    const { data: originalInward, error: inwardError } = await supabase
      .from('vendor_inwards')
      .select(`
        *,
        vendor_inward_items(*)
      `)
      .eq('id', inwardId)
      .single()

    if (inwardError) throw inwardError

    if (originalInward.status !== 'CONFIRMED') {
      throw new Error('Only CONFIRMED inwards can be reversed')
    }

    // 2. Generate reversal inward number
    const reversalInwardNumber = `REV-${originalInward.inward_number}`

    // 3. Insert reversal inward record
    const { data: reversalInward, error: reversalError } = await supabase
      .from('vendor_inwards')
      .insert({
        inward_number: reversalInwardNumber,
        vendor_id: originalInward.vendor_id,
        inward_date: new Date().toISOString().slice(0, 10),
        status: 'CONFIRMED',
        subtotal: -(originalInward.subtotal || 0),
        total_gst_amount: -(originalInward.total_gst_amount || 0),
        total_amount: -(originalInward.total_amount || 0),
        notes: `Reversal of ${originalInward.inward_number}. Reason: ${reversalReason}`,
        created_by: userId
      })
      .select()
      .single()

    if (reversalError) throw reversalError

    // 4. Insert reversal items and update inventory
    for (const item of originalInward.vendor_inward_items) {
      // Insert reversal item with negative quantity
      const { error: itemError } = await supabase
        .from('vendor_inward_items')
        .insert({
          inward_id: reversalInward.id,
          sku_id: item.sku_id,
          vendor_item_name: item.vendor_item_name,
          quantity: -(item.quantity || 0),
          unit: item.unit,
          rate: item.rate,
          amount: -(item.amount || 0),
          gst_rate: item.gst_rate
        })

      if (itemError) throw itemError

      // Update inventory - subtract the quantity
      const { data: existingInventory } = await supabase
        .from('inventory')
        .select('*')
        .eq('sku_id', item.sku_id)
        .single()

      if (existingInventory) {
        const newStock = (existingInventory.current_stock || 0) - (item.quantity || 0)
        const { error: invError } = await supabase
          .from('inventory')
          .update({
            current_stock: newStock,
            available_stock: newStock - (existingInventory.reserved_stock || 0),
            updated_at: new Date().toISOString()
          })
          .eq('sku_id', item.sku_id)

        if (invError) throw invError
      }
    }

    // 5. Update original inward status
    const { error: updateError } = await supabase
      .from('vendor_inwards')
      .update({ status: 'REVERSED' })
      .eq('id', inwardId)

    if (updateError) throw updateError

    console.log('Inward reversal completed:', reversalInwardNumber)
    return reversalInward

  } catch (error) {
    console.error('Inward reversal failed:', error)
    throw error
  }
}

/**
 * Get inward transaction details
 */
export async function getInwardDetails(inwardId) {
  const { data, error } = await supabase
    .from('vendor_inwards')
    .select(`
      *,
      vendors(vendor_name, vendor_code, contact_person, phone, email, city, state, gstin),
      vendor_inward_items(
        *,
        skus(sku_code, sku_name, unit_of_measure)
      )
    `)
    .eq('id', inwardId)
    .single()

  if (error) throw error
  return data
}

/**
 * Get inward list with filters
 */
export async function getInwardList(filters = {}) {
  let query = supabase
    .from('vendor_inwards')
    .select(`
      *,
      vendors(vendor_name),
      vendor_inward_items(id)
    `)
    .order('created_at', { ascending: false })

  // Apply filters
  if (filters.vendorId) {
    query = query.eq('vendor_id', filters.vendorId)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.startDate && filters.endDate) {
    query = query.gte('inward_date', filters.startDate)
                   .lte('inward_date', filters.endDate)
  }

  const { data, error } = await query

  if (error) throw error

  // Add item count to each inward
  return data.map(inward => ({
    ...inward,
    items_count: inward.vendor_inward_items?.length || 0
  }))
}
