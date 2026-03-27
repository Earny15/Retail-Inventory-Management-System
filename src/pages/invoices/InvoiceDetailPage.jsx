import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PermissionGate from '../../components/shared/PermissionGate'
import { currencyToWords } from '../../utils/numberToWords'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { downloadInvoicePDF, blobToDataUri } from '../../pdf/InvoicePDF'
import { uploadInvoicePDFToStorage } from '../../services/invoicePdfService'
import { sendWhatsAppInvoice, extractPdfFilename } from '../../services/twilioService'
import {
  ArrowLeft,
  Calendar,
  Building,
  FileText,
  AlertTriangle,
  XCircle,
  Download,
  Copy,
  Send,
  Plus,
  Trash2
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

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, hasPermission } = useAuth()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [vehicleNo, setVehicleNo] = useState('')
  const [ewayBillNo, setEwayBillNo] = useState('')
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false)
  const [whatsappPhones, setWhatsappPhones] = useState([''])

  // Fetch company for PDF
  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(1).single()
      if (error) throw error
      return data
    }
  })

  // Fetch invoice
  const {
    data: invoice,
    isLoading,
    error
  } = useQuery({
    queryKey: ['invoice-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          customers(id, customer_name, phone, email, billing_address_line1, billing_address_line2, billing_city, billing_state, billing_pincode, shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, shipping_pincode, gstin),
          customer_invoice_items(
            *,
            sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code)
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  // Cancel invoice mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancellationReason.trim()) throw new Error('Cancellation reason is required')

      // Step 1: Update invoice status to CANCELLED
      const { error: updateError } = await supabase
        .from('customer_invoices')
        .update({
          status: 'CANCELLED',
          notes: cancellationReason
        })
        .eq('id', id)

      if (updateError) throw updateError

      // Step 2: Restore inventory for all items
      const allItems = invoice.customer_invoice_items || []
      for (const item of allItems) {
        const { data: inv } = await supabase
          .from('inventory')
          .select('current_stock')
          .eq('sku_id', item.sku_id)
          .single()

        if (inv) {
          const { error: invError } = await supabase
            .from('inventory')
            .update({ current_stock: inv.current_stock + (item.quantity || 0) })
            .eq('sku_id', item.sku_id)
          if (invError) throw invError
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success('Invoice cancelled successfully')
      setCancelModalOpen(false)
      setCancellationReason('')
    },
    onError: (error) => {
      toast.error('Failed to cancel invoice: ' + error.message)
    }
  })

  // Generate public link mutation
  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      if (!invoice || !company) throw new Error('Invoice or company data not available')

      // Pass raw invoice + company directly - same format as Download PDF uses
      const publicUrl = await uploadInvoicePDFToStorage(invoice, company)

      // Update invoice with public URL
      const { error } = await supabase
        .from('customer_invoices')
        .update({ public_pdf_url: publicUrl })
        .eq('id', id)

      if (error) throw error

      return publicUrl
    },
    onSuccess: (publicUrl) => {
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      toast.success('Public link generated successfully!')
      navigator.clipboard.writeText(publicUrl)
      toast.success('Link copied to clipboard!')
    },
    onError: (error) => {
      toast.error('Failed to generate public link: ' + error.message)
    }
  })

  // Send WhatsApp mutation
  const whatsappMutation = useMutation({
    mutationFn: async (phones) => {
      if (!invoice?.public_pdf_url) throw new Error('Generate a public link first')
      const pdfFilename = extractPdfFilename(invoice.public_pdf_url)
      const customerName = invoice.customers?.customer_name || ''
      const invoiceNumber = invoice.invoice_number || ''
      const invoiceDate = formatDate(invoice.invoice_date)

      const results = []
      for (const phone of phones) {
        if (!phone.trim()) continue
        const result = await sendWhatsAppInvoice({
          invoiceId: invoice.id,
          toPhone: phone.trim(),
          customerName,
          invoiceNumber,
          invoiceDate,
          pdfFilename,
          sentBy: user?.id
        })
        results.push(result)
      }
      return results
    },
    onSuccess: (results) => {
      toast.success(`WhatsApp sent to ${results.length} number(s)!`)
      setWhatsappModalOpen(false)
    },
    onError: (error) => {
      toast.error('Failed to send WhatsApp: ' + error.message)
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div>
        <PageHeader title="Invoice Not Found" description="The requested invoice could not be loaded" />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">{error?.message || 'Invoice not found'}</p>
            <Button onClick={() => navigate('/invoices')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isActive = invoice.status === 'ACTIVE'
  const isCancelled = invoice.status === 'CANCELLED'
  const isIntraState = (invoice.cgst_amount || 0) > 0 || (invoice.igst_amount || 0) === 0

  const includedItems = invoice.customer_invoice_items || []
  const excludedItems = []

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`Created on ${formatDate(invoice.invoice_date)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Load saved values for this invoice from localStorage
                const saved = JSON.parse(localStorage.getItem(`invoice-pdf-${invoice.id}`) || '{}')
                setVehicleNo(saved.vehicleNo || '')
                setEwayBillNo(saved.ewayBillNo || '')
                setDownloadModalOpen(true)
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => generateLinkMutation.mutate()}
              disabled={generateLinkMutation.isPending}
            >
              <FileText className="h-4 w-4 mr-2" />
              {generateLinkMutation.isPending ? 'Generating...' : 'Generate Public Link'}
            </Button>
            <Button
              variant="outline"
              className="text-green-600 hover:text-green-800 border-green-300"
              onClick={() => {
                if (!invoice.public_pdf_url) {
                  toast.error('Please generate a public link first')
                  return
                }
                setWhatsappPhones([invoice.customers?.phone || ''])
                setWhatsappModalOpen(true)
              }}
            >
              <Send className="h-4 w-4 mr-2" />
              Send WhatsApp
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/whatsapp-logs?invoice=${invoice.id}`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              WA Logs
            </Button>
            {isActive && (
              <PermissionGate module="customer_invoice" action="edit">
                <Button
                  variant="outline"
                  className="text-red-600 hover:text-red-800 border-red-300"
                  onClick={() => setCancelModalOpen(true)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Invoice
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      {/* Cancelled banner */}
      {isCancelled && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800 flex items-center gap-2">
              CANCELLED
              <Badge variant="danger">CANCELLED</Badge>
            </div>
            {invoice.notes && (
              <p className="text-sm text-red-700 mt-1">Reason: {invoice.notes}</p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Invoice Header Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Invoice Number:</span>
                <span className="font-medium">{invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Date:</span>
                <span className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                  {formatDate(invoice.invoice_date)}
                </span>
              </div>
              {invoice.due_date && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Due Date:</span>
                  <span>{formatDate(invoice.due_date)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Status:</span>
                {isActive && <Badge variant="info">ACTIVE</Badge>}
                {isCancelled && <Badge variant="danger">CANCELLED</Badge>}
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">GST Type:</span>
                {isIntraState ? (
                  <Badge variant="success">CGST + SGST</Badge>
                ) : (
                  <Badge variant="purple">IGST</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Public Link */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Public PDF Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.public_pdf_url ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Shareable Link</div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={invoice.public_pdf_url}
                        readOnly
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
                      />
                      <Button
                        size="sm"
                        onClick={() => {
                          navigator.clipboard.writeText(invoice.public_pdf_url)
                          toast.success('Link copied to clipboard!')
                        }}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">
                    This link can be shared publicly without authentication
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  No public link generated yet. Click "Generate Public Link" to create one.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="h-5 w-5 mr-2" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {invoice.customers ? (
                <>
                  <div>
                    <div className="text-sm text-gray-600">Name</div>
                    <div className="font-medium">{invoice.customers.customer_name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">Location</div>
                    <div>{invoice.customers.billing_city}, {invoice.customers.billing_state}</div>
                  </div>
                  {invoice.customers.gstin && (
                    <div>
                      <div className="text-sm text-gray-600">GSTIN</div>
                      <div className="font-mono">{invoice.customers.gstin}</div>
                    </div>
                  )}
                  {invoice.customers.phone && (
                    <div>
                      <div className="text-sm text-gray-600">Phone</div>
                      <div>{invoice.customers.phone}</div>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-gray-500">Customer information not available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Line Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items ({includedItems.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>HSN</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Rate (Incl.)</TableHeader>
                    <TableHeader>Taxable Amt</TableHeader>
                    <TableHeader>GST %</TableHeader>
                    {isIntraState ? (
                      <>
                        <TableHeader>CGST</TableHeader>
                        <TableHeader>SGST</TableHeader>
                      </>
                    ) : (
                      <TableHeader>IGST</TableHeader>
                    )}
                    <TableHeader>Total</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {includedItems.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.sku?.sku_name || '-'}</div>
                        <div className="text-xs text-gray-500">{item.sku?.sku_code || ''}</div>
                      </TableCell>
                      <TableCell>{item.sku?.hsn_code || '-'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.sku?.unit_of_measure || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.rate)}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                      <TableCell>{item.gst_rate || 0}%</TableCell>
                      {isIntraState ? (
                        <>
                          <TableCell>{formatCurrency((item.gst_amount || 0) / 2)}</TableCell>
                          <TableCell>{formatCurrency((item.gst_amount || 0) / 2)}</TableCell>
                        </>
                      ) : (
                        <TableCell>{formatCurrency(item.gst_amount)}</TableCell>
                      )}
                      <TableCell className="font-semibold">{formatCurrency(item.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {includedItems.map((item, index) => (
                <div
                  key={item.id}
                  className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-slate-50 border-slate-200'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-gray-900">{item.sku?.sku_name || '-'}</div>
                      <div className="text-xs text-gray-500">{item.sku?.sku_code || ''}</div>
                    </div>
                    <span className="text-xs font-medium text-gray-400">#{index + 1}</span>
                  </div>
                  {item.sku?.hsn_code && (
                    <div className="text-xs text-gray-500">HSN: {item.sku.hsn_code}</div>
                  )}
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
                      <span className="text-gray-500 text-xs block">GST</span>
                      <span className="font-medium">{item.gst_rate || 0}%</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-2.5 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500">Taxable</span>
                      <span>{formatCurrency(item.amount)}</span>
                    </div>
                    {isIntraState ? (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">CGST</span>
                          <span>{formatCurrency((item.gst_amount || 0) / 2)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">SGST</span>
                          <span>{formatCurrency((item.gst_amount || 0) / 2)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">IGST</span>
                        <span>{formatCurrency(item.gst_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1">
                      <span>Total</span>
                      <span className="text-navy-600">{formatCurrency(item.total_amount)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                <p className="text-sm font-medium">{currencyToWords(Math.round(invoice.total_amount || 0))}</p>
              </div>

              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sub-total (Taxable):</span>
                  <span>{formatCurrency(invoice.subtotal)}</span>
                </div>
                {isIntraState ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>CGST:</span>
                      <span>{formatCurrency(invoice.cgst_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST:</span>
                      <span>{formatCurrency(invoice.sgst_amount)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>IGST:</span>
                    <span>{formatCurrency(invoice.igst_amount)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total:</span>
                    <span className="text-navy-600">{formatCurrency(invoice.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Excluded Items */}
        {excludedItems.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-gray-500">Excluded Items ({excludedItems.length})</CardTitle>
              <p className="text-sm text-gray-400 mt-1">
                These items were excluded from the invoice and did not affect inventory.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>#</TableHeader>
                      <TableHeader>SKU</TableHeader>
                      <TableHeader>Qty</TableHeader>
                      <TableHeader>Rate</TableHeader>
                      <TableHeader>Total</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {excludedItems.map((item, index) => (
                      <TableRow key={item.id} className="bg-gray-50 opacity-60">
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <div className="font-medium">{item.sku?.sku_name || '-'}</div>
                        </TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{formatCurrency(item.rate)}</TableCell>
                        <TableCell>{formatCurrency(item.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Download PDF Modal */}
      <Modal
        isOpen={downloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        title="Download Invoice PDF"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter transport details if applicable. These will be saved for this invoice.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number</label>
              <input
                type="text"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                placeholder="e.g. KA01AB1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-Way Bill No.</label>
              <input
                type="text"
                value={ewayBillNo}
                onChange={(e) => setEwayBillNo(e.target.value)}
                placeholder="e.g. 1234567890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setDownloadModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={isDownloading}
              onClick={async () => {
                setIsDownloading(true)
                try {
                  // Fetch logo via Supabase Storage to avoid CORS issues
                  let logoDataUri = null
                  if (company?.logo_url) {
                    try {
                      const urlParts = company.logo_url.split('/company-logos/')
                      if (urlParts[1]) {
                        const filePath = decodeURIComponent(urlParts[1])
                        const { data: logoBlob } = await supabase.storage.from('company-logos').download(filePath)
                        if (logoBlob) logoDataUri = await blobToDataUri(logoBlob)
                      }
                    } catch (e) {
                      console.warn('Logo fetch failed:', e)
                    }
                  }
                  // Save values to localStorage for next time
                  localStorage.setItem(`invoice-pdf-${invoice.id}`, JSON.stringify({ vehicleNo, ewayBillNo }))
                  await downloadInvoicePDF(invoice, company, { vehicleNo, ewayBillNo, logoDataUri })
                  toast.success('PDF downloaded')
                  setDownloadModalOpen(false)
                } catch (e) {
                  toast.error('PDF generation failed: ' + e.message)
                } finally {
                  setIsDownloading(false)
                }
              }}
            >
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send WhatsApp Modal */}
      <Modal
        isOpen={whatsappModalOpen}
        onClose={() => setWhatsappModalOpen(false)}
        title="Send Invoice via WhatsApp"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Send invoice <strong>{invoice?.invoice_number}</strong> to the customer via WhatsApp.
          </p>

          {/* Phone Numbers */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Numbers <span className="text-red-500">*</span>
            </label>
            {whatsappPhones.map((phone, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const updated = [...whatsappPhones]
                    updated[index] = e.target.value
                    setWhatsappPhones(updated)
                  }}
                  placeholder="+919876543210"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-400 focus:border-green-400"
                />
                {whatsappPhones.length > 1 && (
                  <button
                    onClick={() => setWhatsappPhones(prev => prev.filter((_, i) => i !== index))}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setWhatsappPhones(prev => [...prev, ''])}
              className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800 mt-1"
            >
              <Plus className="h-3 w-3" /> Add another number
            </button>
            <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +91 for India)</p>
          </div>

          {/* Preview */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-gray-600">Message Preview:</p>
            <p className="text-xs text-gray-700">
              Hello <strong>{invoice?.customers?.customer_name || '...'}</strong>,
            </p>
            <p className="text-xs text-gray-700">
              Invoice <strong>{invoice?.invoice_number}</strong> dated <strong>{formatDate(invoice?.invoice_date)}</strong> from Apex Aluminium is attached.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              + Invoice PDF will be attached
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setWhatsappModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => whatsappMutation.mutate(whatsappPhones)}
              disabled={!whatsappPhones.some(p => p.trim()) || whatsappMutation.isPending}
            >
              <Send className="h-4 w-4 mr-2" />
              {whatsappMutation.isPending ? 'Sending...' : `Send to ${whatsappPhones.filter(p => p.trim()).length} number(s)`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Invoice Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Cancel Invoice"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800 mb-1">Warning</div>
                <div className="text-yellow-700">
                  Cancelling this invoice will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Mark the invoice as CANCELLED</li>
                    <li>Restore inventory for included items</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cancellation Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Enter the reason for cancelling this invoice..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelMutation.isPending}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() => cancelMutation.mutate()}
              disabled={!cancellationReason.trim() || cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <Spinner size="sm" className="mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
