import React, { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuotations } from '../../hooks/useQuotations'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Plus, Eye, Search } from 'lucide-react'

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

export default function QuotationListPage() {
  const navigate = useNavigate()
  const { quotations, isLoading } = useQuotations()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const filtered = useMemo(() => {
    return quotations.filter(q => {
      const matchesSearch = !searchTerm ||
        q.quotation_uid?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.customers?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatus = !statusFilter || q.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [quotations, searchTerm, statusFilter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Sales Quotations"
        description={`${quotations.length} quotation(s)`}
        actions={
          <Button onClick={() => navigate('/quotations/new')}>
            <Plus className="h-4 w-4 mr-2" />
            New Quotation
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by UID or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Quotation UID</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Items</TableHeader>
                  <TableHeader>Total Amount</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No quotations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(q => (
                    <TableRow key={q.id} className="hover:bg-gray-50">
                      <TableCell>
                        <Link to={`/quotations/${q.id}`} className="text-primary-600 font-medium hover:underline">
                          {q.quotation_uid}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(q.quotation_date)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{q.customers?.customer_name || '-'}</div>
                        <div className="text-xs text-gray-500">
                          {q.customers?.billing_city}, {q.customers?.billing_state}
                        </div>
                      </TableCell>
                      <TableCell>{q.sales_quotation_items?.length || 0}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(q.total_amount)}</TableCell>
                      <TableCell>
                        {q.status === 'ACTIVE' && <Badge variant="info">ACTIVE</Badge>}
                        {q.status === 'CANCELLED' && <Badge variant="danger">CANCELLED</Badge>}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/quotations/${q.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-gray-500">
              No quotations found
            </CardContent>
          </Card>
        ) : (
          filtered.map(q => (
            <Card key={q.id} className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/quotations/${q.id}`)}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold text-primary-600">{q.quotation_uid}</div>
                    <div className="text-sm text-gray-500">{formatDate(q.quotation_date)}</div>
                  </div>
                  {q.status === 'ACTIVE' && <Badge variant="info">ACTIVE</Badge>}
                  {q.status === 'CANCELLED' && <Badge variant="danger">CANCELLED</Badge>}
                </div>
                <div className="text-sm font-medium">{q.customers?.customer_name || '-'}</div>
                <div className="text-xs text-gray-500 mb-2">
                  {q.customers?.billing_city}, {q.customers?.billing_state}
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-sm text-gray-500">{q.sales_quotation_items?.length || 0} item(s)</span>
                  <span className="font-bold text-navy-600">{formatCurrency(q.total_amount)}</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
