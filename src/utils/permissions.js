// Permission modules available in the system
export const PERMISSION_MODULES = {
  COMPANY_MASTER: 'company_master',
  SKU_MASTER: 'sku_master',
  CUSTOMER_MASTER: 'customer_master',
  VENDOR_MASTER: 'vendor_master',
  VENDOR_INWARD: 'vendor_inward',
  CUSTOMER_INVOICE: 'customer_invoice',
  SALES_QUOTATION: 'sales_quotation',
  INVENTORY: 'inventory',
  TRANSACTION_LOG: 'transaction_log',
  ANALYTICS: 'analytics',
  USER_ROLE_MASTER: 'user_role_master'
}

// Permission actions
export const PERMISSION_ACTIONS = {
  VIEW: 'view',
  CREATE: 'create',
  EDIT: 'edit',
  DELETE: 'delete'
}

// Resolve user permissions from user_permissions rows into a lookup object
export function resolveUserPermissions(userPerms = []) {
  const permissions = {}

  // Initialize all modules with false permissions
  Object.values(PERMISSION_MODULES).forEach(module => {
    permissions[module] = {
      can_view: false,
      can_create: false,
      can_edit: false,
      can_delete: false
    }
  })

  // Apply user permissions
  userPerms.forEach(perm => {
    if (permissions[perm.module]) {
      permissions[perm.module] = {
        can_view: perm.can_view || false,
        can_create: perm.can_create || false,
        can_edit: perm.can_edit || false,
        can_delete: perm.can_delete || false
      }
    }
  })

  return permissions
}

// Check if user has permission for a specific module and action
export function hasPermission(permissions, module, action) {
  if (!permissions || !permissions[module]) return false

  const actionKey = `can_${action}`
  return permissions[module][actionKey] === true
}
