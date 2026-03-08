import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import PageHeader from '../../components/shared/PageHeader'
import { useAuth } from '../../hooks/useAuth.simple.jsx'
import { BarChart, Package, Users, TrendingUp, IndianRupee } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()

  // 🚧 DEVELOPMENT MOCK - Remove in production
  const mockUser = import.meta.env.DEV ? {
    full_name: 'Demo Admin'
  } : null

  const displayUser = user || mockUser

  const stats = [
    {
      name: 'Total Revenue',
      value: '₹2,45,680',
      change: '+12.3%',
      changeType: 'positive',
      icon: IndianRupee
    },
    {
      name: 'Active SKUs',
      value: '248',
      change: '+3 new',
      changeType: 'positive',
      icon: Package
    },
    {
      name: 'Total Customers',
      value: '89',
      change: '+5 this week',
      changeType: 'positive',
      icon: Users
    },
    {
      name: 'Profit Margin',
      value: '18.2%',
      change: '+0.8%',
      changeType: 'positive',
      icon: TrendingUp
    }
  ]

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${displayUser?.full_name || 'User'}!`}
        description="Here's what's happening with your aluminium business today."
      />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.name}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className={`text-xs ${
                      stat.changeType === 'positive' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {stat.change}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-primary-100">
                    <Icon className="h-6 w-6 text-primary-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New invoice INV-2024-001 created</p>
                  <p className="text-xs text-gray-500">2 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Inward transaction completed</p>
                  <p className="text-xs text-gray-500">15 minutes ago</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-purple-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">New customer registered</p>
                  <p className="text-xs text-gray-500">1 hour ago</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
                <div className="text-center">
                  <Package className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">New Invoice</p>
                </div>
              </button>
              <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
                <div className="text-center">
                  <BarChart className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">AI Inward</p>
                </div>
              </button>
              <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
                <div className="text-center">
                  <Users className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">Add Customer</p>
                </div>
              </button>
              <button className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors">
                <div className="text-center">
                  <TrendingUp className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-600">View Analytics</p>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock Alerts */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-yellow-600">⚠️ Low Stock Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 text-gray-400" />
            <p>No low stock alerts at the moment</p>
            <p className="text-sm">All inventory levels are healthy</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}