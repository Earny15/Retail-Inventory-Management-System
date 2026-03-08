import { Routes, Route, Navigate } from 'react-router-dom'
import { Link, useLocation } from 'react-router-dom'
import DashboardPage from './pages/dashboard/DashboardPage'
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
  { name: 'New Invoice', href: '/invoices/new', icon: Receipt },
  { name: 'Inward', href: '/inward', icon: PackageOpen },
  { name: 'New Inward (AI)', href: '/inward/new', icon: PackageOpen },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Transactions', href: '/transactions', icon: History },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Company Master', href: '/masters/company', icon: Settings },
  { name: 'SKU Master', href: '/masters/skus', icon: Settings },
  { name: 'Customers', href: '/masters/customers', icon: Settings },
  { name: 'Vendors', href: '/masters/vendors', icon: Settings },
  { name: 'Users & Roles', href: '/masters/users', icon: Settings }
]

function BasicSidebar() {
  const location = useLocation()

  return (
    <div className="bg-white border-r border-gray-200 h-full">
      <div className="flex items-center px-4 py-4 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">AluminiumPro</h1>
      </div>

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

function SimplePage({ title, description }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <p className="mb-4">{description}</p>
      <div className="bg-blue-50 p-4 rounded">
        <p>This page is under development. Coming soon!</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{display: 'flex'}}>
        <div style={{width: '250px', minHeight: '100vh'}}>
          <BasicSidebar />
        </div>
        <div style={{flex: 1}}>
          <main className="py-6 px-4 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Invoice Routes */}
              <Route path="/invoices" element={<SimplePage title="Invoice Management" description="View and manage all your customer invoices, track payments, and generate reports." />} />
              <Route path="/invoices/new" element={<SimplePage title="Create New Invoice" description="Generate professional invoices with automatic GST calculations and PDF export." />} />

              {/* Inward Routes */}
              <Route path="/inward" element={<SimplePage title="Vendor Inward Management" description="AI-powered vendor invoice processing and inventory management system." />} />
              <Route path="/inward/new" element={<SimplePage title="AI Inward Processing" description="Upload vendor invoices and let AI automatically process them into your inventory." />} />

              {/* Other Routes */}
              <Route path="/inventory" element={<SimplePage title="Inventory Management" description="Track stock levels, manage SKUs, and monitor inventory movements in real-time." />} />
              <Route path="/transactions" element={<SimplePage title="Transaction Log" description="Comprehensive log of all inventory transactions, payments, and system activities." />} />
              <Route path="/analytics" element={<SimplePage title="Business Analytics" description="Detailed insights, reports, and analytics for your aluminium business performance." />} />

              {/* Masters Routes */}
              <Route path="/masters/company" element={<SimplePage title="Company Master" description="Manage company information, GST details, and billing configurations." />} />
              <Route path="/masters/skus" element={<SimplePage title="SKU Master" description="Manage product catalog, categories, and pricing information." />} />
              <Route path="/masters/customers" element={<SimplePage title="Customer Management" description="Manage customer information, billing addresses, and credit limits." />} />
              <Route path="/masters/vendors" element={<SimplePage title="Vendor Management" description="Manage vendor information, purchase agreements, and payment terms." />} />
              <Route path="/masters/users" element={<SimplePage title="Users & Roles Management" description="Manage user accounts, permissions, and role-based access control." />} />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </div>
  )
}

export default App