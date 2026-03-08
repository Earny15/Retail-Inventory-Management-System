// Permission modules available in the system
export const PERMISSION_MODULES = {
  COMPANY_MASTER: 'company_master',
  SKU_MASTER: 'sku_master',
  CUSTOMER_MASTER: 'customer_master',
  VENDOR_MASTER: 'vendor_master',
  VENDOR_INWARD: 'vendor_inward',
  CUSTOMER_INVOICE: 'customer_invoice',
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

// Merge role permissions with user overrides
export function resolveUserPermissions(rolePermissions = [], userOverrides = []) {
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

  // Apply role permissions
  rolePermissions.forEach(perm => {
    if (permissions[perm.module]) {
      permissions[perm.module] = {
        can_view: perm.can_view || false,
        can_create: perm.can_create || false,
        can_edit: perm.can_edit || false,
        can_delete: perm.can_delete || false
      }
    }
  })

  // Apply user overrides (these take precedence)
  userOverrides.forEach(override => {
    if (permissions[override.module]) {
      // Only override if the value is explicitly set (not null)
      if (override.can_view !== null) {
        permissions[override.module].can_view = override.can_view
      }
      if (override.can_create !== null) {
        permissions[override.module].can_create = override.can_create
      }
      if (override.can_edit !== null) {
        permissions[override.module].can_edit = override.can_edit
      }
      if (override.can_delete !== null) {
        permissions[override.module].can_delete = override.can_delete
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