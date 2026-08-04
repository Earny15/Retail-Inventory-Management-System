import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { Plus, Search, Notebook, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 20

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'CANCELLED', label: 'Cancelled' }
]

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2
}).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NoteKeepingListPage() {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [customerFilter, setCustomerFilter] = useState([])
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(0)

  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list-nk'],
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

  const { data: queryResult, isLoading } = useQuery({
    queryKey: ['nk-invoices', statusFilter, customerFilter, startDate, endDate, searchTerm, page],
    queryFn: async () => {
      let query = supabase
        .from('note_keeping_invoices')
        .select(`
          id, invoice_number, invoice_date, customer_id, status, total_amount,
          converted_from_invoice_number,
          customers(customer_name),
          note_keeping_invoice_items(id)
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

  const filtersActive = !!(searchTerm || statusFilter || customerFilter.length > 0 || startDate || endDate)

  const { data: filteredStats } = useQuery({
    queryKey: ['nk-invoice-stats', statusFilter, customerFilter, startDate, endDate, searchTerm],
    queryFn: async () => {
      let q = supabase
        .from('note_keeping_invoices')
        .select('total_amount', { count: 'exact' })
      if (statusFilter) q = q.eq('status', statusFilter)
      if (customerFilter.length > 0) q = q.in('customer_id', customerFilter)
      if (startDate) q = q.gte('invoice_date', startDate)
      if (endDate) q = q.lte('invoice_date', endDate)
      if (searchTerm) q = q.ilike('invoice_number', `%${searchTerm}%`)
      const { data, error, count } = await q
      if (error) throw error
      const total = (data || []).reduce((s, r) => s + (r.total_amount || 0), 0)
      return { total, count: count || 0 }
    },
    enabled: filtersActive
  })

  const getStatusBadge = (status) => {
    if (status === 'ACTIVE') return <Badge variant="info">ACTIVE</Badge>
    if (status === 'CANCELLED') return <Badge variant="danger">CANCELLED</Badge>
    return <Badge variant="default">{status}</Badge>
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>
  }

  return (
    <div>
      <PageHeader
        title="Note Keeping"
        description="Cash / off-GST entries — parallel to customer invoices, no tax breakdown"
        actions={
          <div className="flex gap-2">
            <Link to="/note-keeping/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Note Keeping
              </Button>
            </Link>
          </div>
        }
      />

      {filtersActive && filteredStats && (
        <div className="mb-4 sm:mb-6">
          <div className="text-xs sm:text-sm text-gray-500 mb-2">
            Stats for {filteredStats.count} filtered note{filteredStats.count === 1 ? '' : 's'}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-navy-100 bg-navy-50 p-4">
              <div className="text-xs font-medium text-navy-700 uppercase tracking-wide">Total Amount</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-navy-900">{formatCurrency(filteredStats.total)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Records</div>
              <div className="mt-1 text-xl sm:text-2xl font-bold text-gray-900">{filteredStats.count}</div>
            </div>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Note Keeping Entries</CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mt-2 sm:mt-4">
            <div className="relative col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search number..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(0) }}
              />
            </div>
            <Select
              isMulti
              options={customerOptions}
              value={customerOptions.filter(o => customerFilter.includes(o.value))}
              onChange={(selected) => { setCustomerFilter((selected || []).map(o => o.value)); setPage(0) }}
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
              <Notebook className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No note-keeping entries found</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Number</TableHeader>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Customer</TableHeader>
                      <TableHeader>Items</TableHeader>
                      <TableHeader>Total</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Source</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {invoices.map(inv => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/note-keeping/${inv.id}`)}
                      >
                        <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                        <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                        <TableCell>{inv.customers?.customer_name || '-'}</TableCell>
                        <TableCell>{inv.note_keeping_invoice_items?.length || 0}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {inv.converted_from_invoice_number
                            ? `from ${inv.converted_from_invoice_number}`
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden space-y-3 p-4">
                {invoices.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`rounded-xl p-4 space-y-2 cursor-pointer active:scale-[0.98] transition-all border ${i % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}
                    onClick={() => navigate(`/note-keeping/${inv.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{inv.invoice_number}</div>
                        <div className="text-sm text-gray-500">{formatDate(inv.invoice_date)}</div>
                      </div>
                      {getStatusBadge(inv.status)}
                    </div>
                    <div className="text-sm text-gray-700">{inv.customers?.customer_name || '-'}</div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500">{inv.note_keeping_invoice_items?.length || 0} items</span>
                      <span className="font-bold text-gray-900">{formatCurrency(inv.total_amount)}</span>
                    </div>
                    {inv.converted_from_invoice_number && (
                      <div className="text-xs text-gray-400">from {inv.converted_from_invoice_number}</div>
                    )}
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
    </div>
  )
}
