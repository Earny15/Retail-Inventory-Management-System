import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSKUs } from '../../hooks/useSKUs.jsx'
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
  Edit3,
  ToggleLeft,
  ToggleRight,
  Package,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

const uomOptions = [
  { value: 'PCS', label: 'PCS' },
  { value: 'KGS', label: 'KGS' },
  { value: 'MTR', label: 'MTR' },
  { value: 'SQM', label: 'SQM' },
  { value: 'BOX', label: 'BOX' },
  { value: 'SET', label: 'SET' },
  { value: 'LTR', label: 'LTR' }
]

const gstRateOptions = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' }
]

const skuSchema = z.object({
  sku_code: z.string().optional(),
  sku_name: z.string().min(2, 'SKU name must be at least 2 characters'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Category is required'),
  primary_uom: z.string().min(1, 'Primary UOM is required'),
  secondary_uom: z.string().optional(),
  conversion_factor: z.number().positive('Conversion factor must be positive').optional(),
  default_selling_price: z.number().min(0, 'Price must be positive').optional(),
  gst_rate: z.number().min(0).max(28, 'GST rate must be between 0 and 28'),
  hsn_code: z.string().optional(),
  reorder_level: z.number().min(0, 'Reorder level must be positive').optional()
})

function SKUForm({ sku = null, onClose, onSubmit, isLoading, categories }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(skuSchema),
    defaultValues: {
      sku_code: sku?.sku_code || '',
      sku_name: sku?.sku_name || '',
      description: sku?.description || '',
      category_id: sku?.category_id || '',
      primary_uom: sku?.unit_of_measure || sku?.primary_uom || 'PCS',
      secondary_uom: sku?.secondary_uom || '',
      conversion_factor: sku?.conversion_factor || '',
      default_selling_price: '',
      gst_rate: sku?.gst_rate || 18,
      hsn_code: sku?.hsn_code || '',
      reorder_level: sku?.reorder_level || ''
    }
  })

  const secondaryUOM = watch('secondary_uom')

  const categoryOptions = categories.map(cat => ({
    value: cat.id,
    label: cat.category_name
  }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="SKU Code"
          placeholder="Auto-generated if empty"
          {...register('sku_code')}
          error={errors.sku_code?.message}
        />
        <Input
          label="SKU Name"
          required
          {...register('sku_name')}
          error={errors.sku_name?.message}
        />
      </div>

      <Input
        label="Description"
        {...register('description')}
        error={errors.description?.message}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Category"
          required
          options={categoryOptions}
          value={categoryOptions.find(opt => opt.value === watch('category_id'))}
          onChange={(selected) => setValue('category_id', selected?.value || '')}
          error={errors.category_id?.message}
        />
        <Select
          label="Primary UOM"
          required
          options={uomOptions}
          value={uomOptions.find(opt => opt.value === watch('primary_uom'))}
          onChange={(selected) => setValue('primary_uom', selected?.value || '')}
          error={errors.primary_uom?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Secondary UOM"
          options={uomOptions}
          value={uomOptions.find(opt => opt.value === watch('secondary_uom'))}
          onChange={(selected) => setValue('secondary_uom', selected?.value || '')}
          error={errors.secondary_uom?.message}
          isClearable
        />
        {secondaryUOM && (
          <Input
            label={`Conversion Factor (1 ${secondaryUOM} = X ${watch('primary_uom')})`}
            type="number"
            step="0.0001"
            {...register('conversion_factor', { valueAsNumber: true })}
            error={errors.conversion_factor?.message}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Default Selling Price (₹)"
          type="number"
          step="0.01"
          {...register('default_selling_price', { valueAsNumber: true })}
          error={errors.default_selling_price?.message}
        />
        <Select
          label="GST Rate"
          required
          options={gstRateOptions}
          value={gstRateOptions.find(opt => opt.value === watch('gst_rate'))}
          onChange={(selected) => setValue('gst_rate', selected?.value || 18)}
          error={errors.gst_rate?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="HSN Code"
          {...register('hsn_code')}
          error={errors.hsn_code?.message}
        />
        <Input
          label="Reorder Level"
          type="number"
          step="0.0001"
          {...register('reorder_level', { valueAsNumber: true })}
          error={errors.reorder_level?.message}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {sku ? 'Update SKU' : 'Create SKU'}
        </Button>
      </div>
    </form>
  )
}

function StockStatusBadge({ quantity, reorderLevel }) {
  if (quantity === 0) {
    return <Badge variant="danger">Out of Stock</Badge>
  }

  if (reorderLevel && quantity <= reorderLevel) {
    return <Badge variant="warning">Low Stock</Badge>
  }

  return <Badge variant="success">In Stock</Badge>
}

export default function SKUMasterPage() {
  const { canCreate, canEdit } = usePermissions()
  const { skus, categories, isLoading, createSKU, updateSKU, toggleSKUStatus, isCreating, isUpdating } = useSKUs()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSKU, setEditingSKU] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter SKUs
  const filteredSKUs = skus.filter(sku => {
    const matchesSearch = sku.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         sku.sku_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = !categoryFilter || sku.category_id === categoryFilter
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && sku.is_active) ||
                         (statusFilter === 'inactive' && !sku.is_active)

    return matchesSearch && matchesCategory && matchesStatus
  })

  const handleCreateSKU = () => {
    setEditingSKU(null)
    setIsModalOpen(true)
  }

  const handleEditSKU = (sku) => {
    if (!canEdit('sku_master')) return
    setEditingSKU(sku)
    setIsModalOpen(true)
  }

  const handleSubmit = (data) => {
    console.log('SKU form submitted with data:', data)

    if (editingSKU) {
      console.log('Updating existing SKU:', editingSKU.id)
      updateSKU({ id: editingSKU.id, ...data })
    } else {
      console.log('Creating new SKU')
      createSKU(data)
    }
    setIsModalOpen(false)
  }

  const handleToggleStatus = (sku) => {
    toggleSKUStatus({ id: sku.id, is_active: !sku.is_active })
  }

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  const categoryFilterOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map(cat => ({ value: cat.id, label: cat.category_name }))
  ]

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
        title="SKU Master"
        description="Manage your product SKUs and inventory items"
        action={
          <PermissionGate module="sku_master" action="create">
            <Button onClick={handleCreateSKU}>
              <Plus className="h-4 w-4 mr-2" />
              Add SKU
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>SKUs</CardTitle>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
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
              options={categoryFilterOptions}
              value={categoryFilterOptions.find(opt => opt.value === categoryFilter)}
              onChange={(selected) => setCategoryFilter(selected?.value || '')}
              className="w-full sm:w-48"
            />
            <Select
              options={statusFilterOptions}
              value={statusFilterOptions.find(opt => opt.value === statusFilter)}
              onChange={(selected) => setStatusFilter(selected?.value || 'all')}
              className="w-full sm:w-48"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredSKUs.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No SKUs found</p>
              {canCreate('sku_master') && (
                <Button onClick={handleCreateSKU} className="mt-3">
                  Create your first SKU
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>SKU Code</TableHeader>
                  <TableHeader>SKU Name</TableHeader>
                  <TableHeader>Category</TableHeader>
                  <TableHeader>UOM</TableHeader>
                  <TableHeader>Current Stock</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Price (₹)</TableHeader>
                  <TableHeader>GST</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSKUs.map((sku) => (
                  <TableRow key={sku.id}>
                    <TableCell className="font-medium">{sku.sku_code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{sku.sku_name}</div>
                        {sku.description && (
                          <div className="text-xs text-gray-500">{sku.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{sku.category?.category_name || '-'}</TableCell>
                    <TableCell>
                      <div>
                        {sku.unit_of_measure}
                        {sku.secondary_uom && (
                          <div className="text-xs text-gray-500">
                            1 {sku.secondary_uom} = {sku.conversion_factor} {sku.unit_of_measure}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span>{sku.inventory?.[0]?.current_stock || 0}</span>
                        <StockStatusBadge
                          quantity={sku.inventory?.[0]?.current_stock || 0}
                          reorderLevel={sku.reorder_level}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {sku.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      -
                    </TableCell>
                    <TableCell>{sku.gst_rate}%</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <PermissionGate module="sku_master" action="edit">
                          <button
                            onClick={() => handleEditSKU(sku)}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="Edit SKU"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </PermissionGate>

                        <PermissionGate module="sku_master" action="edit">
                          <button
                            onClick={() => handleToggleStatus(sku)}
                            className={`p-1 rounded ${sku.is_active
                              ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                            title={sku.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {sku.is_active ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </button>
                        </PermissionGate>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* SKU Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingSKU ? 'Edit SKU' : 'Create New SKU'}
        size="lg"
      >
        <SKUForm
          sku={editingSKU}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          isLoading={isCreating || isUpdating}
          categories={categories}
        />
      </Modal>
    </div>
  )
}