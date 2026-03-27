import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useQuotations } from '../../hooks/useQuotations'
import { currencyToWords } from '../../utils/numberToWords'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Plus, Trash2, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const todayISO = () => new Date().toISOString().split('T')[0]

export default function NewQuotationPage() {
  const navigate = useNavigate()
  const { createQuotation, isCreating } = useQuotations()

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [quotationDate, setQuotationDate] = useState(todayISO())
  const [validityDate, setValidityDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState([
    { id: Date.now(), sku_id: null, qty: 1, unit: '', sellingPrice: 0 }
  ])

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name, phone, billing_city, billing_state')
        .order('customer_name')
      if (error) throw error
      return data
    }
  })

  // Fetch SKUs
  const { data: skus = [] } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, sku_code, sku_name, unit_of_measure, selling_price')
        .order('sku_name')
      if (error) {
        const { data: fallback, error: err2 } = await supabase
          .from('skus')
          .select('id, sku_code, sku_name, unit_of_measure')
          .order('sku_name')
        if (err2) throw err2
        return fallback
      }
      return data
    }
  })

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  const customerOptions = useMemo(() =>
    customers.map(c => ({
      value: c.id,
      label: `${c.customer_name} - ${c.billing_city || ''}`
    })),
    [customers]
  )

  const skuOptions = useMemo(() =>
    skus.map(s => ({
      value: s.id,
      label: `${s.sku_code} - ${s.sku_name}`
    })),
    [skus]
  )

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      id: Date.now(),
      sku_id: null,
      qty: 1,
      unit: '',
      sellingPrice: 0
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
          unit: sku.unit_of_measure || '',
          sellingPrice: sku.selling_price || 0
        }
        return updated
      })
    }
  }

  const summary = useMemo(() => {
    let total = 0
    lineItems.forEach(item => {
      total += (Number(item.sellingPrice) || 0) * (Number(item.qty) || 0)
    })
    return { total }
  }, [lineItems])

  const handleSubmit = async () => {
    if (!selectedCustomerId) { toast.error('Please select a customer'); return }
    if (!quotationDate) { toast.error('Please select a date'); return }

    const validItems = lineItems.filter(item => item.sku_id && item.qty > 0 && item.sellingPrice > 0)
    if (validItems.length === 0) {
      toast.error('Add at least one valid item')
      return
    }

    try {
      const quotation = await createQuotation({
        customerId: selectedCustomerId,
        quotationDate,
        validityDate: validityDate || null,
        notes,
        items: validItems.map(item => ({
          sku_id: item.sku_id,
          quantity: item.qty,
          rate: item.sellingPrice
        }))
      })
      navigate(`/quotations/${quotation.id}`)
    } catch (err) {
      // error handled in hook
    }
  }

  return (
    <div>
      <div className="mb-3 sm:mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Create Sales Quotation</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">Generate a sales quote for your customer</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate('/quotations')}>
          Back
        </Button>
      </div>

      <div className="space-y-6">
        {/* Customer Details */}
        <Card>
          <CardHeader><CardTitle>Customer Details</CardTitle></CardHeader>
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
                  label="Quotation Date"
                  type="date"
                  value={quotationDate}
                  onChange={(e) => setQuotationDate(e.target.value)}
                  required
                />
                <Input
                  label="Valid Until (optional)"
                  type="date"
                  value={validityDate}
                  onChange={(e) => setValidityDate(e.target.value)}
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
                  {selectedCustomer.phone && (
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <p className="font-medium">{selectedCustomer.phone}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Items</CardTitle>
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
                    <TableHeader>Item Name</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Per Unit Cost</TableHeader>
                    <TableHeader>Total</TableHeader>
                    <TableHeader></TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => {
                    const total = (Number(item.sellingPrice) || 0) * (Number(item.qty) || 0)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(o => o.value === item.sku_id) || null}
                            onChange={(selected) => handleSkuSelect(index, selected?.value)}
                            placeholder="Select item..."
                          />
                        </TableCell>
                        <TableCell className="min-w-[90px]">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.qty}
                            onChange={(e) => updateLineItem(index, 'qty', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                          />
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
                        <TableCell className="text-sm font-semibold">{formatCurrency(total)}</TableCell>
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
                const total = (Number(item.sellingPrice) || 0) * (Number(item.qty) || 0)
                return (
                  <div
                    key={item.id}
                    className={`border rounded-xl p-4 space-y-3 ${index % 2 === 0 ? 'bg-white border-gray-200 shadow-sm' : 'bg-blue-50/40 border-blue-100 shadow-sm'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-500">Item #{index + 1}</span>
                      {lineItems.length > 1 && (
                        <button
                          onClick={() => removeLineItem(index)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <Select
                      label="Item"
                      options={skuOptions}
                      value={skuOptions.find(o => o.value === item.sku_id) || null}
                      onChange={(selected) => handleSkuSelect(index, selected?.value)}
                      placeholder="Select item..."
                    />

                    {item.unit && (
                      <div className="text-sm text-gray-500">Unit: {item.unit}</div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
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
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Per Unit Cost</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.sellingPrice}
                          onChange={(e) => updateLineItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                        />
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm font-bold">
                        <span>Total</span>
                        <span className="text-navy-600">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        <Card>
          <CardHeader><CardTitle>Notes (optional)</CardTitle></CardHeader>
          <CardContent>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes for the quotation..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
            />
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader><CardTitle>Quotation Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                <p className="text-sm font-medium">{currencyToWords(Math.round(summary.total))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span className="text-navy-600">{formatCurrency(summary.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/quotations')}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isCreating}>
            {isCreating ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            Generate Quotation
          </Button>
        </div>
      </div>
    </div>
  )
}
