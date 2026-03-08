# AluminiumPro - Code Summary

## Application Overview
AluminiumPro is a comprehensive business management system built with React + Vite frontend and Supabase database backend. It provides functionality for managing invoices, inventory, customers, vendors, and business analytics for an aluminium business.

## Current Status
✅ **Stable Working State** - Navigation and core structure are functional
📝 **Placeholder Pages** - Real functionality temporarily replaced with placeholder components to ensure stability

## Technology Stack
- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Custom auth system with role-based permissions
- **Icons**: Lucide React

## Project Structure

### Core Application Files
- `src/App.jsx` - Main application router with inline sidebar and simplified routing
- `src/main.jsx` - Application entry point
- `src/index.css` - Global styles and Tailwind imports

### Components

#### Layout Components
- `src/components/layout/SimpleSidebar.jsx` - Working simplified sidebar (currently used)
- `src/components/layout/Sidebar.jsx` - Complex sidebar with permissions (causes white screens)
- `src/components/layout/AppLayout.jsx` - Main layout wrapper (causes white screens)
- `src/components/layout/TopBar.jsx` - Top navigation bar

#### UI Components
- `src/components/ui/` - Reusable UI components (Button, Card, Input, Modal, Select, etc.)
- `src/components/PlaceholderPage.jsx` - Temporary placeholder component for development pages

#### Shared Components
- `src/components/shared/PageHeader.jsx` - Page header component
- `src/components/shared/PermissionGate.jsx` - Permission-based rendering component

### Pages

#### Dashboard
- `src/pages/dashboard/DashboardPage.jsx` - Main dashboard (working)

#### Invoices
- `src/pages/invoices/InvoiceListPage.jsx` - Invoice management
- `src/pages/invoices/EnhancedInvoiceListPage.jsx` - Enhanced invoice list with filters
- `src/pages/invoices/NewInvoicePage.jsx` - Invoice creation
- `src/pages/invoices/InvoiceDetailPage.jsx` - Invoice details

#### Inward Management
- `src/pages/inward/InwardListPage.jsx` - Vendor inward management
- `src/pages/inward/NewInwardPage.jsx` - AI-powered inward processing
- `src/pages/inward/InwardDetailPage.jsx` - Inward details

#### Masters
- `src/pages/masters/CompanyMasterPage.jsx` - Company information management
- `src/pages/masters/SKUMasterPage.jsx` - Product/SKU management
- `src/pages/masters/CustomerMasterPage.jsx` - Customer management
- `src/pages/masters/VendorMasterPage.jsx` - Vendor management
- `src/pages/masters/UserRoleMasterPage.jsx` - User and role management

#### Other Pages
- `src/pages/inventory/InventoryPage.jsx` - Inventory management
- `src/pages/transactions/TransactionLogPage.jsx` - Transaction history
- `src/pages/analytics/AnalyticsPage.jsx` - Business analytics
- `src/pages/auth/LoginPage.jsx` - User authentication

### Hooks (Custom React Hooks)
- `src/hooks/useAuth.simple.jsx` - Simplified authentication hook (currently used)
- `src/hooks/usePermissions.jsx` - Permission management
- `src/hooks/useCompany.jsx` - Company data management
- `src/hooks/useCustomers.jsx` - Customer data management
- `src/hooks/useSKUs.jsx` - SKU/product data management
- `src/hooks/useVendors.jsx` - Vendor data management
- `src/hooks/useInvoices.jsx` - Invoice data management
- `src/hooks/useInventory.jsx` - Inventory data management
- `src/hooks/useUsers.jsx` - User management

### Services
- `src/services/supabase.js` - Supabase client configuration
- `src/services/invoiceService.js` - Invoice business logic
- `src/services/inwardService.js` - Inward processing logic
- `src/services/invoicePdfService.js` - PDF generation
- `src/services/analyticsService.js` - Analytics calculations
- `src/services/anthropic.js` - AI integration for inward processing

