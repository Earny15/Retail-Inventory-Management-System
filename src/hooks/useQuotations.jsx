import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import { createQuotation } from '../services/quotationService'
import toast from 'react-hot-toast'

export function useQuotations() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const {
    data: quotations = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['quotations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_quotations')
        .select(`
          *,
          customers(customer_name, billing_city, billing_state, phone),
          sales_quotation_items(
            id, sku_id, quantity, rate, amount,
            sku:skus(sku_name, sku_code, unit_of_measure)
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  const createMutation = useMutation({
    mutationFn: (data) => createQuotation({ ...data, userId: user?.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success('Sales quotation created successfully')
    },
    onError: (error) => {
      toast.error('Failed to create quotation: ' + error.message)
    }
  })

  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase
        .from('sales_quotations')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] })
      toast.success('Quotation cancelled')
    },
    onError: (error) => {
      toast.error('Failed to cancel quotation: ' + error.message)
    }
  })

  return {
    quotations,
    isLoading,
    error,
    createQuotation: createMutation.mutateAsync,
    cancelQuotation: cancelMutation.mutate,
    isCreating: createMutation.isPending
  }
}
