import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getInvoiceById,
  recordPayment,
  sendPaymentReminder,
  updateInvoice,
  generateCustomerStatement
} from '../../services/invoiceService'
import { downloadInvoicePDF, printInvoicePDF } from '../../services/invoicePdfService'
import { convertNumberToWords } from '../../utils/numberToWords'
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
  ArrowLeft,
  Download,
  Printer,
  Edit3,
  IndianRupee,
  Mail,
  Calendar,
  MapPin,
  Phone,
  Building,
  FileText,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Calculator
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

function PaymentModal({ invoice, isOpen, onClose }) {
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
      queryClient.invalidateQueries(['invoice', invoice?.id])
      queryClient.invalidateQueries(['invoices'])
      alert('Payment recorded successfully!')
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
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between text-sm">
            <span>Invoice Total:</span>
            <span className="font-semibold">₹{invoice.grand_total?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span>Amount Paid:</span>
            <span>₹{invoice.payment_summary?.total_paid?.toFixed(2) || '0.00'}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
            <span>Balance Due:</span>
            <span className="text-red-600">₹{invoice.payment_summary?.balance_amount?.toFixed(2) || '0.00'}</span>
          </div>
        </div>

        <Input
          label="Payment Amount"
          type="number"
          step="0.01"
          value={paymentData.amount}
          onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
          max={invoice.payment_summary?.balance_amount}
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
            { value: 'CARD', label: 'Card' },
            { value: 'RTGS', label: 'RTGS/NEFT' }
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

export default function InvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)

  // Fetch invoice data
  const {
    data: invoice,
    isLoading,
    error
  } = useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoiceById(id),
    enabled: !!id
  })

  // Mutations
  const reminderMutation = useMutation({
    mutationFn: (type) => sendPaymentReminder(id, type),
    onSuccess: () => {
      alert('Payment reminder sent successfully!')
    },
    onError: (error) => {
      alert('Failed to send reminder: ' + error.message)
    }
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateInvoice(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries(['invoice', id])
      queryClient.invalidateQueries(['invoices'])
      alert('Invoice status updated successfully!')
    },
    onError: (error) => {
      alert('Failed to update status: ' + error.message)
    }
  })

  const statementMutation = useMutation({
    mutationFn: () => {
      const endDate = new Date().toISOString().split('T')[0]
      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      return generateCustomerStatement(invoice.customer_id, startDate, endDate)
    },
    onSuccess: (statement) => {
      // Here you would generate and download the customer statement PDF
      console.log('Customer statement:', statement)
      alert('Customer statement generated successfully!')
    },
    onError: (error) => {
      alert('Failed to generate statement: ' + error.message)
    }
  })

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const handleDownloadPDF = () => {
    try {
      downloadInvoicePDF(invoice, `Invoice_${invoice.invoice_number}.pdf`)
    } catch (error) {
      alert('Failed to download PDF: ' + error.message)
    }
  }

  const handlePrintInvoice = () => {
    try {
      printInvoicePDF(invoice)
    } catch (error) {
      alert('Failed to print invoice: ' + error.message)
    }
  }

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
        <PageHeader
          title="Invoice Not Found"
          description="The requested invoice could not be loaded"
        />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">
              {error?.message || 'Invoice not found'}
            </p>
            <Button onClick={() => navigate('/invoices')} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={`Invoice ${invoice.invoice_number}`}
        description={`Created on ${formatDate(invoice.invoice_date)}`}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/invoices')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button variant="outline" onClick={handlePrintInvoice}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Invoice Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl">
                    Invoice {invoice.invoice_number}
                  </CardTitle>
                  <div className="flex gap-4 mt-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(invoice.invoice_date)}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      Due: {formatDate(invoice.due_date)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <PaymentStatusBadge
                    status={invoice.payment_summary?.payment_status}
                    daysOverdue={invoice.payment_summary?.days_overdue}
                  />
                  <div className="text-2xl font-bold text-primary-600 mt-2">
                    {formatCurrency(invoice.grand_total)}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Customer & Company Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bill To */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Bill To
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-semibold">{invoice.customers?.customer_name}</div>
                  <div className="text-sm text-gray-600">
                    {invoice.customers?.billing_address_line1}
                    {invoice.customers?.billing_address_line2 && (
                      <><br />{invoice.customers.billing_address_line2}</>
                    )}
                    <br />
                    {invoice.customers?.billing_city}, {invoice.customers?.billing_state} - {invoice.customers?.billing_pincode}
                  </div>
                  {invoice.customers?.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-1" />
                      {invoice.customers.phone}
                    </div>
                  )}
                  {invoice.customers?.gstin && (
                    <div className="text-sm">
                      <span className="font-medium">GSTIN:</span> {invoice.customers.gstin}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Bill From */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Building className="h-5 w-5 mr-2" />
                  Bill From
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="font-semibold">{invoice.companies?.company_name}</div>
                  <div className="text-sm text-gray-600">
                    {invoice.companies?.address_line1}
                    {invoice.companies?.address_line2 && (
                      <><br />{invoice.companies.address_line2}</>
                    )}
                    <br />
                    {invoice.companies?.city}, {invoice.companies?.state} - {invoice.companies?.pincode}
                  </div>
                  {invoice.companies?.phone && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="h-4 w-4 mr-1" />
                      {invoice.companies.phone}
                    </div>
                  )}
                  <div className="text-sm">
                    <span className="font-medium">GSTIN:</span> {invoice.companies?.gstin}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Invoice Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Description</TableHeader>
                      <TableHeader>HSN</TableHeader>
                      <TableHeader>Qty</TableHeader>
                      <TableHeader>Rate</TableHeader>
                      <TableHeader>Amount</TableHeader>
                      <TableHeader>GST%</TableHeader>
                      <TableHeader>GST Amt</TableHeader>
                      <TableHeader>Total</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoice.invoice_items?.map((item, index) => {
                      const amount = item.quantity * item.unit_price
                      const gstAmount = (amount * (item.gst_rate || 0)) / 100
                      const total = amount + gstAmount

                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="font-medium">{item.skus?.sku_name}</div>
                            {item.description && (
                              <div className="text-sm text-gray-500">{item.description}</div>
                            )}
                          </TableCell>
                          <TableCell>{item.hsn_code || '7601'}</TableCell>
                          <TableCell>{item.quantity.toFixed(2)}</TableCell>
                          <TableCell>{formatCurrency(item.unit_price)}</TableCell>
                          <TableCell>{formatCurrency(amount)}</TableCell>
                          <TableCell>{item.gst_rate || 0}%</TableCell>
                          <TableCell>{formatCurrency(gstAmount)}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(total)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Invoice Totals */}
              <div className="border-t p-6">
                <div className="flex justify-end">
                  <div className="w-80 space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(invoice.subtotal_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GST Amount:</span>
                      <span>{formatCurrency(invoice.total_gst_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Round Off:</span>
                      <span>{formatCurrency(invoice.round_off_amount)}</span>
                    </div>
                    <div className="border-t pt-2">
                      <div className="flex justify-between text-xl font-bold">
                        <span>Grand Total:</span>
                        <span className="text-primary-600">
                          {formatCurrency(invoice.grand_total)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Amount in words */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <div className="text-sm font-medium text-gray-700 mb-1">Amount in Words:</div>
                  <div className="text-sm">
                    {convertNumberToWords(Math.round(invoice.grand_total))} Rupees Only
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes & Terms */}
          {(invoice.notes || invoice.terms_conditions) && (
            <Card>
              <CardContent>
                {invoice.notes && (
                  <div className="mb-4">
                    <div className="font-medium text-gray-700 mb-2">Notes:</div>
                    <div className="text-sm text-gray-600">{invoice.notes}</div>
                  </div>
                )}
                {invoice.terms_conditions && (
                  <div>
                    <div className="font-medium text-gray-700 mb-2">Terms & Conditions:</div>
                    <div className="text-sm text-gray-600 whitespace-pre-line">
                      {invoice.terms_conditions}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calculator className="h-5 w-5 mr-2" />
                Payment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Invoice Total:</span>
                  <span className="font-semibold">{formatCurrency(invoice.grand_total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Amount Paid:</span>
                  <span className="text-green-600">
                    {formatCurrency(invoice.payment_summary?.total_paid || 0)}
                  </span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="font-semibold">Balance Due:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(invoice.payment_summary?.balance_amount || 0)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Actions */}
              {invoice.payment_summary?.balance_amount > 0 && (
                <div className="mt-6 space-y-2">
                  <Button
                    onClick={() => setPaymentModalOpen(true)}
                    className="w-full"
                  >
                    <IndianRupee className="h-4 w-4 mr-2" />
                    Record Payment
                  </Button>

                  {invoice.payment_summary?.days_overdue > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => reminderMutation.mutate('GENTLE')}
                      disabled={reminderMutation.isLoading}
                      className="w-full"
                    >
                      {reminderMutation.isLoading ? (
                        <Spinner size="sm" className="mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Send Reminder
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          {invoice.payments && invoice.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="h-5 w-5 mr-2" />
                  Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {invoice.payments.map((payment, index) => (
                    <div key={index} className="border-b pb-3 last:border-b-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {formatCurrency(payment.amount)}
                          </div>
                          <div className="text-sm text-gray-600">
                            {payment.payment_method}
                          </div>
                          {payment.reference_number && (
                            <div className="text-xs text-gray-500">
                              Ref: {payment.reference_number}
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatDate(payment.payment_date)}
                        </div>
                      </div>
                      {payment.notes && (
                        <div className="text-xs text-gray-500 mt-1">
                          {payment.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Invoice Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                onClick={() => navigate(`/invoices/edit/${invoice.id}`)}
                className="w-full"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Invoice
              </Button>

              <Button
                variant="outline"
                onClick={() => statementMutation.mutate()}
                disabled={statementMutation.isLoading}
                className="w-full"
              >
                {statementMutation.isLoading ? (
                  <Spinner size="sm" className="mr-2" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Customer Statement
              </Button>

              {invoice.status === 'DRAFT' && (
                <Button
                  variant="outline"
                  onClick={() => statusMutation.mutate('CONFIRMED')}
                  disabled={statusMutation.isLoading}
                  className="w-full"
                >
                  {statusMutation.isLoading ? (
                    <Spinner size="sm" className="mr-2" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Invoice
                </Button>
              )}

              {invoice.status === 'CONFIRMED' && invoice.payment_summary?.balance_amount > 0 && (
                <Button
                  variant="outline"
                  onClick={() => statusMutation.mutate('CANCELLED')}
                  disabled={statusMutation.isLoading}
                  className="w-full text-red-600 hover:text-red-800"
                >
                  Cancel Invoice
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        invoice={invoice}
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
      />
    </div>
  )
}