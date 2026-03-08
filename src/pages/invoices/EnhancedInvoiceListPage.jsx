import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInvoiceList,
  getOverdueInvoices,
  sendPaymentReminder,
  getInvoiceDashboardStats,
  recordPayment
} from '../../services/invoiceService'
import { downloadInvoicePDF, printInvoicePDF } from '../../services/invoicePdfService'
import { useCustomers } from '../../hooks/useCustomers'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import { PermissionGate } from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import {
  Plus,
  Search,
  FileText,
  Eye,
  Edit3,
  Send,
  Download,
  Filter,
  IndianRupee,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  Printer,
  Mail,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Receipt
} from 'lucide-react'

function PaymentStatusBadge({ status, daysOverdue }) {
  const statusConfig = {
    'PAID': { variant: 'success', label: 'Paid', icon: CheckCircle },
    'PARTIALLY_PAID': { variant: 'warning', label: 'Partially Paid', icon: Clock },
    'UNPAID': { variant: 'default', label: 'Unpaid', icon: IndianRupee },
    'OVERDUE': { variant: 'danger', label: `Overdue (${daysOverdue} days)`, icon: AlertCircle },
    'OVERDUE_PARTIAL': { variant: 'danger', label: `Overdue (${daysOverdue} days)`, icon: AlertCircle },
    'CANCELLED': { variant: 'secondary', label: 'Cancelled', icon: AlertCircle },
    'DRAFT': { variant: 'secondary', label: 'Draft', icon: FileText }
  }

  const config = statusConfig[status] || { variant: 'default', label: status, icon: FileText }
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}

