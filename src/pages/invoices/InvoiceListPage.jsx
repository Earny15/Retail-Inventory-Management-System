import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useInvoices } from '../../hooks/useInvoices.jsx'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import { PermissionGate } from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
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
  AlertCircle
} from 'lucide-react'

export default function InvoiceListPage() {
  const { canCreate, canEdit } = usePermissions()
  const {
    invoices,
    invoiceStats,
    isLoading,
    updateInvoiceStatus,
    sendInvoice
  } = useInvoices()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  // Filter invoices
  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer?.customer_code.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    const now = new Date()
    const invoiceDate = new Date(invoice.invoice_date)
    let matchesDate = true

    if (dateFilter === 'today') {
      matchesDate = invoiceDate.toDateString() === now.toDateString()
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7))
      matchesDate = invoiceDate >= weekAgo
    } else if (dateFilter === 'month') {
      matchesDate =
        invoiceDate.getMonth() === now.getMonth() &&
        invoiceDate.getFullYear() === now.getFullYear()
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'default',
      pending: 'warning',
      paid: 'success',
      cancelled: 'danger',
      overdue: 'danger'
    }
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>
  }

  const isOverdue = (invoice) => {
    return invoice.status === 'pending' && new Date(invoice.due_date) < new Date()
  }

  const handleStatusUpdate = (invoice, newStatus) => {
    updateInvoiceStatus({
      id: invoice.id,
      status: newStatus,
      ...(newStatus === 'paid' && { paidAmount: invoice.total_amount })
    })
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
        description="Manage customer invoices and track payments"
        action={
          <PermissionGate module="customer_invoice" action="create">
            <Link to="/invoices/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </Link>
          </PermissionGate>
        }
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{invoiceStats.totalInvoices}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Amount</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{invoiceStats.totalAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Amount Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{invoiceStats.paidAmount.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-full bg-green-100">
                <IndianRupee className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{invoiceStats.overdueInvoices}</p>
              </div>
              <div className="p-3 rounded-full bg-red-100">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search invoices..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No invoices found</p>
              {canCreate('customer_invoice') && (
                <Link to="/invoices/new">
                  <Button className="mt-3">
                    Create your first invoice
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Invoice #</TableHeader>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Due Date</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow
                    key={invoice.id}
                    className={isOverdue(invoice) ? 'bg-red-50' : ''}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-2">
                        {isOverdue(invoice) && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span>{invoice.invoice_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.customer?.customer_name}</div>
                        <div className="text-sm text-gray-500">{invoice.customer?.customer_code}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(invoice.invoice_date).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <span className={isOverdue(invoice) ? 'text-red-600 font-medium' : ''}>
                        {new Date(invoice.due_date).toLocaleDateString('en-IN')}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      ₹{invoice.total_amount?.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(isOverdue(invoice) ? 'overdue' : invoice.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Link to={`/invoices/${invoice.id}`}>
                          <button
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="View Invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </Link>

                        <PermissionGate module="customer_invoice" action="edit">
                          <Link to={`/invoices/${invoice.id}/edit`}>
                            <button
                              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                              title="Edit Invoice"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </Link>
                        </PermissionGate>

                        {invoice.status === 'pending' && (
                          <button
                            onClick={() => handleStatusUpdate(invoice, 'paid')}
                            className="p-1 text-green-600 hover:text-green-900 hover:bg-green-100 rounded"
                            title="Mark as Paid"
                          >
                            <IndianRupee className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => sendInvoice({
                            invoiceId: invoice.id,
                            method: 'email',
                            recipient: invoice.customer?.email
                          })}
                          className="p-1 text-blue-600 hover:text-blue-900 hover:bg-blue-100 rounded"
                          title="Send Invoice"
                        >
                          <Send className="h-4 w-4" />
                        </button>

                        <button
                          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}