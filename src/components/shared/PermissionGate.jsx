import { useAuth } from '../../hooks/useAuth'

export default function PermissionGate({ module, action = 'view', children, fallback = null }) {
  const { hasPermission } = useAuth()

  if (!hasPermission(module, action)) {
    return fallback
  }

  return children
}
