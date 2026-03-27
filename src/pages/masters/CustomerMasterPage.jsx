import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCustomers } from '../../hooks/useCustomers'
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
import { Plus, Search, Edit3, ToggleLeft, ToggleRight, Users } from 'lucide-react'

const customerTypeOptions = [
  { value: 'Retail', label: 'Retail' }, { value: 'Wholesale', label: 'Wholesale' }, { value: 'Contractor', label: 'Contractor' }
]

const customerSchema = z.object({
  customer_name: z.string().min(2, 'Name is required'),
  contact_person: z.string().optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  billing_address_line1: z.string().min(3, 'Address is required'),
  billing_address_line2: z.string().optional().or(z.literal('')),
  billing_city: z.string().min(2, 'City is required'),
  billing_state: z.string().min(2, 'State is required'),
  billing_pincode: z.string().optional().or(z.literal('')),
  shipping_address_line1: z.string().optional().or(z.literal('')),
  shipping_address_line2: z.string().optional().or(z.literal('')),
  shipping_city: z.string().optional().or(z.literal('')),
  shipping_state: z.string().optional().or(z.literal('')),
  shipping_pincode: z.string().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  pan_number: z.string().optional().or(z.literal('')),
  customer_type: z.string().min(1, 'Type is required'),
  credit_limit: z.coerce.number().min(0).optional().or(z.literal('')),
  credit_days: z.coerce.number().min(0).optional().or(z.literal(''))
})

