import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUsers } from '../../hooks/useUsers.jsx'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import { PermissionGate } from '../../components/shared/PermissionGate'
import { PERMISSION_MODULES, PERMISSION_ACTIONS } from '../../utils/permissions'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import {
  Plus,
  Search,
  Edit3,
  ToggleLeft,
  ToggleRight,
  Users,
  Shield,
  Settings,
  Check,
  X,
  Eye,
  PlusCircle,
  Pencil,
  Trash2
} from 'lucide-react'

const userSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role_id: z.string().min(1, 'Role selection is required'),
  is_super_admin: z.boolean().optional()
})

const roleSchema = z.object({
  role_name: z.string().min(2, 'Role name must be at least 2 characters'),
  description: z.string().optional()
})

function UserForm({ user = null, onClose, onSubmit, isLoading, roles = [] }) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: user?.full_name || '',
      email: user?.email || '',
      password: '',
      role_id: user?.role_id || '',
      is_super_admin: user?.is_super_admin || false
    }
  })

  const roleOptions = roles.map(role => ({
    value: role.id,
    label: role.role_name
  }))

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Full Name"
        required
        {...register('full_name')}
        error={errors.full_name?.message}
      />

      <Input
        label="Email"
        type="email"
        required
        {...register('email')}
        error={errors.email?.message}
        disabled={!!user}
      />

      {!user && (
        <Input
          label="Password"
          type="password"
          required
          {...register('password')}
          error={errors.password?.message}
          placeholder="Minimum 8 characters"
        />
      )}

      <Select
        label="Role"
        required
        options={roleOptions}
        value={roleOptions.find(opt => opt.value === watch('role_id'))}
        onChange={(selected) => setValue('role_id', selected?.value || '')}
        error={errors.role_id?.message}
        placeholder="Select role..."
      />

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="is_super_admin"
          {...register('is_super_admin')}
          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
        />
        <label htmlFor="is_super_admin" className="text-sm font-medium text-gray-900">
          Super Administrator (Full System Access)
        </label>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {user ? 'Update User' : 'Create User'}
        </Button>
      </div>
    </form>
  )
}

function RoleForm({ role = null, onClose, onSubmit, isLoading }) {
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      role_name: role?.role_name || '',
      description: role?.description || ''
    }
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="Role Name"
        required
        {...register('role_name')}
        error={errors.role_name?.message}
      />

      <Input
        label="Description"
        {...register('description')}
        error={errors.description?.message}
        placeholder="Brief description of this role"
      />

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={isLoading}>
          {role ? 'Update Role' : 'Create Role'}
        </Button>
      </div>
    </form>
  )
}

