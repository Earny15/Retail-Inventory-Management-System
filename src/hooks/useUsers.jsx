import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth'
import toast from 'react-hot-toast'

export function useUsers() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*, roles(role_name, description)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    }
  })

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('role_name')
      if (error) throw error
      return data || []
    }
  })

  const { data: userPermissions = [] } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
      if (error) throw error
      return data || []
    }
  })

  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['role-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*')
      if (error) throw error
      return data || []
    }
  })

  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      })
      if (authError) throw authError

      // Create user record
      const { data, error } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role_id: userData.role_id,
          is_super_admin: userData.is_super_admin || false,
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
    },
    onError: (error) => toast.error(error.message || 'Failed to create user')
  })

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }) => {
      const updates = {}
      if (userData.full_name) updates.full_name = userData.full_name
      if (userData.role_id) updates.role_id = userData.role_id
      if (userData.is_super_admin !== undefined) updates.is_super_admin = userData.is_super_admin

      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User status updated')
    },
    onError: () => toast.error('Failed to update status')
  })

  const updateUserPermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }) => {
      // Delete existing permissions for user
      await supabase.from('user_permissions').delete().eq('user_id', userId)
      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(permissions.map(p => ({ user_id: userId, ...p })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] })
      toast.success('User permissions updated')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const updateRolePermissionsMutation = useMutation({
    mutationFn: async ({ roleId, permissions }) => {
      await supabase.from('role_permissions').delete().eq('role_id', roleId)
      if (permissions.length > 0) {
        const { error } = await supabase
          .from('role_permissions')
          .insert(permissions.map(p => ({ role_id: roleId, ...p })))
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-permissions'] })
      toast.success('Role permissions updated')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const createRoleMutation = useMutation({
    mutationFn: async (roleData) => {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          role_name: roleData.role_name || roleData.name,
          description: roleData.description,
          created_by: user?.id,
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role created')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...roleData }) => {
      const updates = {}
      if (roleData.role_name || roleData.name) updates.role_name = roleData.role_name || roleData.name
      if (roleData.description !== undefined) updates.description = roleData.description

      const { data, error } = await supabase
        .from('roles')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role updated')
    },
    onError: (error) => toast.error(`Failed: ${error.message}`)
  })

  return {
    users,
    roles,
    userPermissions,
    rolePermissions,
    isLoading: isLoading || rolesLoading,
    createUser: createUserMutation.mutate,
    updateUser: updateUserMutation.mutate,
    toggleUserStatus: toggleUserStatusMutation.mutate,
    updateUserPermissions: updateUserPermissionsMutation.mutate,
    updateRolePermissions: updateRolePermissionsMutation.mutate,
    createRole: createRoleMutation.mutateAsync,
    updateRole: updateRoleMutation.mutate,
    isCreating: createUserMutation.isPending || createRoleMutation.isPending,
    isUpdating: updateUserMutation.isPending || updateRoleMutation.isPending || updateRolePermissionsMutation.isPending
  }
}
