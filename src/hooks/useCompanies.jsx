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
        'invoice_prefix', 'invoice_number_series',
        'note_keeping_prefix', 'note_keeping_number_series',
        'invoice_footer',
        'terms_and_conditions', 'declaration', 'logo_url'
      ]
      // Remove any field not in known columns
      Object.keys(safeData).forEach(key => {
        if (!knownColumns.includes(key)) delete safeData[key]
      })

      // Retry while PostgREST reports a missing column, dropping only that
      // column — so one unmigrated column doesn't discard every other field.
      const dropped = []
      for (;;) {
        const { data, error } = await supabase
          .from('companies')
          .update(safeData)
          .eq('id', id)
          .select()
          .single()

        if (!error) {
          if (dropped.length) {
            toast.error(`Not saved — column missing in database (run the migration): ${dropped.join(', ')}`, { duration: 8000 })
          }
          return { data, dropped }
        }

        // PGRST204: "Could not find the 'x' column of 'companies' in the schema cache"
        // 42703: undefined_column
        const missing = error.message?.match(/'([^']+)' column/)?.[1]
          || error.message?.match(/column "?([a-z_]+)"? .*does not exist/)?.[1]
        if ((error.code === 'PGRST204' || error.code === '42703') && missing && missing in safeData) {
          console.warn(`companies.${missing} missing, retrying without it`)
          delete safeData[missing]
          dropped.push(missing)
          continue
        }
        throw error
      }
    },
    onSuccess: ({ dropped }) => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['company-first'] })
      if (!dropped.length) toast.success('Company updated successfully')
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