### Utilities
- `src/utils/permissions.js` - Permission system utilities
- `src/utils/gstCalculations.js` - GST calculation utilities
- `src/utils/indianStates.js` - Indian states and codes
- `src/utils/invoiceGenerator.js` - Invoice generation utilities
- `src/utils/numberToWords.js` - Number to words conversion
- `src/utils/sequentialNumbers.js` - Sequential numbering system

### Database
- `database-setup.sql` - Complete database schema
- `RUN-THIS-IN-SUPABASE.sql` - Database setup script
- `seed-categories.sql` - Sample category data
- `src/database/analytics_functions.sql` - Analytics SQL functions

### Configuration Files
- `package.json` - Dependencies and scripts
- `vite.config.js` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `eslint.config.js` - ESLint configuration
- `.env` - Environment variables (Supabase configuration)

## Current Navigation Structure
The application includes the following navigation items:
1. **Dashboard** - Main overview page ✅ Working
2. **Invoices** - Customer invoice management 📝 Placeholder
3. **New Invoice** - Invoice creation form 📝 Placeholder
4. **Inward** - Vendor inward management 📝 Placeholder
5. **New Inward (AI)** - AI-powered invoice processing 📝 Placeholder
6. **Inventory** - Stock and inventory management 📝 Placeholder
7. **Transactions** - Transaction history and logs 📝 Placeholder
8. **Analytics** - Business analytics and reports 📝 Placeholder
9. **Company Master** - Company information management 📝 Placeholder
10. **SKU Master** - Product catalog management 📝 Placeholder
11. **Customers** - Customer relationship management 📝 Placeholder
12. **Vendors** - Vendor management 📝 Placeholder
13. **Users & Roles** - User and permission management 📝 Placeholder

## Key Features Implemented

### Authentication & Permissions
- Role-based access control system
- User authentication with Supabase
- Permission gates for component rendering
- Module-based permission system

### Invoice Management
- Professional invoice generation
- GST calculations and compliance
- PDF export functionality
- Customer billing management

### Inventory Management
- SKU/product catalog
- Real-time stock tracking
- Category management
- Inventory transaction logging

### AI-Powered Inward Processing
- Automatic vendor invoice processing
- AI-powered data extraction
- Inventory updates from vendor invoices

### Master Data Management
- Company information management
- Customer and vendor databases
- User and role management
- Comprehensive configuration options

## Known Issues & Solutions

### White Screen Problem ⚠️
**Issue**: Complex components with dependencies cause React rendering failures
**Solution**: Using simplified components and placeholder pages for stability
**Affected Components**:
- `src/components/layout/Sidebar.jsx` (complex permissions)
- `src/components/layout/AppLayout.jsx` (authentication dependencies)
- Most page components with hooks and complex state

### Current Workarounds
1. **Simplified App.jsx**: Using inline components instead of complex imports
2. **Placeholder Pages**: Stable placeholder components instead of full functionality
3. **Simple Authentication**: Mock auth instead of full Supabase auth
4. **Direct Routing**: Simplified routing without protected routes

## Database Schema
The application uses a comprehensive PostgreSQL schema including:
- Companies, customers, vendors, users
- SKUs, categories, inventory
- Invoices, invoice items
- Inward entries, transactions
- Roles and permissions system

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Git Repository
✅ Repository initialized with initial commit containing all working files
- Commit: "Initial commit - AluminiumPro working application"
- 83 files committed with complete project structure

## Next Steps
1. **Gradual Feature Restoration**: Slowly reintroduce complex components one by one
2. **Dependency Resolution**: Fix authentication and permission system issues
3. **Component Debugging**: Identify specific causes of white screen issues
4. **Testing**: Add comprehensive testing for component stability

## Notes
- Application is currently in a stable state with working navigation
- All major business logic and database structure is implemented
- UI components and services are ready for integration
- Focus should be on resolving component dependency issues to restore full functionality