import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { useVendors } from '../../hooks/useVendors'
import { getInwardList } from '../../services/inwardService'
import { useQuery } from '@tanstack/react-query'
import PermissionGate from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import {
  Plus,
  Search,
  FileText,
  Calendar,
  Package,
  Eye,
  Filter,
  RefreshCcw
} from 'lucide-react'

function StatusBadge({ status }) {
  const statusConfig = {
    'CONFIRMED': { variant: 'success', label: 'Confirmed' },
    'REVERSED': { variant: 'danger', label: 'Reversed' },
    'PROCESSING': { variant: 'warning', label: 'Processing' },
    'FAILED': { variant: 'danger', label: 'Failed' }
  }

  const config = statusConfig[status] || { variant: 'default', label: status }
  return <Badge variant={config.variant}>{config.label}</Badge>
}


export default function InwardListPage() {
  const navigate = useNavigate()
  const { canCreate } = usePermissions()
  const { vendors } = useVendors()

  // Filters state
  const [filters, setFilters] = useState({
    vendorId: '',
    status: '',
    startDate: '',
    endDate: '',
    search: ''
  })

  // Fetch inward transactions
  const {
    data: inwardList = [],
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['inward-list', filters],
    queryFn: () => getInwardList(filters),
    refetchOnWindowFocus: false
  })

  // Vendor options for filter dropdown
  const vendorOptions = [
    { value: '', label: 'All Vendors' },
    ...vendors
      .filter(v => v.is_active)
      .map(v => ({
        value: v.id,
        label: `${v.vendor_code} - ${v.vendor_name}`
      }))
  ]

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'CONFIRMED', label: 'Confirmed' },
    { value: 'REVERSED', label: 'Reversed' },
    { value: 'PROCESSING', label: 'Processing' },
    { value: 'FAILED', label: 'Failed' }
  ]

  // Apply search filter
  const filteredInward = inwardList.filter(inward => {
    if (!filters.search) return true

    const searchTerm = filters.search.toLowerCase()
    return (
      (inward.inward_number || '').toLowerCase().includes(searchTerm) ||
      inward.vendors?.vendor_name?.toLowerCase().includes(searchTerm) ||
      inward.notes?.toLowerCase().includes(searchTerm)
    )
  })

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const clearFilters = () => {
    setFilters({
      vendorId: '',
      status: '',
      startDate: '',
      endDate: '',
      search: ''
    })
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title="Vendor Inward"
          description="AI-powered vendor invoice processing and inventory management"
        />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load inward transactions</p>
            <Button onClick={() => refetch()} variant="outline">
              <RefreshCcw className="h-4 w-4 mr-2" />
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
        title="Vendor Inward"
        description="AI-powered vendor invoice processing and inventory management"
        actions={
          <PermissionGate module="vendor_inward" action="create">
            <Button onClick={() => navigate('/inward/new')}>
              <Plus className="h-4 w-4 mr-2" />
              New Inward
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Inward Transactions</CardTitle>

          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mt-2 sm:mt-4">
            {/* Search */}
            <div className="relative col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search reference, vendor..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={filters.search}
                onChange={(e) => updateFilter('search', e.target.value)}
              />
            </div>

            {/* Vendor Filter */}
            <Select
              options={vendorOptions}
              value={vendorOptions.find(opt => opt.value === filters.vendorId)}
              onChange={(selected) => updateFilter('vendorId', selected?.value || '')}
              placeholder="Vendor"
            />

            {/* Status Filter */}
            <Select
              options={statusOptions}
              value={statusOptions.find(opt => opt.value === filters.status)}
              onChange={(selected) => updateFilter('status', selected?.value || '')}
              placeholder="Status"
            />

            {/* Clear Filters */}
            <Button
              variant="outline"
              onClick={clearFilters}
              className="col-span-2 sm:col-span-1 flex items-center justify-center"
              size="sm"
            >
              <Filter className="h-4 w-4 mr-1" />
              Clear
            </Button>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 mt-2 sm:mt-4">
            <Input
              type="date"
              label="From"
              value={filters.startDate}
              onChange={(e) => updateFilter('startDate', e.target.value)}
            />
            <Input
              type="date"
              label="To"
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
          ) : filteredInward.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No inward transactions found</p>
              {canCreate('vendor_inward') && (
                <Button onClick={() => navigate('/inward/new')} className="mt-3">
                  Create your first inward
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table */}
              <div className="hidden lg:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Inward No</TableHeader>
                      <TableHeader>Date</TableHeader>
                      <TableHeader>Vendor</TableHeader>
                      <TableHeader>Items</TableHeader>
                      <TableHeader>Total Amount</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInward.map((inward) => (
                      <TableRow key={inward.id}>
                        <TableCell className="font-medium">
                          {inward.inward_number}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                            {formatDate(inward.inward_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {inward.vendors?.vendor_name || 'Unknown Vendor'}
                            </div>
                            {inward.inward_number?.startsWith('REV-') && (
                              <div className="text-xs text-gray-500">
                                Reversal
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <FileText className="h-4 w-4 mr-1 text-gray-400" />
                            {inward.items_count} items
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className={`font-medium ${
                            inward.total_amount < 0 ? 'text-red-600' : 'text-gray-900'
                          }`}>
                            {formatCurrency(Math.abs(inward.total_amount || 0))}
                            {inward.total_amount < 0 && (
                              <span className="text-xs block text-red-500">
                                (Reversed)
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={inward.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/inward/${inward.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3 p-4">
                {filteredInward.map((inward, index) => (
                  <div
                    key={inward.id}
                    className={`rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-all border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}
                    onClick={() => navigate(`/inward/${inward.id}`)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="font-medium text-gray-900">
                          {inward.inward_number}
                        </div>
                        <div className="text-sm text-gray-600">
                          {inward.vendors?.vendor_name || 'Unknown Vendor'}
                        </div>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={inward.status} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <div className="text-gray-500">Date</div>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          {formatDate(inward.inward_date)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-500">Items</div>
                        <div className="flex items-center">
                          <FileText className="h-3 w-3 mr-1 text-gray-400" />
                          {inward.items_count} items
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between items-center">
                      <div>
                        <div className="text-sm text-gray-500">Total Amount</div>
                        <div className={`font-semibold ${
                          inward.total_amount < 0 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {formatCurrency(Math.abs(inward.total_amount || 0))}
                          {inward.total_amount < 0 && (
                            <span className="text-xs block text-red-500">
                              (Reversed)
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/inward/${inward.id}`)
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>

                    {inward.inward_number?.startsWith('REV-') && (
                      <div className="mt-2 text-xs text-gray-500 bg-orange-50 px-2 py-1 rounded">
                        Reversal
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {filteredInward.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mt-3 sm:mt-6">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-navy-600">
                {filteredInward.length}
              </div>
              <div className="text-sm text-gray-600">Total Transactions</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {filteredInward.filter(t => t.status === 'CONFIRMED').length}
              </div>
              <div className="text-sm text-gray-600">Confirmed</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">
                {filteredInward.filter(t => t.status === 'REVERSED').length}
              </div>
              <div className="text-sm text-gray-600">Reversed</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(
                  filteredInward
                    .filter(t => t.status === 'CONFIRMED' && !t.inward_number?.startsWith('REV-'))
                    .reduce((sum, t) => sum + (t.total_amount || 0), 0)
                )}
              </div>
              <div className="text-sm text-gray-600">Total Value</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}