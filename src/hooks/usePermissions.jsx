import { useAuth } from './useAuth.simple.jsx'
import { hasPermission, PERMISSION_MODULES, PERMISSION_ACTIONS } from '../utils/permissions'

export function usePermissions() {
  const { permissions } = useAuth()

  // 🚧 DEVELOPMENT MOCK - Remove in production
  const mockPermissions = import.meta.env.DEV ? {
    company_master: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    sku_master: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    customer_master: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    vendor_master: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    vendor_inward: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    customer_invoice: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    inventory: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    transaction_log: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    analytics: { can_view: true, can_create: true, can_edit: true, can_delete: true },
    user_role_master: { can_view: true, can_create: true, can_edit: true, can_delete: true }
  } : {}

  const finalPermissions = Object.keys(permissions).length > 0 ? permissions : mockPermissions

  const checkPermission = (module, action) => {
    return hasPermission(finalPermissions, module, action)
  }

  const canView = (module) => checkPermission(module, PERMISSION_ACTIONS.VIEW)
  const canCreate = (module) => checkPermission(module, PERMISSION_ACTIONS.CREATE)
  const canEdit = (module) => checkPermission(module, PERMISSION_ACTIONS.EDIT)
  const canDelete = (module) => checkPermission(module, PERMISSION_ACTIONS.DELETE)

  return {
    permissions: finalPermissions,
    checkPermission,
    canView,
    canCreate,
    canEdit,
    canDelete,
    modules: PERMISSION_MODULES,
    actions: PERMISSION_ACTIONS
  }
}