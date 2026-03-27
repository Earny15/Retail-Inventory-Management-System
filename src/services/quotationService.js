import { supabase } from './supabase'

function generateUID() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let uid = 'SQ-'
  for (let i = 0; i < 6; i++) {
    uid += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return uid
}

export async function getQuotationList() {
  const { data, error } = await supabase
    .from('sales_quotations')
    .select(`
      *,
      customers(customer_name, billing_city, billing_state, phone),
      sales_quotation_items(
        id, sku_id, quantity, rate, amount,
        sku:skus(sku_name, sku_code, unit_of_measure)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function getQuotationById(id) {
  const { data, error } = await supabase
    .from('sales_quotations')
    .select(`
      *,
      customers(*),
      sales_quotation_items(
        *,
        sku:skus(*)
      )
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function createQuotation({ customerId, quotationDate, validityDate, items, notes, userId }) {
  // Generate unique UID
  let uid = generateUID()
  // Check for collision (unlikely but safe)
  const { data: existing } = await supabase
    .from('sales_quotations')
    .select('id')
    .eq('quotation_uid', uid)
    .single()
  if (existing) uid = generateUID()

  // Get company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .limit(1)
    .single()

  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.rate), 0)

  // Insert header
  const { data: quotation, error: qError } = await supabase
    .from('sales_quotations')
    .insert({
      quotation_uid: uid,
      customer_id: customerId,
      company_id: company?.id,
      quotation_date: quotationDate,
      validity_date: validityDate || null,
      subtotal,
      total_amount: subtotal,
      notes: notes || null,
      status: 'ACTIVE',
      created_by: userId
    })
    .select()
    .single()

  if (qError) throw qError

  // Insert items
  const itemsToInsert = items.map(item => ({
    quotation_id: quotation.id,
    sku_id: item.sku_id,
    quantity: item.quantity,
    rate: item.rate,
    amount: item.quantity * item.rate,
    description: item.description || null
  }))

  const { error: itemsError } = await supabase
    .from('sales_quotation_items')
    .insert(itemsToInsert)

  if (itemsError) throw itemsError

  return quotation
}
