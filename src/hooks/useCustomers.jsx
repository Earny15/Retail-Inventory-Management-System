import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useCustomers() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const {
    data: customers = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData) => {
      const processedData = { ...customerData }
      if (user?.id) processedData.created_by = user.id
      if (!processedData.customer_code) delete processedData.customer_code
      // Clean up empty optional fields that have DB type constraints
      if (processedData.credit_limit === '' || processedData.credit_limit === undefined) processedData.credit_limit = null
      if (processedData.credit_days === '' || processedData.credit_days === undefined) processedData.credit_days = null

      const { data, error } = await supabase
        .from('customers')
        .insert(processedData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer created successfully')
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    }
  })

  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, ...customerData }) => {
      const { data, error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    }
  })

  const toggleCustomerStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('customers').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer status updated')
    },
    onError: () => toast.error('Failed to update status')
  })

  return {
    customers,
    isLoading,
    error,
    createCustomer: createCustomerMutation.mutate,
    updateCustomer: updateCustomerMutation.mutate,
    toggleCustomerStatus: toggleCustomerStatusMutation.mutate,
    isCreating: createCustomerMutation.isPending,
    isUpdating: updateCustomerMutation.isPending
  }
}
