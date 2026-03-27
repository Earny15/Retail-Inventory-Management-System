import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currencyToWords } from '../../utils/numberToWords'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

const GST_RATE_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' }
]

const GST_TYPE_OPTIONS = [
  { value: 'INTRA', label: 'CGST + SGST (Intra-state)' },
  { value: 'INTER', label: 'IGST (Inter-state)' }
]

const GST_MODE_OPTIONS = [
  { value: 'same', label: 'Same GST % for all items' },
  { value: 'different', label: 'Different GST % per item' }
]

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const todayISO = () => new Date().toISOString().split('T')[0]

export default function NewInvoicePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')

  // GST settings - user chooses at invoice level
  const [gstType, setGstType] = useState('INTRA') // INTRA = CGST+SGST, INTER = IGST
  const [gstMode, setGstMode] = useState('same') // same = uniform GST%, different = per-line
  const [uniformGstRate, setUniformGstRate] = useState(18) // used when gstMode === 'same'

  const [lineItems, setLineItems] = useState([
    { id: Date.now(), sku_id: null, hsn_code: '', qty: 1, unit: '', sellingPrice: 0, gst_rate: 18, included: true }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name, phone, billing_city, billing_state, gstin')
        .order('customer_name')
      if (error) throw error
      return data
    }
  })

  // Fetch company (first row)
  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error) throw error
      return data
    }
  })

  // Fetch SKUs - include selling_price if column exists
  const { data: skus = [] } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, sku_code, sku_name, unit_of_measure, hsn_code, selling_price, gst_rate')
        .order('sku_name')
      if (error) {
        // Fallback without selling_price if column doesn't exist
        const { data: fallback, error: err2 } = await supabase
          .from('skus')
          .select('id, sku_code, sku_name, unit_of_measure, hsn_code, gst_rate')
          .order('sku_name')
        if (err2) throw err2
        return fallback
      }
      return data
    }
  })

  // Fetch inventory for stock checks
  const { data: inventoryData = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('sku_id, current_stock')
      if (error) throw error
      return data
    }
  })

  const inventoryMap = useMemo(() => {
    const map = {}
    inventoryData.forEach(inv => { map[inv.sku_id] = inv.current_stock })
    return map
  }, [inventoryData])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  // Customer options
  const customerOptions = useMemo(() =>
    customers.map(c => ({
      value: c.id,
      label: `${c.customer_name} - ${c.billing_city || ''}`
    })),
    [customers]
  )

  // SKU options
  const skuOptions = useMemo(() =>
    skus.map(s => ({
      value: s.id,
      label: `${s.sku_code} - ${s.sku_name}`
    })),
    [skus]
  )

  // Line item handlers
  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: Date.now(),
      sku_id: null,
      hsn_code: '',
      qty: 1,
      unit: '',
      sellingPrice: 0,
      gst_rate: uniformGstRate,
      included: true
    }])
  }

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSkuSelect = (index, skuId) => {
    const sku = skus.find(s => s.id === skuId)
    if (sku) {
      setLineItems(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          sku_id: skuId,
          hsn_code: sku.hsn_code || '',
          unit: sku.unit_of_measure || '',
          sellingPrice: sku.selling_price || 0,
          gst_rate: gstMode === 'same' ? uniformGstRate : (sku.gst_rate ?? updated[index].gst_rate)
        }
        return updated
      })
    }
  }

  // When uniform GST rate changes, update all line items
  const handleUniformGstChange = (rate) => {
    setUniformGstRate(rate)
    if (gstMode === 'same') {
      setLineItems(prev => prev.map(item => ({ ...item, gst_rate: rate })))
    }
  }

  // When GST mode changes to 'same', sync all items to uniform rate
  const handleGstModeChange = (mode) => {
    setGstMode(mode)
    if (mode === 'same') {
      setLineItems(prev => prev.map(item => ({ ...item, gst_rate: uniformGstRate })))
    }
  }

  // Calculations per line item
  // Selling price is GST-INCLUSIVE. Taxable amount is back-calculated.
  // sellingPrice = 118 (incl 18% GST) → total = 118*qty, taxable = 118*qty/1.18 = 100*qty, GST = 18*qty
  const calcLineItem = (item) => {
    const price = Number(item.sellingPrice) || 0
    const qty = Number(item.qty) || 0
    const gstRate = gstMode === 'same' ? uniformGstRate : (Number(item.gst_rate) || 0)

    const total = price * qty
    const taxableAmount = gstRate > 0 ? total / (1 + gstRate / 100) : total
    const totalGst = total - taxableAmount

    let cgst = 0, sgst = 0, igst = 0
    if (gstType === 'INTRA') {
      cgst = totalGst / 2
      sgst = totalGst / 2
    } else {
      igst = totalGst
    }

    return { taxableAmount, cgst, sgst, igst, totalGst, total, gstRate }
  }

  // Summary calculations (only included items)
  const summary = useMemo(() => {
    let subTotal = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let grandTotal = 0

    lineItems.forEach(item => {
      if (!item.included) return
      const calc = calcLineItem(item)
      subTotal += calc.taxableAmount
      totalCgst += calc.cgst
      totalSgst += calc.sgst
      totalIgst += calc.igst
      grandTotal += calc.total
    })

    return { subTotal, totalCgst, totalSgst, totalIgst, grandTotal }
  }, [lineItems, gstType, gstMode, uniformGstRate])

  // Generate invoice mutation
  const generateInvoice = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer')
      return
    }
    if (!invoiceDate) {
      toast.error('Please select an invoice date')
      return
    }
    const includedItems = lineItems.filter(item => item.included)
    const validIncluded = includedItems.filter(item => item.sku_id && item.qty > 0 && item.sellingPrice > 0)
    if (validIncluded.length === 0) {
      toast.error('At least one item with SKU, quantity and selling price is required')
      return
    }
    const allItems = lineItems.filter(item => item.sku_id)
    if (allItems.length !== lineItems.length) {
      toast.error('All line items must have a SKU selected')
      return
    }

    setIsSubmitting(true)

    try {
      // Step 1: Get next invoice number
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('id, invoice_prefix')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (companyError) throw companyError

      const { data: lastInvoice } = await supabase
        .from('customer_invoices')
        .select('invoice_number')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      let nextNum = 1
      if (lastInvoice?.invoice_number) {
        const match = lastInvoice.invoice_number.match(/(\d+)$/)
        if (match) nextNum = parseInt(match[1], 10) + 1
      }
      const invoiceNumber = `${companyData.invoice_prefix || 'INV-'}${nextNum}`

      // Step 2: Insert customer invoice
      const { data: invoiceRecord, error: txError } = await supabase
        .from('customer_invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          customer_id: selectedCustomerId,
          status: 'ACTIVE',
          subtotal: summary.subTotal,
          cgst_amount: summary.totalCgst,
          sgst_amount: summary.totalSgst,
          igst_amount: summary.totalIgst,
          total_gst_amount: summary.totalCgst + summary.totalSgst + summary.totalIgst,
          total_amount: summary.grandTotal,
          due_date: dueDate || null,
          notes: null,
          created_by: user?.id
        })
        .select()
        .single()

      if (txError) throw txError

      // Step 3: Insert invoice items
      for (const item of lineItems) {
        if (!item.included) continue
        const calc = calcLineItem(item)

        const { error: itemError } = await supabase
          .from('customer_invoice_items')
          .insert({
            invoice_id: invoiceRecord.id,
            sku_id: item.sku_id,
            quantity: item.qty,
            rate: item.sellingPrice,
            amount: calc.taxableAmount,
            gst_rate: calc.gstRate,
            gst_amount: calc.totalGst,
            total_amount: calc.total,
            description: item.hsn_code ? `HSN: ${item.hsn_code}` : null
          })

        if (itemError) throw itemError

        // Step 4: Update inventory - reduce stock
        const currentStock = inventoryMap[item.sku_id] || 0
        await supabase
          .from('inventory')
          .update({
            current_stock: currentStock - item.qty,
            available_stock: currentStock - item.qty
          })
          .eq('sku_id', item.sku_id)
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success(`Invoice ${invoiceNumber} generated successfully!`)
      navigate(`/invoices/${invoiceRecord.id}`)

    } catch (error) {
      console.error('Invoice generation failed:', error)
      toast.error('Failed to generate invoice: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-3 sm:mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create New Invoice</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">Generate a GST-compliant outward invoice</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/invoices')}>
          Back
        </Button>
      </div>

      <div className="space-y-6">
        {/* Customer & Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select
                label="Customer"
                required
                options={customerOptions}
                value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                onChange={(selected) => setSelectedCustomerId(selected?.value || null)}
                placeholder="Search customer..."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Invoice Date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
                <Input
                  label="Due Date (optional)"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium">{selectedCustomer.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Location:</span>
                    <p className="font-medium">{selectedCustomer.billing_city}, {selectedCustomer.billing_state}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">GSTIN:</span>
                    <p className="font-medium">{selectedCustomer.gstin || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GST Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>GST Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Select
                  label="Invoice Type"
                  options={GST_TYPE_OPTIONS}
                  value={GST_TYPE_OPTIONS.find(o => o.value === gstType)}
                  onChange={(s) => setGstType(s?.value || 'INTRA')}
                />
                <div className="mt-2">
                  {gstType === 'INTRA' ? (
                    <Badge variant="info">CGST + SGST</Badge>
                  ) : (
                    <Badge variant="purple">IGST</Badge>
                  )}
                </div>
              </div>
              <div>
                <Select
                  label="GST % Mode"
                  options={GST_MODE_OPTIONS}
                  value={GST_MODE_OPTIONS.find(o => o.value === gstMode)}
                  onChange={(s) => handleGstModeChange(s?.value || 'same')}
                />
              </div>
              {gstMode === 'same' && (
                <div>
                  <Select
                    label="GST Rate (all items)"
                    options={GST_RATE_OPTIONS}
                    value={GST_RATE_OPTIONS.find(o => o.value === uniformGstRate)}
                    onChange={(s) => handleUniformGstChange(s?.value ?? 18)}
                  />
                  {gstType === 'INTRA' ? (
                    <p className="text-xs text-gray-500 mt-1">
                      CGST {uniformGstRate / 2}% + SGST {uniformGstRate / 2}%
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      IGST {uniformGstRate}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU Name</TableHeader>
                    <TableHeader>HSN</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Price (Incl. GST)</TableHeader>
                    <TableHeader>Taxable Amt</TableHeader>
                    {gstMode === 'different' && <TableHeader>GST %</TableHeader>}
                    {gstType === 'INTRA' ? (
                      <>
                        <TableHeader>CGST</TableHeader>
                        <TableHeader>SGST</TableHeader>
                      </>
                    ) : (
                      <TableHeader>IGST</TableHeader>
                    )}
                    <TableHeader>Total</TableHeader>
                    <TableHeader>Include</TableHeader>
                    <TableHeader></TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => {
                    const calc = calcLineItem(item)
                    const stock = inventoryMap[item.sku_id] || 0
                    const qtyExceedsStock = item.included && item.sku_id && item.qty > stock

                    return (
                      <TableRow key={item.id} className={!item.included ? 'bg-gray-100 opacity-60' : ''}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(o => o.value === item.sku_id) || null}
                            onChange={(selected) => handleSkuSelect(index, selected?.value)}
                            placeholder="Select SKU..."
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{item.hsn_code || '-'}</span>
                        </TableCell>
                        <TableCell className="min-w-[90px]">
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.qty}
                              onChange={(e) => updateLineItem(index, 'qty', parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                            {qtyExceedsStock && (
                              <div className="flex items-center mt-1 text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Stock: {stock}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.unit || '-'}</span>
                        </TableCell>
                        <TableCell className="min-w-[110px]">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice}
                            onChange={(e) => updateLineItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCurrency(calc.taxableAmount)}
                        </TableCell>
                        {gstMode === 'different' && (
                          <TableCell className="min-w-[100px]">
                            <Select
                              options={GST_RATE_OPTIONS}
                              value={GST_RATE_OPTIONS.find(o => o.value === item.gst_rate) || null}
                              onChange={(selected) => updateLineItem(index, 'gst_rate', selected?.value ?? 18)}
                              menuPortalTarget={document.body}
                            />
                          </TableCell>
                        )}
                        {gstType === 'INTRA' ? (
                          <>
                            <TableCell className="text-sm">{formatCurrency(calc.cgst)}</TableCell>
                            <TableCell className="text-sm">{formatCurrency(calc.sgst)}</TableCell>
                          </>
                        ) : (
                          <TableCell className="text-sm">{formatCurrency(calc.igst)}</TableCell>
                        )}
                        <TableCell className="text-sm font-semibold">{formatCurrency(calc.total)}</TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) => updateLineItem(index, 'included', e.target.checked)}
                            className="h-4 w-4 text-navy-600 rounded"
                          />
                        </TableCell>
                        <TableCell>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(index)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-4">
              {lineItems.map((item, index) => {
                const calc = calcLineItem(item)
                const stock = inventoryMap[item.sku_id] || 0
                const qtyExceedsStock = item.included && item.sku_id && item.qty > stock

                return (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-4 space-y-3 ${!item.included ? 'bg-gray-100 opacity-60 border-gray-200' : index % 2 === 0 ? 'bg-white border-gray-200 shadow-sm' : 'bg-blue-50/40 border-blue-100 shadow-sm'}`}
                  >
                    {/* Card Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-500">Item #{index + 1}</span>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1.5 text-sm text-gray-600">
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) => updateLineItem(index, 'included', e.target.checked)}
                            className="h-4 w-4 text-navy-600 rounded"
                          />
                          Include
                        </label>
                        {lineItems.length > 1 && (
                          <button
                            onClick={() => removeLineItem(index)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* SKU Select */}
                    <Select
                      label="SKU"
                      options={skuOptions}
                      value={skuOptions.find(o => o.value === item.sku_id) || null}
                      onChange={(selected) => handleSkuSelect(index, selected?.value)}
                      placeholder="Select SKU..."
                    />

                    {/* HSN & Unit row */}
                    {(item.hsn_code || item.unit) && (
                      <div className="flex gap-4 text-sm text-gray-500">
                        {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                        {item.unit && <span>Unit: {item.unit}</span>}
                      </div>
                    )}

                    {/* Qty & Selling Price row */}
                    <div className={`grid gap-3 ${gstMode === 'different' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.qty}
                          onChange={(e) => updateLineItem(index, 'qty', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                        />
                        {qtyExceedsStock && (
                          <div className="flex items-center mt-1 text-xs text-amber-600">
                            <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                            Stock: {stock}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Price (Incl. GST)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.sellingPrice}
                          onChange={(e) => updateLineItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                        />
                      </div>
                      {gstMode === 'different' && (
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">GST %</label>
                          <Select
                            options={GST_RATE_OPTIONS}
                            value={GST_RATE_OPTIONS.find(o => o.value === item.gst_rate) || null}
                            onChange={(selected) => updateLineItem(index, 'gst_rate', selected?.value ?? 18)}
                            menuPortalTarget={document.body}
                          />
                        </div>
                      )}
                    </div>

                    {/* Calculated amounts */}
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Taxable Amt</span>
                        <span>{formatCurrency(calc.taxableAmount)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>GST {calc.gstRate}%</span>
                        <span>{formatCurrency(calc.totalGst)}</span>
                      </div>
                      {gstType === 'INTRA' ? (
                        <>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">CGST ({calc.gstRate / 2}%)</span>
                            <span>{formatCurrency(calc.cgst)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">SGST ({calc.gstRate / 2}%)</span>
                            <span>{formatCurrency(calc.sgst)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">IGST ({calc.gstRate}%)</span>
                          <span>{formatCurrency(calc.igst)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                        <span>Total</span>
                        <span className="text-navy-600">{formatCurrency(calc.total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left - amount in words */}
              <div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                  <p className="text-sm font-medium">{currencyToWords(Math.round(summary.grandTotal))}</p>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  <p>Invoice Date: {formatDateDDMMYYYY(invoiceDate)}</p>
                  {dueDate && <p>Due Date: {formatDateDDMMYYYY(dueDate)}</p>}
                  <p className="mt-1">
                    GST Type: {gstType === 'INTRA' ? 'CGST + SGST' : 'IGST'}
                    {gstMode === 'same' && ` @ ${uniformGstRate}%`}
                  </p>
                </div>
              </div>

              {/* Right - totals */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sub-total (Taxable):</span>
                  <span className="font-medium">{formatCurrency(summary.subTotal)}</span>
                </div>
                {gstType === 'INTRA' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>CGST:</span>
                      <span>{formatCurrency(summary.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST:</span>
                      <span>{formatCurrency(summary.totalSgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>IGST:</span>
                    <span>{formatCurrency(summary.totalIgst)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total:</span>
                    <span className="text-navy-600">{formatCurrency(summary.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
          <Button
            onClick={generateInvoice}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Generate Invoice
          </Button>
        </div>
      </div>
    </div>
  )
}
