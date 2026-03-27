import { useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSKUs } from '../../hooks/useSKUs'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../services/supabase'
import PermissionGate from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { Plus, Search, Edit3, ToggleLeft, ToggleRight, Package, FolderPlus, Trash2 } from 'lucide-react'

const uomOptions = [
  { value: 'PCS', label: 'PCS' }, { value: 'KGS', label: 'KGS' }, { value: 'MTR', label: 'MTR' },
  { value: 'SQM', label: 'SQM' }, { value: 'BOX', label: 'BOX' }, { value: 'SET', label: 'SET' }, { value: 'LTR', label: 'LTR' }
]
const gstRateOptions = [
  { value: 0, label: '0%' }, { value: 5, label: '5%' }, { value: 12, label: '12%' },
  { value: 18, label: '18%' }, { value: 28, label: '28%' }
]

const skuSchema = z.object({
  sku_code: z.string().optional().or(z.literal('')),
  sku_name: z.string().min(2, 'SKU name is required'),
  description: z.string().optional().or(z.literal('')),
  category_id: z.string().optional().or(z.literal('')),
  unit_of_measure: z.string().min(1, 'UOM is required'),
  secondary_uom: z.string().optional().or(z.literal('')),
  conversion_factor: z.coerce.number().positive().optional().or(z.literal('')),
  weight_per_unit: z.coerce.number().min(0).optional().or(z.literal('')),
  dimensions: z.string().optional().or(z.literal('')),
  gst_rate: z.coerce.number().min(0).max(28),
  selling_price: z.coerce.number().min(0).optional().or(z.literal('')),
  hsn_code: z.string().optional().or(z.literal('')),
  min_stock_level: z.coerce.number().min(0).optional().or(z.literal('')),
  max_stock_level: z.coerce.number().min(0).optional().or(z.literal('')),
  reorder_level: z.coerce.number().min(0).optional().or(z.literal(''))
})

