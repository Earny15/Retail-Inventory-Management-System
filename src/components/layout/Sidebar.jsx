import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.simple.jsx'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import {
  LayoutDashboard,
  Receipt,
  PackageOpen,
  Package,
  History,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Menu,
  X
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    permission: null
  },
  {
    name: 'Invoices',
    icon: Receipt,
    permission: 'customer_invoice',
    children: [
      { name: 'New Invoice', href: '/invoices/new' },
      { name: 'Invoice List', href: '/invoices' }
    ]
  },
  {
    name: 'Inward',
    icon: PackageOpen,
    permission: 'vendor_inward',
    href: '/inward/list',
    children: [
      { name: 'New Inward (AI)', href: '/inward/new' },
      { name: 'Inward History', href: '/inward/list' }
    ]
  },
  {
    name: 'Inventory',
    href: '/inventory',
    icon: Package,
    permission: 'inventory'
  },
  {
    name: 'Transactions',
    href: '/transactions',
    icon: History,
    permission: 'transaction_log'
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    permission: 'analytics'
  },
  {
    name: 'Masters',
    icon: Settings,
    permission: null,
    children: [
      { name: 'Company', href: '/masters/company', permission: 'company_master' },
      { name: 'SKU Master', href: '/masters/skus', permission: 'sku_master' },
      { name: 'Customers', href: '/masters/customers', permission: 'customer_master' },
      { name: 'Vendors', href: '/masters/vendors', permission: 'vendor_master' },
      { name: 'Users & Roles', href: '/masters/users', permission: 'user_role_master' }
    ]
  }
]

function NavigationItem({ item, isCollapsed }) {
  const location = useLocation()
  const { canView } = usePermissions()
  const [isExpanded, setIsExpanded] = useState(false)

  // Check if this item or any child is active
  const isActive = item.href === location.pathname ||
    (item.children && item.children.some(child => child.href === location.pathname))

  // Check permissions
  if (item.permission && !canView(item.permission)) {
    return null
  }

  // Filter children by permissions
  const visibleChildren = item.children?.filter(child =>
    !child.permission || canView(child.permission)
  ) || []

  if (item.children && visibleChildren.length === 0) {
    return null
  }

  const ItemIcon = item.icon

  if (!item.children) {
    // Simple navigation item
    return (
      <li>
        <Link
          to={item.href}
          className={`
            group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
            ${isActive
              ? 'bg-primary-100 text-primary-900'
              : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }
            ${isCollapsed ? 'justify-center px-2' : 'px-2'}
          `}
          title={isCollapsed ? item.name : undefined}
        >
          <ItemIcon className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span className="ml-3">{item.name}</span>}
        </Link>
      </li>
    )
  }

  // Navigation item with children
  return (
    <li>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          group flex items-center w-full px-2 py-2 text-sm font-medium text-left rounded-md transition-colors
          ${isActive
            ? 'bg-primary-100 text-primary-900'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
          }
          ${isCollapsed ? 'justify-center px-2' : 'px-2'}
        `}
        title={isCollapsed ? item.name : undefined}
      >
        <ItemIcon className="h-5 w-5 flex-shrink-0" />
        {!isCollapsed && (
          <>
            <span className="ml-3 flex-1">{item.name}</span>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </>
        )}
      </button>

      {!isCollapsed && isExpanded && (
        <ul className="mt-1 ml-8 space-y-1">
          {visibleChildren.map((child) => (
            <li key={child.href}>
              <Link
                to={child.href}
                className={`
                  group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors
                  ${child.href === location.pathname
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                {child.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const { user } = useAuth()

  // 🚧 DEVELOPMENT MOCK - Remove in production
  const mockUser = import.meta.env.DEV ? {
    full_name: 'Demo Admin',
    email: 'admin@demo.com'
  } : null

  const displayUser = user || mockUser

  const sidebarContent = (
    <>
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-200">
        {!isCollapsed && (
          <>
            <h1 className="text-xl font-bold text-gray-900">AluminiumPro</h1>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="ml-auto p-1 text-gray-500 hover:text-gray-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </>
        )}
        {isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        <ul className="space-y-1">
          {navigation.map((item) => (
            <NavigationItem
              key={item.name}
              item={item}
              isCollapsed={isCollapsed}
            />
          ))}
        </ul>
      </nav>

      {/* User info */}
      {!isCollapsed && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {displayUser?.full_name?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {displayUser?.full_name}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {displayUser?.email}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <div className={`
        hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0
        ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
        bg-white border-r border-gray-200 transition-all duration-300
      `}>
        {sidebarContent}
      </div>

      {/* Mobile sidebar overlay */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-gray-600 bg-opacity-75" onClick={() => setIsMobileOpen(false)} />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setIsMobileOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-30 p-4">
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-md bg-white border border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Collapsed state indicator for desktop */}
      {isCollapsed && (
        <div className="hidden lg:block lg:pl-16" />
      )}
      {!isCollapsed && (
        <div className="hidden lg:block lg:pl-64" />
      )}
    </>
  )
}