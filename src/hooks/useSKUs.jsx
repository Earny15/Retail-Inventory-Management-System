import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useSKUs() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const {
    data: skus = [],
    isLoading,
    error,
    refetch: refetchSKUs
  } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select(`
          *,
          category:sku_categories(id, category_name),
          inventory(current_stock)
        `)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const {
    data: categories = [],
    isLoading: categoriesLoading,
    refetch: refetchCategories
  } = useQuery({
    queryKey: ['sku-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sku_categories')
        .select('*')
        .eq('is_active', true)
        .order('category_name')
      if (error) throw error
      return data || []
    }
  })

  const createSKUMutation = useMutation({
    mutationFn: async (skuData) => {
      const processedData = { ...skuData }
      if (!processedData.category_id) delete processedData.category_id
      if (user?.id) processedData.created_by = user.id

      // Auto-generate SKU code if not provided (fallback if DB trigger is missing)
      if (!processedData.sku_code) {
        const { count } = await supabase.from('skus').select('*', { count: 'exact', head: true })
        processedData.sku_code = `SKU-${String((count || 0) + 1).padStart(4, '0')}`
      }

      const { data: sku, error: skuError } = await supabase
        .from('skus')
        .insert(processedData)
        .select()
        .single()
      if (skuError) throw skuError

      // Create inventory record with quantity 0
      const { error: invError } = await supabase.from('inventory').insert({
        sku_id: sku.id,
        current_stock: 0,
        available_stock: 0,
        reserved_stock: 0
      })
      if (invError) {
        console.error('Failed to create inventory record:', invError)
        // Don't throw - SKU was created, inventory can be created on first inward
      }

      return sku
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      toast.success('SKU created successfully')
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    }
  })

  const updateSKUMutation = useMutation({
    mutationFn: async ({ id, ...skuData }) => {
      if (!skuData.category_id) skuData.category_id = null
      const { data, error } = await supabase
        .from('skus')
        .update(skuData)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      toast.success('SKU updated successfully')
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`)
    }
  })

  const toggleSKUStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('skus').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      toast.success('SKU status updated')
    },
    onError: () => toast.error('Failed to update status')
  })

  return {
    skus,
    categories,
    isLoading: isLoading || categoriesLoading,
    error,
    createSKU: createSKUMutation.mutate,
    updateSKU: updateSKUMutation.mutate,
    toggleSKUStatus: toggleSKUStatusMutation.mutate,
    isCreating: createSKUMutation.isPending,
    isUpdating: updateSKUMutation.isPending,
    refetch: () => { refetchSKUs(); refetchCategories() }
  }
}
