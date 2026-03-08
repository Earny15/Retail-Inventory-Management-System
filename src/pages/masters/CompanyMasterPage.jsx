import React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCompanies } from '../../hooks/useCompanies.jsx'
import { INDIAN_STATES } from '../../utils/indianStates'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Spinner } from '../../components/ui/Spinner'
import { Save, Building2 } from 'lucide-react'

const companySchema = z.object({
  company_name: z.string().min(2, 'Company name must be at least 2 characters'),
  trade_name: z.string().optional(),
  address_line1: z.string().min(5, 'Address line 1 is required'),
  address_line2: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pin_code: z.string().regex(/^\d{6}$/, 'PIN code must be 6 digits'),
  gstin: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format'),
  pan_number: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be 10 digits'),
  alternate_phone: z.string().regex(/^\d{10}$/, 'Alternate phone must be 10 digits').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  ifsc_code: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format').optional().or(z.literal('')),
  account_holder_name: z.string().optional(),
  invoice_prefix: z.string().min(1, 'Invoice prefix is required'),
  invoice_start_number: z.number().min(1, 'Start number must be at least 1'),
  terms_and_conditions: z.string().optional()
})

export default function CompanyMasterPage() {
  const { companies, isLoading, createCompany, updateCompany, isUpdating, isCreating } = useCompanies()
  const company = companies && companies.length > 0 ? companies[0] : null // Get the first company if exists

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: '',
      trade_name: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      pin_code: '',
      gstin: '',
      pan_number: '',
      phone: '',
      alternate_phone: '',
      email: '',
      bank_name: '',
      bank_account_number: '',
      ifsc_code: '',
      account_holder_name: '',
      invoice_prefix: 'INV-',
      invoice_start_number: 1,
      terms_and_conditions: ''
    }
  })

  // Update form when company data loads
  React.useEffect(() => {
    if (company) {
      Object.keys(company).forEach(key => {
        if (key in companySchema.shape) {
          setValue(key, company[key] || '')
        }
      })
      // Company table has correct field names - no reverse mapping needed
      // Handle pincode field mapping
      if (company.pincode) {
        setValue('pin_code', company.pincode)
      }
    }
  }, [company, setValue])

  const onSubmit = (data) => {
    console.log('Form submitted with data:', data)

    // Convert invoice_start_number to number if it exists and fix field naming
    const processedData = {
      ...data,
      pincode: data.pin_code, // Map pin_code to pincode for database
      invoice_start_number: data.invoice_start_number ? Number(data.invoice_start_number) : 1,
      // If it's a new company, set current number same as start number
      invoice_current_number: company?.invoice_current_number || (data.invoice_start_number ? Number(data.invoice_start_number) : 1)
    }

    // Remove the form field name that doesn't match database
    delete processedData.pin_code

    console.log('Processed data for submission:', processedData)

    if (company && company.id) {
      // Update existing company
      console.log('Updating existing company:', company.id)
      updateCompany({ id: company.id, ...processedData })
    } else {
      // Create new company
      console.log('Creating new company')
      createCompany(processedData)
    }
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
        title="Company Master"
        description="Manage your company information and settings"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Company Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Company Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Company Name"
                required
                {...register('company_name')}
                error={errors.company_name?.message}
              />
              <Input
                label="Trade Name"
                {...register('trade_name')}
                error={errors.trade_name?.message}
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
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
                required
                placeholder="6-digit PIN"
                {...register('pin_code')}
                error={errors.pin_code?.message}
              />
            </div>
          </CardContent>
        </Card>

        {/* Tax Information */}
        <Card>
          <CardHeader>
            <CardTitle>Tax Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="GSTIN"
                required
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
          </CardContent>
        </Card>

        {/* Bank Information */}
        <Card>
          <CardHeader>
            <CardTitle>Bank Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Bank Name"
                {...register('bank_name')}
                error={errors.bank_name?.message}
              />
              <Input
                label="Account Holder Name"
                {...register('account_holder_name')}
                error={errors.account_holder_name?.message}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </CardContent>
        </Card>

        {/* Invoice Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Invoice Prefix"
                required
                placeholder="INV-"
                {...register('invoice_prefix')}
                error={errors.invoice_prefix?.message}
              />
              <Input
                label="Invoice Start Number"
                type="number"
                required
                {...register('invoice_start_number', { valueAsNumber: true })}
                error={errors.invoice_start_number?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Terms & Conditions
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                {...register('terms_and_conditions')}
              />
              {errors.terms_and_conditions && (
                <p className="text-sm text-red-600 mt-1">
                  {errors.terms_and_conditions.message}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            type="submit"
            loading={isUpdating || isCreating}
            disabled={!isDirty}
            className="min-w-[120px]"
          >
            <Save className="h-4 w-4 mr-2" />
            {company ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </form>
    </div>
  )
}