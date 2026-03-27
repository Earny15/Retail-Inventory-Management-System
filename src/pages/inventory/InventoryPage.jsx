import React, { useState, useMemo } from 'react'
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
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/gstCalculator'
import { Modal } from '../../components/ui/Modal'
import { generateInventoryReportPDF, generateInventoryReportCSV } from '../../utils/reportGenerator'
import toast from 'react-hot-toast'
import {
  Package,
  Search,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  RefreshCw,
  FileDown
} from 'lucide-react'

export default function InventoryPage() {
  const { user, hasPermission } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState(null)
  const [stockFilter, setStockFilter] = useState(null)
  const [selectedSku, setSelectedSku] = useState(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [isGeneratingReport, setIsGeneratingReport] = useState(false)

  // Fetch company for report header
  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('company_name').order('created_at', { ascending: false }).limit(1).single()
      if (error) throw error
      return data
    }
  })

  // Fetch categories for filter
  const { data: categories = [] } = useQuery({
    queryKey: ['sku-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sku_categories')
        .select('id, category_name')
        .order('category_name')
      if (error) throw error
      return data
    }
  })

  // Fetch inventory with SKU and category join
  const { data: inventory = [], isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['inventory-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          sku_id,
          current_stock,
          reserved_stock,
          available_stock,
          average_cost,
          last_purchase_cost,
          last_purchase_date,
          updated_at,
          skus (
            id,
            sku_code,
            sku_name,
            unit_of_measure,
            reorder_level,
            category_id,
            sku_categories (
              id,
              category_name
            )
          )
        `)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    refetchInterval: 60000
  })

  // Slide-over: fetch last 10 inward items for selected SKU
  const { data: skuInwardTxns = [], isLoading: loadingInward } = useQuery({
    queryKey: ['sku-inward-txns', selectedSku?.sku_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_inward_items')
        .select(`
          id,
          quantity,
          sku_id,
          inward_id,
          vendor_inwards (
            id,
            inward_number,
            inward_date,
            status,
            vendor_id,
            vendors ( vendor_name )
          )
        `)
        .eq('sku_id', selectedSku.sku_id)
        .order('id', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data || []).filter(d => d.vendor_inwards)
    },
    enabled: !!selectedSku
  })

  // Slide-over: fetch last 10 outward (invoice) items for selected SKU
  const { data: skuOutwardTxns = [], isLoading: loadingOutward } = useQuery({
    queryKey: ['sku-outward-txns', selectedSku?.sku_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoice_items')
        .select(`
          id,
          quantity,
          sku_id,
          invoice_id,
          customer_invoices (
            id,
            invoice_number,
            invoice_date,
            status,
            customer_id,
            customers ( customer_name )
          )
        `)
        .eq('sku_id', selectedSku.sku_id)
        .order('id', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data || []).filter(d => d.customer_invoices)
    },
    enabled: !!selectedSku
  })

  const categoryOptions = useMemo(() => [
    { value: null, label: 'All Categories' },
    ...categories.map(c => ({ value: c.id, label: c.category_name }))
  ], [categories])

  const stockFilterOptions = [
    { value: null, label: 'All' },
    { value: 'ok', label: 'OK' },
    { value: 'low', label: 'Low Stock' },
    { value: 'out', label: 'Out of Stock' }
  ]

  const getStockStatus = (item) => {
    const qty = item.current_stock ?? 0
    const reorder = item.skus?.reorder_level ?? 0
    if (qty <= 0) return { label: 'Out of Stock', variant: 'danger' }
    if (reorder > 0 && qty <= reorder) return { label: 'Low Stock', variant: 'warning' }
    return { label: 'In Stock', variant: 'success' }
  }

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const sku = item.skus
      if (!sku) return false

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesName = sku.sku_name?.toLowerCase().includes(term)
        const matchesCode = sku.sku_code?.toLowerCase().includes(term)
        if (!matchesName && !matchesCode) return false
      }

      // Category filter
      if (categoryFilter) {
        if (sku.category_id !== categoryFilter) return false
      }

      // Stock status filter
      if (stockFilter) {
        const status = getStockStatus(item)
        if (stockFilter === 'ok' && status.variant !== 'success') return false
        if (stockFilter === 'low' && status.variant !== 'warning') return false
        if (stockFilter === 'out' && status.variant !== 'danger') return false
      }

      return true
    })
  }, [inventory, searchTerm, categoryFilter, stockFilter])

  const handleRowClick = (item) => {
    setSelectedSku(item)
    setPanelOpen(true)
  }

  const handleGenerateReport = (format) => {
    setIsGeneratingReport(true)
    try {
      const data = filteredInventory
      if (!data || data.length === 0) {
        toast.error('No inventory items to export')
        return
      }
      if (format === 'pdf') {
        generateInventoryReportPDF(data, { companyName: company?.company_name })
      } else {
        generateInventoryReportCSV(data)
      }
      toast.success(`${format.toUpperCase()} report downloaded!`)
      setReportModalOpen(false)
    } catch (err) {
      toast.error('Report generation failed: ' + err.message)
    } finally {
      setIsGeneratingReport(false)
    }
  }

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString('en-IN')
    : null

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
        title="Inventory"
        description={lastUpdated ? `Last updated: ${lastUpdated}` : 'Current stock levels'}
        actions={
          <Button variant="outline" onClick={() => setReportModalOpen(true)}>
            <FileDown className="h-4 w-4 mr-2" />
            Report
          </Button>
        }
      />

      {/* Filters */}
      <Card className="mb-3 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            <div className="relative col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search SKU..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              options={categoryOptions}
              value={categoryOptions.find(o => o.value === categoryFilter)}
              onChange={(selected) => setCategoryFilter(selected?.value ?? null)}
              placeholder="Category"
              isClearable
            />
            <Select
              options={stockFilterOptions}
              value={stockFilterOptions.find(o => o.value === stockFilter)}
              onChange={(selected) => setStockFilter(selected?.value ?? null)}
              placeholder="Stock Status"
              isClearable
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventory Table - Desktop */}
      <Card>
        <CardContent className="p-0">
          {filteredInventory.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500 font-medium">No inventory items found</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>SKU Code</TableHeader>
                      <TableHeader>SKU Name</TableHeader>
                      <TableHeader>Category</TableHeader>
                      <TableHeader>Current Stock</TableHeader>
                      <TableHeader>Unit</TableHeader>
                      <TableHeader>Reorder Level</TableHeader>
                      <TableHeader>Status</TableHeader>
                      <TableHeader>Last Updated</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredInventory.map((item) => {
                      const sku = item.skus
                      const status = getStockStatus(item)
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer"
                          onClick={() => handleRowClick(item)}
                        >
                          <TableCell className="font-medium font-mono">{sku?.sku_code}</TableCell>
                          <TableCell>{sku?.sku_name}</TableCell>
                          <TableCell>{sku?.sku_categories?.category_name || '-'}</TableCell>
                          <TableCell className="font-semibold">{item.current_stock ?? 0}</TableCell>
                          <TableCell>{sku?.unit_of_measure || '-'}</TableCell>
                          <TableCell>{sku?.reorder_level ?? '-'}</TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell className="text-gray-500 text-xs">
                            {item.updated_at
                              ? new Date(item.updated_at).toLocaleDateString('en-IN')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {filteredInventory.map((item, index) => {
                  const sku = item.skus
                  const status = getStockStatus(item)
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-all border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}
                      onClick={() => handleRowClick(item)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-gray-900 truncate">{sku?.sku_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{sku?.sku_code}</p>
                        </div>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">{sku?.sku_categories?.category_name || 'Uncategorized'}</span>
                        <span className="font-bold text-gray-900">
                          {item.current_stock ?? 0} <span className="font-normal text-gray-500">{sku?.unit_of_measure || ''}</span>
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Generate Report Modal */}
      <Modal isOpen={reportModalOpen} onClose={() => setReportModalOpen(false)} title="Generate Inventory Report" size="md">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Download the current inventory report with all stock details. The report will include items matching your current filters.
          </p>
          <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-600">
            <p><strong>{filteredInventory.length}</strong> items will be included based on your current filters.</p>
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

      {/* Slide-over Panel */}
      {panelOpen && selectedSku && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-gray-500 bg-opacity-50" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-y-0 right-0 max-w-lg w-full bg-white shadow-xl flex flex-col">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedSku.skus?.sku_code} - {selectedSku.skus?.sku_name}
                </h3>
                <p className="text-sm text-gray-500">
                  {selectedSku.skus?.sku_categories?.category_name || 'Uncategorized'}
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Current Stock Card */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Current Stock</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {selectedSku.current_stock ?? 0} <span className="text-base font-normal text-gray-500">{selectedSku.skus?.unit_of_measure}</span>
                    </p>
                  </div>
                  <Badge variant={getStockStatus(selectedSku).variant}>
                    {getStockStatus(selectedSku).label}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-gray-500">
                  Reorder Level: {selectedSku.skus?.reorder_level ?? 'Not set'}
                </div>
                {selectedSku.average_cost != null && (
                  <div className="mt-1 text-sm text-gray-500">
                    Avg Cost: {formatCurrency(selectedSku.average_cost)}
                  </div>
                )}
              </div>

              {/* Inward Transactions */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                  Last 10 Inward Entries
                </h4>
                {loadingInward ? (
                  <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                ) : skuInwardTxns.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3">No inward entries found</p>
                ) : (
                  <div className="space-y-2">
                    {skuInwardTxns.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-3 bg-green-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{txn.vendor_inwards?.inward_number}</p>
                          <p className="text-xs text-gray-500">
                            {txn.vendor_inwards?.vendors?.vendor_name || 'Unknown'} &middot;{' '}
                            {txn.vendor_inwards?.inward_date
                              ? new Date(txn.vendor_inwards.inward_date).toLocaleDateString('en-IN')
                              : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-700">+{txn.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outward Transactions */}
              <div>
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                  <ArrowUpRight className="h-4 w-4 text-red-600" />
                  Last 10 Invoice Entries
                </h4>
                {loadingOutward ? (
                  <div className="flex justify-center py-4"><Spinner size="sm" /></div>
                ) : skuOutwardTxns.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3">No invoice entries found</p>
                ) : (
                  <div className="space-y-2">
                    {skuOutwardTxns.map((txn) => (
                      <div key={txn.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{txn.customer_invoices?.invoice_number}</p>
                          <p className="text-xs text-gray-500">
                            {txn.customer_invoices?.customers?.customer_name || 'Unknown'} &middot;{' '}
                            {txn.customer_invoices?.invoice_date
                              ? new Date(txn.customer_invoices.invoice_date).toLocaleDateString('en-IN')
                              : '-'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-red-700">-{txn.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
