import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PermissionGate from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { downloadInvoicePDF, blobToDataUri } from '../../pdf/InvoicePDF'
import { generateInvoiceReportPDF, generateInvoiceReportCSV } from '../../utils/reportGenerator'
import {
  Plus,
  Search,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  FileDown
} from 'lucide-react'
import toast from 'react-hot-toast'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CANCELLED', label: 'Cancelled' }
]

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

export default function InvoiceListPage() {
  const navigate = useNavigate()
  const { user, hasPermission } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportFromDate, setReportFromDate] = useState('')
  const [reportToDate, setReportToDate] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Download modal state
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadInvoiceId, setDownloadInvoiceId] = useState(null)
  const [vehicleNo, setVehicleNo] = useState('')
  const [ewayBillNo, setEwayBillNo] = useState('')
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

  // Fetch customers for filter dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name')
        .order('customer_name')
      if (error) throw error
      return data
    }
  })

  const customerOptions = useMemo(() => [
    { value: '', label: 'All Customers' },
    ...customers.map(c => ({ value: c.id, label: c.customer_name }))
  ], [customers])

  const {
    data: queryResult,
    isLoading,
    error
  } = useQuery({
    queryKey: ['invoices', statusFilter, customerFilter, startDate, endDate, searchTerm, page],
    queryFn: async () => {
      let query = supabase
        .from('customer_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          customer_id,
          status,
          total_amount,
          cgst_amount,
          igst_amount,
          customers(customer_name),
          customer_invoice_items(id)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (statusFilter) query = query.eq('status', statusFilter)
      if (customerFilter) query = query.eq('customer_id', customerFilter)
      if (startDate) query = query.gte('invoice_date', startDate)
      if (endDate) query = query.lte('invoice_date', endDate)
      if (searchTerm) query = query.ilike('invoice_number', `%${searchTerm}%`)

      const { data, error, count } = await query
      if (error) throw error
      return { invoices: data || [], totalCount: count || 0 }
    }
  })

  const invoices = queryResult?.invoices || []
  const totalCount = queryResult?.totalCount || 0
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const getStatusBadge = (status) => {
    if (status === 'ACTIVE') return <Badge variant="info">ACTIVE</Badge>
    if (status === 'CANCELLED') return <Badge variant="danger">CANCELLED</Badge>
    return <Badge variant="default">{status}</Badge>
  }

  const getGstBadge = (gstType) => {
    if (gstType === 'CGST_SGST') return <Badge variant="success">CGST+SGST</Badge>
    if (gstType === 'IGST') return <Badge variant="purple">IGST</Badge>
    return <Badge variant="default">{gstType || '-'}</Badge>
  }

  const openDownloadModal = (invoiceId) => {
    const saved = JSON.parse(localStorage.getItem(`invoice-pdf-${invoiceId}`) || '{}')
    setVehicleNo(saved.vehicleNo || '')
    setEwayBillNo(saved.ewayBillNo || '')
    setDownloadInvoiceId(invoiceId)
    setDownloadModalOpen(true)
  }

  const handleDownloadPDF = async () => {
    if (!downloadInvoiceId) return
    setIsDownloading(true)
    try {
      const { data: fullInvoice, error } = await supabase
        .from('customer_invoices')
        .select('*, customers(*), customer_invoice_items(*, sku:skus(*))')
        .eq('id', downloadInvoiceId)
        .single()
      if (error) throw error

      // Fetch logo via Supabase Storage to avoid CORS issues
      let logoDataUri = null
      if (company?.logo_url) {
        try {
          // Extract file path from public URL
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

      localStorage.setItem(`invoice-pdf-${downloadInvoiceId}`, JSON.stringify({ vehicleNo, ewayBillNo }))
      await downloadInvoicePDF(fullInvoice, company, { vehicleNo, ewayBillNo, logoDataUri })
      toast.success('PDF downloaded')
      setDownloadModalOpen(false)
    } catch (err) {
      toast.error('PDF failed: ' + err.message)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleGenerateReport = async (format) => {
    setIsGeneratingReport(true)
    try {
      let query = supabase
        .from('customer_invoices')
        .select(`
          id, invoice_number, invoice_date, due_date, status,
          subtotal, cgst_amount, sgst_amount, igst_amount, total_gst_amount, total_amount,
          paid_amount,
          customers(customer_name),
          customer_invoice_items(id)
        `)
        .order('invoice_date', { ascending: false })

      if (reportFromDate) query = query.gte('invoice_date', reportFromDate)
      if (reportToDate) query = query.lte('invoice_date', reportToDate)

      const { data, error } = await query
      if (error) throw error

      if (!data || data.length === 0) {
        toast.error('No invoices found for the selected date range')
        return
      }

      if (format === 'pdf') {
        generateInvoiceReportPDF(data, { fromDate: reportFromDate, toDate: reportToDate, companyName: company?.company_name })
      } else {
        generateInvoiceReportCSV(data, { fromDate: reportFromDate, toDate: reportToDate })
      }
      toast.success(`${format.toUpperCase()} report downloaded!`)
      setReportModalOpen(false)
    } catch (err) {
      toast.error('Report generation failed: ' + err.message)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Customer Invoices"
        description="Manage outward invoices and track sales"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { setReportFromDate(''); setReportToDate(''); setReportModalOpen(true) }}>
              <FileDown className="h-4 w-4 mr-2" />
              Report
            </Button>
            <PermissionGate module="customer_invoice" action="create">
              <Link to="/invoices/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Invoice
                </Button>
              </Link>
            </PermissionGate>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mt-2 sm:mt-4">
            <div className="relative col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoice..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
              />
            </div>
            <Select
              options={customerOptions}
              value={customerOptions.find(o => o.value === customerFilter) || customerOptions[0]}
              onChange={(selected) => { setCustomerFilter(selected?.value || ''); setPage(0) }}
              placeholder="Customer"
            />
            <Select
              options={STATUS_OPTIONS}
              value={STATUS_OPTIONS.find(o => o.value === statusFilter) || STATUS_OPTIONS[0]}
              onChange={(selected) => { setStatusFilter(selected?.value || ''); setPage(0) }}
              placeholder="Status"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-4">
            <Input type="date" label="From" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(0) }} />
            <Input type="date" label="To" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(0) }} />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No invoices found</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Invoice No</TableHeader>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Customer Name</TableHeader>
                      <TableHeader>Items</TableHeader>
                      <TableHeader>Grand Total</TableHeader>
                      <TableHeader>GST Type</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell>{invoice.customers?.customer_name || '-'}</TableCell>
                        <TableCell>{invoice.customer_invoice_items?.length || 0}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(invoice.total_amount)}</TableCell>
                        <TableCell>{getGstBadge(invoice.igst_amount > 0 ? 'IGST' : 'CGST_SGST')}</TableCell>
                        <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => { e.stopPropagation(); openDownloadModal(invoice.id) }}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {invoices.map((invoice, index) => (
                  <div
                    key={invoice.id}
                    className={`rounded-xl p-4 space-y-2 cursor-pointer active:scale-[0.98] transition-all border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{invoice.invoice_number}</div>
                        <div className="text-sm text-gray-500">{formatDate(invoice.invoice_date)}</div>
                      </div>
                      {getStatusBadge(invoice.status)}
                    </div>
                    <div className="text-sm text-gray-700">{invoice.customers?.customer_name || '-'}</div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getGstBadge(invoice.igst_amount > 0 ? 'IGST' : 'CGST_SGST')}
                        <span className="text-xs text-gray-500">{invoice.customer_invoice_items?.length || 0} items</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{formatCurrency(invoice.total_amount)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); openDownloadModal(invoice.id) }}
                          className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-t">
                  <div className="text-sm text-gray-600">
                    Showing {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-gray-600">Page {page + 1} of {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Generate Invoice Report" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a date range and download the invoice report with all details.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={reportFromDate}
                onChange={(e) => setReportFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={reportToDate}
                onChange={(e) => setReportToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">Leave empty to include all invoices.</p>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setReportModalOpen(false)}>Cancel</Button>
            <Button
              variant="outline"
              disabled={isGeneratingReport}
              onClick={() => handleGenerateReport('csv')}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isGeneratingReport ? 'Generating...' : 'Download CSV'}
            </Button>
            <Button
              disabled={isGeneratingReport}
              onClick={() => handleGenerateReport('pdf')}
            >
              <FileDown className="h-4 w-4 mr-2" />
              {isGeneratingReport ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Download PDF Modal */}
      <Modal isOpen={downloadModalOpen} onClose={() => setDownloadModalOpen(false)} title="Download Invoice PDF" size="md">
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
            <Button variant="outline" onClick={() => setDownloadModalOpen(false)}>Cancel</Button>
            <Button disabled={isDownloading} onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              {isDownloading ? 'Generating...' : 'Download PDF'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
