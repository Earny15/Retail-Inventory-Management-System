import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalyticsDashboard, getSalesAnalytics, getPurchaseAnalytics, getInventoryAnalytics, getPLAnalytics } from '../../services/analyticsService'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Spinner } from '../../components/ui/Spinner'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Package,
  DollarSign,
  BarChart3,
  PieChart,
  Activity,
  Calendar,
  Filter
} from 'lucide-react'

function MetricCard({ title, value, change, changeType, icon: Icon, description }) {
  const isPositive = changeType === 'positive'
  const isNeutral = changeType === 'neutral'

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-3 rounded-lg ${
              isPositive ? 'bg-green-100' : isNeutral ? 'bg-gray-100' : 'bg-red-100'
            }`}>
              <Icon className={`h-6 w-6 ${
                isPositive ? 'text-green-600' : isNeutral ? 'text-gray-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{title}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              {description && (
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              )}
            </div>
          </div>
          {change && (
            <div className={`flex items-center text-sm ${
              isPositive ? 'text-green-600' : isNeutral ? 'text-gray-600' : 'text-red-600'
            }`}>
              {isPositive ? (
                <TrendingUp className="h-4 w-4 mr-1" />
              ) : isNeutral ? (
                <Activity className="h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="h-4 w-4 mr-1" />
              )}
              {change}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SalesTab({ dateRange }) {
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-analytics', dateRange],
    queryFn: () => getSalesAnalytics(dateRange),
    refetchOnWindowFocus: false
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Sales Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Sales"
          value={formatCurrency(salesData?.totalSales || 0)}
          change={salesData?.salesGrowth ? `${salesData.salesGrowth}%` : null}
          changeType={salesData?.salesGrowth > 0 ? 'positive' : salesData?.salesGrowth < 0 ? 'negative' : 'neutral'}
          icon={DollarSign}
          description="Gross sales revenue"
        />
        <MetricCard
          title="Invoices"
          value={salesData?.totalInvoices || 0}
          change={salesData?.invoiceGrowth ? `${salesData.invoiceGrowth}%` : null}
          changeType={salesData?.invoiceGrowth > 0 ? 'positive' : salesData?.invoiceGrowth < 0 ? 'negative' : 'neutral'}
          icon={ShoppingCart}
          description="Total invoices generated"
        />
        <MetricCard
          title="Avg Invoice Value"
          value={formatCurrency(salesData?.avgInvoiceValue || 0)}
          change={salesData?.avgValueGrowth ? `${salesData.avgValueGrowth}%` : null}
          changeType={salesData?.avgValueGrowth > 0 ? 'positive' : salesData?.avgValueGrowth < 0 ? 'negative' : 'neutral'}
          icon={BarChart3}
          description="Average per invoice"
        />
        <MetricCard
          title="GST Collected"
          value={formatCurrency(salesData?.totalGST || 0)}
          icon={PieChart}
          description="Total GST amount"
          changeType="neutral"
        />
      </div>

      {/* Sales Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData?.topCustomers?.map((customer, index) => (
                <div key={customer.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
                      <span className="text-primary-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{customer.customer_name}</p>
                      <p className="text-sm text-gray-500">{customer.invoices_count} invoices</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(customer.total_amount)}</p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No customer data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top SKUs */}
        <Card>
          <CardHeader>
            <CardTitle>Top Selling SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {salesData?.topSKUs?.map((sku, index) => (
                <div key={sku.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                      <span className="text-green-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{sku.sku_name}</p>
                      <p className="text-sm text-gray-500">{sku.total_quantity} units sold</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(sku.total_revenue)}</p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No SKU data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Trends */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Sales Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {salesData?.monthlyTrends?.map((month) => (
              <div key={month.month} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{month.month_name}</p>
                  <p className="text-sm text-gray-500">{month.invoices_count} invoices</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(month.total_amount)}</p>
                  <p className="text-sm text-gray-500">Avg: {formatCurrency(month.avg_amount)}</p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">No trend data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PurchaseTab({ dateRange }) {
  const { data: purchaseData, isLoading } = useQuery({
    queryKey: ['purchase-analytics', dateRange],
    queryFn: () => getPurchaseAnalytics(dateRange),
    refetchOnWindowFocus: false
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Purchase Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Purchases"
          value={formatCurrency(purchaseData?.totalPurchases || 0)}
          change={purchaseData?.purchaseGrowth ? `${purchaseData.purchaseGrowth}%` : null}
          changeType={purchaseData?.purchaseGrowth > 0 ? 'negative' : purchaseData?.purchaseGrowth < 0 ? 'positive' : 'neutral'}
          icon={Package}
          description="Total inward value"
        />
        <MetricCard
          title="Inward Transactions"
          value={purchaseData?.totalInwards || 0}
          change={purchaseData?.inwardGrowth ? `${purchaseData.inwardGrowth}%` : null}
          changeType={purchaseData?.inwardGrowth > 0 ? 'neutral' : 'neutral'}
          icon={Activity}
          description="Total inward transactions"
        />
        <MetricCard
          title="Avg Transaction Value"
          value={formatCurrency(purchaseData?.avgInwardValue || 0)}
          change={purchaseData?.avgValueGrowth ? `${purchaseData.avgValueGrowth}%` : null}
          changeType={purchaseData?.avgValueGrowth > 0 ? 'negative' : purchaseData?.avgValueGrowth < 0 ? 'positive' : 'neutral'}
          icon={BarChart3}
          description="Average per inward"
        />
        <MetricCard
          title="Total Items"
          value={purchaseData?.totalItems || 0}
          icon={Package}
          description="Items purchased"
          changeType="neutral"
        />
      </div>

      {/* Purchase Charts and Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Vendors */}
        <Card>
          <CardHeader>
            <CardTitle>Top Vendors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseData?.topVendors?.map((vendor, index) => (
                <div key={vendor.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center">
                      <span className="text-purple-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{vendor.vendor_name}</p>
                      <p className="text-sm text-gray-500">{vendor.transactions_count} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(vendor.total_amount)}</p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No vendor data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Purchased SKUs */}
        <Card>
          <CardHeader>
            <CardTitle>Most Purchased SKUs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {purchaseData?.topSKUs?.map((sku, index) => (
                <div key={sku.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <span className="text-orange-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{sku.sku_name}</p>
                      <p className="text-sm text-gray-500">{sku.total_quantity} units purchased</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(sku.total_cost)}</p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No SKU data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function InventoryTab({ dateRange }) {
  const { data: inventoryData, isLoading } = useQuery({
    queryKey: ['inventory-analytics', dateRange],
    queryFn: () => getInventoryAnalytics(dateRange),
    refetchOnWindowFocus: false
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  return (
    <div className="space-y-6">
      {/* Inventory Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total SKUs"
          value={inventoryData?.totalSKUs || 0}
          icon={Package}
          description="Active SKUs in system"
          changeType="neutral"
        />
        <MetricCard
          title="Total Stock Value"
          value={formatCurrency(inventoryData?.totalStockValue || 0)}
          icon={DollarSign}
          description="Current inventory value"
          changeType="neutral"
        />
        <MetricCard
          title="Low Stock Alerts"
          value={inventoryData?.lowStockItems || 0}
          icon={TrendingDown}
          description="Items below minimum stock"
          changeType={inventoryData?.lowStockItems > 0 ? 'negative' : 'positive'}
        />
        <MetricCard
          title="Out of Stock"
          value={inventoryData?.outOfStockItems || 0}
          icon={Activity}
          description="Items with zero stock"
          changeType={inventoryData?.outOfStockItems > 0 ? 'negative' : 'positive'}
        />
      </div>

      {/* Inventory Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventoryData?.lowStockList?.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.sku_name}</p>
                    <p className="text-sm text-gray-500">Min: {item.minimum_stock_level}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-600 font-semibold">{item.current_stock}</p>
                    <p className="text-xs text-gray-500">Current Stock</p>
                  </div>
                </div>
              )) || (
                <p className="text-green-600 text-center py-4">✓ All items have sufficient stock</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* High Value Items */}
        <Card>
          <CardHeader>
            <CardTitle>High Value Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {inventoryData?.highValueItems?.map((item, index) => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.sku_name}</p>
                      <p className="text-sm text-gray-500">{item.current_stock} units</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(item.stock_value)}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(item.avg_cost)}/unit</p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500 text-center py-4">No inventory data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Stock by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {inventoryData?.categoryBreakdown?.map((category) => (
              <div key={category.id} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{category.category_name}</p>
                  <p className="text-sm text-gray-500">{category.sku_count} SKUs</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">{formatCurrency(category.total_value)}</p>
                  <p className="text-sm text-gray-500">{category.total_stock} units</p>
                </div>
              </div>
            )) || (
              <p className="text-gray-500 text-center py-4">No category data available</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfitLossTab({ dateRange }) {
  const { data: plData, isLoading } = useQuery({
    queryKey: ['pl-analytics', dateRange],
    queryFn: () => getPLAnalytics(dateRange),
    refetchOnWindowFocus: false
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const grossProfit = (plData?.totalRevenue || 0) - (plData?.totalCOGS || 0)
  const grossMargin = plData?.totalRevenue ? ((grossProfit / plData.totalRevenue) * 100).toFixed(1) : 0

  return (
    <div className="space-y-6">
      {/* P&L Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={formatCurrency(plData?.totalRevenue || 0)}
          change={plData?.revenueGrowth ? `${plData.revenueGrowth}%` : null}
          changeType={plData?.revenueGrowth > 0 ? 'positive' : plData?.revenueGrowth < 0 ? 'negative' : 'neutral'}
          icon={DollarSign}
          description="Sales revenue"
        />
        <MetricCard
          title="Cost of Goods Sold"
          value={formatCurrency(plData?.totalCOGS || 0)}
          change={plData?.cogsGrowth ? `${plData.cogsGrowth}%` : null}
          changeType={plData?.cogsGrowth > 0 ? 'negative' : plData?.cogsGrowth < 0 ? 'positive' : 'neutral'}
          icon={Package}
          description="Direct costs"
        />
        <MetricCard
          title="Gross Profit"
          value={formatCurrency(grossProfit)}
          change={plData?.profitGrowth ? `${plData.profitGrowth}%` : null}
          changeType={grossProfit > 0 ? (plData?.profitGrowth > 0 ? 'positive' : plData?.profitGrowth < 0 ? 'negative' : 'neutral') : 'negative'}
          icon={TrendingUp}
          description={`${grossMargin}% margin`}
        />
        <MetricCard
          title="GST Collected"
          value={formatCurrency(plData?.totalGSTCollected || 0)}
          icon={BarChart3}
          description="Output GST"
          changeType="neutral"
        />
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader>
          <CardTitle>Profit & Loss Statement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Revenue Section */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">Revenue</p>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(plData?.totalRevenue || 0)}</p>
              </div>
              <div className="ml-4 space-y-2 mt-2">
                <div className="flex justify-between text-sm">
                  <p className="text-gray-600">Sales (Excluding GST)</p>
                  <p className="text-gray-900">{formatCurrency((plData?.totalRevenue || 0) - (plData?.totalGSTCollected || 0))}</p>
                </div>
                <div className="flex justify-between text-sm">
                  <p className="text-gray-600">GST Collected</p>
                  <p className="text-gray-900">{formatCurrency(plData?.totalGSTCollected || 0)}</p>
                </div>
              </div>
            </div>

            {/* Cost Section */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">Cost of Goods Sold</p>
                <p className="text-lg font-semibold text-red-600">{formatCurrency(plData?.totalCOGS || 0)}</p>
              </div>
              <div className="ml-4 space-y-2 mt-2">
                <div className="flex justify-between text-sm">
                  <p className="text-gray-600">Direct Material Cost</p>
                  <p className="text-gray-900">{formatCurrency(plData?.totalCOGS || 0)}</p>
                </div>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="border-b border-gray-200 pb-4">
              <div className="flex justify-between items-center">
                <p className="text-lg font-semibold text-gray-900">Gross Profit</p>
                <p className={`text-lg font-semibold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(grossProfit)}
                </p>
              </div>
              <div className="ml-4 mt-2">
                <p className="text-sm text-gray-600">Gross Margin: {grossMargin}%</p>
              </div>
            </div>

            {/* SKU Profitability */}
            {plData?.skuProfitability && plData.skuProfitability.length > 0 && (
              <div>
                <p className="text-lg font-semibold text-gray-900 mb-3">Top Profitable SKUs</p>
                <div className="space-y-3">
                  {plData.skuProfitability.map((sku, index) => (
                    <div key={sku.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 font-medium text-sm">{index + 1}</span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{sku.sku_name}</p>
                          <p className="text-sm text-gray-500">{sku.units_sold} units sold</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-green-600">{formatCurrency(sku.profit)}</p>
                        <p className="text-xs text-gray-500">{sku.margin}% margin</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState('sales')
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    endDate: new Date().toISOString().split('T')[0]
  })

  const tabs = [
    { id: 'sales', label: 'Sales Analytics', icon: TrendingUp },
    { id: 'purchase', label: 'Purchase Analytics', icon: Package },
    { id: 'inventory', label: 'Inventory Analytics', icon: BarChart3 },
    { id: 'pl', label: 'Profit & Loss', icon: DollarSign }
  ]

  const handleDateRangeChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }))
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sales':
        return <SalesTab dateRange={dateRange} />
      case 'purchase':
        return <PurchaseTab dateRange={dateRange} />
      case 'inventory':
        return <InventoryTab dateRange={dateRange} />
      case 'pl':
        return <ProfitLossTab dateRange={dateRange} />
      default:
        return <SalesTab dateRange={dateRange} />
    }
  }

  return (
    <div>
      <PageHeader
        title="Analytics Dashboard"
        description="Comprehensive business insights and performance metrics"
      />

      {/* Date Range Filter */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Date Range:</span>
            </div>
            <div className="flex gap-4">
              <Input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
                label="From"
              />
              <Input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
                label="To"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                    ${activeTab === tab.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  )
}