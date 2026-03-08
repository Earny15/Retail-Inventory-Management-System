import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useInventory } from '../../hooks/useInventory.jsx'
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
  Package,
  Search,
  Edit3,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  IndianRupee,
  History,
  Settings,
  Plus,
  Minus
} from 'lucide-react'

const stockAdjustmentSchema = z.object({
  newStock: z.number().min(0, 'Stock cannot be negative'),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional()
})

const reorderLevelSchema = z.object({
  reorderLevel: z.number().min(0, 'Reorder level cannot be negative'),
  minStockLevel: z.number().min(0, 'Minimum stock level cannot be negative'),
  maxStockLevel: z.number().min(0, 'Maximum stock level cannot be negative')
})

function StockAdjustmentForm({ inventory, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(stockAdjustmentSchema),
    defaultValues: {
      newStock: inventory?.current_stock || 0,
      reason: '',
      notes: ''
    }
  })

  const reasonOptions = [
    { value: 'Damage', label: 'Damaged Stock' },
    { value: 'Theft', label: 'Theft/Loss' },
    { value: 'Count Adjustment', label: 'Physical Count Adjustment' },
    { value: 'Quality Issue', label: 'Quality Issue' },
    { value: 'Return', label: 'Customer Return' },
    { value: 'Other', label: 'Other' }
  ]

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{inventory?.sku?.sku_code} - {inventory?.sku?.sku_name}</h4>
            <p className="text-sm text-gray-600">Company: {inventory?.company?.company_name}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Current Stock</p>
            <p className="text-2xl font-bold text-gray-900">{inventory?.current_stock}</p>
          </div>
        </div>
      </div>

      <Input
        label="New Stock Level"
        type="number"
        step="0.01"
        required
        {...register('newStock', { valueAsNumber: true })}
        error={errors.newStock?.message}
      />

      <Select
        label="Reason"
        required
        options={reasonOptions}
        placeholder="Select reason for adjustment..."
        {...register('reason')}
        error={errors.reason?.message}
      />

      <Input
        label="Notes"
        placeholder="Additional notes about this adjustment"
        {...register('notes')}
        error={errors.notes?.message}
      />

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Update Stock
        </Button>
      </div>
    </form>
  )
}

