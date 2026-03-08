import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useVendors } from '../../hooks/useVendors.jsx'
import { useSKUs } from '../../hooks/useSKUs.jsx'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import { PermissionGate } from '../../components/shared/PermissionGate'
import { INDIAN_STATES } from '../../utils/indianStates'
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
  Building2,
  Phone,
  Mail,
  MapPin,
  Link as LinkIcon,
  Trash2
} from 'lucide-react'

const vendorSchema = z.object({
  vendor_name: z.string().min(2, 'Vendor name must be at least 2 characters'),
  contact_person: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address_line1: z.string().min(5, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional().or(z.literal('')),
  payment_terms: z.string().optional()
})

const aliasSchema = z.object({
  vendor_item_name: z.string().min(2, 'Vendor item name is required'),
  sku_id: z.string().min(1, 'SKU selection is required')
})

function VendorForm({ vendor = null, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_name: vendor?.vendor_name || '',
      contact_person: vendor?.contact_person || '',
      phone: vendor?.phone || '',
      email: vendor?.email || '',
      address_line1: vendor?.address_line1 || '',
      address_line2: vendor?.address_line2 || '',
      city: vendor?.city || '',
      state: vendor?.state || '',
      gstin: vendor?.gstin || '',
      pan_number: vendor?.pan_number || '',
      bank_name: vendor?.bank_name || '',
      bank_account_number: vendor?.bank_account_number || '',
      ifsc_code: vendor?.ifsc_code || '',
      payment_terms: vendor?.payment_terms || ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Vendor Name"
          required
          {...register('vendor_name')}
          error={errors.vendor_name?.message}
        />
        <Input
          label="Contact Person"
          {...register('contact_person')}
          error={errors.contact_person?.message}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Phone"
          required
          placeholder="10-digit phone number"
          {...register('phone')}
          error={errors.phone?.message}
        />
        <Input
          label="Email"
          type="email"
          {...register('email')}
          error={errors.email?.message}
        />
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Address Information</h4>

        <Input
          label="Address Line 1"
          required
          {...register('address_line1')}
          error={errors.address_line1?.message}
        />

        <Input
          label="Address Line 2"
          {...register('address_line2')}
          error={errors.address_line2?.message}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="City"
            required
            {...register('city')}
            error={errors.city?.message}
          />
          <Select
            label="State"
            required
            options={INDIAN_STATES}
            value={INDIAN_STATES.find(state => state.value === watch('state'))}
            onChange={(selected) => setValue('state', selected?.value || '')}
            error={errors.state?.message}
          />
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Business Information</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="GSTIN"
            placeholder="22AAAAA0000A1Z5"
            {...register('gstin')}
            error={errors.gstin?.message}
          />
          <Input
            label="PAN Number"
            placeholder="ABCTY1234D"
            {...register('pan_number')}
            error={errors.pan_number?.message}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Bank Name"
            {...register('bank_name')}
            error={errors.bank_name?.message}
          />
          <Input
            label="Bank Account Number"
            {...register('bank_account_number')}
            error={errors.bank_account_number?.message}
          />
          <Input
            label="IFSC Code"
            placeholder="ABCD0123456"
            {...register('ifsc_code')}
            error={errors.ifsc_code?.message}
          />
        </div>

        <Input
          label="Payment Terms"
          placeholder="Net 30 days"
          {...register('payment_terms')}
          error={errors.payment_terms?.message}
        />
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {vendor ? 'Update Vendor' : 'Create Vendor'}
        </Button>
      </div>
    </form>
  )
}

function AliasForm({ vendorId, onClose, onSubmit, isLoading }) {
  const { skus } = useSKUs()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(aliasSchema),
    defaultValues: {
      vendor_item_name: '',
      sku_id: ''
    }
  })

  const skuOptions = skus.map(sku => ({
    value: sku.id,
    label: `${sku.sku_code} - ${sku.sku_name}`
  }))

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      vendor_id: vendorId
    })
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Vendor Item Name"
        required
        placeholder="How the vendor calls this item"
        {...register('vendor_item_name')}
        error={errors.vendor_item_name?.message}
      />

      <Select
        label="Internal SKU"
        required
        options={skuOptions}
        value={skuOptions.find(opt => opt.value === watch('sku_id'))}
        onChange={(selected) => setValue('sku_id', selected?.value || '')}
        error={errors.sku_id?.message}
        placeholder="Select SKU..."
      />

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          Create Alias
        </Button>
      </div>
    </form>
  )
}

