import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null)
      setPermissions({})
      return
    }

    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*, roles(role_name)')
        .eq('id', authUser.id)
        .single()

      if (error) throw error

      // Fetch user permissions
      const { data: userPerms } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', authUser.id)

      const resolved = profile.is_super_admin
        ? createSuperAdminPermissions()
        : resolvePermissions(userPerms || [])

      setUser({
        id: authUser.id,
        email: authUser.email,
        full_name: profile.full_name,
        role_id: profile.role_id,
        role_name: profile.roles?.role_name,
        is_super_admin: profile.is_super_admin,
        is_active: profile.is_active,
      })
      setPermissions(resolved)
    } catch (err) {
      console.error('Error fetching user profile:', err)
      // If profile fetch fails, still set basic user info
      setUser({
        id: authUser.id,
        email: authUser.email,
        full_name: authUser.email,
        is_super_admin: false,
        is_active: true,
      })
      setPermissions(createSuperAdminPermissions()) // Fallback for dev
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Use onAuthStateChange as the single source of truth
    // It fires INITIAL_SESSION on first load, so no need for separate getSession()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setPermissions({})
          if (mounted) setLoading(false)
        } else if (event === 'INITIAL_SESSION') {
          if (session?.user) {
            await fetchUserProfile(session.user)
          }
          if (mounted) setLoading(false)
        }
        // For SIGNED_IN, user is already set by login() directly — skip to avoid double fetch
      }
    )

    // Safety timeout in case onAuthStateChange never fires
    const timeout = setTimeout(() => {
      if (mounted) setLoading(false)
    }, 3000)

    return () => {
      mounted = false
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [fetchUserProfile])

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    // Directly set user state so navigation works immediately
    // (don't wait for onAuthStateChange which fires asynchronously)
    if (data?.user) {
      await fetchUserProfile(data.user)
    }
    return data
  }

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setPermissions({})
  }

  const value = {
    user,
    permissions,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    hasPermission: (module, action) => {
      if (!user) return false
      if (user.is_super_admin) return true
      const perm = permissions[module]
      if (!perm) return false
      return perm[`can_${action}`] === true
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Resolve permissions from user_permissions rows into a lookup object
function resolvePermissions(userPerms) {
  const modules = [
    'company_master', 'sku_master', 'customer_master', 'vendor_master',
    'vendor_inward', 'customer_invoice', 'inventory', 'transaction_log',
    'analytics', 'user_role_master',
  ]
  const perms = {}
  modules.forEach(m => {
    perms[m] = { can_view: false, can_create: false, can_edit: false, can_delete: false }
  })

  // Apply user permissions
  userPerms.forEach(perm => {
    if (perms[perm.module]) {
      perms[perm.module] = {
        can_view: perm.can_view || false,
        can_create: perm.can_create || false,
        can_edit: perm.can_edit || false,
        can_delete: perm.can_delete || false,
      }
    }
  })

  return perms
}

function createSuperAdminPermissions() {
  const modules = [
    'company_master', 'sku_master', 'customer_master', 'vendor_master',
    'vendor_inward', 'customer_invoice', 'inventory', 'transaction_log',
    'analytics', 'user_role_master',
  ]
  const perms = {}
  modules.forEach(m => {
    perms[m] = { can_view: true, can_create: true, can_edit: true, can_delete: true }
  })
  return perms
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
