import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import Input from '../../components/ui/Input'
import { formatCurrency } from '../../utils/gstCalculator'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Package,
  IndianRupee,
  FileText,
  Users,
  AlertTriangle,
  BarChart3,
  Calendar,
  ShoppingCart
} from 'lucide-react'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

function KPICard({ title, value, icon: Icon, color = 'blue', description }) {
  const colorMap = {
    blue: 'bg-blue-100 text-navy-600',
    green: 'bg-green-100 text-green-600',
    amber: 'bg-amber-100 text-amber-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600'
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{title}</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-900 mt-1 truncate">{value}</p>
            {description && <p className="text-xs text-gray-500 mt-1 hidden sm:block">{description}</p>}
          </div>
          <div className={`p-2 sm:p-3 rounded-full ${colorMap[color]} ml-2 flex-shrink-0`}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message = 'No data available', icon: Icon = Package }) {
  return (
    <div className="text-center py-12">
      <Icon className="h-12 w-12 mx-auto text-gray-300 mb-3" />
      <p className="text-gray-500">{message}</p>
      <p className="text-sm text-gray-400 mt-1">Data will appear once transactions are recorded</p>
    </div>
  )
}

// ====================== TAB 1: SALES ANALYTICS ======================
function SalesTab({ dateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-sales', dateRange],
    queryFn: async () => {
      const { startDate, endDate } = dateRange

      // Fetch customer_invoices with items
      const { data: invoices, error } = await supabase
        .from('customer_invoices')
        .select(`
          id, invoice_number, invoice_date, total_amount, subtotal,
          customer_id,
          customers ( customer_name ),
          customer_invoice_items (
            id, sku_id, quantity,
            sku:skus ( sku_name, sku_code )
          )
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)
        .order('invoice_date')

      if (error) throw error
      return invoices || []
    },
    refetchOnWindowFocus: false
  })

  const analytics = useMemo(() => {
    if (!data || data.length === 0) return null

    const totalRevenue = data.reduce((s, t) => s + (t.total_amount || 0), 0)
    const totalSubtotal = data.reduce((s, t) => s + (t.subtotal || 0), 0)
    const totalGST = totalRevenue - totalSubtotal
    const invoiceCount = data.length
    const avgInvoiceValue = invoiceCount > 0 ? totalRevenue / invoiceCount : 0

    // Daily trend
    const dailyMap = {}
    data.forEach(t => {
      const day = t.invoice_date?.split('T')[0] || t.invoice_date
      if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, count: 0 }
      dailyMap[day].revenue += (t.total_amount || 0)
      dailyMap[day].count += 1
    })
    const salesTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

    // Top 10 SKUs by frequency
    const skuMap = {}
    data.forEach(t => {
      (t.customer_invoice_items || []).forEach(item => {
        const key = item.sku_id
        if (!skuMap[key]) skuMap[key] = { name: item.sku?.sku_name || 'Unknown', quantity: 0 }
        skuMap[key].quantity += (item.quantity || 0)
      })
    })
    const topSKUs = Object.values(skuMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // Sales by Customer
    const custMap = {}
    data.forEach(t => {
      const name = t.customers?.customer_name || 'Unknown'
      if (!custMap[name]) custMap[name] = { name, value: 0 }
      custMap[name].value += (t.total_amount || 0)
    })
    const salesByCustomer = Object.values(custMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    return { totalRevenue, totalGST, invoiceCount, avgInvoiceValue, salesTrend, topSKUs, salesByCustomer }
  }, [data])

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  if (!analytics) return <EmptyState message="No sales data in this date range" icon={ShoppingCart} />

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Total Revenue" value={formatCurrency(analytics.totalRevenue)} icon={IndianRupee} color="green" description="This period" />
        <KPICard title="Invoice Count" value={analytics.invoiceCount} icon={FileText} color="blue" />
        <KPICard title="Avg Invoice Value" value={formatCurrency(analytics.avgInvoiceValue)} icon={BarChart3} color="purple" />
        <KPICard title="Total GST" value={formatCurrency(analytics.totalGST)} icon={IndianRupee} color="amber" />
      </div>

      {/* Sales Trend Line Chart */}
      <Card>
        <CardHeader><CardTitle>Sales Trend</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {analytics.salesTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v)} labelFormatter={v => new Date(v).toLocaleDateString('en-IN')} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} name="Revenue" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No trend data" />}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 SKUs - Horizontal Bar */}
        <Card>
          <CardHeader><CardTitle>Top 10 SKUs by Quantity Sold</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {analytics.topSKUs.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={analytics.topSKUs} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="quantity" name="Qty Sold" radius={[0, 4, 4, 0]}>
                    {analytics.topSKUs.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No SKU data" />}
          </CardContent>
        </Card>

        {/* Sales by Customer - Pie Chart */}
        <Card>
          <CardHeader><CardTitle>Sales by Customer</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            {analytics.salesByCustomer.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={analytics.salesByCustomer}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name.slice(0, 12)} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {analytics.salesByCustomer.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState message="No customer data" />}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ====================== TAB 2: PURCHASE ANALYTICS ======================
function PurchaseTab({ dateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-purchase', dateRange],
    queryFn: async () => {
      const { startDate, endDate } = dateRange

      const { data: inwards, error } = await supabase
        .from('vendor_inwards')
        .select(`
          id, inward_number, inward_date, total_amount, status,
          vendor_id,
          vendors ( vendor_name )
        `)
        .gte('inward_date', startDate)
        .lte('inward_date', endDate)
        .order('inward_date')

      if (error) throw error

      return { inwards: inwards || [] }
    },
    refetchOnWindowFocus: false
  })

  const analytics = useMemo(() => {
    if (!data) return null
    const { inwards } = data
    if (inwards.length === 0) return null

    const totalPurchase = inwards.reduce((s, t) => s + (t.total_amount || 0), 0)
    const inwardCount = inwards.length
    const uniqueVendors = new Set(inwards.map(t => t.vendor_id).filter(Boolean)).size

    // Purchase Trend
    const dailyMap = {}
    inwards.forEach(t => {
      const day = t.inward_date?.split('T')[0] || t.inward_date
      if (!dailyMap[day]) dailyMap[day] = { date: day, spend: 0 }
      dailyMap[day].spend += (t.total_amount || 0)
    })
    const purchaseTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))

    // Top Vendors by Spend
    const vendorMap = {}
    inwards.forEach(t => {
      const name = t.vendors?.vendor_name || 'Unknown'
      if (!vendorMap[name]) vendorMap[name] = { name, spend: 0 }
      vendorMap[name].spend += (t.total_amount || 0)
    })
    const topVendors = Object.values(vendorMap)
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 10)

    return { totalPurchase, inwardCount, uniqueVendors, purchaseTrend, topVendors }
  }, [data])

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  if (!analytics) return <EmptyState message="No purchase data in this date range" icon={Package} />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KPICard title="Total Purchase" value={formatCurrency(analytics.totalPurchase)} icon={IndianRupee} color="blue" />
        <KPICard title="Inward Entries" value={analytics.inwardCount} icon={Package} color="green" />
        <KPICard title="Unique Vendors" value={analytics.uniqueVendors} icon={Users} color="purple" />
      </div>

      {/* Purchase Trend */}
      <Card>
        <CardHeader><CardTitle>Purchase Trend</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {analytics.purchaseTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={analytics.purchaseTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tickFormatter={v => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} labelFormatter={v => new Date(v).toLocaleDateString('en-IN')} />
                <Legend />
                <Line type="monotone" dataKey="spend" stroke="#f59e0b" strokeWidth={2} name="Purchase Spend" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No trend data" />}
        </CardContent>
      </Card>

      {/* Top Vendors Bar Chart */}
      <Card>
        <CardHeader><CardTitle>Top Vendors by Spend</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {analytics.topVendors.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={analytics.topVendors}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={80} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={v => formatCurrency(v)} />
                <Bar dataKey="spend" name="Spend" radius={[4, 4, 0, 0]}>
                  {analytics.topVendors.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState message="No vendor data" />}
        </CardContent>
      </Card>
    </div>
  )
}

// ====================== TAB 3: INVENTORY ANALYTICS ======================
function InventoryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-inventory'],
    queryFn: async () => {
      // Fetch inventory with SKU details - use average_cost from inventory table
      const { data: inv, error } = await supabase
        .from('inventory')
        .select(`
          id, current_stock, average_cost, updated_at, sku_id,
          skus (
            sku_code, sku_name, unit_of_measure, reorder_level,
            sku_categories ( category_name )
          )
        `)
      if (error) throw error

      // Dead stock: SKUs with no customer_invoice_items in recent invoices (90 days)
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const { data: recentInvoiceItems, error: outErr } = await supabase
        .from('customer_invoice_items')
        .select('sku_id, customer_invoices!inner(invoice_date)')
        .gte('customer_invoices.invoice_date', ninetyDaysAgo.toISOString())
      if (outErr) console.warn('Recent invoice items query failed:', outErr)

      const recentOutwardSkuIds = new Set((recentInvoiceItems || []).map(r => r.sku_id))

      return { inventory: inv || [], recentOutwardSkuIds }
    },
    refetchOnWindowFocus: false
  })

  const analytics = useMemo(() => {
    if (!data) return null
    const { inventory, recentOutwardSkuIds } = data

    const stockRows = inventory.map(item => {
      const avgCost = item.average_cost || 0
      const qty = item.current_stock || 0
      return {
        id: item.id,
        sku_id: item.sku_id,
        sku_code: item.skus?.sku_code,
        sku_name: item.skus?.sku_name,
        category: item.skus?.sku_categories?.category_name || '-',
        qty,
        avgCost,
        stockValue: qty * avgCost,
        reorderLevel: item.skus?.reorder_level || 0,
        unit: item.skus?.unit_of_measure || '-'
      }
    })

    const totalInventoryValue = stockRows.reduce((s, r) => s + r.stockValue, 0)
    const lowStockAlerts = stockRows.filter(r => r.reorderLevel > 0 && r.qty > 0 && r.qty <= r.reorderLevel)
    const deadStock = stockRows.filter(r => r.qty > 0 && !recentOutwardSkuIds.has(r.sku_id))

    return { stockRows, totalInventoryValue, lowStockAlerts, deadStock }
  }, [data])

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  if (!analytics) return <EmptyState message="No inventory data" icon={Package} />

  return (
    <div className="space-y-6">
      {/* Total Inventory Value */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-green-100">
              <IndianRupee className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Inventory Value</p>
              <p className="text-2xl sm:text-3xl font-bold text-gray-900">{formatCurrency(analytics.totalInventoryValue)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stock Value - Desktop Table / Mobile Cards */}
      <Card>
        <CardHeader><CardTitle>Stock Value by SKU</CardTitle></CardHeader>
        <CardContent className="p-0">
          {analytics.stockRows.length === 0 ? (
            <EmptyState message="No stock data" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>SKU</TableHeader>
                      <TableHeader>Category</TableHeader>
                      <TableHeader>Qty</TableHeader>
                      <TableHeader>Avg Cost</TableHeader>
                      <TableHeader>Stock Value</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.stockRows
                      .sort((a, b) => b.stockValue - a.stockValue)
                      .slice(0, 50)
                      .map(row => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{row.sku_name}</p>
                              <p className="text-xs text-gray-500">{row.sku_code}</p>
                            </div>
                          </TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell>{row.qty} {row.unit}</TableCell>
                          <TableCell>{formatCurrency(row.avgCost)}</TableCell>
                          <TableCell className="font-semibold">{formatCurrency(row.stockValue)}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {analytics.stockRows
                  .sort((a, b) => b.stockValue - a.stockValue)
                  .slice(0, 50)
                  .map((row, index) => (
                    <div key={row.id} className={`rounded-xl p-4 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                      <div className="flex items-start justify-between mb-1">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 truncate">{row.sku_name}</p>
                          <p className="text-xs text-gray-500">{row.sku_code} &middot; {row.category}</p>
                        </div>
                        <p className="font-semibold text-gray-900 ml-2">{formatCurrency(row.stockValue)}</p>
                      </div>
                      <div className="flex items-center justify-between text-sm text-gray-500 mt-1">
                        <span>{row.qty} {row.unit}</span>
                        <span>Avg: {formatCurrency(row.avgCost)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Low Stock Alerts ({analytics.lowStockAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.lowStockAlerts.length === 0 ? (
              <p className="text-green-600 text-center py-6">All stock levels are healthy</p>
            ) : (
              <div className="space-y-2">
                {analytics.lowStockAlerts.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.sku_name}</p>
                      <p className="text-xs text-gray-500">Reorder at: {item.reorderLevel}</p>
                    </div>
                    <Badge variant="warning">{item.qty} left</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dead Stock */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-red-500" />
              Dead Stock - No Sales in 90 Days ({analytics.deadStock.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.deadStock.length === 0 ? (
              <p className="text-green-600 text-center py-6">No dead stock detected</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {analytics.deadStock.slice(0, 20).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{item.sku_name}</p>
                      <p className="text-xs text-gray-500">{item.category}</p>
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      <p className="text-sm font-semibold">{item.qty} {item.unit}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(item.stockValue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ====================== TAB 4: PROFIT & LOSS ======================
function ProfitLossTab({ dateRange }) {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-pl', dateRange],
    queryFn: async () => {
      const { startDate, endDate } = dateRange

      // Revenue: from customer_invoices
      const { data: invoices, error: salesErr } = await supabase
        .from('customer_invoices')
        .select(`
          id, invoice_date, total_amount, subtotal,
          customer_invoice_items ( sku_id, quantity )
        `)
        .gte('invoice_date', startDate)
        .lte('invoice_date', endDate)

      if (salesErr) throw salesErr

      // COGS: get average_cost per SKU from inventory table
      const { data: invData, error: invErr } = await supabase
        .from('inventory')
        .select('sku_id, average_cost')

      if (invErr) console.warn('Inventory cost query error:', invErr)

      // Build cost map
      const costMap = {}
      ;(invData || []).forEach(c => {
        costMap[c.sku_id] = c.average_cost || 0
      })

      return { invoices: invoices || [], costMap }
    },
    refetchOnWindowFocus: false
  })

  const analytics = useMemo(() => {
    if (!data) return null
    const { invoices, costMap } = data

    const revenue = invoices.reduce((s, t) => s + (t.total_amount || 0), 0)
    const totalSubtotal = invoices.reduce((s, t) => s + (t.subtotal || 0), 0)
    const totalGST = revenue - totalSubtotal
    const revenueExGST = totalSubtotal

    // Calculate COGS
    let cogs = 0
    invoices.forEach(t => {
      (t.customer_invoice_items || []).forEach(item => {
        const avgCost = costMap[item.sku_id] || 0
        cogs += (item.quantity || 0) * avgCost
      })
    })

    const grossProfit = revenueExGST - cogs
    const marginPct = revenueExGST > 0 ? ((grossProfit / revenueExGST) * 100).toFixed(1) : '0.0'

    // Monthly P&L table
    const monthlyMap = {}
    invoices.forEach(t => {
      const d = new Date(t.invoice_date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, subtotal: 0, cogs: 0 }
      monthlyMap[key].revenue += (t.total_amount || 0)
      monthlyMap[key].subtotal += (t.subtotal || 0)
      ;(t.customer_invoice_items || []).forEach(item => {
        const avgCost = costMap[item.sku_id] || 0
        monthlyMap[key].cogs += (item.quantity || 0) * avgCost
      })
    })

    const monthlyPL = Object.values(monthlyMap)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(m => {
        const gst = m.revenue - m.subtotal
        const revExGST = m.subtotal
        const profit = revExGST - m.cogs
        const margin = revExGST > 0 ? ((profit / revExGST) * 100).toFixed(1) : '0.0'
        return { ...m, gst, revenueExGST: revExGST, grossProfit: profit, margin }
      })

    return { revenue, revenueExGST, totalGST, cogs, grossProfit, marginPct, monthlyPL }
  }, [data])

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="lg" /></div>
  if (!analytics) return <EmptyState message="No P&L data in this date range" icon={TrendingUp} />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard title="Revenue (excl GST)" value={formatCurrency(analytics.revenueExGST)} icon={IndianRupee} color="green" />
        <KPICard title="COGS" value={formatCurrency(analytics.cogs)} icon={Package} color="red" />
        <KPICard
          title="Gross Profit"
          value={formatCurrency(analytics.grossProfit)}
          icon={TrendingUp}
          color={analytics.grossProfit >= 0 ? 'green' : 'red'}
        />
        <KPICard title="Margin %" value={`${analytics.marginPct}%`} icon={BarChart3} color="purple" />
      </div>

      {/* Monthly P&L Table */}
      <Card>
        <CardHeader><CardTitle>Monthly Profit & Loss</CardTitle></CardHeader>
        <CardContent className="p-0">
          {analytics.monthlyPL.length === 0 ? (
            <EmptyState message="No monthly data" />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>Month</TableHeader>
                      <TableHeader>Revenue (incl GST)</TableHeader>
                      <TableHeader>GST</TableHeader>
                      <TableHeader>Revenue (excl GST)</TableHeader>
                      <TableHeader>COGS</TableHeader>
                      <TableHeader>Gross Profit</TableHeader>
                      <TableHeader>Margin</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analytics.monthlyPL.map(row => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">
                          {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                        </TableCell>
                        <TableCell>{formatCurrency(row.revenue)}</TableCell>
                        <TableCell>{formatCurrency(row.gst)}</TableCell>
                        <TableCell>{formatCurrency(row.revenueExGST)}</TableCell>
                        <TableCell className="text-red-600">{formatCurrency(row.cogs)}</TableCell>
                        <TableCell className={row.grossProfit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {formatCurrency(row.grossProfit)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={parseFloat(row.margin) >= 0 ? 'success' : 'danger'}>
                            {row.margin}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3 p-4">
                {analytics.monthlyPL.map((row, index) => (
                  <div key={row.month} className={`rounded-xl p-4 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                    <p className="font-semibold text-gray-900 mb-2">
                      {new Date(row.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                      <span className="text-gray-500">Revenue</span>
                      <span className="text-right">{formatCurrency(row.revenue)}</span>
                      <span className="text-gray-500">GST</span>
                      <span className="text-right">{formatCurrency(row.gst)}</span>
                      <span className="text-gray-500">COGS</span>
                      <span className="text-right text-red-600">{formatCurrency(row.cogs)}</span>
                      <span className="text-gray-500 font-medium">Gross Profit</span>
                      <span className={`text-right font-semibold ${row.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(row.grossProfit)}
                      </span>
                      <span className="text-gray-500">Margin</span>
                      <span className="text-right">
                        <Badge variant={parseFloat(row.margin) >= 0 ? 'success' : 'danger'}>{row.margin}%</Badge>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ====================== MAIN ANALYTICS PAGE ======================
export default function AnalyticsPage() {
  const { user, hasPermission } = useAuth()
  const [activeTab, setActiveTab] = useState('sales')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  })

  const tabs = [
    { id: 'sales', label: 'Sales', icon: TrendingUp },
    { id: 'purchase', label: 'Purchases', icon: Package },
    { id: 'inventory', label: 'Inventory', icon: BarChart3 },
    { id: 'pl', label: 'P&L', icon: IndianRupee }
  ]

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Business insights, trends, and performance metrics"
      />

      {/* Date Range Filter */}
      <Card className="mb-3 sm:mb-6">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex gap-2 sm:gap-4 w-full sm:w-auto">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs text-gray-500 mb-0.5">From</label>
                <input
                  type="date"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs text-gray-500 mb-0.5">To</label>
                <input
                  type="date"
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation - scrollable on mobile */}
      <div className="mb-3 sm:mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-1.5" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'sales' && <SalesTab dateRange={dateRange} />}
      {activeTab === 'purchase' && <PurchaseTab dateRange={dateRange} />}
      {activeTab === 'inventory' && <InventoryTab />}
      {activeTab === 'pl' && <ProfitLossTab dateRange={dateRange} />}
    </div>
  )
}
