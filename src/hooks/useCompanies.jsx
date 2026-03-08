import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useCompanies() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch companies
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

  // Create company mutation
  const createCompanyMutation = useMutation({
    mutationFn: async (companyData) => {
      // Map form fields to database fields
      const processedData = {
        ...companyData,
        // Handle development mode where user might be null
        ...(user?.id && { created_by: user.id })
      }

      // Remove fields that don't exist in database
      const fieldsToRemove = [
        'trade_name',
        'alternate_phone',
        'account_holder_name',
        'invoice_start_number',
        'invoice_current_number',
        'terms_and_conditions'
      ]
      fieldsToRemove.forEach(field => {
        if (processedData[field] !== undefined) {
          delete processedData[field]
        }
      })

      // Company table actually has address_line1/address_line2 per schema - no mapping needed
      const fieldMapping = {}  // No field mapping needed for companies

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          processedData[fieldMapping[formField]] = processedData[formField]
          delete processedData[formField]
        }
      })

      const { data, error } = await supabase
        .from('companies')
        .insert(processedData)
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
      console.error('Error creating company:', error)
      const errorMessage = error.message || 'Failed to create company'
      toast.error(`Company creation failed: ${errorMessage}`)
    }
  })

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async ({ id, ...companyData }) => {
      // Map form fields to database fields
      const processedData = { ...companyData }

      console.log('🔍 Company update - Original data:', companyData)

      // Remove fields that don't exist in database
      const fieldsToRemove = [
        'trade_name',
        'alternate_phone',
        'account_holder_name',
        'invoice_start_number',
        'invoice_current_number',
        'terms_and_conditions'
      ]
      fieldsToRemove.forEach(field => {
        if (processedData[field] !== undefined) {
          console.log(`🗑️ Removing field: ${field} =`, processedData[field])
          delete processedData[field]
        }
      })

      console.log('✅ Company update - Processed data:', processedData)

      // Company table actually has address_line1/address_line2 per schema - no mapping needed
      const fieldMapping = {}  // No field mapping needed for companies

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          processedData[fieldMapping[formField]] = processedData[formField]
          delete processedData[formField]
        }
      })

      const { data, error } = await supabase
        .from('companies')
        .update(processedData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company updated successfully')
    },
    onError: (error) => {
      console.error('Error updating company:', error)
      const errorMessage = error.message || 'Failed to update company'
      toast.error(`Company update failed: ${errorMessage}`)
    }
  })

  // Delete company mutation (soft delete - just mark as inactive)
  const deleteCompanyMutation = useMutation({
    mutationFn: async (companyId) => {
      const { error } = await supabase
        .from('companies')
        .update({ is_active: false })
        .eq('id', companyId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success('Company deactivated')
    },
    onError: (error) => {
      console.error('Error deactivating company:', error)
      toast.error('Failed to deactivate company')
    }
  })

  return {
    companies,
    isLoading,
    error,
    createCompany: createCompanyMutation.mutate,
    updateCompany: updateCompanyMutation.mutate,
    deleteCompany: deleteCompanyMutation.mutate,
    isCreating: createCompanyMutation.isPending,
    isUpdating: updateCompanyMutation.isPending,
    isDeleting: deleteCompanyMutation.isPending
  }
}