function PermissionMatrix({ userId, userPermissions = [], onSave, isLoading }) {
  const [permissions, setPermissions] = useState(() => {
    const permissionMap = {}
    userPermissions
      .filter(p => p.user_id === userId)
      .forEach(p => {
        permissionMap[p.module] = {
          can_view: p.can_view,
          can_create: p.can_create,
          can_edit: p.can_edit,
          can_delete: p.can_delete
        }
      })
    return permissionMap
  })

  const handlePermissionChange = (module, action, value) => {
    setPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: value
      }
    }))
  }

  const handleSave = () => {
    const permissionArray = Object.entries(permissions).map(([module, perms]) => ({
      module,
      ...perms
    }))
    onSave(permissionArray)
  }

  const moduleLabels = {
    company_master: 'Company Master',
    sku_master: 'SKU Master',
    customer_master: 'Customer Master',
    vendor_master: 'Vendor Master',
    vendor_inward: 'Vendor Inward',
    customer_invoice: 'Customer Invoice',
    inventory: 'Inventory',
    transaction_log: 'Transaction Log',
    analytics: 'Analytics',
    user_role_master: 'User & Role Master'
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left font-medium">Module</th>
              <th className="border border-gray-200 px-4 py-2 text-center font-medium">
                <div className="flex items-center justify-center space-x-1">
                  <Eye className="h-4 w-4" />
                  <span>View</span>
                </div>
              </th>
              <th className="border border-gray-200 px-4 py-2 text-center font-medium">
                <div className="flex items-center justify-center space-x-1">
                  <PlusCircle className="h-4 w-4" />
                  <span>Create</span>
                </div>
              </th>
              <th className="border border-gray-200 px-4 py-2 text-center font-medium">
                <div className="flex items-center justify-center space-x-1">
                  <Pencil className="h-4 w-4" />
                  <span>Edit</span>
                </div>
              </th>
              <th className="border border-gray-200 px-4 py-2 text-center font-medium">
                <div className="flex items-center justify-center space-x-1">
                  <Trash2 className="h-4 w-4" />
                  <span>Delete</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {Object.values(PERMISSION_MODULES).map(module => (
              <tr key={module}>
                <td className="border border-gray-200 px-4 py-2 font-medium">
                  {moduleLabels[module] || module}
                </td>
                {Object.values(PERMISSION_ACTIONS).map(action => (
                  <td key={action} className="border border-gray-200 px-4 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={permissions[module]?.[action] || false}
                      onChange={(e) => handlePermissionChange(module, action, e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end space-x-3 pt-4 border-t">
        <Button onClick={handleSave} loading={isLoading}>
          Save Permissions
        </Button>
      </div>
    </div>
  )
}

export default function UserRoleMasterPage() {
  const { canCreate, canEdit } = usePermissions()
  const {
    users,
    roles,
    userPermissions,
    isLoading,
    createUser,
    updateUser,
    toggleUserStatus,
    updateUserPermissions,
    createRole,
    updateRole,
    isCreating,
    isUpdating
  } = useUsers()

  const [activeTab, setActiveTab] = useState('users')
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && user.is_active) ||
                         (statusFilter === 'inactive' && !user.is_active)

    return matchesSearch && matchesStatus
  })

  const handleCreateUser = () => {
    setEditingUser(null)
    setIsUserModalOpen(true)
  }

  const handleEditUser = (user) => {
    if (!canEdit('user_role_master')) return
    setEditingUser(user)
    setIsUserModalOpen(true)
  }

  const handleUserSubmit = (data) => {
    if (editingUser) {
      updateUser({ id: editingUser.id, ...data })
    } else {
      createUser(data)
    }
    setIsUserModalOpen(false)
  }

  const handleToggleUserStatus = (user) => {
    toggleUserStatus({ id: user.id, is_active: !user.is_active })
  }

  const handleCreateRole = () => {
    setEditingRole(null)
    setIsRoleModalOpen(true)
  }

  const handleEditRole = (role) => {
    if (!canEdit('user_role_master')) return
    setEditingRole(role)
    setIsRoleModalOpen(true)
  }

  const handleRoleSubmit = (data) => {
    if (editingRole) {
      updateRole({ id: editingRole.id, ...data })
    } else {
      createRole(data)
    }
    setIsRoleModalOpen(false)
  }

  const handleEditPermissions = (userId) => {
    setSelectedUserId(userId)
    setIsPermissionModalOpen(true)
  }

  const handlePermissionSave = (permissions) => {
    updateUserPermissions({ userId: selectedUserId, permissions })
    setIsPermissionModalOpen(false)
  }

  const statusFilterOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' }
  ]

  const selectedUser = users.find(u => u.id === selectedUserId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="User & Role Master"
        description="Manage users, roles, and permissions for your system"
      />

      {/* Tab Navigation */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('users')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'users'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span>Users</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('roles')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'roles'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Shield className="h-4 w-4" />
                <span>Roles</span>
              </div>
            </button>
          </nav>
        </div>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Users</CardTitle>
              <PermissionGate module="user_role_master" action="create">
                <Button onClick={handleCreateUser}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </PermissionGate>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mt-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search users..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select
                options={statusFilterOptions}
                value={statusFilterOptions.find(opt => opt.value === statusFilter)}
                onChange={(selected) => setStatusFilter(selected?.value || 'all')}
                className="w-full sm:w-48"
              />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No users found</p>
                {canCreate('user_role_master') && (
                  <Button onClick={handleCreateUser} className="mt-3">
                    Add your first user
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader>Role</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.role?.role_name || 'No Role'}</TableCell>
                      <TableCell>
                        {user.is_super_admin ? (
                          <Badge variant="warning">Super Admin</Badge>
                        ) : (
                          <Badge variant="default">User</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.is_active ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="danger">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleEditPermissions(user.id)}
                            className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                            title="Edit Permissions"
                          >
                            <Settings className="h-4 w-4" />
                          </button>

                          <PermissionGate module="user_role_master" action="edit">
                            <button
                              onClick={() => handleEditUser(user)}
                              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                              title="Edit User"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </PermissionGate>

                          <PermissionGate module="user_role_master" action="edit">
                            <button
                              onClick={() => handleToggleUserStatus(user)}
                              className={`p-1 rounded ${user.is_active
                                ? 'text-green-600 hover:text-green-900 hover:bg-green-100'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                              }`}
                              title={user.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {user.is_active ? (
                                <ToggleRight className="h-4 w-4" />
                              ) : (
                                <ToggleLeft className="h-4 w-4" />
                              )}
                            </button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Roles</CardTitle>
              <PermissionGate module="user_role_master" action="create">
                <Button onClick={handleCreateRole}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Role
                </Button>
              </PermissionGate>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {roles.length === 0 ? (
              <div className="text-center py-12">
                <Shield className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-500">No roles found</p>
                {canCreate('user_role_master') && (
                  <Button onClick={handleCreateRole} className="mt-3">
                    Add your first role
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>Role Name</TableHeader>
                    <TableHeader>Description</TableHeader>
                    <TableHeader>Users Count</TableHeader>
                    <TableHeader>Actions</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roles.map((role) => {
                    const userCount = users.filter(u => u.role_id === role.id).length
                    return (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.role_name}</TableCell>
                        <TableCell>{role.description || '-'}</TableCell>
                        <TableCell>{userCount}</TableCell>
                        <TableCell>
                          <PermissionGate module="user_role_master" action="edit">
                            <button
                              onClick={() => handleEditRole(role)}
                              className="p-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                              title="Edit Role"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* User Form Modal */}
      <Modal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        title={editingUser ? 'Edit User' : 'Create New User'}
        size="lg"
      >
        <UserForm
          user={editingUser}
          roles={roles}
          onClose={() => setIsUserModalOpen(false)}
          onSubmit={handleUserSubmit}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Role Form Modal */}
      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title={editingRole ? 'Edit Role' : 'Create New Role'}
      >
        <RoleForm
          role={editingRole}
          onClose={() => setIsRoleModalOpen(false)}
          onSubmit={handleRoleSubmit}
          isLoading={isCreating || isUpdating}
        />
      </Modal>

      {/* Permission Matrix Modal */}
      <Modal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        title={`Permissions - ${selectedUser?.full_name || ''}`}
        size="xl"
      >
        <PermissionMatrix
          userId={selectedUserId}
          userPermissions={userPermissions}
          onSave={handlePermissionSave}
          isLoading={isUpdating}
        />
      </Modal>
    </div>
  )
}