function ReorderLevelForm({ inventory, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(reorderLevelSchema),
    defaultValues: {
      reorderLevel: inventory?.sku?.reorder_level || 0,
      minStockLevel: inventory?.sku?.min_stock_level || 0,
      maxStockLevel: inventory?.sku?.max_stock_level || 0
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-medium">{inventory?.sku?.sku_code} - {inventory?.sku?.sku_name}</h4>
        <p className="text-sm text-gray-600">Current Stock: {inventory?.current_stock}</p>
      </div>

      <Input
        label="Minimum Stock Level"
        type="number"
        step="0.01"
        required
        {...register('minStockLevel', { valueAsNumber: true })}
        error={errors.minStockLevel?.message}
      />

      <Input
        label="Reorder Level"
        type="number"
        step="0.01"
        required
        {...register('reorderLevel', { valueAsNumber: true })}
        error={errors.reorderLevel?.message}
        helpText="System will alert when stock reaches this level"
      />

      <Input
        label="Maximum Stock Level"
        type="number"
        step="0.01"
        required
        {...register('maxStockLevel', { valueAsNumber: true })}
        error={errors.maxStockLevel?.message}
      />

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Update Levels
        </Button>
      </div>
    </form>
  )
}

export default function InventoryPage() {
  const { canEdit } = usePermissions()
  const {
    inventory,
    transactions,
    lowStockItems,
    inventorySummary,
    isLoading,
    updateStock,
    setReorderLevel,
    isUpdating
  } = useInventory()

  const [activeTab, setActiveTab] = useState('inventory')
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false)
  const [selectedInventory, setSelectedInventory] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [companyFilter, setCompanyFilter] = useState('all')

  // Filter inventory
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.sku?.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.sku?.sku_code.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStock = stockFilter === 'all' ||
                        (stockFilter === 'low' && item.current_stock <= (item.sku?.reorder_level || 0)) ||
                        (stockFilter === 'out' && item.current_stock <= 0) ||
                        (stockFilter === 'normal' && item.current_stock > (item.sku?.reorder_level || 0))

    const matchesCompany = companyFilter === 'all' || item.company_id === companyFilter

    return matchesSearch && matchesStock && matchesCompany
  })

  const handleStockAdjustment = (inventory) => {
    setSelectedInventory(inventory)
    setIsStockModalOpen(true)
  }

  const handleReorderLevelSetting = (inventory) => {
    setSelectedInventory(inventory)
    setIsReorderModalOpen(true)
  }

  const handleStockSubmit = (data) => {
    updateStock({
      inventoryId: selectedInventory.id,
      ...data
    })
    setIsStockModalOpen(false)
  }

  const handleReorderSubmit = (data) => {
    setReorderLevel({
      skuId: selectedInventory.sku_id,
      ...data
    })
    setIsReorderModalOpen(false)
  }

  const stockFilterOptions = [
    { value: 'all', label: 'All Stock' },
    { value: 'normal', label: 'Normal Stock' },
    { value: 'low', label: 'Low Stock' },
    { value: 'out', label: 'Out of Stock' }
  ]

  const uniqueCompanies = [...new Set(inventory.map(item => item.company))]
  const companyFilterOptions = [
    { value: 'all', label: 'All Companies' },
    ...uniqueCompanies.map(company => ({
      value: company?.id,
      label: company?.company_name
    }))
  ]

  const getStockStatus = (item) => {
    if (item.current_stock <= 0) return { label: 'Out of Stock', variant: 'danger' }
    if (item.current_stock <= (item.sku?.reorder_level || 0)) return { label: 'Low Stock', variant: 'warning' }
    return { label: 'Normal', variant: 'success' }
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
        title="Inventory Management"
        description="Track stock levels, manage inventory, and monitor alerts"
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Items</p>
                <p className="text-2xl font-bold text-gray-900">{inventorySummary.totalItems}</p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{inventorySummary.totalValue.toLocaleString('en-IN')}
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
                <p className="text-sm font-medium text-gray-600">Low Stock Alerts</p>
                <p className="text-2xl font-bold text-amber-600">{inventorySummary.lowStockCount}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Out of Stock</p>
                <p className="text-2xl font-bold text-red-600">{inventorySummary.outOfStockCount}</p>
              </div>
              <div className="p-3 rounded-full bg-red-100">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('inventory')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'inventory'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Package className="h-4 w-4" />
                <span>Current Inventory</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'transactions'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <History className="h-4 w-4" />
                <span>Stock Movements</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'alerts'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Low Stock Alerts</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Current Inventory Tab */}
      {activeTab === 'inventory' && (
        <Card>
          <CardHeader>
            <CardTitle>Current Inventory</CardTitle>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search SKUs..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                options={stockFilterOptions}
                value={stockFilterOptions.find(opt => opt.value === stockFilter)}
                onChange={(selected) => setStockFilter(selected?.value || 'all')}
                className="w-full lg:w-48"
              />
              <Select
                options={companyFilterOptions}
                value={companyFilterOptions.find(opt => opt.value === companyFilter)}
                onChange={(selected) => setCompanyFilter(selected?.value || 'all')}
                className="w-full lg:w-48"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredInventory.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No inventory items found</p>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>SKU Code</TableHeader>
                    <TableHeader>Product Name</TableHeader>
                    <TableHeader>Company</TableHeader>
                    <TableHeader>Current Stock</TableHeader>
                    <TableHeader>Reorder Level</TableHeader>
                    <TableHeader>Avg. Cost</TableHeader>
                    <TableHeader>Total Value</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredInventory.map((item) => {
                    const status = getStockStatus(item)
                    const totalValue = item.current_stock * (item.average_cost || 0)

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.sku?.sku_code}</TableCell>
                        <TableCell>{item.sku?.sku_name}</TableCell>
                        <TableCell>{item.company?.company_name}</TableCell>
                        <TableCell>{item.current_stock} {item.sku?.unit_of_measure}</TableCell>
                        <TableCell>{item.sku?.reorder_level || '-'}</TableCell>
                        <TableCell>₹{item.average_cost?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>₹{totalValue.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <PermissionGate module="inventory" action="edit">
                              <button
                                onClick={() => handleStockAdjustment(item)}
                                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                title="Adjust Stock"
                              >
                                <Edit3 className="h-4 w-4" />
                              </button>
                            </PermissionGate>

                            <PermissionGate module="inventory" action="edit">
                              <button
                                onClick={() => handleReorderLevelSetting(item)}
                                className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                                title="Set Reorder Levels"
                              >
                                <Settings className="h-4 w-4" />
                              </button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock Movements Tab */}
      {activeTab === 'transactions' && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Stock Movements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No stock movements found</p>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Date</TableHeader>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Quantity</TableHeader>
                    <TableHeader>Reference</TableHeader>
                    <TableHeader>Notes</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString('en-IN')}
                      </TableCell>
                      <TableCell>
                        {transaction.sku?.sku_code} - {transaction.sku?.sku_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-1">
                          {transaction.transaction_type === 'stock_in' ? (
                            <TrendingUp className="h-4 w-4 text-green-600" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-600" />
                          )}
                          <span className={transaction.transaction_type === 'stock_in' ? 'text-green-600' : 'text-red-600'}>
                            {transaction.transaction_type === 'stock_in' ? 'Stock In' : 'Stock Out'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{transaction.quantity}</TableCell>
                      <TableCell>
                        {transaction.vendor_inward?.inward_number ||
                         transaction.customer_invoice?.invoice_number ||
                         'Manual'}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {transaction.notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Low Stock Alerts Tab */}
      {activeTab === 'alerts' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span>Low Stock Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 mx-auto text-green-400 mb-3" />
                <p className="text-green-600 font-medium">All stock levels are healthy!</p>
                <p className="text-gray-500">No low stock alerts at this time.</p>
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>SKU Code</TableHeader>
                    <TableHeader>Product Name</TableHeader>
                    <TableHeader>Current Stock</TableHeader>
                    <TableHeader>Reorder Level</TableHeader>
                    <TableHeader>Min. Level</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowStockItems.map((item) => (
                    <TableRow key={item.id} className="bg-amber-50">
                      <TableCell className="font-medium">{item.sku?.sku_code}</TableCell>
                      <TableCell>{item.sku?.sku_name}</TableCell>
                      <TableCell>
                        <span className="font-medium text-amber-600">
                          {item.current_stock} {item.sku?.unit_of_measure}
                        </span>
                      </TableCell>
                      <TableCell>{item.sku?.reorder_level || '-'}</TableCell>
                      <TableCell>{item.sku?.min_stock_level || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="warning">Low Stock</Badge>
                      </TableCell>
                      <TableCell>
                        <PermissionGate module="inventory" action="edit">
                          <Button
                            size="sm"
                            onClick={() => handleStockAdjustment(item)}
                          >
                            Restock
                          </Button>
                        </PermissionGate>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={isStockModalOpen}
        onClose={() => setIsStockModalOpen(false)}
        title="Adjust Stock Level"
      >
        <StockAdjustmentForm
          inventory={selectedInventory}
          onClose={() => setIsStockModalOpen(false)}
          onSubmit={handleStockSubmit}
          isLoading={isUpdating}
        />
      </Modal>

      {/* Reorder Level Modal */}
      <Modal
        isOpen={isReorderModalOpen}
        onClose={() => setIsReorderModalOpen(false)}
        title="Set Stock Levels"
      >
        <ReorderLevelForm
          inventory={selectedInventory}
          onClose={() => setIsReorderModalOpen(false)}
          onSubmit={handleReorderSubmit}
          isLoading={isUpdating}
        />
      </Modal>
    </div>
  )
}