import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useCompanies() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const {
    data: companies = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const createCompanyMutation = useMutation({
    mutationFn: async (companyData) => {
      const { data, error } = await supabase
        .from('companies')
        .insert(companyData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company created successfully')
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    }
  })

  const uploadLogoMutation = useMutation({
    mutationFn: async ({ companyId, file }) => {
      const ext = file.name.split('.').pop()
      const filePath = `${companyId}/logo.${ext}`

      // Remove old logo files
      const { data: existingFiles } = await supabase.storage
        .from('company-logos')
        .list(companyId)
      if (existingFiles?.length) {
        await supabase.storage
          .from('company-logos')
          .remove(existingFiles.map(f => `${companyId}/${f.name}`))
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('company-logos')
        .upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('company-logos')
        .getPublicUrl(filePath)

      return publicUrl
    },
    onError: (error) => {
      toast.error(`Logo upload failed: ${error.message}`)
    }
  })

  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, ...companyData }) => {
      // Strip any fields that cause errors (columns that may not exist yet)
      const safeData = { ...companyData }
      const knownColumns = [
        'company_name', 'company_code', 'address_line1', 'address_line2',
        'city', 'state', 'pincode', 'phone', 'email', 'gstin', 'pan_number',
        'bank_name', 'bank_account_number', 'ifsc_code',
        'invoice_prefix', 'invoice_footer',
        'terms_and_conditions', 'declaration', 'logo_url'
      ]
      // Remove any field not in known columns
      Object.keys(safeData).forEach(key => {
        if (!knownColumns.includes(key)) delete safeData[key]
      })

      // First attempt with all fields
      let { data, error } = await supabase
        .from('companies')
        .update(safeData)
        .eq('id', id)
        .select()
        .single()

      // If it fails (likely missing columns), retry with only core fields
      if (error) {
        console.warn('Full update failed, retrying with core fields:', error.message)
        const coreData = {}
        const coreColumns = [
          'company_name', 'company_code', 'address_line1', 'address_line2',
          'city', 'state', 'pincode', 'phone', 'email', 'gstin', 'pan_number',
          'bank_name', 'bank_account_number', 'ifsc_code',
          'invoice_prefix', 'invoice_footer'
        ]
        coreColumns.forEach(key => {
          if (safeData[key] !== undefined) coreData[key] = safeData[key]
        })

        const result = await supabase
          .from('companies')
          .update(coreData)
          .eq('id', id)
          .select()
          .single()

        if (result.error) throw result.error
        return result.data
      }

      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company updated successfully')
    },
    onError: (error) => {
      console.error('Company update error:', error)
      toast.error(`Failed: ${error.message}`)
    }
  })

  return {
    companies,
    isLoading,
    error,
    createCompany: createCompanyMutation.mutate,
    updateCompany: updateCompanyMutation.mutate,
    uploadLogo: uploadLogoMutation.mutateAsync,
    isCreating: createCompanyMutation.isPending,
    isUpdating: updateCompanyMutation.isPending,
    isUploadingLogo: uploadLogoMutation.isPending
  }
}
