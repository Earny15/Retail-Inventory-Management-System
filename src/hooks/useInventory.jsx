import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useInventory() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch inventory with SKU and company details
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
            sku_code,
            sku_name,
            category:sku_categories(category_name),
            unit_of_measure,
            weight_per_unit,
            dimensions,
            min_stock_level,
            max_stock_level,
            reorder_level
          ),
          company:companies(company_name)
        `)
        .order('updated_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Fetch inventory transactions (recent stock movements)
  const {
    data: transactions = [],
    isLoading: transactionsLoading
  } = useQuery({
    queryKey: ['inventory-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select(`
          *,
          sku:skus(sku_code, sku_name),
          company:companies(company_name),
          vendor_inward:vendor_inwards(inward_number),
          customer_invoice:customer_invoices(invoice_number),
          created_by_user:users(full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error
      return data || []
    }
  })

  // Fetch low stock items
  const {
    data: lowStockItems = [],
    isLoading: lowStockLoading
  } = useQuery({
    queryKey: ['low-stock-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_low_stock_items')

      if (error) {
        // Fallback query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('inventory')
          .select(`
            *,
            sku:skus(
              sku_code,
              sku_name,
              min_stock_level,
              reorder_level
            )
          `)

        if (fallbackError) throw fallbackError

        // Filter low stock items manually
        return fallbackData.filter(item =>
          item.current_stock <= (item.sku?.reorder_level || item.sku?.min_stock_level || 0)
        )
      }
      return data || []
    }
  })

  // Update stock levels (manual adjustment)
  const updateStockMutation = useMutation({
    mutationFn: async ({ inventoryId, newStock, reason, notes }) => {
      const inventory = await supabase
        .from('inventory')
        .select('*, sku:skus(sku_code, sku_name)')
        .eq('id', inventoryId)
        .single()

      if (inventory.error) throw inventory.error

      const oldStock = inventory.data.current_stock
      const difference = newStock - oldStock

      // Update inventory
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          current_stock: newStock,
          updated_at: new Date().toISOString()
        })
        .eq('id', inventoryId)

      if (updateError) throw updateError

      // Create transaction record
      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert({
          sku_id: inventory.data.sku_id,
          company_id: inventory.data.company_id,
          transaction_type: difference > 0 ? 'stock_in' : 'stock_out',
          quantity: Math.abs(difference),
          unit_cost: 0, // Manual adjustment, no cost
          total_cost: 0,
          reference_type: 'manual_adjustment',
          notes: `${reason}: ${notes || 'Manual stock adjustment'}`,
          created_by: user?.id
        })

      if (transactionError) throw transactionError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-transactions'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] })
      toast.success('Stock level updated successfully')
    },
    onError: (error) => {
      console.error('Error updating stock:', error)
      toast.error('Failed to update stock level')
    }
  })

  // Set reorder level
  const setReorderLevelMutation = useMutation({
    mutationFn: async ({ skuId, reorderLevel, minStockLevel, maxStockLevel }) => {
      const { error } = await supabase
        .from('skus')
        .update({
          reorder_level: reorderLevel,
          min_stock_level: minStockLevel,
          max_stock_level: maxStockLevel
        })
        .eq('id', skuId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['low-stock-items'] })
      toast.success('Stock levels updated successfully')
    },
    onError: (error) => {
      console.error('Error updating stock levels:', error)
      toast.error('Failed to update stock levels')
    }
  })

  // Calculate inventory summary
  const inventorySummary = {
    totalItems: inventory.length,
    totalValue: inventory.reduce((sum, item) => sum + (item.current_stock * (item.average_cost || 0)), 0),
    lowStockCount: lowStockItems.length,
    outOfStockCount: inventory.filter(item => item.current_stock <= 0).length
  }

  return {
    inventory,
    transactions,
    lowStockItems,
    inventorySummary,
    isLoading: isLoading || transactionsLoading || lowStockLoading,
    error,
    updateStock: updateStockMutation.mutate,
    setReorderLevel: setReorderLevelMutation.mutate,
    isUpdating: updateStockMutation.isPending || setReorderLevelMutation.isPending
  }
}