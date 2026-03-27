import { useAuth } from './useAuth'

export function usePermissions() {
  const { hasPermission } = useAuth()

  return {
    checkPermission: hasPermission,
    canView: (module) => hasPermission(module, 'view'),
    canCreate: (module) => hasPermission(module, 'create'),
    canEdit: (module) => hasPermission(module, 'edit'),
    canDelete: (module) => hasPermission(module, 'delete'),
  }
}
