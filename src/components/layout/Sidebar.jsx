import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, FileText, FilePlus, PackageOpen, PackagePlus,
  Package, History, BarChart3, Building2, Layers, Users, Truck,
  UserCog, X, ChevronDown, ChevronRight, ClipboardList, ClipboardPlus,
  MessageCircle
} from 'lucide-react'
import { useState } from 'react'

const navGroups = [
  {
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, module: null },
    ]
  },
  {
    label: 'Invoices',
    icon: FileText,
    module: 'customer_invoice',
    items: [
      { name: 'New Invoice', href: '/invoices/new', icon: FilePlus },
      { name: 'Invoice List', href: '/invoices', icon: FileText },
    ]
  },
  {
    label: 'Sales Quotation',
    icon: ClipboardList,
    items: [
      { name: 'New Quotation', href: '/quotations/new', icon: ClipboardPlus },
      { name: 'Quotation List', href: '/quotations', icon: ClipboardList },
    ]
  },
  {
    label: 'Inward',
    icon: PackageOpen,
    module: 'vendor_inward',
    items: [
      { name: 'New Inward (AI)', href: '/inward/new', icon: PackagePlus },
      { name: 'Inward History', href: '/inward', icon: PackageOpen },
    ]
  },
  {
    items: [
      { name: 'WhatsApp Logs', href: '/whatsapp-logs', icon: MessageCircle },
      { name: 'Inventory', href: '/inventory', icon: Package, module: 'inventory' },
      { name: 'Transactions', href: '/transactions', icon: History, module: 'transaction_log' },
      { name: 'Analytics', href: '/analytics', icon: BarChart3, module: 'analytics' },
    ]
  },
  {
    label: 'Masters',
    icon: Building2,
    items: [
      { name: 'Company', href: '/masters/company', icon: Building2, module: 'company_master' },
      { name: 'SKU Master', href: '/masters/skus', icon: Layers, module: 'sku_master' },
      { name: 'Customers', href: '/masters/customers', icon: Users, module: 'customer_master' },
      { name: 'Vendors', href: '/masters/vendors', icon: Truck, module: 'vendor_master' },
      { name: 'Users & Roles', href: '/masters/users', icon: UserCog, module: 'user_role_master' },
    ]
  },
]

export default function Sidebar({ onClose }) {
  const location = useLocation()
  const { hasPermission } = useAuth()
  const [expanded, setExpanded] = useState({})

  const toggleGroup = (label) => {
    setExpanded(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const isActive = (href) => location.pathname === href

  const isGroupActive = (items) => items.some(item => location.pathname === item.href)

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header with blue accent */}
      <div className="flex items-center justify-between px-4 py-4 bg-navy-600">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-navy-600 text-sm font-bold">AP</span>
          </div>
          <span className="text-lg font-bold text-white tracking-tight">AluminiumPro</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden p-1.5 rounded-lg hover:bg-white/20">
            <X className="h-5 w-5 text-white/80" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navGroups.map((group, gIdx) => {
          if (group.module && !hasPermission(group.module, 'view')) return null

          if (!group.label) {
            return (
              <div key={gIdx}>
                {group.items.map(item => {
                  if (item.module && !hasPermission(item.module, 'view')) return null
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                        isActive(item.href)
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-600/25'
                          : 'text-gray-800 hover:bg-navy-50 hover:text-navy-700'
                      }`}
                    >
                      <Icon className={`h-5 w-5 flex-shrink-0 ${isActive(item.href) ? '' : 'text-navy-500'}`} />
                      <span>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )
          }

          const groupActive = isGroupActive(group.items)
          const isExpanded = expanded[group.label] ?? groupActive
          const GroupIcon = group.icon

          const visibleItems = group.items.filter(
            item => !item.module || hasPermission(item.module, 'view')
          )
          if (visibleItems.length === 0) return null

          return (
            <div key={group.label}>
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
                  groupActive ? 'text-navy-700' : 'text-gray-600 hover:bg-navy-50 hover:text-gray-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <GroupIcon className={`h-5 w-5 flex-shrink-0 ${groupActive ? 'text-primary-600' : 'text-navy-400'}`} />
                  <span>{group.label}</span>
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {isExpanded && (
                <div className="ml-4 mt-1 space-y-0.5">
                  {visibleItems.map(item => {
                    const Icon = item.icon
                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 px-3 py-2 text-sm rounded-xl transition-all ${
                          isActive(item.href)
                            ? 'bg-primary-600 text-white font-medium shadow-md shadow-primary-600/25'
                            : 'text-gray-700 hover:bg-navy-50 hover:text-navy-700'
                        }`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${isActive(item.href) ? '' : 'text-navy-400'}`} />
                        <span>{item.name}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <UserBadge />
      </div>
    </div>
  )
}

function UserBadge() {
  const { user } = useAuth()
  const initials = (user?.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-xl bg-navy-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">{initials}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name || 'User'}</p>
        <p className="text-xs text-gray-500 truncate">{user?.role_name || 'Admin'}</p>
      </div>
    </div>
  )
}
