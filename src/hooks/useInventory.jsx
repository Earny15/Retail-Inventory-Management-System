import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'

export function useInventory() {
  const { user } = useAuth()

  const {
    data: inventory = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          sku:skus(
            id, sku_code, sku_name, unit_of_measure,
            reorder_level, gst_rate, hsn_code, is_active,
            category:sku_categories(category_name)
          )
        `)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const lowStockItems = inventory.filter(item => {
    if (!item.sku) return false
    const reorder = item.sku.reorder_level || 0
    return item.current_stock > 0 && item.current_stock <= reorder
  })

  const outOfStockItems = inventory.filter(item => item.current_stock <= 0)

  return {
    inventory,
    lowStockItems,
    outOfStockItems,
    isLoading,
    error,
    inventorySummary: {
      totalItems: inventory.length,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
    }
  }
}