function CustomerForm({ customer = null, onClose, onSubmit, isLoading }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      customer_name: customer?.customer_name || '', contact_person: customer?.contact_person || '',
      phone: customer?.phone || '', email: customer?.email || '',
      billing_address_line1: customer?.billing_address_line1 || '',
      billing_address_line2: customer?.billing_address_line2 || '',
      billing_city: customer?.billing_city || '',
      billing_state: customer?.billing_state || '',
      billing_pincode: customer?.billing_pincode || '',
      shipping_address_line1: customer?.shipping_address_line1 || '',
      shipping_address_line2: customer?.shipping_address_line2 || '',
      shipping_city: customer?.shipping_city || '',
      shipping_state: customer?.shipping_state || '',
      shipping_pincode: customer?.shipping_pincode || '',
      gstin: customer?.gstin || '', pan_number: customer?.pan_number || '',
      customer_type: customer?.customer_type || 'Retail',
      credit_limit: customer?.credit_limit || '', credit_days: customer?.credit_days || ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Customer Name" required {...register('customer_name')} error={errors.customer_name?.message} />
        <Input label="Contact Person" {...register('contact_person')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Phone" required {...register('phone')} error={errors.phone?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
      </div>

      <h4 className="font-medium text-gray-700 pt-2">Billing Address</h4>
      <Input label="Address Line 1" required {...register('billing_address_line1')} error={errors.billing_address_line1?.message} />
      <Input label="Address Line 2" {...register('billing_address_line2')} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="City" required {...register('billing_city')} error={errors.billing_city?.message} />
        <Select label="State" required options={INDIAN_STATES}
          value={INDIAN_STATES.find(s => s.value === watch('billing_state'))}
          onChange={(s) => setValue('billing_state', s?.value || '')} error={errors.billing_state?.message} />
        <Input label="PIN Code" {...register('billing_pincode')} />
      </div>

      <h4 className="font-medium text-gray-700 pt-2">Shipping Address</h4>
      <Input label="Address Line 1" {...register('shipping_address_line1')} />
      <Input label="Address Line 2" {...register('shipping_address_line2')} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Input label="City" {...register('shipping_city')} />
        <Select label="State" options={INDIAN_STATES}
          value={INDIAN_STATES.find(s => s.value === watch('shipping_state'))}
          onChange={(s) => setValue('shipping_state', s?.value || '')} />
        <Input label="PIN Code" {...register('shipping_pincode')} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="GSTIN" {...register('gstin')} />
        <Input label="PAN Number" {...register('pan_number')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select label="Customer Type" required options={customerTypeOptions}
          value={customerTypeOptions.find(o => o.value === watch('customer_type'))}
          onChange={(s) => setValue('customer_type', s?.value || '')} />
        <Input label="Credit Limit" type="number" step="0.01" {...register('credit_limit')} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Credit Days" type="number" {...register('credit_days')} />
      </div>
      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
        <Button variant="outline" type="button" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
        <Button type="submit" loading={isLoading} className="w-full sm:w-auto">{customer ? 'Update' : 'Create'} Customer</Button>
      </div>
    </form>
  )
}

export default function CustomerMasterPage() {
  const { hasPermission } = useAuth()
  const { customers, isLoading, createCustomer, updateCustomer, toggleCustomerStatus, isCreating, isUpdating } = useCustomers()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filtered = customers.filter(c => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return c.customer_name.toLowerCase().includes(s) || c.customer_code?.toLowerCase().includes(s) || c.phone?.includes(s) || c.billing_city?.toLowerCase().includes(s)
  })

  const handleSubmit = (data) => {
    const cleaned = { ...data }
    if (cleaned.credit_limit === '') delete cleaned.credit_limit
    if (cleaned.credit_days === '') delete cleaned.credit_days
    if (editingCustomer) {
      updateCustomer({ id: editingCustomer.id, ...cleaned })
    } else {
      createCustomer(cleaned)
    }
    setIsModalOpen(false)
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>

  return (
    <div>
      <PageHeader title="Customer Master" description="Manage your customers"
        actions={
          <PermissionGate module="customer_master" action="create">
            <Button onClick={() => { setEditingCustomer(null); setIsModalOpen(true) }} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Customer</Button>
          </PermissionGate>
        } />

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="mb-3 sm:mb-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search customers..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full sm:max-w-md text-sm focus:ring-2 focus:ring-primary-400" />
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No customers found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Code</TableHeader><TableHeader>Name</TableHeader><TableHeader>Phone</TableHeader>
                      <TableHeader>City</TableHeader><TableHeader>GSTIN</TableHeader><TableHeader>Type</TableHeader>
                      <TableHeader>Status</TableHeader><TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.customer_code}</TableCell>
                        <TableCell>{c.customer_name}</TableCell>
                        <TableCell>{c.phone}</TableCell>
                        <TableCell>{c.billing_city}{c.billing_state ? `, ${c.billing_state}` : ''}</TableCell>
                        <TableCell className="text-sm">{c.gstin || '-'}</TableCell>
                        <TableCell><Badge variant="info">{c.customer_type}</Badge></TableCell>
                        <TableCell><Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <PermissionGate module="customer_master" action="edit">
                              <button onClick={() => { setEditingCustomer(c); setIsModalOpen(true) }}
                                className="p-1 text-gray-600 hover:text-primary-600 rounded hover:bg-primary-50"><Edit3 className="h-4 w-4" /></button>
                            </PermissionGate>
                            <PermissionGate module="customer_master" action="edit">
                              <button onClick={() => toggleCustomerStatus({ id: c.id, is_active: !c.is_active })}
                                className="p-1 rounded hover:bg-gray-100">
                                {c.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
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
                {filtered.map((c, index) => (
                  <div key={c.id} className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-gray-900">{c.customer_name}</div>
                        <div className="text-sm text-gray-500">{c.customer_code}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={c.is_active ? 'success' : 'danger'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                      {c.phone && <span>{c.phone}</span>}
                      {c.billing_city && <span>| {c.billing_city}{c.billing_state ? `, ${c.billing_state}` : ''}</span>}
                    </div>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <Badge variant="info">{c.customer_type}</Badge>
                      {c.gstin && <span className="text-gray-500">GSTIN: {c.gstin}</span>}
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-gray-100">
                      <PermissionGate module="customer_master" action="edit">
                        <button onClick={() => { setEditingCustomer(c); setIsModalOpen(true) }}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                          <Edit3 className="h-3.5 w-3.5" /> Edit
                        </button>
                      </PermissionGate>
                      <PermissionGate module="customer_master" action="edit">
                        <button onClick={() => toggleCustomerStatus({ id: c.id, is_active: !c.is_active })}
                          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                          {c.is_active ? <><ToggleRight className="h-3.5 w-3.5 text-green-600" /> Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingCustomer ? 'Edit Customer' : 'New Customer'} size="lg">
        <CustomerForm customer={editingCustomer} onClose={() => setIsModalOpen(false)} onSubmit={handleSubmit} isLoading={isCreating || isUpdating} />
      </Modal>
    </div>
  )
}
