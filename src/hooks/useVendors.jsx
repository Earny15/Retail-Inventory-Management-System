import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useVendors() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch vendors
  const {
    data: vendors = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Fetch vendor SKU aliases
  const {
    data: vendorAliases = [],
    isLoading: aliasesLoading
  } = useQuery({
    queryKey: ['vendor-aliases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_sku_aliases')
        .select(`
          *,
          vendor:vendors(vendor_name),
          sku:skus(sku_name, sku_code)
        `)

      if (error) throw error
      return data || []
    }
  })

  // Create vendor mutation
  const createVendorMutation = useMutation({
    mutationFn: async (vendorData) => {
      const { data, error } = await supabase
        .from('vendors')
        .insert({
          ...vendorData,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor created successfully')
    },
    onError: (error) => {
      console.error('Error creating vendor:', error)
      toast.error('Failed to create vendor')
    }
  })

  // Update vendor mutation
  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, ...vendorData }) => {
      const { data, error } = await supabase
        .from('vendors')
        .update(vendorData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor updated successfully')
    },
    onError: (error) => {
      console.error('Error updating vendor:', error)
      toast.error('Failed to update vendor')
    }
  })

  // Toggle vendor active status
  const toggleVendorStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor status updated')
    },
    onError: (error) => {
      console.error('Error updating vendor status:', error)
      toast.error('Failed to update vendor status')
    }
  })

  // Create vendor SKU alias
  const createAliasMutation = useMutation({
    mutationFn: async (aliasData) => {
      const { data, error } = await supabase
        .from('vendor_sku_aliases')
        .insert({
          ...aliasData,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] })
      toast.success('SKU alias created successfully')
    },
    onError: (error) => {
      console.error('Error creating alias:', error)
      toast.error('Failed to create SKU alias')
    }
  })

  // Delete vendor SKU alias
  const deleteAliasMutation = useMutation({
    mutationFn: async (aliasId) => {
      const { error } = await supabase
        .from('vendor_sku_aliases')
        .delete()
        .eq('id', aliasId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] })
      toast.success('SKU alias deleted successfully')
    },
    onError: (error) => {
      console.error('Error deleting alias:', error)
      toast.error('Failed to delete SKU alias')
    }
  })

  return {
    vendors,
    vendorAliases,
    isLoading: isLoading || aliasesLoading,
    error,
    createVendor: createVendorMutation.mutate,
    updateVendor: updateVendorMutation.mutate,
    toggleVendorStatus: toggleVendorStatusMutation.mutate,
    createAlias: createAliasMutation.mutate,
    deleteAlias: deleteAliasMutation.mutate,
    isCreating: createVendorMutation.isPending,
    isUpdating: updateVendorMutation.isPending
  }
}