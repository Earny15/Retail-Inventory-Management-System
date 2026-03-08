import { usePermissions } from '../../hooks/usePermissions.jsx'

export function PermissionGate({
  module,
  action,
  children,
  fallback = null,
  showDisabled = false
}) {
  const { checkPermission } = usePermissions()

  const hasAccess = checkPermission(module, action)

  if (!hasAccess) {
    if (showDisabled && typeof children === 'function') {
      return children({ disabled: true })
    }
    return fallback
  }

  if (typeof children === 'function') {
    return children({ disabled: false })
  }

  return children
}