import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createInvoice, calculateInvoiceTotals } from '../../services/invoiceService'
import { downloadInvoicePDF, printInvoicePDF } from '../../services/invoicePdfService'
import { useCustomers } from '../../hooks/useCustomers'
import { useSKUs } from '../../hooks/useSKUs'
import { useCompanies } from '../../hooks/useCompanies'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import {
  Plus,
  Trash2,
  Save,
  FileText,
  Printer,
  Download,
  Calculator,
  Eye,
  AlertCircle,
  CheckCircle,
  Copy
} from 'lucide-react'

// Validation schema
const invoiceSchema = z.object({
  customer_id: z.string().min(1, 'Customer is required'),
  company_id: z.string().min(1, 'Company is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  due_date: z.string().min(1, 'Due date is required'),
  place_of_supply: z.string().optional(),
  notes: z.string().optional(),
  terms_conditions: z.string().optional(),
  items: z.array(z.object({
    sku_id: z.string().min(1, 'SKU is required'),
    quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
    unit_price: z.number().min(0.01, 'Unit price must be greater than 0'),
    gst_rate: z.number().min(0).max(100, 'GST rate must be between 0-100'),
    hsn_code: z.string().optional(),
    description: z.string().optional()
  })).min(1, 'At least one item is required')
})

export default function NewInvoicePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [calculatedTotals, setCalculatedTotals] = useState({
    subtotal_amount: 0,
    total_gst_amount: 0,
    round_off_amount: 0,
    grand_total: 0
  })
  const [previewMode, setPreviewMode] = useState(false)

  // Data hooks
  const { customers } = useCustomers()
  const { skus } = useSKUs()
  const { companies } = useCompanies()

  // Form setup
  const {
    control,
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{ quantity: 1, unit_price: 0, gst_rate: 18 }]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items'
  })

  const watchedItems = watch('items')
  const watchedCustomerId = watch('customer_id')

  // Calculate totals when items change
  useEffect(() => {
    const validItems = watchedItems?.filter(item =>
      item.sku_id && item.quantity > 0 && item.unit_price > 0
    ) || []

    if (validItems.length > 0) {
      const totals = calculateInvoiceTotals(validItems)
      setCalculatedTotals(totals)
    } else {
      setCalculatedTotals({
        subtotal_amount: 0,
        total_gst_amount: 0,
        round_off_amount: 0,
        grand_total: 0
      })
    }
  }, [watchedItems])

  // Auto-fill place of supply based on customer
  useEffect(() => {
    if (watchedCustomerId) {
      const selectedCustomer = customers.find(c => c.id === watchedCustomerId)
      if (selectedCustomer) {
        setValue('place_of_supply', selectedCustomer.billing_state)
      }
    }
  }, [watchedCustomerId, customers, setValue])

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: createInvoice,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['customers'])
      queryClient.invalidateQueries(['inventory'])

      // Show success message and redirect
      alert('Invoice created successfully!')
      navigate(`/invoices/${data.id}`)
    },
    onError: (error) => {
      console.error('Create invoice error:', error)
      alert('Failed to create invoice. Please try again.')
    }
  })

  // Form submission
  const onSubmit = useCallback(async (formData) => {
    try {
      const invoiceData = {
        ...formData,
        ...calculatedTotals,
        status: 'CONFIRMED'
      }

      await createInvoiceMutation.mutateAsync(invoiceData)
    } catch (error) {
      console.error('Submit error:', error)
    }
  }, [calculatedTotals, createInvoiceMutation])

  // Save as draft
  const saveDraft = useCallback(async () => {
    try {
      const formData = watch()
      const invoiceData = {
        ...formData,
        ...calculatedTotals,
        status: 'DRAFT'
      }

      await createInvoiceMutation.mutateAsync(invoiceData)
    } catch (error) {
      console.error('Save draft error:', error)
    }
  }, [watch, calculatedTotals, createInvoiceMutation])

  // Add new item
  const addItem = () => {
    append({ quantity: 1, unit_price: 0, gst_rate: 18 })
  }

  // Copy item
  const copyItem = (index) => {
    const item = watchedItems[index]
    append({ ...item })
  }

  // Auto-fill SKU details
  const handleSKUChange = (index, skuId) => {
    const selectedSKU = skus.find(s => s.id === skuId)
    if (selectedSKU) {
      setValue(`items.${index}.sku_id`, skuId)
      setValue(`items.${index}.unit_price`, selectedSKU.selling_price || 0)
      setValue(`items.${index}.gst_rate`, selectedSKU.gst_rate || 18)
      setValue(`items.${index}.hsn_code`, selectedSKU.hsn_code || '')
      setValue(`items.${index}.description`, selectedSKU.description || selectedSKU.sku_name)
    }
  }

  // Generate preview data for PDF
  const generatePreviewData = () => {
    const formData = watch()
    const selectedCustomer = customers.find(c => c.id === formData.customer_id)
    const selectedCompany = companies.find(c => c.id === formData.company_id)

    return {
      invoice_number: 'PREVIEW-001',
      invoice_date: formData.invoice_date,
      due_date: formData.due_date,
      place_of_supply: formData.place_of_supply,
      notes: formData.notes,
      customer: selectedCustomer || {},
      company: selectedCompany || {},
      items: formData.items?.map(item => {
        const sku = skus.find(s => s.id === item.sku_id)
        return {
          ...item,
          sku_name: sku?.sku_name || '',
          unit_of_measure: sku?.unit_of_measure || 'PCS'
        }
      }).filter(item => item.sku_id) || [],
      ...calculatedTotals
    }
  }

  // Preview PDF
  const handlePreviewPDF = () => {
    try {
      const previewData = generatePreviewData()
      if (previewData.items.length === 0) {
        alert('Please add at least one item to preview the invoice.')
        return
      }
      downloadInvoicePDF(previewData, 'Invoice_Preview.pdf')
    } catch (error) {
      console.error('Preview error:', error)
      alert('Failed to generate preview. Please check the form data.')
    }
  }

  // Prepare options for dropdowns
  const customerOptions = customers
    .filter(c => c.is_active)
    .map(c => ({
      value: c.id,
      label: `${c.customer_code} - ${c.customer_name}`
    }))

  const companyOptions = companies
    .filter(c => c.is_active)
    .map(c => ({
      value: c.id,
      label: c.company_name
    }))

  const skuOptions = skus
    .filter(s => s.is_active)
    .map(s => ({
      value: s.id,
      label: `${s.sku_code} - ${s.sku_name}`,
      price: s.selling_price,
      gstRate: s.gst_rate
    }))

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  return (
    <div>
      <PageHeader
        title="Create New Invoice"
        description="Generate professional GST-compliant invoices"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handlePreviewPDF}
              disabled={!watchedItems?.some(item => item.sku_id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview PDF
            </Button>
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Controller
              name="customer_id"
              control={control}
              render={({ field }) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer *
                  </label>
                  <Select
                    {...field}
                    options={customerOptions}
                    placeholder="Select customer"
                    error={errors.customer_id?.message}
                  />
                </div>
              )}
            />

            <Controller
              name="company_id"
              control={control}
              render={({ field }) => (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company *
                  </label>
                  <Select
                    {...field}
                    options={companyOptions}
                    placeholder="Select company"
                    error={errors.company_id?.message}
                  />
                </div>
              )}
            />

            <Input
              label="Invoice Date *"
              type="date"
              {...register('invoice_date')}
              error={errors.invoice_date?.message}
            />

            <Input
              label="Due Date *"
              type="date"
              {...register('due_date')}
              error={errors.due_date?.message}
            />

            <Input
              label="Place of Supply"
              {...register('place_of_supply')}
              placeholder="e.g., Maharashtra"
            />
          </CardContent>
        </Card>

        {/* Invoice Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice Items</CardTitle>
            <Button type="button" onClick={addItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Item {index + 1}</h4>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyItem(index)}
                        title="Copy item"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Controller
                      name={`items.${index}.sku_id`}
                      control={control}
                      render={({ field }) => (
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            SKU *
                          </label>
                          <Select
                            {...field}
                            options={skuOptions}
                            placeholder="Select SKU"
                            onChange={(selected) => handleSKUChange(index, selected?.value)}
                            error={errors.items?.[index]?.sku_id?.message}
                          />
                        </div>
                      )}
                    />

                    <Input
                      label="Quantity *"
                      type="number"
                      step="0.01"
                      min="0.01"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      error={errors.items?.[index]?.quantity?.message}
                    />

                    <Input
                      label="Unit Price *"
                      type="number"
                      step="0.01"
                      min="0"
                      {...register(`items.${index}.unit_price`, { valueAsNumber: true })}
                      error={errors.items?.[index]?.unit_price?.message}
                    />

                    <Input
                      label="GST Rate (%)"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...register(`items.${index}.gst_rate`, { valueAsNumber: true })}
                      error={errors.items?.[index]?.gst_rate?.message}
                    />

                    <Input
                      label="HSN Code"
                      {...register(`items.${index}.hsn_code`)}
                      placeholder="e.g., 7601"
                    />

                    <div className="lg:col-span-2">
                      <Input
                        label="Description"
                        {...register(`items.${index}.description`)}
                        placeholder="Additional item description"
                      />
                    </div>

                    {/* Item totals */}
                    {watchedItems?.[index]?.quantity > 0 && watchedItems?.[index]?.unit_price > 0 && (
                      <div className="lg:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Line Total
                        </label>
                        <div className="p-2 bg-white rounded border">
                          <div className="text-sm">
                            <div>Amount: {formatCurrency(watchedItems[index].quantity * watchedItems[index].unit_price)}</div>
                            <div>GST: {formatCurrency((watchedItems[index].quantity * watchedItems[index].unit_price * (watchedItems[index].gst_rate || 0)) / 100)}</div>
                            <div className="font-semibold border-t pt-1 mt-1">
                              Total: {formatCurrency(
                                (watchedItems[index].quantity * watchedItems[index].unit_price) +
                                ((watchedItems[index].quantity * watchedItems[index].unit_price * (watchedItems[index].gst_rate || 0)) / 100)
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {errors.items && (
              <div className="text-red-600 text-sm mt-2 flex items-center">
                <AlertCircle className="h-4 w-4 mr-1" />
                {errors.items.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Totals */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calculator className="h-5 w-5 mr-2" />
              Invoice Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left side - Additional details */}
              <div className="space-y-4">
                <Input
                  label="Notes"
                  {...register('notes')}
                  placeholder="Additional notes for this invoice"
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Terms & Conditions
                  </label>
                  <textarea
                    {...register('terms_conditions')}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows="4"
                    placeholder="Payment terms, delivery conditions, etc."
                  />
                </div>
              </div>

              {/* Right side - Totals */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Invoice Totals</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(calculatedTotals.subtotal_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>GST Amount:</span>
                    <span>{formatCurrency(calculatedTotals.total_gst_amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Round Off:</span>
                    <span>{formatCurrency(calculatedTotals.round_off_amount)}</span>
                  </div>
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-xl font-bold">
                      <span>Grand Total:</span>
                      <span className="text-primary-600">
                        {formatCurrency(calculatedTotals.grand_total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <Card>
          <CardContent className="flex flex-col sm:flex-row gap-4 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/invoices')}
            >
              Cancel
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={saveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? <Spinner size="sm" className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save as Draft
            </Button>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[140px]"
            >
              {isSubmitting ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Create Invoice
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}