function CategoryManager({ categories, onCategoryCreated }) {
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!newCatName.trim()) return
    setIsSaving(true)
    setError('')
    try {
      const { data, error: dbError } = await supabase
        .from('sku_categories')
        .insert({ category_name: newCatName.trim(), description: newCatDesc.trim() || null, is_active: true })
        .select()
        .single()
      if (dbError) throw dbError
      onCategoryCreated(data)
      setNewCatName('')
      setNewCatDesc('')
    } catch (err) {
      setError(err.message || 'Failed to create category')
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleCategory = async (cat) => {
    try {
      await supabase
        .from('sku_categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id)
      onCategoryCreated(null) // trigger refresh
    } catch (err) {
      console.error('Failed to toggle category:', err)
    }
  }

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
      <div className="space-y-3">
        {categories.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No categories yet. Create one below.</p>
        ) : (
          categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <div className="font-medium">{cat.category_name}</div>
                {cat.description && <div className="text-sm text-gray-500">{cat.description}</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cat.is_active ? 'success' : 'danger'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge>
                <button onClick={() => handleToggleCategory(cat)} className="p-1 rounded hover:bg-gray-200">
                  {cat.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium text-gray-700">Add New Category</h4>
        <Input label="Category Name" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Aluminium Sheets" />
        <Input label="Description" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Optional description" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleCreate} loading={isSaving} disabled={!newCatName.trim()} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-1" />Create Category
        </Button>
      </div>
    </div>
  )
}

function SKUForm({ sku = null, onClose, onSubmit, isLoading, categories }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(skuSchema),
    defaultValues: {
      sku_code: sku?.sku_code || '', sku_name: sku?.sku_name || '', description: sku?.description || '',
      category_id: sku?.category_id || '', unit_of_measure: sku?.unit_of_measure || 'PCS',
      secondary_uom: sku?.secondary_uom || '', conversion_factor: sku?.conversion_factor || '',
      weight_per_unit: sku?.weight_per_unit || '', dimensions: sku?.dimensions || '',
      gst_rate: sku?.gst_rate ?? 18, selling_price: sku?.selling_price || '', hsn_code: sku?.hsn_code || '',
      min_stock_level: sku?.min_stock_level || '', max_stock_level: sku?.max_stock_level || '',
      reorder_level: sku?.reorder_level || ''
    }
  })

  const secondaryUOM = watch('secondary_uom')
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.category_name }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="SKU Code" placeholder="Auto-generated" {...register('sku_code')} />
        <Input label="SKU Name" required {...register('sku_name')} error={errors.sku_name?.message} />
      </div>
      <Input label="Description" {...register('description')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Category" options={categoryOptions} isClearable
          value={categoryOptions.find(o => o.value === watch('category_id')) || null}
          onChange={(s) => setValue('category_id', s?.value || '')} error={errors.category_id?.message}
          placeholder="Select or leave empty" />
        <Select label="Unit of Measure" required options={uomOptions}
          value={uomOptions.find(o => o.value === watch('unit_of_measure'))}
          onChange={(s) => setValue('unit_of_measure', s?.value || '')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Secondary UOM" options={uomOptions} isClearable
          value={uomOptions.find(o => o.value === watch('secondary_uom'))}
          onChange={(s) => setValue('secondary_uom', s?.value || '')} />
        {secondaryUOM && (
          <Input label={`1 ${secondaryUOM} = X ${watch('unit_of_measure')}`} type="number" step="0.0001"
            {...register('conversion_factor')} />
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Weight per Unit" type="number" step="0.01" {...register('weight_per_unit')} />
        <Input label="Dimensions" placeholder="e.g. 100x50x2 mm" {...register('dimensions')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Selling Price (GST Inclusive)" type="number" step="0.01" placeholder="Price including GST" {...register('selling_price')} />
        <Select label="Default GST Rate" options={gstRateOptions}
          value={gstRateOptions.find(o => o.value === Number(watch('gst_rate')))}
          onChange={(s) => setValue('gst_rate', s?.value ?? 18)} />
        <Input label="HSN Code" {...register('hsn_code')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Min Stock Level" type="number" step="0.01" {...register('min_stock_level')} />
        <Input label="Max Stock Level" type="number" step="0.01" {...register('max_stock_level')} />
        <Input label="Reorder Level" type="number" step="0.01" {...register('reorder_level')} />
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
        <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={isLoading} className="w-full sm:w-auto">{sku ? 'Update SKU' : 'Create SKU'}</Button>
      </div>
    </form>
  )
}

export default function SKUMasterPage() {
  const { hasPermission } = useAuth()
  const { skus, categories, isLoading, createSKU, updateSKU, toggleSKUStatus, isCreating, isUpdating, refetch } = useSKUs()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingSKU, setEditingSKU] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  const filteredSKUs = skus.filter(sku => {
    const matchesSearch = !searchTerm || sku.sku_name.toLowerCase().includes(searchTerm.toLowerCase()) || sku.sku_code.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCat = !categoryFilter || sku.category_id === categoryFilter
    return matchesSearch && matchesCat
  })

  const handleSubmit = (data) => {
    const cleaned = { ...data }
    if (cleaned.conversion_factor === '') delete cleaned.conversion_factor
    if (cleaned.weight_per_unit === '') delete cleaned.weight_per_unit
    if (cleaned.min_stock_level === '') delete cleaned.min_stock_level
    if (cleaned.max_stock_level === '') delete cleaned.max_stock_level
    if (cleaned.reorder_level === '') delete cleaned.reorder_level
    if (cleaned.sku_code === '') delete cleaned.sku_code
    if (cleaned.dimensions === '') delete cleaned.dimensions
    if (cleaned.selling_price === '' || cleaned.selling_price === undefined) delete cleaned.selling_price

    if (editingSKU) {
      updateSKU({ id: editingSKU.id, ...cleaned })
    } else {
      createSKU(cleaned)
    }
    setIsModalOpen(false)
  }

  const handleCategoryCreated = useCallback(() => {
    if (refetch) refetch()
  }, [refetch])

  const categoryFilterOptions = [{ value: '', label: 'All Categories' }, ...categories.map(c => ({ value: c.id, label: c.category_name }))]

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>

  return (
    <div>
      <PageHeader title="SKU Master" description="Manage your product SKUs"
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)} className="w-full sm:w-auto">
              <FolderPlus className="h-4 w-4 mr-2" />Categories
            </Button>
            <PermissionGate module="sku_master" action="create">
              <Button onClick={() => { setEditingSKU(null); setIsModalOpen(true) }} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add SKU</Button>
            </PermissionGate>
          </div>
        } />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-4 mb-3 sm:mb-4">
            <div className="relative col-span-2 sm:flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Search SKUs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400" />
            </div>
            <Select options={categoryFilterOptions} value={categoryFilterOptions.find(o => o.value === categoryFilter)}
              onChange={(s) => setCategoryFilter(s?.value || '')} className="col-span-2 sm:w-48" />
          </div>

          {filteredSKUs.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No SKUs found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>SKU Code</TableHeader><TableHeader>Name</TableHeader><TableHeader>Category</TableHeader>
                      <TableHeader>UOM</TableHeader><TableHeader>Stock</TableHeader>
                      <TableHeader>GST</TableHeader><TableHeader>Status</TableHeader><TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredSKUs.map(sku => {
                      const stock = sku.inventory?.[0]?.current_stock ?? 0
                      const reorder = sku.reorder_level || 0
                      return (
                        <TableRow key={sku.id}>
                          <TableCell className="font-medium">{sku.sku_code}</TableCell>
                          <TableCell>
                            <div className="font-medium">{sku.sku_name}</div>
                            {sku.description && <div className="text-xs text-gray-500 truncate max-w-[200px]">{sku.description}</div>}
                          </TableCell>
                          <TableCell>{sku.category?.category_name || '-'}</TableCell>
                          <TableCell>{sku.unit_of_measure}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>{stock}</span>
                              {stock <= 0 ? <Badge variant="danger">Out</Badge> :
                               stock <= reorder ? <Badge variant="warning">Low</Badge> :
                               <Badge variant="success">OK</Badge>}
                            </div>
                          </TableCell>
                          <TableCell>{sku.gst_rate}%</TableCell>
                          <TableCell>
                            <Badge variant={sku.is_active ? 'success' : 'danger'}>{sku.is_active ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <PermissionGate module="sku_master" action="edit">
                                <button onClick={() => { setEditingSKU(sku); setIsModalOpen(true) }}
                                  className="p-1 text-gray-600 hover:text-primary-600 rounded hover:bg-primary-50"><Edit3 className="h-4 w-4" /></button>
                              </PermissionGate>
                              <PermissionGate module="sku_master" action="edit">
                                <button onClick={() => toggleSKUStatus({ id: sku.id, is_active: !sku.is_active })}
                                  className="p-1 rounded hover:bg-gray-100">
                                  {sku.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                                </button>
                              </PermissionGate>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredSKUs.map((sku, index) => {
                  const stock = sku.inventory?.[0]?.current_stock ?? 0
                  const reorder = sku.reorder_level || 0
                  return (
                    <div key={sku.id} className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{sku.sku_name}</div>
                          <div className="text-sm text-gray-500">{sku.sku_code}</div>
                        </div>
                        <Badge variant={sku.is_active ? 'success' : 'danger'}>{sku.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      {sku.description && <div className="text-sm text-gray-500">{sku.description}</div>}
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-gray-600">Cat: {sku.category?.category_name || '-'}</span>
                        <span className="text-gray-600">| UOM: {sku.unit_of_measure}</span>
                        <span className="text-gray-600">| GST: {sku.gst_rate}%</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">Stock: {stock}</span>
                        {stock <= 0 ? <Badge variant="danger">Out</Badge> :
                         stock <= reorder ? <Badge variant="warning">Low</Badge> :
                         <Badge variant="success">OK</Badge>}
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        <PermissionGate module="sku_master" action="edit">
                          <button onClick={() => { setEditingSKU(sku); setIsModalOpen(true) }}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </button>
                        </PermissionGate>
                        <PermissionGate module="sku_master" action="edit">
                          <button onClick={() => toggleSKUStatus({ id: sku.id, is_active: !sku.is_active })}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                            {sku.is_active ? <><ToggleRight className="h-3.5 w-3.5 text-green-600" /> Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingSKU ? 'Edit SKU' : 'New SKU'} size="lg">
        <SKUForm sku={editingSKU} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit}
          isLoading={isCreating || isUpdating} categories={categories} />
      </Modal>

      <Modal isOpen={isCategoryModalOpen} onClose={() => setIsCategoryModalOpen(false)} title="Manage SKU Categories" size="lg">
        <CategoryManager categories={categories} onCategoryCreated={handleCategoryCreated} />
      </Modal>
    </div>
  )
}
