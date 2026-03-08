import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCustomers } from '../../hooks/useCustomers.jsx'
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
  Users,
  Building,
  Phone,
  Mail,
  MapPin
} from 'lucide-react'

const customerTypeOptions = [
  { value: 'Retail', label: 'Retail' },
  { value: 'Wholesale', label: 'Wholesale' },
  { value: 'Contractor', label: 'Contractor' }
]

const customerSchema = z.object({
  customer_name: z.string().min(2, 'Customer name must be at least 2 characters'),
  contact_person: z.string().optional(),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  alternate_phone: z.string().regex(/^\d{10}$/, 'Alternate phone must be 10 digits').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address_line1: z.string().min(5, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits').optional().or(z.literal('')),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
  customer_type: z.string().min(1, 'Customer type is required'),
  credit_limit: z.number().min(0, 'Credit limit must be positive').optional(),
  notes: z.string().optional()
})

function CustomerForm({ customer = null, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customer_name: customer?.customer_name || '',
      contact_person: customer?.contact_person || '',
      phone: customer?.phone || '',
      alternate_phone: customer?.alternate_phone || '',
      email: customer?.email || '',
      address_line1: customer?.address_line1 || customer?.billing_address_line1 || '',
      address_line2: customer?.address_line2 || customer?.billing_address_line2 || '',
      city: customer?.city || customer?.billing_city || '',
      state: customer?.state || customer?.billing_state || '',
      pin_code: customer?.pin_code || customer?.billing_pincode || '',
      gstin: customer?.gstin || '',
      pan_number: customer?.pan_number || '',
      customer_type: customer?.customer_type || 'Retail',
      credit_limit: customer?.credit_limit || '',
      notes: customer?.notes || ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Customer Name"
          required
          {...register('customer_name')}
          error={errors.customer_name?.message}
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
          label="Alternate Phone"
          placeholder="10-digit phone number"
          {...register('alternate_phone')}
          error={errors.alternate_phone?.message}
        />
      </div>

      <Input
        label="Email"
        type="email"
        {...register('email')}
        error={errors.email?.message}
      />

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <Input
            label="PIN Code"
            placeholder="6-digit PIN"
            {...register('pin_code')}
            error={errors.pin_code?.message}
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Customer Type"
            required
            options={customerTypeOptions}
            value={customerTypeOptions.find(opt => opt.value === watch('customer_type'))}
            onChange={(selected) => setValue('customer_type', selected?.value || '')}
            error={errors.customer_type?.message}
          />
          <Input
            label="Credit Limit (₹)"
            type="number"
            step="0.01"
            {...register('credit_limit', { valueAsNumber: true })}
            error={errors.credit_limit?.message}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            {...register('notes')}
          />
          {errors.notes && (
            <p className="text-sm text-red-600 mt-1">
              {errors.notes.message}
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {customer ? 'Update Customer' : 'Create Customer'}
        </Button>
      </div>
    </form>
  )
}

export default function CustomerMasterPage() {
  const { canCreate, canEdit } = usePermissions()
  const { customers, isLoading, createCustomer, updateCustomer, toggleCustomerStatus, isCreating, isUpdating } = useCustomers()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter customers
  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.customer_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         customer.phone.includes(searchTerm)

    const matchesType = !typeFilter || customer.customer_type === typeFilter
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && customer.is_active) ||
                         (statusFilter === 'inactive' && !customer.is_active)

    return matchesSearch && matchesType && matchesStatus
  })

  const handleCreateCustomer = () => {
    setEditingCustomer(null)
    setIsModalOpen(true)
  }

  const handleEditCustomer = (customer) => {
    if (!canEdit('customer_master')) return
    setEditingCustomer(customer)
    setIsModalOpen(true)
  }

  const handleSubmit = (data) => {
    console.log('Customer form submitted with data:', data)

    if (editingCustomer) {
      console.log('Updating existing customer:', editingCustomer.id)
      updateCustomer({ id: editingCustomer.id, ...data })
    } else {
      console.log('Creating new customer')
      createCustomer(data)
    }
    setIsModalOpen(false)
  }

  const handleToggleStatus = (customer) => {
    toggleCustomerStatus({ id: customer.id, is_active: !customer.is_active })
  }

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  const typeFilterOptions = [
    { value: '', label: 'All Types' },
    ...customerTypeOptions
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
        title="Customer Master"
        description="Manage your customer database and contact information"
        action={
          <PermissionGate module="customer_master" action="create">
            <Button onClick={handleCreateCustomer}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </PermissionGate>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search customers..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select
              options={typeFilterOptions}
              value={typeFilterOptions.find(opt => opt.value === typeFilter)}
              onChange={(selected) => setTypeFilter(selected?.value || '')}
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
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No customers found</p>
              {canCreate('customer_master') && (
                <Button onClick={handleCreateCustomer} className="mt-3">
                  Add your first customer
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Customer Code</TableHeader>
                  <TableHeader>Customer Name</TableHeader>
                  <TableHeader>Contact Info</TableHeader>
                  <TableHeader>Location</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader>GSTIN</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredCustomers.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">{customer.customer_code}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium flex items-center space-x-2">
                          <Building className="h-4 w-4 text-gray-400" />
                          <span>{customer.customer_name}</span>
                        </div>
                        {customer.contact_person && (
                          <div className="text-xs text-gray-500">{customer.contact_person}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1 text-sm">
                          <Phone className="h-3 w-3 text-gray-400" />
                          <span>{customer.phone}</span>
                        </div>
                        {customer.email && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <Mail className="h-3 w-3" />
                            <span>{customer.email}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm">
                        <MapPin className="h-3 w-3 text-gray-400" />
                        <span>{customer.city || customer.billing_city}, {customer.state || customer.billing_state}</span>
                      </div>
                      {(customer.pin_code || customer.billing_pincode) && (
                        <div className="text-xs text-gray-500">{customer.pin_code || customer.billing_pincode}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info">{customer.customer_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {customer.gstin || '-'}
                    </TableCell>
                    <TableCell>
                      {customer.is_active ? (
                        <Badge variant="success">Active</Badge>
                      ) : (
                        <Badge variant="danger">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <PermissionGate module="customer_master" action="edit">
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="Edit Customer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        </PermissionGate>

                        <PermissionGate module="customer_master" action="edit">
                          <button
                            onClick={() => handleToggleStatus(customer)}
                            className={`p-1 rounded ${customer.is_active
                              ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                            }`}
                            title={customer.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {customer.is_active ? (
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

      {/* Customer Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Create New Customer'}
        size="lg"
      >
        <CustomerForm
          customer={editingCustomer}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSubmit}
          isLoading={isCreating || isUpdating}
        />
      </Modal>
    </div>
  )
}