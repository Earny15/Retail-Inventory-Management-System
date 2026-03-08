// Mock analytics service for demo purposes
// TODO: Replace with real database queries once analytics functions are deployed
// Force refresh to clear cache

import { supabase } from './supabase'

export async function getSalesAnalytics(dateRange) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    totalSales: 2450000,
    totalInvoices: 145,
    avgInvoiceValue: 16896,
    totalGST: 441000,
    salesGrowth: 12,
    invoiceGrowth: 8,
    avgValueGrowth: 4,
    topCustomers: [
      { id: '1', customer_name: 'ABC Industries', total_amount: 450000, invoices_count: 12 },
      { id: '2', customer_name: 'XYZ Corporation', total_amount: 380000, invoices_count: 8 },
      { id: '3', customer_name: 'PQR Ltd', total_amount: 290000, invoices_count: 15 },
      { id: '4', customer_name: 'DEF Enterprises', total_amount: 220000, invoices_count: 6 },
      { id: '5', customer_name: 'GHI Manufacturing', total_amount: 180000, invoices_count: 9 }
    ],
    topSKUs: [
      { id: '1', sku_name: 'Aluminium Sheet 4x8', total_quantity: 200, total_revenue: 800000 },
      { id: '2', sku_name: 'Aluminium Pipe 2 inch', total_quantity: 150, total_revenue: 450000 },
      { id: '3', sku_name: 'Aluminium Angle 40x40', total_quantity: 300, total_revenue: 360000 },
      { id: '4', sku_name: 'Aluminium Rod 10mm', total_quantity: 500, total_revenue: 250000 },
      { id: '5', sku_name: 'Aluminium Coil 1mm', total_quantity: 80, total_revenue: 240000 }
    ],
    monthlyTrends: [
      { month: '2024-01-01', month_name: 'January 2024', total_amount: 820000, invoices_count: 48, avg_amount: 17083 },
      { month: '2024-02-01', month_name: 'February 2024', total_amount: 750000, invoices_count: 42, avg_amount: 17857 },
      { month: '2024-03-01', month_name: 'March 2024', total_amount: 880000, invoices_count: 55, avg_amount: 16000 }
    ]
  }
}

export async function getPurchaseAnalytics(dateRange) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    totalPurchases: 1800000,
    totalInwards: 89,
    avgInwardValue: 20224,
    totalItems: 1250,
    purchaseGrowth: -5,
    inwardGrowth: 15,
    avgValueGrowth: -18,
    topVendors: [
      { id: '1', vendor_name: 'Hindalco Industries', total_amount: 520000, transactions_count: 15 },
      { id: '2', vendor_name: 'Vedanta Aluminium', total_amount: 480000, transactions_count: 12 },
      { id: '3', vendor_name: 'Jindal Aluminium', total_amount: 320000, transactions_count: 18 },
      { id: '4', vendor_name: 'NALCO', total_amount: 290000, transactions_count: 9 },
      { id: '5', vendor_name: 'Bharat Aluminium', total_amount: 190000, transactions_count: 11 }
    ],
    topSKUs: [
      { id: '1', sku_name: 'Aluminium Ingot 99.7%', total_quantity: 5000, total_cost: 750000 },
      { id: '2', sku_name: 'Aluminium Sheet Raw', total_quantity: 800, total_cost: 480000 },
      { id: '3', sku_name: 'Aluminium Extrusion Stock', total_quantity: 1200, total_cost: 360000 },
      { id: '4', sku_name: 'Aluminium Scrap Premium', total_quantity: 3000, total_cost: 210000 },
      { id: '5', sku_name: 'Aluminium Wire Rod', total_quantity: 400, total_cost: 160000 }
    ]
  }
}

export async function getInventoryAnalytics() {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    totalSKUs: 156,
    totalStockValue: 3200000,
    lowStockItems: 8,
    outOfStockItems: 3,
    lowStockList: [
      { id: '1', sku_name: 'Aluminium Pipe 1 inch', current_stock: 5, minimum_stock_level: 20 },
      { id: '2', sku_name: 'Aluminium Channel 100mm', current_stock: 12, minimum_stock_level: 25 },
      { id: '3', sku_name: 'Aluminium Round Bar 8mm', current_stock: 8, minimum_stock_level: 15 }
    ],
    highValueItems: [
      { id: '1', sku_name: 'Aluminium Sheet 4x8', current_stock: 150, avg_cost: 4500, stock_value: 675000 },
      { id: '2', sku_name: 'Aluminium Extrusion Profile', current_stock: 200, avg_cost: 2800, stock_value: 560000 },
      { id: '3', sku_name: 'Aluminium Plate 20mm', current_stock: 80, avg_cost: 6200, stock_value: 496000 },
      { id: '4', sku_name: 'Aluminium Coil 2mm', current_stock: 60, avg_cost: 7500, stock_value: 450000 },
      { id: '5', sku_name: 'Aluminium Tube Square', current_stock: 120, avg_cost: 3200, stock_value: 384000 }
    ],
    categoryBreakdown: [
      { id: '1', category_name: 'Sheets & Plates', sku_count: 45, total_stock: 890, total_value: 1200000 },
      { id: '2', category_name: 'Pipes & Tubes', sku_count: 38, total_stock: 650, total_value: 980000 },
      { id: '3', category_name: 'Profiles & Extrusions', sku_count: 32, total_stock: 420, total_value: 760000 },
      { id: '4', category_name: 'Rods & Bars', sku_count: 28, total_stock: 380, total_value: 180000 },
      { id: '5', category_name: 'Angles & Channels', sku_count: 13, total_stock: 190, total_value: 80000 }
    ]
  }
}

export async function getPLAnalytics(dateRange) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  return {
    totalRevenue: 2450000,
    totalCOGS: 1800000,
    totalGSTCollected: 441000,
    revenueGrowth: 12,
    cogsGrowth: -5,
    profitGrowth: 44,
    skuProfitability: [
      { id: '1', sku_name: 'Aluminium Sheet 4x8', units_sold: 200, profit: 320000, margin: 40.0 },
      { id: '2', sku_name: 'Aluminium Pipe 2 inch', units_sold: 150, profit: 180000, margin: 40.0 },
      { id: '3', sku_name: 'Aluminium Angle 40x40', units_sold: 300, profit: 144000, margin: 40.0 },
      { id: '4', sku_name: 'Aluminium Extrusion Profile', units_sold: 100, profit: 120000, margin: 35.0 },
      { id: '5', sku_name: 'Aluminium Coil 1mm', units_sorted: 80, profit: 96000, margin: 40.0 }
    ]
  }
}

// Legacy function for backward compatibility
export async function getAnalyticsDashboard(dateRange) {
  const [sales, purchase, inventory, pl] = await Promise.all([
    getSalesAnalytics(dateRange),
    getPurchaseAnalytics(dateRange),
    getInventoryAnalytics(),
    getPLAnalytics(dateRange)
  ])

  return {
    sales,
    purchase,
    inventory,
    pl
  }
}