export default function VendorMasterPage() {
  const { canCreate, canEdit } = usePermissions()
  const {
    vendors,
    vendorAliases,
    isLoading,
    createVendor,
    updateVendor,
    toggleVendorStatus,
    createAlias,
    deleteAlias,
    isCreating,
    isUpdating
  } = useVendors()

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false)
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState(null)
  const [selectedVendorId, setSelectedVendorId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter vendors
  const filteredVendors = vendors.filter(vendor => {
    const matchesSearch = vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.vendor_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         vendor.phone.includes(searchTerm)

    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && vendor.is_active) ||
                         (statusFilter === 'inactive' && !vendor.is_active)

    return matchesSearch && matchesStatus
  })

  const handleCreateVendor = () => {
    setEditingVendor(null)
    setIsVendorModalOpen(true)
  }

  const handleEditVendor = (vendor) => {
    if (!canEdit('vendor_master')) return
    setEditingVendor(vendor)
    setIsVendorModalOpen(true)
  }

  const handleVendorSubmit = (data) => {
    if (editingVendor) {
      updateVendor({ id: editingVendor.id, ...data })
    } else {
      createVendor(data)
    }
    setIsVendorModalOpen(false)
  }

  const handleToggleStatus = (vendor) => {
    toggleVendorStatus({ id: vendor.id, is_active: !vendor.is_active })
  }

  const handleViewAliases = (vendorId) => {
    setSelectedVendorId(vendorId)
    setIsAliasModalOpen(true)
  }

  const handleAliasSubmit = (data) => {
    createAlias(data)
    setIsAliasModalOpen(false)
  }

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  // Get aliases for selected vendor
  const selectedVendorAliases = vendorAliases.filter(
    alias => alias.vendor_id === selectedVendorId
  )

  const selectedVendor = vendors.find(v => v.id === selectedVendorId)

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
        title="Vendor Master"
        description="Manage your vendor database and supplier information"
        action={
          <PermissionGate module="vendor_master" action="create">
            <Button onClick={handleCreateVendor}>
              <Plus className="h-4 w-4 mr-2" />
              Add Vendor
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Vendors</CardTitle>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search vendors..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              options={statusFilterOptions}
              value={statusFilterOptions.find(opt => opt.value === statusFilter)}
              onChange={(selected) => setStatusFilter(selected?.value || 'all')}
              className="w-full sm:w-48"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No vendors found</p>
              {canCreate('vendor_master') && (
                <Button onClick={handleCreateVendor} className="mt-3">
                  Add your first vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Vendor Code</TableHeader>
                  <TableHeader>Vendor Name</TableHeader>
                  <TableHeader>Contact Info</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>GSTIN</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="font-medium">{vendor.vendor_code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          <span>{vendor.vendor_name}</span>
                        </div>
                        {vendor.contact_person && (
                          <div className="text-xs text-gray-500">{vendor.contact_person}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{vendor.phone}</span>
                        </div>
                        {vendor.email && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />
                            <span>{vendor.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span>{vendor.city}, {vendor.state}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {vendor.gstin || '-'}
                    </TableCell>
                    <TableCell>
                      {vendor.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewAliases(vendor.id)}
                          className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                          title="View SKU Aliases"
                        >
                          <LinkIcon className="h-4 w-4" />
                        </button>

                        <PermissionGate module="vendor_master" action="edit">
                          <button
                            onClick={() => handleEditVendor(vendor)}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="Edit Vendor"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </PermissionGate>

                        <PermissionGate module="vendor_master" action="edit">
                          <button
                            onClick={() => handleToggleStatus(vendor)}
                            className={`p-1 rounded ${vendor.is_active
                              ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                            title={vendor.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {vendor.is_active ? (
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

      {/* Vendor Form Modal */}
      <Modal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        title={editingVendor ? 'Edit Vendor' : 'Create New Vendor'}
        size="lg"
      >
        <VendorForm
          vendor={editingVendor}
          onClose={() => setIsVendorModalOpen(false)}
          onSubmit={handleVendorSubmit}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* SKU Aliases Modal */}
      <Modal
        isOpen={isAliasModalOpen}
        onClose={() => setIsAliasModalOpen(false)}
        title={`SKU Aliases - ${selectedVendor?.vendor_name || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="font-medium">Current Aliases</h4>
            <PermissionGate module="vendor_master" action="create">
              <Button
                size="sm"
                onClick={() => {
                  // Add inline alias form logic here
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Alias
              </Button>
            </PermissionGate>
          </div>

          {selectedVendorAliases.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <LinkIcon className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No SKU aliases defined for this vendor</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedVendorAliases.map((alias) => (
                <div
                  key={alias.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">{alias.vendor_item_name}</div>
                    <div className="text-sm text-gray-600">
                      → {alias.sku?.sku_code} - {alias.sku?.sku_name}
                    </div>
                  </div>
                  <PermissionGate module="vendor_master" action="delete">
                    <button
                      onClick={() => deleteAlias(alias.id)}
                      className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded"
                      title="Delete Alias"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </PermissionGate>
                </div>
              ))}
            </div>
          )}

          {/* Add Alias Form */}
          <div className="border-t pt-4">
            <h5 className="font-medium mb-3">Add New Alias</h5>
            <AliasForm
              vendorId={selectedVendorId}
              onClose={() => setIsAliasModalOpen(false)}
              onSubmit={handleAliasSubmit}
              isLoading={isCreating}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}