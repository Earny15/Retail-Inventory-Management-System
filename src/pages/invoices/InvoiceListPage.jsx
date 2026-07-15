import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import JSZip from 'jszip'
import { pdf } from '@react-pdf/renderer'
import InvoicePDFDocument from '../../pdf/InvoicePDF'
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
import { uploadInvoicePDFToStorage } from '../../services/invoicePdfService'
import { generateInvoiceReportPDF, generateInvoiceReportCSV } from '../../utils/reportGenerator'
import {
  Plus,
  Search,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Link as LinkIcon,
  Archive
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
  const [customerFilter, setCustomerFilter] = useState([]) // multi-select: array of customer ids
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)

  // Report modal state
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportFromDate, setReportFromDate] = useState('')
  const [reportToDate, setReportToDate] = useState('')
  const [reportCustomerFilter, setReportCustomerFilter] = useState([]) // multi-select: array of customer ids
  const [reportStatusFilter, setReportStatusFilter] = useState('')
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Download modal state
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadInvoiceId, setDownloadInvoiceId] = useState(null)
  const [vehicleNo, setVehicleNo] = useState('')
  const [ewayBillNo, setEwayBillNo] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  // ZIP-download state for the current filter
  const [isZipping, setIsZipping] = useState(false)
  const [zipProgress, setZipProgress] = useState({ done: 0, total: 0 })

  // Backfill state (for legacy invoices missing public_pdf_url)
  const [backfillModalOpen, setBackfillModalOpen] = useState(false)
  const [backfillTotal, setBackfillTotal] = useState(0)
  const [backfillDone, setBackfillDone] = useState(0)
  const [backfillFailed, setBackfillFailed] = useState(0)
  const [backfillFailedIds, setBackfillFailedIds] = useState([])
  const [backfillRunning, setBackfillRunning] = useState(false)
  const [backfillFinished, setBackfillFinished] = useState(false)

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

  const customerOptions = useMemo(
    () => customers.map(c => ({ value: c.id, label: c.customer_name })),
    [customers]
  )

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
      if (customerFilter.length > 0) query = query.in('customer_id', customerFilter)
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

  // Stats are only shown when at least one filter is active, to avoid
  // pulling totals across the entire invoice history.
  const filtersActive = !!(searchTerm || statusFilter || customerFilter.length > 0 || startDate || endDate)

  const { data: filteredStats } = useQuery({
    queryKey: ['invoice-stats', statusFilter, customerFilter, startDate, endDate, searchTerm],
    queryFn: async () => {
      let q = supabase
        .from('customer_invoices')
        .select('subtotal, total_gst_amount, total_amount', { count: 'exact' })
      if (statusFilter) q = q.eq('status', statusFilter)
      if (customerFilter.length > 0) q = q.in('customer_id', customerFilter)
      if (startDate) q = q.gte('invoice_date', startDate)
      if (endDate) q = q.lte('invoice_date', endDate)
      if (searchTerm) q = q.ilike('invoice_number', `%${searchTerm}%`)
      const { data, error, count } = await q
      if (error) throw error
      const totals = (data || []).reduce(
        (acc, r) => ({
          invoiceValue: acc.invoiceValue + (r.total_amount || 0),
          taxableAmount: acc.taxableAmount + (r.subtotal || 0),
          gstAmount: acc.gstAmount + (r.total_gst_amount || 0)
        }),
        { invoiceValue: 0, taxableAmount: 0, gstAmount: 0 }
      )
      return { ...totals, count: count || 0 }
    },
    enabled: filtersActive
  })

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
          paid_amount, public_pdf_url,
          customers(customer_name, gstin),
          customer_invoice_items(id)
        `)
        .order('invoice_date', { ascending: false })

      if (reportFromDate) query = query.gte('invoice_date', reportFromDate)
      if (reportToDate) query = query.lte('invoice_date', reportToDate)
      if (reportCustomerFilter.length > 0) query = query.in('customer_id', reportCustomerFilter)
      if (reportStatusFilter) query = query.eq('status', reportStatusFilter)

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

  // Sanitize an invoice number for use in a filename inside the ZIP.
  const safeInvoiceFilename = (invNo) => {
    const clean = String(invNo || 'invoice').replace(/[\\/:*?"<>|]/g, '_')
    return `${clean}.pdf`
  }

  // Download every invoice matching the current filters as PDFs bundled in a ZIP.
  const downloadFilteredAsZip = async () => {
    if (!company) {
      toast.error('Company info not loaded — wait a moment and retry.')
      return
    }
    if (isZipping) return
    setIsZipping(true)
    setZipProgress({ done: 0, total: 0 })

    try {
      // Re-run the same filtered query but WITHOUT pagination so we cover
      // everything the current filters match (not just this page's 20 rows).
      let q = supabase
        .from('customer_invoices')
        .select(`
          *,
          customers(*),
          customer_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code))
        `)
        .order('invoice_date', { ascending: false })
      if (statusFilter) q = q.eq('status', statusFilter)
      if (customerFilter.length > 0) q = q.in('customer_id', customerFilter)
      if (startDate) q = q.gte('invoice_date', startDate)
      if (endDate) q = q.lte('invoice_date', endDate)
      if (searchTerm) q = q.ilike('invoice_number', `%${searchTerm}%`)

      const { data: rows, error } = await q
      if (error) throw error
      if (!rows || rows.length === 0) {
        toast.error('No invoices to download for the current filters.')
        return
      }

      setZipProgress({ done: 0, total: rows.length })
      const zip = new JSZip()
      const failed = []

      for (const inv of rows) {
        try {
          const blob = await pdf(
            React.createElement(InvoicePDFDocument, {
              invoice: inv,
              company,
              vehicleNo: '',
              ewayBillNo: '',
              logoDataUri: null
            })
          ).toBlob()
          zip.file(safeInvoiceFilename(inv.invoice_number), blob)
        } catch (e) {
          console.warn('Failed to render PDF for', inv.invoice_number, e)
          failed.push(inv.invoice_number)
        }
        setZipProgress(p => ({ ...p, done: p.done + 1 }))
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' })
      const stamp = new Date().toISOString().split('T')[0]
      const url = URL.createObjectURL(zipBlob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Invoices_${stamp}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      if (failed.length === 0) {
        toast.success(`Downloaded ${rows.length} invoice${rows.length === 1 ? '' : 's'} as ZIP`)
      } else {
        toast(`Downloaded ${rows.length - failed.length} of ${rows.length}. Failed: ${failed.join(', ')}`, { icon: '⚠️' })
      }
    } catch (err) {
      console.error('ZIP download failed:', err)
      toast.error('ZIP download failed: ' + err.message)
    } finally {
      setIsZipping(false)
      setZipProgress({ done: 0, total: 0 })
    }
  }

  const openBackfillModal = async () => {
    setBackfillFinished(false)
    setBackfillDone(0)
    setBackfillFailed(0)
    setBackfillFailedIds([])
    setBackfillTotal(0)
    setBackfillModalOpen(true)
    // Count how many invoices need a link so the user can decide whether to run
    const { count, error } = await supabase
      .from('customer_invoices')
      .select('id', { count: 'exact', head: true })
      .is('public_pdf_url', null)
    if (error) {
      toast.error('Could not count invoices: ' + error.message)
      return
    }
    setBackfillTotal(count || 0)
  }

  const runBackfill = async () => {
    if (!company) {
      toast.error('Company info not loaded — wait a moment and retry.')
      return
    }
    setBackfillRunning(true)
    setBackfillFinished(false)
    setBackfillDone(0)
    setBackfillFailed(0)
    setBackfillFailedIds([])

    try {
      // Fetch IDs of every invoice without a public link. We fetch full data
      // per-invoice inside the loop so a very large backlog doesn't spike memory.
      const { data: pending, error: listErr } = await supabase
        .from('customer_invoices')
        .select('id, invoice_number')
        .is('public_pdf_url', null)
        .order('invoice_date', { ascending: true })
      if (listErr) throw listErr

      setBackfillTotal(pending?.length || 0)
      if (!pending || pending.length === 0) {
        setBackfillFinished(true)
        return
      }

      for (const row of pending) {
        try {
          const { data: fullInvoice, error: fetchErr } = await supabase
            .from('customer_invoices')
            .select(`
              *,
              customers(*),
              customer_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code))
            `)
            .eq('id', row.id)
            .single()
          if (fetchErr) throw fetchErr

          const publicUrl = await uploadInvoicePDFToStorage(fullInvoice, company)
          const { error: updErr } = await supabase
            .from('customer_invoices')
            .update({ public_pdf_url: publicUrl })
            .eq('id', row.id)
          if (updErr) throw updErr

          setBackfillDone(d => d + 1)
        } catch (err) {
          console.warn('Backfill failed for', row.invoice_number, err)
          setBackfillFailed(f => f + 1)
          setBackfillFailedIds(list => [...list, row.invoice_number])
        }
      }

      setBackfillFinished(true)
      // Refresh the list so the newly-populated URLs appear in future reports
      // and detail-page checks.
    } finally {
      setBackfillRunning(false)
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
            <Button
              variant="outline"
              onClick={() => {
                setReportFromDate('')
                setReportToDate('')
                setReportCustomerFilter([])
                setReportStatusFilter('')
                setReportModalOpen(true)
              }}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Report
            </Button>
            <PermissionGate module="customer_invoice" action="edit">
              <Button variant="outline" onClick={openBackfillModal}>
                <LinkIcon className="h-4 w-4 mr-2" />
                Backfill Links
              </Button>
            </PermissionGate>
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

      {/* Stats — shown only when at least one filter is active */}
      {filtersActive && filteredStats && (
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            <div className="text-xs sm:text-sm text-gray-500">
              Stats for {filteredStats.count} filtered invoice{filteredStats.count === 1 ? '' : 's'}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadFilteredAsZip}
              disabled={isZipping || filteredStats.count === 0}
            >
              <Archive className="h-4 w-4 mr-1.5" />
              {isZipping
                ? (zipProgress.total > 0
                    ? `Preparing ZIP… ${zipProgress.done}/${zipProgress.total}`
                    : 'Preparing ZIP…')
                : `Download ${filteredStats.count} as ZIP`}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
              <div className="text-xs font-medium text-navy-700 uppercase tracking-wide">Invoice Value</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-navy-900">{formatCurrency(filteredStats.invoiceValue)}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <div className="text-xs font-medium text-emerald-700 uppercase tracking-wide">Taxable Amount</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-emerald-900">{formatCurrency(filteredStats.taxableAmount)}</div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <div className="text-xs font-medium text-amber-700 uppercase tracking-wide">GST Amount</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-amber-900">{formatCurrency(filteredStats.gstAmount)}</div>
            </div>
          </div>
        </div>
      )}

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
              isMulti
              options={customerOptions}
              value={customerOptions.filter(o => customerFilter.includes(o.value))}
              onChange={(selected) => {
                setCustomerFilter((selected || []).map(o => o.value))
                setPage(0)
              }}
              placeholder="All Customers"
              closeMenuOnSelect={false}
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
            Filter invoices and download the report. Leave any filter empty to include all.
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
              <Select
                isMulti
                options={customerOptions}
                value={customerOptions.filter(o => reportCustomerFilter.includes(o.value))}
                onChange={(selected) => setReportCustomerFilter((selected || []).map(o => o.value))}
                placeholder="All Customers"
                closeMenuOnSelect={false}
                menuPortalTarget={document.body}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select
                options={STATUS_OPTIONS}
                value={STATUS_OPTIONS.find(o => o.value === reportStatusFilter) || STATUS_OPTIONS[0]}
                onChange={(selected) => setReportStatusFilter(selected?.value || '')}
                placeholder="All Status"
                menuPortalTarget={document.body}
              />
            </div>
          </div>
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

      {/* Backfill Public Links Modal */}
      <Modal
        isOpen={backfillModalOpen}
        onClose={() => { if (!backfillRunning) setBackfillModalOpen(false) }}
        title="Backfill Public PDF Links"
        size="md"
      >
        <div className="space-y-4">
          {!backfillRunning && !backfillFinished && (
            <>
              <p className="text-sm text-gray-600">
                Generates and uploads the PDF for every invoice that doesn't already have a public link.
                Existing invoices with a public link are skipped. This runs against production data —
                any browser tab close before it finishes will stop the batch mid-way (already-processed
                invoices stay saved).
              </p>
              <div className="rounded-lg bg-gray-50 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Invoices without a link:</span>
                  <span className="font-semibold text-gray-900">{backfillTotal}</span>
                </div>
              </div>
              {backfillTotal === 0 ? (
                <p className="text-sm text-emerald-700">Nothing to do — every invoice already has a public link.</p>
              ) : (
                <p className="text-xs text-gray-500">
                  Estimated time: ~{Math.ceil(backfillTotal * 2)} seconds (about 2s per invoice).
                </p>
              )}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setBackfillModalOpen(false)}>Close</Button>
                <Button onClick={runBackfill} disabled={backfillTotal === 0}>
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Start Backfill
                </Button>
              </div>
            </>
          )}

          {backfillRunning && (
            <>
              <p className="text-sm text-gray-600">
                Processing invoices. Please leave this tab open until it finishes.
              </p>
              <div className="rounded-lg bg-gray-50 p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Progress</span>
                  <span className="font-medium text-gray-900">
                    {backfillDone + backfillFailed} of {backfillTotal}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-full bg-navy-600 transition-all"
                    style={{ width: `${backfillTotal ? ((backfillDone + backfillFailed) / backfillTotal) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 pt-1">
                  <span>Succeeded: <strong className="text-emerald-700">{backfillDone}</strong></span>
                  <span>Failed: <strong className="text-red-700">{backfillFailed}</strong></span>
                </div>
              </div>
            </>
          )}

          {backfillFinished && !backfillRunning && (
            <>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold text-emerald-800">
                  Done. {backfillDone} succeeded{backfillFailed > 0 ? `, ${backfillFailed} failed` : ''}.
                </p>
                {backfillFailedIds.length > 0 && (
                  <p className="text-xs text-emerald-700 mt-1">
                    Failed invoices: {backfillFailedIds.slice(0, 10).join(', ')}
                    {backfillFailedIds.length > 10 && ` (+${backfillFailedIds.length - 10} more)`}. Retry via the invoice detail page.
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button onClick={() => setBackfillModalOpen(false)}>Close</Button>
              </div>
            </>
          )}
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
