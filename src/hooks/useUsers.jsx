import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../services/supabase'
import { useAuth } from './useAuth.simple.jsx'
import toast from 'react-hot-toast'

export function useUsers() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Fetch users with role information
  const {
    data: users = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(role_name, description)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  // Fetch roles
  const {
    data: roles = [],
    isLoading: rolesLoading
  } = useQuery({
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

  // Fetch user permissions
  const {
    data: userPermissions = [],
    isLoading: permissionsLoading
  } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_permissions')
        .select(`
          *,
          user:users(full_name, email)
        `)

      if (error) throw error
      return data || []
    }
  })

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData) => {
      const { data, error } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
        options: {
          data: {
            full_name: userData.full_name,
            role_id: userData.role_id,
            is_super_admin: userData.is_super_admin || false
          }
        }
      })

      if (error) throw error

      // Create user record in our users table
      const { data: userRecord, error: userError } = await supabase
        .from('users')
        .insert({
          id: data.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role_id: userData.role_id,
          is_super_admin: userData.is_super_admin || false,
          created_by: user?.id
        })
        .select()
        .single()

      if (userError) throw userError
      return userRecord
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User created successfully')
    },
    onError: (error) => {
      console.error('Error creating user:', error)
      toast.error(error.message || 'Failed to create user')
    }
  })

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, ...userData }) => {
      const { data, error } = await supabase
        .from('users')
        .update(userData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User updated successfully')
    },
    onError: (error) => {
      console.error('Error updating user:', error)
      toast.error('Failed to update user')
    }
  })

  // Toggle user active status
  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({ id, is_active }) => {
      const { error } = await supabase
        .from('users')
        .update({ is_active })
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('User status updated')
    },
    onError: (error) => {
      console.error('Error updating user status:', error)
      toast.error('Failed to update user status')
    }
  })

  // Update user permissions
  const updateUserPermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }) => {
      // Delete existing permissions for user
      await supabase
        .from('user_permissions')
        .delete()
        .eq('user_id', userId)

      // Insert new permissions
      if (permissions.length > 0) {
        const { error } = await supabase
          .from('user_permissions')
          .insert(
            permissions.map(perm => ({
              user_id: userId,
              module: perm.module,
              can_view: perm.can_view,
              can_create: perm.can_create,
              can_edit: perm.can_edit,
              can_delete: perm.can_delete,
              created_by: user?.id
            }))
          )

        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-permissions'] })
      toast.success('User permissions updated')
    },
    onError: (error) => {
      console.error('Error updating user permissions:', error)
      toast.error('Failed to update user permissions')
    }
  })

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: async (roleData) => {
      const { data, error } = await supabase
        .from('roles')
        .insert({
          ...roleData,
          created_by: user?.id
        })
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role created successfully')
    },
    onError: (error) => {
      console.error('Error creating role:', error)
      toast.error('Failed to create role')
    }
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, ...roleData }) => {
      const { data, error } = await supabase
        .from('roles')
        .update(roleData)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] })
      toast.success('Role updated successfully')
    },
    onError: (error) => {
      console.error('Error updating role:', error)
      toast.error('Failed to update role')
    }
  })

  return {
    users,
    roles,
    userPermissions,
    isLoading: isLoading || rolesLoading || permissionsLoading,
    error,
    createUser: createUserMutation.mutate,
    updateUser: updateUserMutation.mutate,
    toggleUserStatus: toggleUserStatusMutation.mutate,
    updateUserPermissions: updateUserPermissionsMutation.mutate,
    createRole: createRoleMutation.mutate,
    updateRole: updateRoleMutation.mutate,
    isCreating: createUserMutation.isPending || createRoleMutation.isPending,
    isUpdating: updateUserMutation.isPending || updateRoleMutation.isPending
  }
}