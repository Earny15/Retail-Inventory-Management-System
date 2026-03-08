import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useCategories() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch categories
  const {
    data: categories = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sku_categories')
        .select('*')
        .order('category_name')

      if (error) throw error
      return data || []
    }
  })

  // Create category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (categoryData) => {
      const { data, error } = await supabase
        .from('sku_categories')
        .insert({
          ...categoryData,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category created successfully')
    },
    onError: (error) => {
      console.error('Error creating category:', error)
      toast.error('Failed to create category')
    }
  })

  // Update category mutation
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...categoryData }) => {
      const { data, error } = await supabase
        .from('sku_categories')
        .update(categoryData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category updated successfully')
    },
    onError: (error) => {
      console.error('Error updating category:', error)
      toast.error('Failed to update category')
    }
  })

  // Toggle category active status
  const toggleCategoryStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('sku_categories')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      toast.success('Category status updated')
    },
    onError: (error) => {
      console.error('Error updating category status:', error)
      toast.error('Failed to update category status')
    }
  })

  return {
    categories,
    isLoading,
    error,
    createCategory: createCategoryMutation.mutate,
    updateCategory: updateCategoryMutation.mutate,
    toggleCategoryStatus: toggleCategoryStatusMutation.mutate,
    isCreating: createCategoryMutation.isPending,
    isUpdating: updateCategoryMutation.isPending
  }
}