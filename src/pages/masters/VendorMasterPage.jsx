import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useVendors } from '../../hooks/useVendors'
import { useSKUs } from '../../hooks/useSKUs'
import { useAuth } from '../../hooks/useAuth'
import PermissionGate from '../../components/shared/PermissionGate'
import { INDIAN_STATES } from '../../utils/indianStates'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { Plus, Search, Edit3, ToggleLeft, ToggleRight, Building2, Link as LinkIcon, Trash2 } from 'lucide-react'

const vendorSchema = z.object({
  vendor_name: z.string().min(2, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address_line1: z.string().min(3, 'Address is required'),
  address_line2: z.string().optional().or(z.literal('')),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  gstin: z.string().optional().or(z.literal('')),
  pan_number: z.string().optional().or(z.literal('')),
  bank_name: z.string().optional().or(z.literal('')),
  bank_account_number: z.string().optional().or(z.literal('')),
  ifsc_code: z.string().optional().or(z.literal('')),
  payment_terms: z.string().optional().or(z.literal(''))
})

function VendorForm({ vendor = null, onClose, onSubmit, isLoading }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_name: vendor?.vendor_name || '', contact_person: vendor?.contact_person || '',
      phone: vendor?.phone || '', email: vendor?.email || '',
      address_line1: vendor?.address_line1 || '', address_line2: vendor?.address_line2 || '',
      city: vendor?.city || '', state: vendor?.state || '',
      gstin: vendor?.gstin || '', pan_number: vendor?.pan_number || '',
      bank_name: vendor?.bank_name || '', bank_account_number: vendor?.bank_account_number || '',
      ifsc_code: vendor?.ifsc_code || '', payment_terms: vendor?.payment_terms || ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Vendor Name" required {...register('vendor_name')} error={errors.vendor_name?.message} />
        <Input label="Contact Person" {...register('contact_person')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Phone" required {...register('phone')} error={errors.phone?.message} />
        <Input label="Email" type="email" {...register('email')} />
      </div>
      <Input label="Address Line 1" required {...register('address_line1')} error={errors.address_line1?.message} />
      <Input label="Address Line 2" {...register('address_line2')} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="City" required {...register('city')} error={errors.city?.message} />
        <Select label="State" required options={INDIAN_STATES}
          value={INDIAN_STATES.find(s => s.value === watch('state'))}
          onChange={(s) => setValue('state', s?.value || '')} error={errors.state?.message} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="GSTIN" {...register('gstin')} />
        <Input label="PAN" {...register('pan_number')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="Bank Name" {...register('bank_name')} />
        <Input label="Account Number" {...register('bank_account_number')} />
        <Input label="IFSC Code" {...register('ifsc_code')} />
      </div>
      <Input label="Payment Terms" {...register('payment_terms')} />
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
        <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={isLoading} className="w-full sm:w-auto">{vendor ? 'Update' : 'Create'} Vendor</Button>
      </div>
    </form>
  )
}

export default function VendorMasterPage() {
  const { hasPermission } = useAuth()
  const { vendors, vendorAliases, isLoading, createVendor, updateVendor, toggleVendorStatus, createAlias, deleteAlias, isCreating, isUpdating } = useVendors()
  const { skus } = useSKUs()
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [selectedVendorId, setSelectedVendorId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [newAliasName, setNewAliasName] = useState('')
  const [newAliasSku, setNewAliasSku] = useState(null)

  const filtered = vendors.filter(v => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return v.vendor_name.toLowerCase().includes(s) || v.vendor_code?.toLowerCase().includes(s) || v.phone?.includes(s)
  })

  const handleVendorSubmit = (data) => {
    if (editingVendor) updateVendor({ id: editingVendor.id, ...data })
    else createVendor(data)
    setIsVendorModalOpen(false)
  }

  const selectedAliases = vendorAliases.filter(a => a.vendor_id === selectedVendorId)
  const selectedVendor = vendors.find(v => v.id === selectedVendorId)
  const skuOptions = skus.map(s => ({ value: s.id, label: `${s.sku_code} - ${s.sku_name}` }))

  const handleAddAlias = () => {
    if (!newAliasName || !newAliasSku) return
    createAlias({ vendor_id: selectedVendorId, vendor_item_name: newAliasName, sku_id: newAliasSku })
    setNewAliasName('')
    setNewAliasSku(null)
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>

  return (
    <div>
      <PageHeader title="Vendor Master" description="Manage your vendors"
        actions={
          <PermissionGate module="vendor_master" action="create">
            <Button onClick={() => { setEditingVendor(null); setIsVendorModalOpen(true) }} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Vendor</Button>
          </PermissionGate>
        } />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 sm:mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search vendors..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:max-w-md text-sm focus:ring-2 focus:ring-primary-400" />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No vendors found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Code</TableHeader><TableHeader>Name</TableHeader><TableHeader>Phone</TableHeader>
                      <TableHeader>City</TableHeader><TableHeader>GSTIN</TableHeader>
                      <TableHeader>Status</TableHeader><TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(v => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.vendor_code}</TableCell>
                        <TableCell>{v.vendor_name}{v.contact_person && <div className="text-xs text-gray-500">{v.contact_person}</div>}</TableCell>
                        <TableCell>{v.phone}</TableCell>
                        <TableCell>{v.city}, {v.state}</TableCell>
                        <TableCell className="text-sm">{v.gstin || '-'}</TableCell>
                        <TableCell><Badge variant={v.is_active ? 'success' : 'danger'}>{v.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <button onClick={() => { setSelectedVendorId(v.id); setIsAliasModalOpen(true) }}
                              className="p-1 text-gray-600 hover:text-purple-600 rounded hover:bg-purple-50" title="SKU Aliases">
                              <LinkIcon className="h-4 w-4" />
                            </button>
                            <PermissionGate module="vendor_master" action="edit">
                              <button onClick={() => { setEditingVendor(v); setIsVendorModalOpen(true) }}
                                className="p-1 text-gray-600 hover:text-primary-600 rounded hover:bg-primary-50"><Edit3 className="h-4 w-4" /></button>
                            </PermissionGate>
                            <PermissionGate module="vendor_master" action="edit">
                              <button onClick={() => toggleVendorStatus({ id: v.id, is_active: !v.is_active })}
                                className="p-1 rounded hover:bg-gray-100">
                                {v.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                              </button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filtered.map((v, index) => (
                  <div key={v.id} className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{v.vendor_name}</div>
                        <div className="text-sm text-gray-500">{v.vendor_code}</div>
                        {v.contact_person && <div className="text-sm text-gray-500">{v.contact_person}</div>}
                      </div>
                      <Badge variant={v.is_active ? 'success' : 'danger'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                      {v.phone && <span>{v.phone}</span>}
                      {v.city && <span>| {v.city}, {v.state}</span>}
                    </div>
                    {v.gstin && <div className="text-sm text-gray-500">GSTIN: {v.gstin}</div>}
                    <div className="flex gap-3 pt-2 border-t border-gray-100">
                      <button onClick={() => { setSelectedVendorId(v.id); setIsAliasModalOpen(true) }}
                        className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800">
                        <LinkIcon className="h-3.5 w-3.5" /> Aliases
                      </button>
                      <PermissionGate module="vendor_master" action="edit">
                        <button onClick={() => { setEditingVendor(v); setIsVendorModalOpen(true) }}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                      </PermissionGate>
                      <PermissionGate module="vendor_master" action="edit">
                        <button onClick={() => toggleVendorStatus({ id: v.id, is_active: !v.is_active })}
                          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                          {v.is_active ? <><ToggleRight className="h-3.5 w-3.5 text-green-600" /> Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
                        </button>
                      </PermissionGate>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isVendorModalOpen} onClose={() => setIsVendorModalOpen(false)} title={editingVendor ? 'Edit Vendor' : 'New Vendor'} size="lg">
        <VendorForm vendor={editingVendor} onClose={() => setIsVendorModalOpen(false)} onSubmit={handleVendorSubmit} isLoading={isCreating || isUpdating} />
      </Modal>

      <Modal isOpen={isAliasModalOpen} onClose={() => setIsAliasModalOpen(false)} title={`SKU Aliases - ${selectedVendor?.vendor_name || ''}`} size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {selectedAliases.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <LinkIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No aliases for this vendor</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedAliases.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{a.vendor_item_name}</div>
                    <div className="text-sm text-gray-600 truncate">&rarr; {a.sku?.sku_code} - {a.sku?.sku_name}</div>
                  </div>
                  <button onClick={() => deleteAlias(a.id)} className="p-1 text-red-600 hover:bg-red-50 rounded ml-2 flex-shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t pt-4">
            <h5 className="font-medium mb-3">Add New Alias</h5>
            <div className="space-y-3">
              <Input label="Vendor Item Name" value={newAliasName} onChange={(e) => setNewAliasName(e.target.value)} placeholder="How vendor calls this item" />
              <Select label="Internal SKU" options={skuOptions} value={skuOptions.find(o => o.value === newAliasSku)}
                onChange={(s) => setNewAliasSku(s?.value || null)} placeholder="Select SKU..." />
              <Button onClick={handleAddAlias} disabled={!newAliasName || !newAliasSku} loading={isCreating} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1" />Add Alias
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
