import React, { useState, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useCompanies } from '../../hooks/useCompanies'
import { supabase } from '../../services/supabase'
import { INDIAN_STATES } from '../../utils/indianStates'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { Save, Building2, Upload, X, ImageIcon, RotateCcw, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

const companySchema = z.object({
  company_name: z.string().min(2, 'Company name is required'),
  company_code: z.string().optional().or(z.literal('')),
  address_line1: z.string().optional().or(z.literal('')),
  address_line2: z.string().optional().or(z.literal('')),
  city: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  pincode: z.string().optional().or(z.literal('')),
  gstin: z.string().optional().or(z.literal('')),
  pan_number: z.string().optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
  email: z.string().optional().or(z.literal('')),
  bank_name: z.string().optional().or(z.literal('')),
  bank_account_number: z.string().optional().or(z.literal('')),
  ifsc_code: z.string().optional().or(z.literal('')),
  invoice_prefix: z.string().optional().or(z.literal('')),
  invoice_footer: z.string().optional().or(z.literal('')),
  terms_and_conditions: z.string().optional().or(z.literal('')),
  declaration: z.string().optional().or(z.literal(''))
})

export default function CompanyMasterPage() {
  const { companies, isLoading, createCompany, updateCompany, uploadLogo, isUpdating, isCreating, isUploadingLogo } = useCompanies()
  const company = companies?.[0] || null
  const fileInputRef = useRef(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState(null)

  const handleReset = async () => {
    if (!resetPassword) {
      toast.error('Please enter the password')
      return
    }
    setIsResetting(true)
    setResetResult(null)
    try {
      const { data, error } = await supabase.rpc('reset_all_data', { p_password: resetPassword })
      if (error) throw error
      if (!data?.success) {
        toast.error(data?.error || 'Reset failed - invalid password')
        return
      }
      setResetResult(data.deleted)
      toast.success('All data has been reset successfully!')
    } catch (err) {
      toast.error('Reset failed: ' + err.message)
    } finally {
      setIsResetting(false)
      setResetPassword('')
    }
  }

  const {
    register, handleSubmit, setValue, watch,
    formState: { errors, isDirty }
  } = useForm({
    resolver: zodResolver(companySchema),
    defaultValues: {
      company_name: '', company_code: '', address_line1: '', address_line2: '',
      city: '', state: '', pincode: '', gstin: '', pan_number: '',
      phone: '', email: '',
      bank_name: '', bank_account_number: '', ifsc_code: '',
      invoice_prefix: 'INV-', invoice_footer: '',
      terms_and_conditions: '', declaration: ''
    }
  })

  React.useEffect(() => {
    if (company) {
      const fields = ['company_name', 'company_code', 'address_line1', 'address_line2',
        'city', 'state', 'pincode', 'gstin', 'pan_number', 'phone',
        'email', 'bank_name', 'bank_account_number', 'ifsc_code',
        'invoice_prefix', 'invoice_footer', 'terms_and_conditions', 'declaration']
      fields.forEach(key => {
        if (company[key] != null) setValue(key, company[key])
      })
      if (company.logo_url) setLogoPreview(company.logo_url)
    }
  }, [company, setValue])

  const handleLogoSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      return alert('Please select a JPG, PNG, WebP, or SVG file')
    }
    if (file.size > 2 * 1024 * 1024) {
      return alert('Logo must be under 2MB')
    }
    // Show immediate preview
    setLogoPreview(URL.createObjectURL(file))

    // Auto-upload and save to DB immediately
    if (company?.id) {
      try {
        const logoUrl = await uploadLogo({ companyId: company.id, file })
        setLogoPreview(logoUrl)
        // Save logo_url to company record immediately
        updateCompany({ id: company.id, logo_url: logoUrl })
      } catch (err) {
        setLogoPreview(company?.logo_url || null)
      }
    } else {
      setLogoFile(file)
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeLogo = () => {
    setLogoFile(null)
    setLogoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    // Remove from DB immediately
    if (company?.id) {
      updateCompany({ id: company.id, logo_url: null })
    }
  }

  const onSubmit = async (data) => {
    // Only send fields that exist in the companies table
    const dbFields = {
      company_name: data.company_name,
      company_code: data.company_code || null,
      address_line1: data.address_line1,
      address_line2: data.address_line2 || null,
      city: data.city,
      state: data.state,
      pincode: data.pincode,
      gstin: data.gstin,
      pan_number: data.pan_number || null,
      phone: data.phone,
      email: data.email || null,
      bank_name: data.bank_name || null,
      bank_account_number: data.bank_account_number || null,
      ifsc_code: data.ifsc_code || null,
      invoice_prefix: data.invoice_prefix,
      invoice_footer: data.invoice_footer || null,
      terms_and_conditions: data.terms_and_conditions || null,
      declaration: data.declaration || null,
      logo_url: logoPreview || company?.logo_url || null
    }

    if (company?.id) {
      updateCompany({ id: company.id, ...dbFields })
    } else {
      createCompany(dbFields)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>

  return (
    <div>
      <PageHeader title="Company Master" description="Manage your company information and settings" />
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" />Company Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Company Logo</label>
              <div className="flex items-start gap-4">
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50 flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Company logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <ImageIcon className="h-10 w-10 text-gray-300" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    onChange={handleLogoSelect}
                    className="hidden"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-1.5" />{logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </Button>
                  {logoFile && (
                    <Button type="button" variant="ghost" size="sm" onClick={removeLogo}>
                      <X className="h-4 w-4 mr-1.5" />Remove
                    </Button>
                  )}
                  <p className="text-xs text-gray-500">JPG, PNG, WebP, or SVG. Max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Company Name" required {...register('company_name')} error={errors.company_name?.message} />
              <Input label="Company Code" {...register('company_code')} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Phone" required {...register('phone')} error={errors.phone?.message} />
              <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Address</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Address Line 1" required {...register('address_line1')} error={errors.address_line1?.message} />
            <Input label="Address Line 2" {...register('address_line2')} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="City" required {...register('city')} error={errors.city?.message} />
              <Select label="State" required options={INDIAN_STATES}
                value={INDIAN_STATES.find(s => s.value === watch('state'))}
                onChange={(sel) => setValue('state', sel?.value || '', { shouldDirty: true })}
                error={errors.state?.message} />
              <Input label="PIN Code" required {...register('pincode')} error={errors.pincode?.message} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tax Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="GSTIN" required placeholder="22AAAAA0000A1Z5" {...register('gstin')} error={errors.gstin?.message} />
              <Input label="PAN Number" placeholder="ABCTY1234D" {...register('pan_number')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Bank Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Bank Name" {...register('bank_name')} />
              <Input label="IFSC Code" {...register('ifsc_code')} />
            </div>
            <Input label="Account Number" {...register('bank_account_number')} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invoice Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input label="Invoice Prefix" required {...register('invoice_prefix')} error={errors.invoice_prefix?.message} />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Footer</label>
              <textarea rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400" {...register('invoice_footer')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Terms & Conditions</label>
              <textarea rows={4} placeholder="Enter terms and conditions for invoices..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400" {...register('terms_and_conditions')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Declaration</label>
              <textarea rows={3} placeholder="Enter declaration text for invoices..." className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400 focus:border-primary-400" {...register('declaration')} />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between pb-6">
          <Button
            type="button"
            variant="outline"
            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={() => { setResetModalOpen(true); setResetResult(null); setResetPassword('') }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />Reset All Data
          </Button>
          <Button type="submit" loading={isUpdating || isCreating || isUploadingLogo} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />{company ? 'Save Changes' : 'Create Company'}
          </Button>
        </div>
      </form>

      {/* Reset Data Modal */}
      <Modal
        isOpen={resetModalOpen}
        onClose={() => { setResetModalOpen(false); setResetResult(null) }}
        title="Reset All Data"
        size="md"
      >
        <div className="space-y-4">
          {!resetResult ? (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Warning: This action cannot be undone!</p>
                  <p className="text-sm text-red-700 mt-1">This will permanently delete all:</p>
                  <ul className="text-sm text-red-700 mt-1 list-disc list-inside space-y-0.5">
                    <li>Customer Invoices & Invoice Items</li>
                    <li>Sales Quotations & Quotation Items</li>
                    <li>Vendor Inwards & Inward Items</li>
                    <li>Inventory & Inventory Transactions</li>
                    <li>Customers, Vendors, SKUs, Categories</li>
                    <li>WhatsApp Message Logs</li>
                  </ul>
                  <p className="text-sm text-green-700 font-medium mt-2">Preserved: Company Master, Users & Roles</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter Password to Confirm
                </label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter reset password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-400 focus:border-red-400"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleReset() }}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t">
                <Button variant="outline" onClick={() => setResetModalOpen(false)}>Cancel</Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleReset}
                  disabled={isResetting || !resetPassword}
                >
                  {isResetting ? (
                    <><Spinner size="sm" className="mr-2" />Resetting...</>
                  ) : (
                    <><RotateCcw className="h-4 w-4 mr-2" />Reset All Data</>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-green-800">Reset completed successfully!</p>
                <p className="text-sm text-green-700 mt-1">Records deleted:</p>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  {Object.entries(resetResult).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-gray-600">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-medium text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-2 border-t">
                <Button onClick={() => { setResetModalOpen(false); window.location.reload() }}>
                  Done
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
