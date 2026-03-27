import supabase from './supabase'
import { calculateGST, calculateRoundOff } from '../utils/gstCalculations'
import { generateSequentialNumber } from '../utils/sequentialNumbers'
import { uploadInvoicePDFToStorage } from './invoicePdfService'

// Get invoice list with filters
export async function getInvoiceList(filters = {}) {
  try {
    let query = supabase
      .from('customer_invoices')
      .select(`
        *,
        customers!inner(customer_name, billing_city, billing_state),
        invoice_items(
          id,
          sku_id,
          quantity,
          unit_price,
          total_amount,
          skus(sku_name)
        )
      `)

    // Apply filters
    if (filters.customerId) {
      query = query.eq('customer_id', filters.customerId)
    }

    if (filters.status) {
      query = query.eq('status', filters.status)
    }

    if (filters.startDate) {
      query = query.gte('invoice_date', filters.startDate)
    }

    if (filters.endDate) {
      query = query.lte('invoice_date', filters.endDate)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query

    if (error) throw error

    return data.map(invoice => ({
      ...invoice,
      items_count: invoice.invoice_items?.length || 0,
      customer_name: invoice.customers?.customer_name,
      customer_location: `${invoice.customers?.billing_city}, ${invoice.customers?.billing_state}`,
      payment_status: getPaymentStatus(invoice),
      days_overdue: getDaysOverdue(invoice)
    }))

  } catch (error) {
    console.error('Error fetching invoice list:', error)
    throw error
  }
}

// Get single invoice with full details
export async function getInvoiceById(id) {
  try {
    const { data, error } = await supabase
      .from('customer_invoices')
      .select(`
        *,
        customers!inner(*),
        companies!inner(*),
        invoice_items!inner(
          *,
          skus!inner(*)
        ),
        invoice_payments(
          *
        )
      `)
      .eq('id', id)
      .single()

    if (error) throw error

    // Calculate payment summary
    const payments = data.invoice_payments || []
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0)
    const balanceAmount = data.grand_total - totalPaid

    return {
      ...data,
      payment_summary: {
        total_paid: totalPaid,
        balance_amount: balanceAmount,
        payment_status: getPaymentStatus(data, totalPaid),
        days_overdue: getDaysOverdue(data)
      },
      payments
    }

  } catch (error) {
    console.error('Error fetching invoice:', error)
    throw error
  }
}

