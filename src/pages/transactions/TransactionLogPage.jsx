import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/gstCalculator'
import {
  Search,
  FileText,
  Eye,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react'

const TYPE_OPTIONS = [
  { value: null, label: 'All Types' },
  { value: 'INWARD', label: 'Inward' },
  { value: 'INVOICE', label: 'Invoice' }
]

const STATUS_OPTIONS = [
  { value: null, label: 'All Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'draft', label: 'Draft' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'paid', label: 'Paid' },
  { value: 'pending', label: 'Pending' }
]

const TYPE_BADGE_MAP = {
  INWARD: { variant: 'success', icon: ArrowDownLeft },
  INVOICE: { variant: 'info', icon: ArrowUpRight }
}

export default function TransactionLogPage() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState(null)
  const [statusFilter, setStatusFilter] = useState(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  // Fetch vendor_inwards
  const { data: inwards = [], isLoading: loadingInwards } = useQuery({
    queryKey: ['txn-log-inwards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_inwards')
        .select(`
          id,
          inward_number,
          inward_date,
          status,
          total_amount,
          vendor_id,
          created_at,
          vendors ( vendor_name )
        `)
        .order('inward_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data || []).map(row => ({
        id: row.id,
        ref_no: row.inward_number,
        type: 'INWARD',
        date: row.inward_date,
        status: row.status,
        grand_total: row.total_amount,
        party_name: row.vendors?.vendor_name || '-',
        created_at: row.created_at
      }))
    }
  })

  // Fetch customer_invoices
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['txn-log-invoices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          id,
          invoice_number,
          invoice_date,
          status,
          total_amount,
          customer_id,
          created_at,
          customers ( customer_name )
        `)
        .order('invoice_date', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data || []).map(row => ({
        id: row.id,
        ref_no: row.invoice_number,
        type: 'INVOICE',
        date: row.invoice_date,
        status: row.status,
        grand_total: row.total_amount,
        party_name: row.customers?.customer_name || '-',
        created_at: row.created_at
      }))
    }
  })

  const isLoading = loadingInwards || loadingInvoices

  // Merge and sort by date descending
  const allTransactions = useMemo(() => {
    return [...inwards, ...invoices].sort((a, b) => {
      const dateA = a.date || a.created_at || ''
      const dateB = b.date || b.created_at || ''
      return dateB.localeCompare(dateA)
    })
  }, [inwards, invoices])

  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(txn => {
      // Type filter
      if (typeFilter && txn.type !== typeFilter) return false

      // Status filter
      if (statusFilter && txn.status?.toLowerCase() !== statusFilter.toLowerCase()) return false

      // Date range filter
      if (dateFrom) {
        const txnDate = new Date(txn.date)
        if (txnDate < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const txnDate = new Date(txn.date)
        const endDate = new Date(dateTo)
        endDate.setHours(23, 59, 59, 999)
        if (txnDate > endDate) return false
      }

      // Search: party name or ref_no
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const partyName = txn.party_name?.toLowerCase() || ''
        const refNo = txn.ref_no?.toLowerCase() || ''
        if (!partyName.includes(term) && !refNo.includes(term)) {
          return false
        }
      }

      return true
    })
  }, [allTransactions, typeFilter, statusFilter, dateFrom, dateTo, searchTerm])

  const handleView = (txn) => {
    if (txn.type === 'INWARD') {
      navigate(`/inward/${txn.id}`)
    } else {
      navigate(`/invoices/${txn.id}`)
    }
  }

  const getStatusVariant = (status) => {
    const s = (status || '').toLowerCase()
    if (s === 'confirmed' || s === 'paid') return 'success'
    if (s === 'draft' || s === 'pending') return 'warning'
    if (s === 'cancelled') return 'danger'
    return 'default'
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
        description="Unified view of all vendor inwards and customer invoices"
      />

      {/* Filters */}
      <Card className="mb-3 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
            <div className="relative col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              options={TYPE_OPTIONS}
              value={TYPE_OPTIONS.find(o => o.value === typeFilter)}
              onChange={(selected) => setTypeFilter(selected?.value ?? null)}
              placeholder="Type"
              isClearable
            />
            <Select
              options={STATUS_OPTIONS}
              value={STATUS_OPTIONS.find(o => o.value === statusFilter)}
              onChange={(selected) => setStatusFilter(selected?.value ?? null)}
              placeholder="Status"
              isClearable
            />
            <div className="col-span-2 sm:col-span-1 flex gap-2">
              <input
                type="date"
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <input
                type="date"
                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>All Transactions</span>
            <span className="text-sm font-normal text-gray-500">
              {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 font-medium">No transactions found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Ref No</TableHeader>
                      <TableHeader>Type</TableHeader>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Party</TableHeader>
                      <TableHeader>Total</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Action</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredTransactions.map((txn) => {
                      const typeMeta = TYPE_BADGE_MAP[txn.type] || { variant: 'default', icon: FileText }
                      const TypeIcon = typeMeta.icon
                      const statusVariant = getStatusVariant(txn.status)

                      return (
                        <TableRow key={`${txn.type}-${txn.id}`}>
                          <TableCell className="font-mono font-medium text-sm">{txn.ref_no || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <TypeIcon className="h-3.5 w-3.5" />
                              <Badge variant={typeMeta.variant}>
                                {txn.type === 'INWARD' ? 'Inward' : 'Invoice'}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            {txn.date
                              ? new Date(txn.date).toLocaleDateString('en-IN')
                              : '-'}
                          </TableCell>
                          <TableCell>{txn.party_name}</TableCell>
                          <TableCell className="font-semibold">
                            {txn.grand_total != null ? formatCurrency(txn.grand_total) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={statusVariant}>{txn.status || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleView(txn)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {filteredTransactions.map((txn, index) => {
                  const typeMeta = TYPE_BADGE_MAP[txn.type] || { variant: 'default', icon: FileText }
                  const TypeIcon = typeMeta.icon
                  const statusVariant = getStatusVariant(txn.status)

                  return (
                    <div
                      key={`${txn.type}-${txn.id}`}
                      className={`rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-all border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}
                      onClick={() => handleView(txn)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono font-semibold text-gray-900 text-sm">{txn.ref_no || '-'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{txn.party_name}</p>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2">
                          <TypeIcon className="h-3.5 w-3.5" />
                          <Badge variant={typeMeta.variant}>
                            {txn.type === 'INWARD' ? 'Inward' : 'Invoice'}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">
                          {txn.date ? new Date(txn.date).toLocaleDateString('en-IN') : '-'}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusVariant}>{txn.status || '-'}</Badge>
                          <span className="font-semibold text-gray-900">
                            {txn.grand_total != null ? formatCurrency(txn.grand_total) : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
