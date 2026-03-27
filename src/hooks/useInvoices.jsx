import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { generateInvoiceNumber } from '../utils/invoiceGenerator'
import { calculateInvoiceTotals, determineGSTType, GST_TYPES } from '../utils/gstCalculator'
import toast from 'react-hot-toast'

export function useInvoices() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch invoices with customer and company details
  const {
    data: invoices = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          customer:customers(
            customer_name,
            customer_code,
            phone,
            email,
            billing_address_line1,
            billing_address_line2,
            billing_city,
            billing_state,
            gstin
          ),
          company:companies(
            company_name,
            address_line1,
            address_line2,
            city,
            state,
            gstin
          ),
          customer_invoice_items(
            *,
            sku:skus(sku_code, sku_name, unit_of_measure, hsn_code)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Fetch invoice by ID
  const useInvoice = (invoiceId) => {
    return useQuery({
      queryKey: ['invoice', invoiceId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('customer_invoices')
          .select(`
            *,
            customer:customers(*),
            company:companies(*),
            customer_invoice_items(
              *,
              sku:skus(*)
            )
          `)
          .eq('id', invoiceId)
          .single()

        if (error) throw error
        return data
      },
      enabled: !!invoiceId
    })
  }

  // Get next invoice number
  const getNextInvoiceNumber = async (companyId) => {
    const { data, error } = await supabase
      .from('customer_invoices')
      .select('invoice_number')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    const lastInvoiceNumber = data?.invoice_number
    return generateInvoiceNumber(lastInvoiceNumber, 'INV')
  }

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (invoiceData) => {
      const {
        customerId,
        companyId,
        invoiceDate,
        dueDate,
        items,
        discountAmount = 0,
        discountPercentage = 0,
        notes,
        terms,
        shippingAddress,
        ...otherData
      } = invoiceData

      // Get customer and company details for GST calculation
      const [customerRes, companyRes] = await Promise.all([
        supabase.from('customers').select('billing_state').eq('id', customerId).single(),
        supabase.from('companies').select('state').eq('id', companyId).single()
      ])

      if (customerRes.error) throw customerRes.error
      if (companyRes.error) throw companyRes.error

      // Determine GST type
      const gstType = determineGSTType(
        companyRes.data.state,
        customerRes.data.billing_state
      )

      // Add GST type to items
      const itemsWithGST = items.map(item => ({
        ...item,
        gstType
      }))

      // Calculate totals
      const totals = calculateInvoiceTotals(itemsWithGST, discountAmount)

      // Generate invoice number
      const invoiceNumber = await getNextInvoiceNumber(companyId)

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('customer_invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: customerId,
          company_id: companyId,
          invoice_date: invoiceDate,
          due_date: dueDate,
          subtotal: totals.subtotal,
          discount_amount: totals.discountAmount,
          discount_percentage: discountPercentage,
          cgst_amount: totals.totalCGST,
          sgst_amount: totals.totalSGST,
          igst_amount: totals.totalIGST,
          total_gst_amount: totals.totalGSTAmount,
          round_off_amount: totals.roundOffAmount,
          total_amount: totals.grandTotal,
          notes,
          terms_and_conditions: terms,
          shipping_address_line1: shippingAddress?.line1,
          shipping_address_line2: shippingAddress?.line2,
          shipping_city: shippingAddress?.city,
          shipping_state: shippingAddress?.state,
          shipping_pincode: shippingAddress?.pincode,
          created_by: user?.id,
          ...otherData
        })
        .select()
        .single()

      if (invoiceError) throw invoiceError

      // Create invoice items
      const invoiceItems = items.map(item => ({
        invoice_id: invoice.id,
        sku_id: item.skuId,
        quantity: item.quantity,
        rate: item.rate,
        amount: item.quantity * item.rate,
        gst_rate: item.gstRate,
        gst_amount: (item.quantity * item.rate * item.gstRate) / 100,
        total_amount: item.quantity * item.rate + (item.quantity * item.rate * item.gstRate) / 100,
        description: item.description
      }))

      const { error: itemsError } = await supabase
        .from('customer_invoice_items')
        .insert(invoiceItems)

      if (itemsError) throw itemsError

      // Update inventory (reduce stock)
      for (const item of items) {
        const { error: inventoryError } = await supabase.rpc(
          'update_inventory_stock',
          {
            p_sku_id: item.skuId,
            p_company_id: companyId,
            p_quantity: -item.quantity, // Negative for stock out
            p_transaction_type: 'stock_out',
            p_reference_type: 'customer_invoice',
            p_reference_id: invoice.id,
            p_unit_cost: item.rate,
            p_notes: `Invoice ${invoiceNumber} - Sale`,
            p_created_by: user?.id
          }
        )

        if (inventoryError) {
          console.warn('Inventory update failed for item:', item.skuId, inventoryError)
        }
      }

      return invoice
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Invoice created successfully')
    },
    onError: (error) => {
      console.error('Error creating invoice:', error)
      toast.error('Failed to create invoice')
    }
  })

  // Update invoice mutation
  const updateInvoiceMutation = useMutation({
    mutationFn: async ({ id, ...invoiceData }) => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .update(invoiceData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice updated successfully')
    },
    onError: (error) => {
      console.error('Error updating invoice:', error)
      toast.error('Failed to update invoice')
    }
  })

  // Update invoice status mutation
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: async ({ id, status, paidAmount = null, paymentDate = null }) => {
      const updateData = { status }

      if (status === 'paid') {
        updateData.paid_amount = paidAmount
        updateData.payment_date = paymentDate || new Date().toISOString()
      }

      const { error } = await supabase
        .from('customer_invoices')
        .update(updateData)
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice status updated')
    },
    onError: (error) => {
      console.error('Error updating invoice status:', error)
      toast.error('Failed to update invoice status')
    }
  })

  // Send invoice mutation (email/WhatsApp)
  const sendInvoiceMutation = useMutation({
    mutationFn: async ({ invoiceId, method, recipient }) => {
      // This would integrate with email/SMS service
      // For now, just mark as sent
      const { error } = await supabase
        .from('customer_invoices')
        .update({
          is_sent: true,
          sent_at: new Date().toISOString(),
          sent_method: method
        })
        .eq('id', invoiceId)

      if (error) throw error

      // Here you would call email/WhatsApp API
      console.log(`Sending invoice via ${method} to ${recipient}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Invoice sent successfully')
    },
    onError: (error) => {
      console.error('Error sending invoice:', error)
      toast.error('Failed to send invoice')
    }
  })

  // Calculate dashboard stats
  const invoiceStats = {
    totalInvoices: invoices.length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    paidAmount: invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    pendingAmount: invoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (inv.total_amount || 0), 0),
    overdueInvoices: invoices.filter(inv =>
      inv.status === 'pending' && new Date(inv.due_date) < new Date()
    ).length
  }

  return {
    invoices,
    invoiceStats,
    isLoading,
    error,
    useInvoice,
    getNextInvoiceNumber,
    createInvoice: createInvoiceMutation.mutate,
    updateInvoice: updateInvoiceMutation.mutate,
    updateInvoiceStatus: updateInvoiceStatusMutation.mutate,
    sendInvoice: sendInvoiceMutation.mutate,
    isCreating: createInvoiceMutation.isPending,
    isUpdating: updateInvoiceMutation.isPending,
    isSending: sendInvoiceMutation.isPending
  }
}