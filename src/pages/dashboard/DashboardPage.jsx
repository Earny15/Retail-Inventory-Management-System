import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { formatCurrency } from '../../utils/gstCalculator'
import {
  IndianRupee,
  Package,
  Users,
  FileText,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  ArrowRight
} from 'lucide-react'

export default function DashboardPage() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()

  // KPI: Total Revenue this month (from customer_invoices)
  const { data: revenueData } = useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: async () => {
      const now = new Date()
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

      const { data, error } = await supabase
        .from('customer_invoices')
        .select('total_amount')
        .gte('invoice_date', firstOfMonth)
        .lte('invoice_date', endOfMonth)

      if (error) throw error
      const total = (data || []).reduce((s, t) => s + (t.total_amount || 0), 0)
      const count = data?.length || 0
      return { total, count }
    },
    refetchOnWindowFocus: false
  })

  // KPI: Active SKUs count
  const { data: skuCount } = useQuery({
    queryKey: ['dashboard-skus'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('skus')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
      if (error) throw error
      return count || 0
    },
    refetchOnWindowFocus: false
  })

  // KPI: Total Customers
  const { data: customerCount } = useQuery({
    queryKey: ['dashboard-customers'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      return count || 0
    },
    refetchOnWindowFocus: false
  })

  // Recent transactions: merge vendor_inwards + customer_invoices, sort by date
  const { data: recentTxns = [], isLoading: loadingTxns } = useQuery({
    queryKey: ['dashboard-recent-txns'],
    queryFn: async () => {
      // Fetch recent inwards
      const { data: inwards, error: inErr } = await supabase
        .from('vendor_inwards')
        .select(`
          id, inward_number, inward_date, status, total_amount, created_at,
          vendors ( vendor_name )
        `)
        .order('created_at', { ascending: false })
        .limit(5)
      if (inErr) throw inErr

      // Fetch recent invoices
      const { data: invoices, error: invErr } = await supabase
        .from('customer_invoices')
        .select(`
          id, invoice_number, invoice_date, status, total_amount, created_at,
          customers ( customer_name )
        `)
        .order('created_at', { ascending: false })
        .limit(5)
      if (invErr) throw invErr

      const merged = [
        ...(inwards || []).map(r => ({
          id: r.id,
          ref_no: r.inward_number,
          type: 'INWARD',
          date: r.inward_date,
          status: r.status,
          total_amount: r.total_amount,
          party_name: r.vendors?.vendor_name || '-',
          created_at: r.created_at
        })),
        ...(invoices || []).map(r => ({
          id: r.id,
          ref_no: r.invoice_number,
          type: 'INVOICE',
          date: r.invoice_date,
          status: r.status,
          total_amount: r.total_amount,
          party_name: r.customers?.customer_name || '-',
          created_at: r.created_at
        }))
      ]

      // Sort by created_at descending and take top 5
      merged.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      return merged.slice(0, 5)
    },
    refetchOnWindowFocus: false
  })

  // Low stock alerts (using current_stock from inventory)
  const { data: lowStockItems = [], isLoading: loadingLowStock } = useQuery({
    queryKey: ['dashboard-low-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id, current_stock,
          skus ( sku_code, sku_name, reorder_level, unit_of_measure )
        `)

      if (error) throw error

      // Filter client-side: current_stock <= reorder_level and reorder_level > 0
      return (data || []).filter(item =>
        item.skus?.reorder_level > 0 && (item.current_stock || 0) <= item.skus.reorder_level
      )
    },
    refetchOnWindowFocus: false
  })

  const stats = [
    {
      name: 'Total Revenue',
      value: formatCurrency(revenueData?.total || 0),
      description: 'This month',
      icon: IndianRupee,
      color: 'bg-emerald-100 text-emerald-700'
    },
    {
      name: 'Active SKUs',
      value: skuCount ?? 0,
      description: 'In catalog',
      icon: Package,
      color: 'bg-blue-100 text-blue-600'
    },
    {
      name: 'Total Customers',
      value: customerCount ?? 0,
      description: 'Registered',
      icon: Users,
      color: 'bg-purple-100 text-purple-700'
    },
    {
      name: 'Invoices This Month',
      value: revenueData?.count ?? 0,
      description: 'Customer invoices',
      icon: FileText,
      color: 'bg-amber-100 text-amber-700'
    }
  ]

  const quickActions = [
    { label: 'New Invoice', icon: Plus, path: '/invoices/new', color: 'text-blue-600' },
    { label: 'New Inward', icon: ArrowDownLeft, path: '/inward/new', color: 'text-emerald-600' },
    { label: 'Customers', icon: Users, path: '/masters/customers', color: 'text-purple-600' },
    { label: 'Analytics', icon: BarChart3, path: '/analytics', color: 'text-amber-600' }
  ]

  const getTypeBadge = (type) => {
    if (type === 'INWARD') return <Badge variant="success">Inward</Badge>
    if (type === 'INVOICE') return <Badge variant="info">Invoice</Badge>
    return <Badge variant="default">{type}</Badge>
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.full_name || 'User'}!`}
        description="Here's what's happening with your aluminium business today."
      />

      {/* KPI Cards - 2-col on mobile, 4-col on desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name}>
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.name}</p>
                    <p className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
                    <p className="text-xs text-gray-500 mt-1 hidden sm:block">{stat.description}</p>
                  </div>
                  <div className={`p-2 sm:p-3 rounded-full ${stat.color} ml-2 flex-shrink-0`}>
                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTxns ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : recentTxns.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                <p className="text-gray-500 text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTxns.map(txn => (
                  <div
                    key={`${txn.type}-${txn.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50 rounded px-1 -mx-1 transition-colors"
                    onClick={() => {
                      if (txn.type === 'INWARD') navigate(`/inward/${txn.id}`)
                      else navigate(`/invoices/${txn.id}`)
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {txn.ref_no || 'No ref'}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {txn.party_name} &middot;{' '}
                          {txn.date
                            ? new Date(txn.date).toLocaleDateString('en-IN')
                            : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 ml-2">
                      {getTypeBadge(txn.type)}
                      <span className="text-sm font-semibold text-gray-900 hidden sm:inline">
                        {txn.total_amount != null ? formatCurrency(txn.total_amount) : '-'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {quickActions.map(action => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => navigate(action.path)}
                    className="p-4 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50 transition-all group"
                  >
                    <div className="text-center">
                      <Icon className={`h-8 w-8 mx-auto mb-2 ${action.color} group-hover:scale-110 transition-transform`} />
                      <p className="text-sm font-medium text-gray-600">{action.label}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Low Stock Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLowStock ? (
            <div className="flex justify-center py-6"><Spinner size="md" /></div>
          ) : lowStockItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No low stock alerts</p>
              <p className="text-sm">All inventory levels are healthy</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.slice(0, 10).map(item => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.skus?.sku_name}</p>
                    <p className="text-xs text-gray-500">{item.skus?.sku_code} &middot; Reorder at {item.skus?.reorder_level}</p>
                  </div>
                  <Badge variant={item.current_stock <= 0 ? 'danger' : 'warning'}>
                    {item.current_stock || 0} {item.skus?.unit_of_measure}
                  </Badge>
                </div>
              ))}
              {lowStockItems.length > 10 && (
                <button
                  onClick={() => navigate('/inventory')}
                  className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium mt-2"
                >
                  View all {lowStockItems.length} alerts
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
