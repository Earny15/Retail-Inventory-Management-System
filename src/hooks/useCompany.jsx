import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import toast from 'react-hot-toast'

export function useCompany() {
  const queryClient = useQueryClient()

  // Fetch company data
  const {
    data: company,
    isLoading,
    error
  } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error
      }

      return data
    }
  })

  // Update company mutation
  const updateCompanyMutation = useMutation({
    mutationFn: async (companyData) => {
      const { data, error } = await supabase
        .from('companies')
        .upsert(companyData)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['company'], data)
      toast.success('Company information updated successfully')
    },
    onError: (error) => {
      console.error('Error updating company:', error)
      toast.error('Failed to update company information')
    }
  })

  return {
    company,
    isLoading,
    error,
    updateCompany: updateCompanyMutation.mutate,
    isUpdating: updateCompanyMutation.isPending
  }
}