// Create new invoice
export async function createInvoice(invoiceData) {
  try {
    // Start transaction
    const { data: invoice, error: invoiceError } = await supabase
      .from('customer_invoices')
      .insert({
        ...invoiceData,
        invoice_number: await generateSequentialNumber('invoice', invoiceData.companyId),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (invoiceError) throw invoiceError

    // Add invoice items
    if (invoiceData.items && invoiceData.items.length > 0) {
      const itemsToInsert = invoiceData.items.map(item => ({
        ...item,
        invoice_id: invoice.id,
        total_amount: item.quantity * item.unit_price
      }))

      const { error: itemsError } = await supabase
        .from('customer_invoice_items')
        .insert(itemsToInsert)

      if (itemsError) throw itemsError

      // Update inventory for confirmed invoices
      if (invoiceData.status === 'CONFIRMED') {
        await updateInventoryForInvoice(invoice.id, 'OUTWARD')
      }
    }

    // Generate and upload PDF for public access
    try {
      const fullInvoice = await getInvoiceById(invoice.id)
      const publicPdfUrl = await uploadInvoicePDFToStorage(fullInvoice)

      // Update invoice with public PDF URL
      await supabase
        .from('customer_invoices')
        .update({ public_pdf_url: publicPdfUrl })
        .eq('id', invoice.id)

      invoice.public_pdf_url = publicPdfUrl
    } catch (pdfError) {
      console.error('Error generating/uploading PDF:', pdfError)
      // Don't fail the invoice creation if PDF upload fails
    }

    return invoice

  } catch (error) {
    console.error('Error creating invoice:', error)
    throw error
  }
}

// Update invoice
export async function updateInvoice(id, updates) {
  try {
    const { data, error } = await supabase
      .from('customer_invoices')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    // Handle status changes
    if (updates.status === 'CONFIRMED') {
      await updateInventoryForInvoice(id, 'OUTWARD')
    } else if (updates.status === 'CANCELLED') {
      await updateInventoryForInvoice(id, 'INWARD') // Reverse the stock
    }

    return data

  } catch (error) {
    console.error('Error updating invoice:', error)
    throw error
  }
}

// Delete invoice
export async function deleteInvoice(id) {
  try {
    // Get current invoice to check status
    const { data: invoice } = await supabase
      .from('customer_invoices')
      .select('status')
      .eq('id', id)
      .single()

    if (invoice?.status === 'CONFIRMED') {
      throw new Error('Cannot delete confirmed invoices. Cancel the invoice first.')
    }

    // Delete invoice items first
    await supabase
      .from('customer_invoice_items')
      .delete()
      .eq('invoice_id', id)

    // Delete invoice
    const { error } = await supabase
      .from('customer_invoices')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { success: true }

  } catch (error) {
    console.error('Error deleting invoice:', error)
    throw error
  }
}

// Record payment against invoice
export async function recordPayment(paymentData) {
  try {
    const { data: payment, error: paymentError } = await supabase
      .from('invoice_payments')
      .insert({
        ...paymentData,
        payment_date: paymentData.payment_date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (paymentError) throw paymentError

    // Update invoice payment status
    const { data: invoice } = await getInvoiceById(paymentData.invoice_id)
    const totalPaid = (invoice.payment_summary?.total_paid || 0) + paymentData.amount

    let status = invoice.status
    if (totalPaid >= invoice.grand_total) {
      status = 'PAID'
    } else if (totalPaid > 0) {
      status = 'PARTIALLY_PAID'
    }

    await supabase
      .from('customer_invoices')
      .update({
        payment_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentData.invoice_id)

    return payment

  } catch (error) {
    console.error('Error recording payment:', error)
    throw error
  }
}

// Get payment history for invoice
export async function getPaymentHistory(invoiceId) {
  try {
    const { data, error } = await supabase
      .from('invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false })

    if (error) throw error
    return data

  } catch (error) {
    console.error('Error fetching payment history:', error)
    throw error
  }
}

// Get overdue invoices
export async function getOverdueInvoices() {
  try {
    const { data, error } = await supabase
      .from('customer_invoices')
      .select(`
        *,
        customers!inner(customer_name, phone, email),
        invoice_payments(amount)
      `)
      .lt('due_date', new Date().toISOString().split('T')[0])
      .in('status', ['CONFIRMED', 'PARTIALLY_PAID'])

    if (error) throw error

    return data.map(invoice => {
      const totalPaid = invoice.invoice_payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0
      const balanceAmount = invoice.grand_total - totalPaid

      return {
        ...invoice,
        balance_amount: balanceAmount,
        days_overdue: getDaysOverdue(invoice),
        payment_status: getPaymentStatus(invoice, totalPaid)
      }
    }).filter(invoice => invoice.balance_amount > 0)

  } catch (error) {
    console.error('Error fetching overdue invoices:', error)
    throw error
  }
}

// Generate customer statement
export async function generateCustomerStatement(customerId, startDate, endDate) {
  try {
    // Get customer details
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single()

    if (customerError) throw customerError

    // Get invoices in date range
    const { data: invoices, error: invoicesError } = await supabase
      .from('customer_invoices')
      .select(`
        *,
        invoice_payments(
          amount,
          payment_date,
          payment_method,
          reference_number
        )
      `)
      .eq('customer_id', customerId)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)
      .order('invoice_date', { ascending: true })

    if (invoicesError) throw invoicesError

    // Calculate opening balance (invoices before start date)
    const { data: previousInvoices } = await supabase
      .from('customer_invoices')
      .select('grand_total, invoice_payments(amount)')
      .eq('customer_id', customerId)
      .lt('invoice_date', startDate)

    const openingBalance = previousInvoices?.reduce((total, invoice) => {
      const paid = invoice.invoice_payments?.reduce((sum, payment) => sum + payment.amount, 0) || 0
      return total + (invoice.grand_total - paid)
    }, 0) || 0

    // Process statement entries
    const entries = []
    let runningBalance = openingBalance

    // Add opening balance entry
    if (openingBalance !== 0) {
      entries.push({
        date: startDate,
        description: 'Opening Balance',
        type: 'OPENING',
        debit: openingBalance > 0 ? openingBalance : 0,
        credit: openingBalance < 0 ? Math.abs(openingBalance) : 0,
        balance: runningBalance
      })
    }

    // Process each invoice and its payments
    invoices.forEach(invoice => {
      // Add invoice entry
      runningBalance += invoice.grand_total
      entries.push({
        date: invoice.invoice_date,
        description: `Invoice ${invoice.invoice_number}`,
        type: 'INVOICE',
        reference: invoice.invoice_number,
        debit: invoice.grand_total,
        credit: 0,
        balance: runningBalance
      })

      // Add payment entries
      invoice.invoice_payments?.forEach(payment => {
        runningBalance -= payment.amount
        entries.push({
          date: payment.payment_date,
          description: `Payment - ${payment.payment_method}`,
          type: 'PAYMENT',
          reference: payment.reference_number,
          debit: 0,
          credit: payment.amount,
          balance: runningBalance
        })
      })
    })

    // Calculate totals
    const totalDebits = entries.reduce((sum, entry) => sum + (entry.debit || 0), 0)
    const totalCredits = entries.reduce((sum, entry) => sum + (entry.credit || 0), 0)
    const closingBalance = runningBalance

    return {
      customer,
      period: { startDate, endDate },
      openingBalance,
      closingBalance,
      totalDebits,
      totalCredits,
      entries
    }

  } catch (error) {
    console.error('Error generating customer statement:', error)
    throw error
  }
}

// Send payment reminder
export async function sendPaymentReminder(invoiceId, reminderType = 'GENTLE') {
  try {
    const invoice = await getInvoiceById(invoiceId)

    const reminderData = {
      invoice_id: invoiceId,
      customer_id: invoice.customer_id,
      reminder_type: reminderType,
      sent_date: new Date().toISOString(),
      days_overdue: getDaysOverdue(invoice),
      amount_due: invoice.payment_summary.balance_amount
    }

    const { data, error } = await supabase
      .from('payment_reminders')
      .insert(reminderData)
      .select()
      .single()

    if (error) throw error

    // Here you would integrate with email/SMS service
    // For now, we'll just log the reminder
    console.log(`Payment reminder sent for invoice ${invoice.invoice_number}`, reminderData)

    return data

  } catch (error) {
    console.error('Error sending payment reminder:', error)
    throw error
  }
}

// Helper functions
function getPaymentStatus(invoice, totalPaid = null) {
  if (invoice.status === 'CANCELLED') return 'CANCELLED'
  if (invoice.status === 'DRAFT') return 'DRAFT'

  const paid = totalPaid ?? (invoice.invoice_payments?.reduce((sum, p) => sum + p.amount, 0) || 0)

  if (paid === 0) {
    return getDaysOverdue(invoice) > 0 ? 'OVERDUE' : 'UNPAID'
  } else if (paid >= invoice.grand_total) {
    return 'PAID'
  } else {
    return getDaysOverdue(invoice) > 0 ? 'OVERDUE_PARTIAL' : 'PARTIALLY_PAID'
  }
}

function getDaysOverdue(invoice) {
  if (!invoice.due_date || invoice.status === 'PAID' || invoice.status === 'CANCELLED') {
    return 0
  }

  const dueDate = new Date(invoice.due_date)
  const today = new Date()
  const diffTime = today - dueDate
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

// Update inventory when invoice is confirmed/cancelled
async function updateInventoryForInvoice(invoiceId, direction) {
  try {
    const { data: items } = await supabase
      .from('customer_invoice_items')
      .select('sku_id, quantity')
      .eq('invoice_id', invoiceId)

    for (const item of items) {
      const adjustment = direction === 'OUTWARD' ? -item.quantity : item.quantity

      const { error } = await supabase
        .from('inventory')
        .update({
          current_stock: supabase.raw(`current_stock + ${adjustment}`),
          updated_at: new Date().toISOString()
        })
        .eq('sku_id', item.sku_id)

      if (error) throw error
    }

  } catch (error) {
    console.error('Error updating inventory:', error)
    throw error
  }
}

// Calculate invoice totals
export function calculateInvoiceTotals(items) {
  let subtotal = 0
  let totalGST = 0

  items.forEach(item => {
    const amount = item.quantity * item.unit_price
    subtotal += amount

    const gstAmount = calculateGST(amount, item.gst_rate)
    totalGST += gstAmount
  })

  const beforeRoundOff = subtotal + totalGST
  const roundOff = calculateRoundOff(beforeRoundOff)
  const grandTotal = beforeRoundOff + roundOff

  return {
    subtotal_amount: subtotal,
    total_gst_amount: totalGST,
    round_off_amount: roundOff,
    grand_total: grandTotal
  }
}

// Get invoice dashboard statistics
export async function getInvoiceDashboardStats(dateRange) {
  try {
    const { startDate, endDate } = dateRange

    // Get invoices in date range
    const { data: invoices } = await supabase
      .from('customer_invoices')
      .select(`
        *,
        invoice_payments(amount)
      `)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate)

    // Get overdue invoices
    const { data: overdueInvoices } = await supabase
      .from('customer_invoices')
      .select('*, invoice_payments(amount)')
      .lt('due_date', new Date().toISOString().split('T')[0])
      .in('status', ['CONFIRMED', 'PARTIALLY_PAID'])

    const overdueAmount = overdueInvoices?.reduce((total, invoice) => {
      const paid = invoice.invoice_payments?.reduce((sum, p) => sum + p.amount, 0) || 0
      return total + Math.max(0, invoice.grand_total - paid)
    }, 0) || 0

    // Calculate stats
    const totalInvoices = invoices?.length || 0
    const totalAmount = invoices?.reduce((sum, inv) => sum + inv.grand_total, 0) || 0
    const totalPaid = invoices?.reduce((sum, inv) => {
      const paid = inv.invoice_payments?.reduce((pSum, p) => pSum + p.amount, 0) || 0
      return sum + paid
    }, 0) || 0
    const pendingAmount = totalAmount - totalPaid

    return {
      totalInvoices,
      totalAmount,
      totalPaid,
      pendingAmount,
      overdueAmount,
      averageInvoiceValue: totalInvoices > 0 ? totalAmount / totalInvoices : 0
    }

  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      totalInvoices: 0,
      totalAmount: 0,
      totalPaid: 0,
      pendingAmount: 0,
      overdueAmount: 0,
      averageInvoiceValue: 0
    }
  }
}