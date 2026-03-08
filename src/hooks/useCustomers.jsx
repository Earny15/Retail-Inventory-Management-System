import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useCustomers() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch customers
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

  // Create customer mutation
  const createCustomerMutation = useMutation({
    mutationFn: async (customerData) => {
      // Handle field mapping if needed
      const processedData = {
        ...customerData,
        // Handle development mode where user might be null
        ...(user?.id && { created_by: user.id })
      }

      // Remove fields that don't exist in database
      const fieldsToRemove = ['alternate_phone', 'notes']
      fieldsToRemove.forEach(field => {
        if (processedData[field] !== undefined) {
          delete processedData[field]
        }
      })

      // Map form fields to database fields
      const fieldMapping = {
        pin_code: 'billing_pincode',
        address_line1: 'billing_address_line1',
        address_line2: 'billing_address_line2',
        city: 'billing_city',
        state: 'billing_state'
      }

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          processedData[fieldMapping[formField]] = processedData[formField]
          delete processedData[formField]
        }
      })

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
      console.error('Error creating customer:', error)
      const errorMessage = error.message || 'Failed to create customer'
      toast.error(`Customer creation failed: ${errorMessage}`)
    }
  })

  // Update customer mutation
  const updateCustomerMutation = useMutation({
    mutationFn: async ({ id, ...customerData }) => {
      // Handle field mapping if needed
      const processedData = { ...customerData }

      // Remove fields that don't exist in database
      const fieldsToRemove = ['alternate_phone', 'notes']
      fieldsToRemove.forEach(field => {
        if (processedData[field] !== undefined) {
          delete processedData[field]
        }
      })

      // Map form fields to database fields
      const fieldMapping = {
        pin_code: 'billing_pincode',
        address_line1: 'billing_address_line1',
        address_line2: 'billing_address_line2',
        city: 'billing_city',
        state: 'billing_state'
      }

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          processedData[fieldMapping[formField]] = processedData[formField]
          delete processedData[formField]
        }
      })

      const { data, error } = await supabase
        .from('customers')
        .update(processedData)
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
      console.error('Error updating customer:', error)
      toast.error('Failed to update customer')
    }
  })

  // Toggle customer active status
  const toggleCustomerStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('customers')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      toast.success('Customer status updated')
    },
    onError: (error) => {
      console.error('Error updating customer status:', error)
      toast.error('Failed to update customer status')
    }
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