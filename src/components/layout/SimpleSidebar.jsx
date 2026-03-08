import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  PackageOpen,
  Package,
  History,
  BarChart3,
  Settings
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Invoices', href: '/invoices', icon: Receipt },
  { name: 'Inward', href: '/inward', icon: PackageOpen },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Masters', href: '/masters/company', icon: Settings }
]

export default function SimpleSidebar() {
  const location = useLocation()

  return (
    <div className="bg-white border-r border-gray-200 h-full">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">AluminiumPro</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.href

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`
                group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                ${isActive
                  ? 'bg-blue-100 text-blue-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }
              `}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="ml-3">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-medium">DA</span>
            </div>
          </div>
          <div className="ml-3 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">Demo Admin</p>
            <p className="text-xs text-gray-500 truncate">admin@demo.com</p>
          </div>
        </div>
      </div>
    </div>
  )
}