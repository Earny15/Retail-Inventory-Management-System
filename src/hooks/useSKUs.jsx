import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useSKUs() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch SKUs with categories and inventory
  const {
    data: skus = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select(`
          *,
          category:sku_categories(id, category_name),
          inventory(current_stock, available_stock)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Fetch SKU categories
  const {
    data: categories = [],
    isLoading: categoriesLoading
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

  // Create SKU mutation
  const createSKUMutation = useMutation({
    mutationFn: async (skuData) => {
      // Start transaction
      // Map form fields to database fields
      const processedData = {
        ...skuData,
        // Handle development mode where user might be null
        ...(user?.id && { created_by: user.id })
      }

      // Remove empty sku_code to let database trigger generate it
      if (processedData.sku_code === '' || processedData.sku_code === null || processedData.sku_code === undefined) {
        delete processedData.sku_code
      }

      // Map form fields to database fields
      const fieldMapping = {
        primary_uom: 'unit_of_measure',
        // Remove default_selling_price since it doesn't exist in the database schema
        default_selling_price: null  // Will be removed from data
      }

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          if (fieldMapping[formField] === null) {
            // Remove fields that don't exist in database
            delete processedData[formField]
          } else {
            // Map to correct database field
            processedData[fieldMapping[formField]] = processedData[formField]
            delete processedData[formField]
          }
        }
      })

      const { data: sku, error: skuError } = await supabase
        .from('skus')
        .insert(processedData)
        .select()
        .single()

      if (skuError) throw skuError

      // Create inventory record
      const { error: inventoryError } = await supabase
        .from('inventory')
        .insert({
          sku_id: sku.id,
          current_stock: 0,
          available_stock: 0
        })

      if (inventoryError) throw inventoryError

      return sku
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      toast.success('SKU created successfully')
    },
    onError: (error) => {
      console.error('Error creating SKU:', error)
      const errorMessage = error.message || 'Failed to create SKU'
      toast.error(`SKU creation failed: ${errorMessage}`)
    }
  })

  // Update SKU mutation
  const updateSKUMutation = useMutation({
    mutationFn: async ({ id, ...skuData }) => {
      // Map form fields to database fields
      const processedData = { ...skuData }

      // Remove empty sku_code to let database trigger generate it
      if (processedData.sku_code === '' || processedData.sku_code === null || processedData.sku_code === undefined) {
        delete processedData.sku_code
      }

      const fieldMapping = {
        primary_uom: 'unit_of_measure',
        // Remove default_selling_price since it doesn't exist in the database schema
        default_selling_price: null  // Will be removed from data
      }

      Object.keys(fieldMapping).forEach(formField => {
        if (processedData[formField] !== undefined) {
          if (fieldMapping[formField] === null) {
            // Remove fields that don't exist in database
            delete processedData[formField]
          } else {
            // Map to correct database field
            processedData[fieldMapping[formField]] = processedData[formField]
            delete processedData[formField]
          }
        }
      })

      const { data, error } = await supabase
        .from('skus')
        .update(processedData)
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
      console.error('Error updating SKU:', error)
      toast.error('Failed to update SKU')
    }
  })

  // Toggle SKU active status
  const toggleSKUStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('skus')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skus'] })
      toast.success('SKU status updated')
    },
    onError: (error) => {
      console.error('Error updating SKU status:', error)
      toast.error('Failed to update SKU status')
    }
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
    isUpdating: updateSKUMutation.isPending
  }
}