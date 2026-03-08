import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import {
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  FileText,
  Package,
  Users,
  Building2,
  Calendar,
  IndianRupee
} from 'lucide-react'

export default function TransactionLogPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')

  // Fetch all transactions from different sources
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transaction-log'],
    queryFn: async () => {
      // Fetch inventory transactions
      const { data: inventoryTxns, error: invError } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          sku:skus(sku_code, sku_name),
          company:companies(company_name),
          vendor_inward:vendor_inwards(inward_number, vendor:vendors(vendor_name)),
          customer_invoice:customer_invoices(invoice_number, customer:customers(customer_name))
        `)
        .order('created_at', { ascending: false })
        .limit(500)

      if (invError) throw invError

      // Fetch customer invoices
      const { data: invoices, error: invoiceError } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          customer:customers(customer_name, customer_code),
          company:companies(company_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (invoiceError) throw invoiceError

      // Fetch vendor inwards
      const { data: inwards, error: inwardError } = await supabase
        .from('vendor_inwards')
        .select(`
          *,
          vendor:vendors(vendor_name, vendor_code),
          company:companies(company_name)
        `)
        .order('created_at', { ascending: false })
        .limit(200)

      if (inwardError) throw inwardError

      // Combine and normalize all transactions
      const allTransactions = [
        // Inventory transactions
        ...inventoryTxns.map(txn => ({
          id: `inv_${txn.id}`,
          type: 'inventory',
          subtype: txn.transaction_type,
          date: txn.created_at,
          description: `${txn.transaction_type === 'stock_in' ? 'Stock In' : 'Stock Out'}: ${txn.sku?.sku_name || 'Unknown SKU'}`,
          entity: txn.vendor_inward?.vendor?.vendor_name || txn.customer_invoice?.customer?.customer_name || 'System',
          reference: txn.vendor_inward?.inward_number || txn.customer_invoice?.invoice_number || txn.reference_type,
          amount: txn.total_cost || (txn.quantity * txn.unit_cost),
          quantity: txn.quantity,
          notes: txn.notes,
          company: txn.company?.company_name
        })),

        // Customer invoices
        ...invoices.map(invoice => ({
          id: `invoice_${invoice.id}`,
          type: 'sale',
          subtype: 'customer_invoice',
          date: invoice.invoice_date,
          description: `Customer Invoice: ${invoice.invoice_number}`,
          entity: invoice.customer?.customer_name || 'Unknown Customer',
          reference: invoice.invoice_number,
          amount: invoice.total_amount,
          quantity: null,
          notes: invoice.notes,
          company: invoice.company?.company_name,
          status: invoice.status
        })),

        // Vendor inwards
        ...inwards.map(inward => ({
          id: `inward_${inward.id}`,
          type: 'purchase',
          subtype: 'vendor_inward',
          date: inward.inward_date,
          description: `Vendor Inward: ${inward.inward_number}`,
          entity: inward.vendor?.vendor_name || 'Unknown Vendor',
          reference: inward.inward_number,
          amount: inward.total_amount,
          quantity: null,
          notes: inward.notes,
          company: inward.company?.company_name,
          status: inward.status
        }))
      ]

      // Sort by date (most recent first)
      return allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))
    }
  })

  // Filter transactions
  const filteredTransactions = transactions.filter(txn => {
    const matchesSearch =
      txn.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      txn.reference.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = typeFilter === 'all' || txn.type === typeFilter

    const now = new Date()
    const txnDate = new Date(txn.date)
    let matchesDate = true

    if (dateFilter === 'today') {
      matchesDate = txnDate.toDateString() === now.toDateString()
    } else if (dateFilter === 'week') {
      const weekAgo = new Date(now.setDate(now.getDate() - 7))
      matchesDate = txnDate >= weekAgo
    } else if (dateFilter === 'month') {
      matchesDate =
        txnDate.getMonth() === now.getMonth() &&
        txnDate.getFullYear() === now.getFullYear()
    }

    return matchesSearch && matchesType && matchesDate
  })

  // Calculate summary stats
  const stats = {
    totalTransactions: filteredTransactions.length,
    totalSales: filteredTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    totalPurchases: filteredTransactions
      .filter(t => t.type === 'purchase')
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    inventoryMovements: filteredTransactions.filter(t => t.type === 'inventory').length
  }

  const getTransactionIcon = (type, subtype) => {
    if (type === 'inventory') {
      return subtype === 'stock_in' ?
        <TrendingUp className="h-4 w-4 text-green-600" /> :
        <TrendingDown className="h-4 w-4 text-red-600" />
    }
    if (type === 'sale') return <FileText className="h-4 w-4 text-blue-600" />
    if (type === 'purchase') return <Package className="h-4 w-4 text-orange-600" />
    return <Users className="h-4 w-4 text-gray-600" />
  }

  const getTypeBadge = (type) => {
    const variants = {
      inventory: 'default',
      sale: 'success',
      purchase: 'warning'
    }
    return <Badge variant={variants[type] || 'default'}>{type}</Badge>
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
        title="Transaction Log"
        description="Unified view of all business transactions across the system"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
              </div>
              <div className="p-3 rounded-full bg-gray-100">
                <FileText className="h-6 w-6 text-gray-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-green-600">
                  ₹{stats.totalSales.toLocaleString('en-IN')}
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
                <p className="text-sm font-medium text-gray-600">Total Purchases</p>
                <p className="text-2xl font-bold text-orange-600">
                  ₹{stats.totalPurchases.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <IndianRupee className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Stock Movements</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inventoryMovements}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>

          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search transactions..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="sale">Sales</option>
              <option value="purchase">Purchases</option>
              <option value="inventory">Inventory</option>
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
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No transactions found</p>
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>Description</TableHeader>
                  <TableHeader>Entity</TableHeader>
                  <TableHeader>Reference</TableHeader>
                  <TableHeader>Amount</TableHeader>
                  <TableHeader>Notes</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>
                      {new Date(txn.date).toLocaleDateString('en-IN')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getTransactionIcon(txn.type, txn.subtype)}
                        {getTypeBadge(txn.type)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{txn.description}</TableCell>
                    <TableCell>{txn.entity}</TableCell>
                    <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                    <TableCell>
                      {txn.amount ? (
                        <span className={`font-medium ${
                          txn.type === 'sale' ? 'text-green-600' :
                          txn.type === 'purchase' ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          ₹{txn.amount.toLocaleString('en-IN')}
                        </span>
                      ) : (
                        txn.quantity && `${txn.quantity} units`
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-gray-600">
                      {txn.notes || '-'}
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