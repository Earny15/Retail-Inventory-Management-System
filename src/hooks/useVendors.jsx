import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useVendors() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

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

  const {
    data: vendorAliases = [],
    isLoading: aliasesLoading
  } = useQuery({
    queryKey: ['vendor-aliases'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_sku_aliases')
        .select(`*, sku:skus(sku_name, sku_code)`)
      if (error) throw error
      return data || []
    }
  })

  const createVendorMutation = useMutation({
    mutationFn: async (vendorData) => {
      const processedData = { ...vendorData }
      if (user?.id) processedData.created_by = user.id
      if (!processedData.vendor_code) delete processedData.vendor_code

      const { data, error } = await supabase
        .from('vendors')
        .insert(processedData)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor created successfully')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

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
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const toggleVendorStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('vendors').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendors'] })
      toast.success('Vendor status updated')
    },
    onError: () => toast.error('Failed to update status')
  })

  const createAliasMutation = useMutation({
    mutationFn: async (aliasData) => {
      const { data, error } = await supabase
        .from('vendor_sku_aliases')
        .insert({ ...aliasData, created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] })
      toast.success('SKU alias created')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const deleteAliasMutation = useMutation({
    mutationFn: async (aliasId) => {
      const { error } = await supabase.from('vendor_sku_aliases').delete().eq('id', aliasId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor-aliases'] })
      toast.success('Alias deleted')
    },
    onError: () => toast.error('Failed to delete alias')
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
    isCreating: createVendorMutation.isPending || createAliasMutation.isPending,
    isUpdating: updateVendorMutation.isPending
  }
}
