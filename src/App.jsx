import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/auth/LoginPage'
import DashboardPage from './pages/dashboard/DashboardPage'
import CompanyMasterPage from './pages/masters/CompanyMasterPage'
import SKUMasterPage from './pages/masters/SKUMasterPage'
import CustomerMasterPage from './pages/masters/CustomerMasterPage'
import VendorMasterPage from './pages/masters/VendorMasterPage'
import UserRoleMasterPage from './pages/masters/UserRoleMasterPage'
import InventoryPage from './pages/inventory/InventoryPage'
import NewInvoicePage from './pages/invoices/NewInvoicePage'
import InvoiceListPage from './pages/invoices/InvoiceListPage'
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage'
import NewInwardPage from './pages/inward/NewInwardPage'
import InwardListPage from './pages/inward/InwardListPage'
import InwardDetailPage from './pages/inward/InwardDetailPage'
import TransactionLogPage from './pages/transactions/TransactionLogPage'
import WhatsAppLogsPage from './pages/whatsapp/WhatsAppLogsPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import NewQuotationPage from './pages/quotations/NewQuotationPage'
import QuotationListPage from './pages/quotations/QuotationListPage'
import QuotationDetailPage from './pages/quotations/QuotationDetailPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<DashboardPage />} />

        <Route path="/invoices" element={<InvoiceListPage />} />
        <Route path="/invoices/new" element={<NewInvoicePage />} />
        <Route path="/invoices/:id" element={<InvoiceDetailPage />} />

        <Route path="/quotations" element={<QuotationListPage />} />
        <Route path="/quotations/new" element={<NewQuotationPage />} />
        <Route path="/quotations/:id" element={<QuotationDetailPage />} />

        <Route path="/inward" element={<InwardListPage />} />
        <Route path="/inward/new" element={<NewInwardPage />} />
        <Route path="/inward/:id" element={<InwardDetailPage />} />

        <Route path="/whatsapp-logs" element={<WhatsAppLogsPage />} />

        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/transactions" element={<TransactionLogPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />

        <Route path="/masters/company" element={<CompanyMasterPage />} />
        <Route path="/masters/skus" element={<SKUMasterPage />} />
        <Route path="/masters/customers" element={<CustomerMasterPage />} />
        <Route path="/masters/vendors" element={<VendorMasterPage />} />
        <Route path="/masters/users" element={<UserRoleMasterPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}
