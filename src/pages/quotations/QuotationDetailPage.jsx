import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { currencyToWords } from '../../utils/numberToWords'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { downloadQuotationPDF } from '../../pdf/QuotationPDF'
import {
  ArrowLeft, Calendar, Building, FileText, AlertTriangle, XCircle, Download
} from 'lucide-react'
import toast from 'react-hot-toast'

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function QuotationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // Fetch company for PDF
  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(1).single()
      if (error) throw error
      return data
    }
  })

  // Fetch quotation
  const { data: quotation, isLoading, error } = useQuery({
    queryKey: ['quotation-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_quotations')
        .select(`
          *,
          customers(*),
          sales_quotation_items(
            *,
            sku:skus(id, sku_code, sku_name, unit_of_measure)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancellationReason.trim()) throw new Error('Cancellation reason is required')
      const { error } = await supabase
        .from('sales_quotations')
        .update({ status: 'CANCELLED', notes: cancellationReason })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success('Quotation cancelled')
      setCancelModalOpen(false)
      setCancellationReason('')
    },
    onError: (error) => {
      toast.error('Failed to cancel: ' + error.message)
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error || !quotation) {
    return (
      <div>
        <PageHeader title="Quotation Not Found" description="The requested quotation could not be loaded" />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">{error?.message || 'Quotation not found'}</p>
            <Button onClick={() => navigate('/quotations')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Quotations
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActive = quotation.status === 'ACTIVE'
  const isCancelled = quotation.status === 'CANCELLED'
  const items = quotation.sales_quotation_items || []
  const customer = quotation.customers || {}

  return (
    <div>
      <PageHeader
        title={`Quotation ${quotation.quotation_uid}`}
        description={`Created on ${formatDate(quotation.quotation_date)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/quotations')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setIsDownloading(true)
                try {
                  await downloadQuotationPDF(quotation, company)
                  toast.success('PDF downloaded')
                } catch (e) {
                  toast.error('PDF generation failed: ' + e.message)
                } finally {
                  setIsDownloading(false)
                }
              }}
              disabled={isDownloading}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
            {isActive && (
              <Button
                variant="outline"
                className="text-red-600 hover:text-red-800 border-red-300"
                onClick={() => setCancelModalOpen(true)}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancel Quotation
              </Button>
            )}
          </div>
        }
      />

      {isCancelled && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800 flex items-center gap-2">
              CANCELLED
              <Badge variant="danger">CANCELLED</Badge>
            </div>
            {quotation.notes && (
              <p className="text-sm text-red-700 mt-1">Reason: {quotation.notes}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Quotation & Customer Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Quotation Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Quotation UID:</span>
                <span className="font-medium">{quotation.quotation_uid}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Date:</span>
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                  {formatDate(quotation.quotation_date)}
                </span>
              </div>
              {quotation.validity_date && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Valid Until:</span>
                  <span>{formatDate(quotation.validity_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                {isActive && <Badge variant="info">ACTIVE</Badge>}
                {isCancelled && <Badge variant="danger">CANCELLED</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Name</div>
                <div className="font-medium">{customer.customer_name || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Location</div>
                <div>{customer.billing_city}, {customer.billing_state}</div>
              </div>
              {customer.phone && (
                <div>
                  <div className="text-sm text-gray-600">Phone</div>
                  <div>{customer.phone}</div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Items ({items.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>S.No</TableHeader>
                    <TableHeader>Item Name</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Per Unit Cost</TableHeader>
                    <TableHeader>Total</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.sku?.sku_name || '-'}</div>
                        <div className="text-xs text-gray-500">{item.sku?.sku_code || ''}</div>
                      </TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.sku?.unit_of_measure || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {items.map((item, index) => (
                <div key={item.id} className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{item.sku?.sku_name || '-'}</div>
                      <div className="text-xs text-gray-500">{item.sku?.sku_code || ''}</div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500 text-xs block">Qty</span>
                      <span className="font-medium">{item.quantity} {item.sku?.unit_of_measure || ''}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Rate</span>
                      <span className="font-medium">{formatCurrency(item.rate)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-xs block">Total</span>
                      <span className="font-bold text-navy-600">{formatCurrency(item.amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader><CardTitle>Quotation Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                <p className="text-sm font-medium">{currencyToWords(Math.round(quotation.total_amount || 0))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span className="text-navy-600">{formatCurrency(quotation.total_amount)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Quotation"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-700">
                This action will mark the quotation as cancelled.
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Enter the reason..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCancelModalOpen(false)}>
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              disabled={!cancellationReason.trim() || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
