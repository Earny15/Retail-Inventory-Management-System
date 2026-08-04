import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currencyToWords } from '../../utils/numberToWords'
import { nextNoteKeepingNumber, logNoteKeepingActivity } from '../../services/noteKeepingService'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Plus, Trash2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2
}).format(amount || 0)

const todayISO = () => new Date().toISOString().split('T')[0]

export default function NewNoteKeepingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { id: editingId } = useParams()
  const isEditMode = !!editingId

  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')
  const initialItemId = useRef(Date.now()).current
  const [lineItems, setLineItems] = useState([
    { id: initialItemId, sku_id: null, qty: '', unit: '', rate: 0 }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [expandedItemId, setExpandedItemId] = useState(initialItemId)
  const itemRefs = useRef({})
  const [editPrepopulated, setEditPrepopulated] = useState(false)

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

  const { data: skus = [] } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, sku_code, sku_name, unit_of_measure, selling_price')
        .order('sku_name')
      if (error) throw error
      return data
    }
  })

  const { data: existing, isLoading: existingLoading } = useQuery({
    queryKey: ['nk-edit', editingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_keeping_invoices')
        .select('*, note_keeping_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure))')
        .eq('id', editingId).single()
      if (error) throw error
      return data
    },
    enabled: isEditMode
  })

  useEffect(() => {
    if (!isEditMode || !existing || editPrepopulated) return
    setSelectedCustomerId(existing.customer_id)
    setInvoiceDate(existing.invoice_date)
    setDueDate(existing.due_date || '')
    const dbItems = existing.note_keeping_invoice_items || []
    const mapped = dbItems.length
      ? dbItems.map((it, idx) => ({
          id: Date.now() + idx,
          sku_id: it.sku_id,
          qty: it.quantity ?? '',
          unit: it.sku?.unit_of_measure || '',
          rate: Number(it.rate) || 0
        }))
      : [{ id: Date.now(), sku_id: null, qty: '', unit: '', rate: 0 }]
    setLineItems(mapped)
    setExpandedItemId(mapped[0]?.id || null)
    setEditPrepopulated(true)
  }, [isEditMode, existing, editPrepopulated])

  const customerOptions = useMemo(() => customers.map(c => ({
    value: c.id, label: `${c.customer_name} - ${c.billing_city || ''}`
  })), [customers])

  const skuOptions = useMemo(() => skus.map(s => ({
    value: s.id, label: s.sku_name
  })), [skus])

  const summary = useMemo(() => {
    let total = 0
    lineItems.forEach(item => {
      total += (Number(item.rate) || 0) * (Number(item.qty) || 0)
    })
    return { total }
  }, [lineItems])

  const scrollToItem = (id) => setTimeout(() => {
    const el = itemRefs.current[id]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 80)

  const addLineItem = () => {
    const newId = Date.now()
    setLineItems(prev => [...prev, { id: newId, sku_id: null, qty: '', unit: '', rate: 0 }])
    setExpandedItemId(newId)
    scrollToItem(newId)
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
    if (!sku) return
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = {
        ...updated[index],
        sku_id: skuId,
        unit: sku.unit_of_measure || '',
        rate: sku.selling_price || 0
      }
      return updated
    })
  }

  const validate = () => {
    if (!invoiceDate) { toast.error('Please select a date'); return false }
    const valid = lineItems.filter(i => i.sku_id && Number(i.qty) > 0 && Number(i.rate) > 0)
    if (valid.length === 0) {
      toast.error('At least one item with SKU, quantity and rate is required')
      return false
    }
    if (lineItems.some(i => !i.sku_id)) {
      toast.error('All line items must have a SKU selected')
      return false
    }
    return true
  }

  const handleCreate = async () => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const { invoiceNumber, nextSeries, company } = await nextNoteKeepingNumber()
      const { data: invoiceRecord, error } = await supabase
        .from('note_keeping_invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          customer_id: selectedCustomerId,
          status: 'ACTIVE',
          total_amount: summary.total,
          created_by: user?.id
        })
        .select()
        .single()
      if (error) throw error

      const itemRows = lineItems
        .filter(i => i.sku_id && Number(i.qty) > 0 && Number(i.rate) > 0)
        .map(i => ({
          invoice_id: invoiceRecord.id,
          sku_id: i.sku_id,
          quantity: Number(i.qty),
          rate: Number(i.rate),
          amount: Number(i.qty) * Number(i.rate)
        }))
      if (itemRows.length) {
        const { error: insErr } = await supabase.from('note_keeping_invoice_items').insert(itemRows)
        if (insErr) throw insErr
      }

      try {
        await supabase
          .from('companies')
          .update({ note_keeping_number_series: nextSeries })
          .eq('id', company.id)
      } catch (e) { console.warn('NK series bump failed:', e) }

      const createdItems = lineItems.filter(i => i.sku_id).map(i => {
        const s = skus.find(x => x.id === i.sku_id)
        return { sku_name: s?.sku_name || 'Unknown', qty: i.qty }
      })
      await logNoteKeepingActivity({
        invoiceId: invoiceRecord.id,
        action: 'created',
        details: { total: summary.total, items_count: createdItems.length, items: createdItems },
        actor: user
      })

      queryClient.invalidateQueries({ queryKey: ['nk-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['company-first'] })
      toast.success(`Note Keeping ${invoiceNumber} created`)
      navigate(`/note-keeping/${invoiceRecord.id}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to save: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!validate()) return
    setIsSubmitting(true)
    try {
      const { error: updErr } = await supabase
        .from('note_keeping_invoices')
        .update({
          invoice_date: invoiceDate,
          due_date: dueDate || null,
          customer_id: selectedCustomerId,
          total_amount: summary.total
        })
        .eq('id', editingId)
      if (updErr) throw updErr

      const { error: delErr } = await supabase
        .from('note_keeping_invoice_items').delete().eq('invoice_id', editingId)
      if (delErr) throw delErr

      const itemRows = lineItems
        .filter(i => i.sku_id && Number(i.qty) > 0 && Number(i.rate) > 0)
        .map(i => ({
          invoice_id: editingId,
          sku_id: i.sku_id,
          quantity: Number(i.qty),
          rate: Number(i.rate),
          amount: Number(i.qty) * Number(i.rate)
        }))
      if (itemRows.length) {
        const { error: insErr } = await supabase.from('note_keeping_invoice_items').insert(itemRows)
        if (insErr) throw insErr
      }

      await logNoteKeepingActivity({
        invoiceId: editingId,
        action: 'updated',
        details: { next_total: summary.total },
        actor: user
      })

      queryClient.invalidateQueries({ queryKey: ['nk-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['nk-detail', editingId] })
      queryClient.invalidateQueries({ queryKey: ['nk-activity', editingId] })
      toast.success('Note Keeping updated')
      navigate(`/note-keeping/${editingId}`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to update: ' + err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = () => (isEditMode ? handleUpdate() : handleCreate())

  if (isEditMode && existingLoading) {
    return <div className="flex items-center justify-center min-h-96"><Spinner size="xl" /></div>
  }

  return (
    <div>
      <div className="mb-3 sm:mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isEditMode ? `Edit ${existing?.invoice_number || ''}` : 'New Note Keeping'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">
            {isEditMode ? 'Update items or dates.' : 'Non-GST cash / memo entry — no tax breakdown.'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(isEditMode ? `/note-keeping/${editingId}` : '/note-keeping')}>
          Back
        </Button>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Party & Date</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select
                label="Customer (optional)"
                options={customerOptions}
                value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                onChange={(s) => setSelectedCustomerId(s?.value || null)}
                placeholder="Search customer..."
                isClearable
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
                <Input label="Due Date (optional)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Rate</TableHeader>
                    <TableHeader>Amount</TableHeader>
                    <TableHeader></TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => {
                    const amount = (Number(item.rate) || 0) * (Number(item.qty) || 0)
                    const rowAlt = index % 2 === 0 ? 'bg-white' : 'bg-blue-50/40'
                    return (
                      <TableRow
                        key={item.id}
                        ref={(el) => { if (el) itemRefs.current[item.id] = el }}
                        className={rowAlt}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(o => o.value === item.sku_id) || null}
                            onChange={(s) => handleSkuSelect(index, s?.value)}
                            placeholder="Select SKU..."
                          />
                        </TableCell>
                        <TableCell className="min-w-[90px]">
                          <input
                            type="number" min="0" step="0.01"
                            value={item.qty}
                            onChange={(e) => updateLineItem(index, 'qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                          />
                        </TableCell>
                        <TableCell><span className="text-sm">{item.unit || '-'}</span></TableCell>
                        <TableCell className="min-w-[110px]">
                          <input
                            type="number" min="0" step="0.01"
                            value={item.rate}
                            onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-semibold">{formatCurrency(amount)}</TableCell>
                        <TableCell>
                          {lineItems.length > 1 && (
                            <button onClick={() => removeLineItem(index)} className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded">
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

            {/* Mobile — accordion */}
            <div className="lg:hidden space-y-3">
              {lineItems.map((item, index) => {
                const amount = (Number(item.rate) || 0) * (Number(item.qty) || 0)
                const isExpanded = expandedItemId === item.id
                const skuLabel = skuOptions.find(o => o.value === item.sku_id)?.label
                const altBg = index % 2 === 0 ? 'bg-white border-gray-200 shadow-sm' : 'bg-blue-50/50 border-blue-100 shadow-sm'
                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) itemRefs.current[item.id] = el }}
                    className={`border rounded-xl ${altBg}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                          <span className={`text-sm font-medium truncate ${item.sku_id ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                            {skuLabel || 'No SKU selected'}
                          </span>
                        </div>
                        {item.sku_id && (
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            <span>{item.qty} {item.unit || ''}</span>
                            <span>×</span>
                            <span>{formatCurrency(item.rate)}</span>
                            <span className="ml-auto font-semibold text-navy-600">{formatCurrency(amount)}</span>
                          </div>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-100 pt-3">
                        <Select
                          label="SKU"
                          options={skuOptions}
                          value={skuOptions.find(o => o.value === item.sku_id) || null}
                          onChange={(s) => handleSkuSelect(index, s?.value)}
                          placeholder="Select SKU..."
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.qty}
                              onChange={(e) => updateLineItem(index, 'qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Rate</label>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.rate}
                              onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 flex justify-between text-sm font-bold">
                          <span>Amount</span>
                          <span className="text-navy-600">{formatCurrency(amount)}</span>
                        </div>
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4 inline mr-1" />
                            Remove
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={addLineItem}
                className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-navy-400 hover:bg-navy-50 rounded-xl text-gray-700 hover:text-navy-700 transition flex items-center justify-center font-medium"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Item
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                <p className="text-sm font-medium">{currencyToWords(Math.round(summary.total))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-navy-600">{formatCurrency(summary.total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate(isEditMode ? `/note-keeping/${editingId}` : '/note-keeping')}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" className="mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            {isEditMode ? 'Save Changes' : 'Create Note Keeping'}
          </Button>
        </div>
      </div>
    </div>
  )
}