function PaymentModal({ invoice, isOpen, onClose, onSuccess }) {
  const [paymentData, setPaymentData] = useState({
    amount: invoice?.payment_summary?.balance_amount || 0,
    payment_method: 'CASH',
    reference_number: '',
    notes: ''
  })

  const queryClient = useQueryClient()

  const paymentMutation = useMutation({
    mutationFn: recordPayment,
    onSuccess: () => {
      queryClient.invalidateQueries(['invoices'])
      queryClient.invalidateQueries(['dashboard-stats'])
      onSuccess?.()
      onClose()
    },
    onError: (error) => {
      alert('Failed to record payment: ' + error.message)
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    paymentMutation.mutate({
      ...paymentData,
      invoice_id: invoice.id,
      customer_id: invoice.customer_id
    })
  }

  if (!isOpen || !invoice) return null

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Record Payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Payment Amount"
          type="number"
          step="0.01"
          value={paymentData.amount}
          onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
          required
        />

        <Select
          label="Payment Method"
          value={paymentData.payment_method}
          onChange={(value) => setPaymentData(prev => ({ ...prev, payment_method: value }))}
          options={[
            { value: 'CASH', label: 'Cash' },
            { value: 'CHEQUE', label: 'Cheque' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { value: 'UPI', label: 'UPI' },
            { value: 'CARD', label: 'Card' }
          ]}
        />

        <Input
          label="Reference Number"
          value={paymentData.reference_number}
          onChange={(e) => setPaymentData(prev => ({ ...prev, reference_number: e.target.value }))}
          placeholder="Cheque number, transaction ID, etc."
        />

        <Input
          label="Notes"
          value={paymentData.notes}
          onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Additional payment notes"
        />

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={paymentMutation.isLoading}>
            {paymentMutation.isLoading ? <Spinner size="sm" className="mr-2" /> : null}
            Record Payment
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function EnhancedInvoiceListPage() {
  const navigate = useNavigate()
  const { canCreate, canEdit } = usePermissions()
  const { customers } = useCustomers()
  const queryClient = useQueryClient()

  // State
  const [filters, setFilters] = useState({
    customerId: '',
    status: '',
    paymentStatus: '',
    startDate: '',
    endDate: '',
    search: ''
  })
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [showOverdue, setShowOverdue] = useState(false)

  // Date range for dashboard
  const dateRange = {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  }

  // Data fetching
  const {
    data: invoices = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['invoices', filters],
    queryFn: () => getInvoiceList(filters),
    refetchOnWindowFocus: false
  })

  const {
    data: overdueInvoices = []
  } = useQuery({
    queryKey: ['overdue-invoices'],
    queryFn: getOverdueInvoices,
    refetchOnWindowFocus: false
  })

  const {
    data: dashboardStats
  } = useQuery({
    queryKey: ['dashboard-stats', dateRange],
    queryFn: () => getInvoiceDashboardStats(dateRange),
    refetchOnWindowFocus: false
  })

  // Mutations
  const reminderMutation = useMutation({
    mutationFn: ({ invoiceId, type }) => sendPaymentReminder(invoiceId, type),
    onSuccess: () => {
      alert('Payment reminder sent successfully!')
    },
    onError: (error) => {
      alert('Failed to send reminder: ' + error.message)
    }
  })

  // Filter options
  const customerOptions = [
    { value: '', label: 'All Customers' },
    ...customers
      .filter(c => c.is_active)
      .map(c => ({
        value: c.id,
        label: `${c.customer_code} - ${c.customer_name}`
      }))
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ]

  const paymentStatusOptions = [
    { value: '', label: 'All Payment Status' },
    { value: 'PAID', label: 'Paid' },
    { value: 'PARTIALLY_PAID', label: 'Partially Paid' },
    { value: 'UNPAID', label: 'Unpaid' },
    { value: 'OVERDUE', label: 'Overdue' }
  ]

  // Filter and search
  const filteredInvoices = (showOverdue ? overdueInvoices : invoices).filter(invoice => {
    if (!filters.search) return true

    const searchTerm = filters.search.toLowerCase()
    return (
      invoice.invoice_number.toLowerCase().includes(searchTerm) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm) ||
      invoice.notes?.toLowerCase().includes(searchTerm)
    )
  })

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      customerId: '',
      status: '',
      paymentStatus: '',
      startDate: '',
      endDate: '',
      search: ''
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleDownloadPDF = async (invoice) => {
    try {
      // Here you would fetch the complete invoice data
      downloadInvoicePDF(invoice, `Invoice_${invoice.invoice_number}.pdf`)
    } catch (error) {
      alert('Failed to download PDF: ' + error.message)
    }
  }

  const handlePrintInvoice = async (invoice) => {
    try {
      // Here you would fetch the complete invoice data
      printInvoicePDF(invoice)
    } catch (error) {
      alert('Failed to print invoice: ' + error.message)
    }
  }

  const handleSendReminder = (invoice, type = 'GENTLE') => {
    reminderMutation.mutate({ invoiceId: invoice.id, type })
  }

  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice)
    setPaymentModalOpen(true)
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Customer Invoices"
          description="Manage and track customer invoices with payment status"
        />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load invoices</p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Customer Invoices"
        description="Manage and track customer invoices with payment status"
        action={
          <div className="flex gap-2">
            <Button
              variant={showOverdue ? 'default' : 'outline'}
              onClick={() => setShowOverdue(!showOverdue)}
            >
              {showOverdue ? 'Show All' : 'Show Overdue'}
              {overdueInvoices.length > 0 && (
                <Badge variant="danger" className="ml-2">
                  {overdueInvoices.length}
                </Badge>
              )}
            </Button>
            <PermissionGate module="customer_invoice" action="create">
              <Button onClick={() => navigate('/invoices/new')}>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* Dashboard Stats */}
      {dashboardStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold">{dashboardStats.totalInvoices}</p>
                </div>
                <Receipt className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    {formatCurrency(dashboardStats.totalAmount)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Amount</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {formatCurrency(dashboardStats.pendingAmount)}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Overdue Amount</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(dashboardStats.overdueAmount)}
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{showOverdue ? 'Overdue Invoices' : 'All Invoices'}</span>
            <span className="text-sm font-normal text-gray-500">
              {filteredInvoices.length} invoices
            </span>
          </CardTitle>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>

            {/* Customer Filter */}
            <Select
              options={customerOptions}
              value={customerOptions.find(opt => opt.value === filters.customerId)}
              onChange={(selected) => updateFilter('customerId', selected?.value || '')}
              placeholder="Filter by customer"
            />

            {/* Status Filter */}
            <Select
              options={statusOptions}
              value={statusOptions.find(opt => opt.value === filters.status)}
              onChange={(selected) => updateFilter('status', selected?.value || '')}
              placeholder="Filter by status"
            />

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={clearFilters}
              className="flex items-center justify-center"
            >
              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Date Range */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <Input
              type="date"
              label="From Date"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
            <Input
              type="date"
              label="To Date"
              value={filters.endDate}
              onChange={(e) => updateFilter('endDate', e.target.value)}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">
                {showOverdue ? 'No overdue invoices found' : 'No invoices found'}
              </p>
              {canCreate('customer_invoice') && !showOverdue && (
                <Button onClick={() => navigate('/invoices/new')} className="mt-3">
                  Create your first invoice
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Invoice No</TableHeader>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Customer</TableHeader>
                      <TableHeader>Amount</TableHeader>
                      <TableHeader>Payment Status</TableHeader>
                      <TableHeader>Due Date</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInvoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDate(invoice.invoice_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{invoice.customer_name}</div>
                            <div className="text-sm text-gray-500">{invoice.customer_location}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {formatCurrency(invoice.grand_total)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <PaymentStatusBadge
                            status={invoice.payment_status}
                            daysOverdue={invoice.days_overdue}
                          />
                        </TableCell>
                        <TableCell>
                          <div className={`${
                            invoice.days_overdue > 0 ? 'text-red-600 font-medium' : 'text-gray-900'
                          }`}>
                            {formatDate(invoice.due_date)}
                            {invoice.days_overdue > 0 && (
                              <div className="text-xs text-red-500">
                                {invoice.days_overdue} days overdue
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/invoices/${invoice.id}`)}
                              title="View invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadPDF(invoice)}
                              title="Download PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePrintInvoice(invoice)}
                              title="Print invoice"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {invoice.payment_status !== 'PAID' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRecordPayment(invoice)}
                                title="Record payment"
                              >
                                <IndianRupee className="h-4 w-4" />
                              </Button>
                            )}
                            {invoice.days_overdue > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSendReminder(invoice)}
                                title="Send reminder"
                              >
                                <Mail className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4 p-4">
                {filteredInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {invoice.invoice_number}
                        </div>
                        <div className="text-sm text-gray-600">
                          {invoice.customer_name}
                        </div>
                      </div>
                      <div className="text-right">
                        <PaymentStatusBadge
                          status={invoice.payment_status}
                          daysOverdue={invoice.days_overdue}
                        />
                        <div className="text-sm font-medium mt-1">
                          {formatCurrency(invoice.grand_total)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                      <div>
                        <div className="text-gray-500">Invoice Date</div>
                        <div>{formatDate(invoice.invoice_date)}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">Due Date</div>
                        <div className={
                          invoice.days_overdue > 0 ? 'text-red-600 font-medium' : 'text-gray-900'
                        }>
                          {formatDate(invoice.due_date)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(invoice)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      {invoice.payment_status !== 'PAID' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecordPayment(invoice)}
                        >
                          <IndianRupee className="h-4 w-4 mr-1" />
                          Payment
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        invoice={selectedInvoice}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries(['invoices'])
          queryClient.invalidateQueries(['overdue-invoices'])
        }}
      />
    </div>
  )
}