import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useUsers } from '../../hooks/useUsers'
import { useAuth } from '../../hooks/useAuth'
import PermissionGate from '../../components/shared/PermissionGate'
import { PERMISSION_MODULES } from '../../utils/permissions'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { Plus, Search, Edit3, ToggleLeft, ToggleRight, Users, Shield, Settings, Eye, FilePlus, Pencil, Trash2, Check, X as XIcon } from 'lucide-react'

const userSchema = z.object({
  full_name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Min 6 chars').optional().or(z.literal('')),
  role_id: z.string().min(1, 'Role is required'),
  is_super_admin: z.boolean().optional()
})

const roleSchema = z.object({
  role_name: z.string().min(2, 'Name is required'),
  description: z.string().optional().or(z.literal(''))
})

const MODULE_LABELS = {
  company_master: 'Company', sku_master: 'SKU Master', customer_master: 'Customers',
  vendor_master: 'Vendors', vendor_inward: 'Inward', customer_invoice: 'Invoices',
  inventory: 'Inventory', transaction_log: 'Transactions', analytics: 'Analytics',
  user_role_master: 'Users & Roles'
}

function PermissionMatrix({ userId, permissions = [], onSave, isLoading }) {
  const [perms, setPerms] = useState(() => {
    const map = {}
    permissions.filter(p => p.user_id === userId).forEach(p => {
      map[p.module] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete }
    })
    return map
  })

  const toggle = (mod, action) => {
    setPerms(prev => ({
      ...prev,
      [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] }
    }))
  }

  const handleSave = () => {
    const arr = Object.entries(perms).map(([module, p]) => ({ module, ...p }))
    onSave(arr)
  }

  return (
    <div className="space-y-4">
      {/* Desktop permission table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200 text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-3 py-2 text-left">Module</th>
              <th className="border border-gray-200 px-3 py-2 text-center">View</th>
              <th className="border border-gray-200 px-3 py-2 text-center">Create</th>
              <th className="border border-gray-200 px-3 py-2 text-center">Edit</th>
              <th className="border border-gray-200 px-3 py-2 text-center">Delete</th>
            </tr>
          </thead>
          <tbody>
            {Object.values(PERMISSION_MODULES).map(mod => (
              <tr key={mod}>
                <td className="border border-gray-200 px-3 py-2 font-medium">{MODULE_LABELS[mod] || mod}</td>
                {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                  <td key={action} className="border border-gray-200 px-3 py-2 text-center">
                    <input type="checkbox" checked={perms[mod]?.[action] || false}
                      onChange={() => toggle(mod, action)}
                      className="h-4 w-4 text-navy-600 border-gray-300 rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile permission cards */}
      <div className="sm:hidden space-y-3">
        {Object.values(PERMISSION_MODULES).map(mod => (
          <div key={mod} className="border border-gray-200 rounded-lg p-3">
            <div className="font-medium text-gray-900 mb-2">{MODULE_LABELS[mod] || mod}</div>
            <div className="grid grid-cols-2 gap-2">
              {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                <label key={action} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={perms[mod]?.[action] || false}
                    onChange={() => toggle(mod, action)}
                    className="h-4 w-4 text-navy-600 border-gray-300 rounded" />
                  <span className="capitalize">{action.replace('can_', '')}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} loading={isLoading} className="w-full sm:w-auto">Save Permissions</Button>
      </div>
    </div>
  )
}

export default function UserRoleMasterPage() {
  const { hasPermission } = useAuth()
  const { users, roles, userPermissions, rolePermissions, isLoading, createUser, updateUser, toggleUserStatus,
    updateUserPermissions, updateRolePermissions, createRole, updateRole, isCreating, isUpdating } = useUsers()

  const [activeTab, setActiveTab] = useState('users')
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isPermModalOpen, setIsPermModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [editingRole, setEditingRole] = useState(null)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)
  })

  const handleUserSubmit = (data) => {
    if (editingUser) {
      const { password, email, ...rest } = data
      updateUser({ id: editingUser.id, ...rest })
    } else {
      createUser(data)
    }
    setIsUserModalOpen(false)
  }

  const handleRoleSubmit = async (data) => {
    const { permissions, ...roleData } = data
    if (editingRole) {
      updateRole({ id: editingRole.id, ...roleData })
      if (permissions) {
        updateRolePermissions({ roleId: editingRole.id, permissions })
      }
    } else {
      try {
        const newRole = await createRole(roleData)
        if (newRole?.id && permissions) {
          updateRolePermissions({ roleId: newRole.id, permissions })
        }
      } catch (e) { /* error handled by mutation */ }
    }
    setIsRoleModalOpen(false)
  }

  const getRolePermissionSummary = (roleId) => {
    const perms = rolePermissions.filter(p => p.role_id === roleId)
    const modules = perms.filter(p => p.can_view || p.can_create || p.can_edit || p.can_delete)
    return modules
  }

  const handlePermSave = (permissions) => {
    updateUserPermissions({ userId: selectedUserId, permissions })
    setIsPermModalOpen(false)
  }

  const roleOptions = roles.map(r => ({ value: r.id, label: r.role_name }))

  if (isLoading) return <div className="flex items-center justify-center py-12"><Spinner size="xl" /></div>

  return (
    <div>
      <PageHeader title="Users & Roles" description="Manage users, roles, and permissions" />

      <div className="mb-3 sm:mb-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-4 sm:gap-6">
          {[{ key: 'users', label: 'Users', icon: Users }, { key: 'roles', label: 'Roles', icon: Shield }].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`py-2 px-1 border-b-2 text-sm font-medium flex items-center gap-2 ${
                activeTab === tab.key ? 'border-navy-600 text-navy-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="h-4 w-4" />{tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'users' && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-4 mb-3 sm:mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search users..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full text-sm focus:ring-2 focus:ring-primary-400" />
              </div>
              <PermissionGate module="user_role_master" action="create">
                <Button onClick={() => { setEditingUser(null); setIsUserModalOpen(true) }} className="w-full sm:w-auto" size="sm"><Plus className="h-4 w-4 mr-1" />Add User</Button>
              </PermissionGate>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="text-center py-12"><Users className="h-12 w-12 mx-auto text-gray-400 mb-3" /><p className="text-gray-500">No users found</p></div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHead><TableRow>
                      <TableHeader>Name</TableHeader><TableHeader>Email</TableHeader><TableHeader>Role</TableHeader>
                      <TableHeader>Type</TableHeader><TableHeader>Status</TableHeader><TableHeader>Actions</TableHeader>
                    </TableRow></TableHead>
                    <TableBody>
                      {filteredUsers.map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.roles?.role_name || 'No Role'}</TableCell>
                          <TableCell>{u.is_super_admin ? <Badge variant="warning">Super Admin</Badge> : <Badge>User</Badge>}</TableCell>
                          <TableCell><Badge variant={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge></TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <button onClick={() => { setSelectedUserId(u.id); setIsPermModalOpen(true) }}
                                className="p-1 text-gray-600 hover:text-purple-600 rounded hover:bg-purple-50" title="Permissions">
                                <Settings className="h-4 w-4" />
                              </button>
                              <PermissionGate module="user_role_master" action="edit">
                                <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true) }}
                                  className="p-1 text-gray-600 hover:text-primary-600 rounded hover:bg-primary-50"><Edit3 className="h-4 w-4" /></button>
                              </PermissionGate>
                              <PermissionGate module="user_role_master" action="edit">
                                <button onClick={() => toggleUserStatus({ id: u.id, is_active: !u.is_active })}
                                  className="p-1 rounded hover:bg-gray-100">
                                  {u.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4 text-gray-400" />}
                                </button>
                              </PermissionGate>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-3">
                  {filteredUsers.map((u, index) => (
                    <div key={u.id} className={`rounded-xl p-4 space-y-2 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{u.full_name}</div>
                          <div className="text-sm text-gray-500">{u.email}</div>
                        </div>
                        <Badge variant={u.is_active ? 'success' : 'danger'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="text-gray-600">Role: {u.roles?.role_name || 'No Role'}</span>
                        {u.is_super_admin && <Badge variant="warning">Super Admin</Badge>}
                      </div>
                      <div className="flex gap-3 pt-2 border-t border-gray-100">
                        <button onClick={() => { setSelectedUserId(u.id); setIsPermModalOpen(true) }}
                          className="flex items-center gap-1 text-sm text-purple-600 hover:text-purple-800">
                          <Settings className="h-3.5 w-3.5" /> Permissions
                        </button>
                        <PermissionGate module="user_role_master" action="edit">
                          <button onClick={() => { setEditingUser(u); setIsUserModalOpen(true) }}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                            <Edit3 className="h-3.5 w-3.5" /> Edit
                          </button>
                        </PermissionGate>
                        <PermissionGate module="user_role_master" action="edit">
                          <button onClick={() => toggleUserStatus({ id: u.id, is_active: !u.is_active })}
                            className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800">
                            {u.is_active ? <><ToggleRight className="h-3.5 w-3.5 text-green-600" /> Deactivate</> : <><ToggleLeft className="h-3.5 w-3.5" /> Activate</>}
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'roles' && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex justify-end mb-3 sm:mb-4">
              <PermissionGate module="user_role_master" action="create">
                <Button onClick={() => { setEditingRole(null); setIsRoleModalOpen(true) }} className="w-full sm:w-auto" size="sm"><Plus className="h-4 w-4 mr-1" />Add Role</Button>
              </PermissionGate>
            </div>
            {roles.length === 0 ? (
              <div className="text-center py-12"><Shield className="h-12 w-12 mx-auto text-gray-400 mb-3" /><p className="text-gray-500">No roles</p></div>
            ) : (
              <div className="space-y-4">
                {roles.map((r, index) => {
                  const permSummary = getRolePermissionSummary(r.id)
                  const userCount = users.filter(u => u.role_id === r.id).length
                  return (
                    <div key={r.id} className={`rounded-xl p-4 space-y-3 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Shield className="h-4 w-4 text-navy-500" />
                            <span className="font-semibold text-gray-900">{r.role_name}</span>
                          </div>
                          {r.description && <p className="text-sm text-gray-500 mt-0.5 ml-6">{r.description}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="info">{userCount} {userCount === 1 ? 'user' : 'users'}</Badge>
                          <PermissionGate module="user_role_master" action="edit">
                            <button onClick={() => { setEditingRole(r); setIsRoleModalOpen(true) }}
                              className="p-1.5 text-gray-500 hover:text-primary-600 rounded-lg hover:bg-primary-50">
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </PermissionGate>
                        </div>
                      </div>

                      {/* Permission summary */}
                      {permSummary.length > 0 ? (
                        <div className="border-t border-gray-100 pt-3">
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Permissions</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {permSummary.map(p => {
                              const actions = []
                              if (p.can_view) actions.push('View')
                              if (p.can_create) actions.push('Create')
                              if (p.can_edit) actions.push('Edit')
                              if (p.can_delete) actions.push('Delete')
                              return (
                                <div key={p.module} className="flex items-center gap-2 text-sm bg-gray-50 rounded-lg px-2.5 py-1.5">
                                  <span className="font-medium text-gray-800">{MODULE_LABELS[p.module] || p.module}</span>
                                  <span className="text-gray-400">—</span>
                                  <span className="text-gray-600 text-xs">{actions.join(', ')}</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-gray-100 pt-3">
                          <p className="text-sm text-gray-400 italic">No permissions assigned</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? 'Edit User' : 'New User'} size="lg">
        {(() => {
          const UserFormInner = () => {
            const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
              resolver: zodResolver(userSchema),
              defaultValues: {
                full_name: editingUser?.full_name || '', email: editingUser?.email || '', password: '',
                role_id: editingUser?.role_id || '', is_super_admin: editingUser?.is_super_admin || false
              }
            })
            return (
              <form onSubmit={handleSubmit(handleUserSubmit)} className="space-y-4">
                <Input label="Full Name" required {...register('full_name')} error={errors.full_name?.message} />
                <Input label="Email" type="email" required {...register('email')} error={errors.email?.message} disabled={!!editingUser} />
                {!editingUser && <Input label="Password" type="password" required {...register('password')} error={errors.password?.message} />}
                <Select label="Role" required options={roleOptions}
                  value={roleOptions.find(o => o.value === watch('role_id'))}
                  onChange={(s) => setValue('role_id', s?.value || '')} error={errors.role_id?.message} />
                <label className="flex items-center gap-2">
                  <input type="checkbox" {...register('is_super_admin')} className="h-4 w-4 text-navy-600 border-gray-300 rounded" />
                  <span className="text-sm font-medium">Super Administrator</span>
                </label>
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => setIsUserModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" loading={isCreating || isUpdating} className="w-full sm:w-auto">{editingUser ? 'Update' : 'Create'} User</Button>
                </div>
              </form>
            )
          }
          return <UserFormInner />
        })()}
      </Modal>

      <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} title={editingRole ? 'Edit Role' : 'New Role'} size="xl">
        {(() => {
          const RoleFormInner = () => {
            const { register, handleSubmit, formState: { errors } } = useForm({
              resolver: zodResolver(roleSchema),
              defaultValues: { role_name: editingRole?.role_name || '', description: editingRole?.description || '' }
            })

            const [rolePerms, setRolePerms] = useState(() => {
              if (!editingRole) return {}
              const map = {}
              rolePermissions.filter(p => p.role_id === editingRole.id).forEach(p => {
                map[p.module] = { can_view: p.can_view, can_create: p.can_create, can_edit: p.can_edit, can_delete: p.can_delete }
              })
              return map
            })

            const togglePerm = (mod, action) => {
              setRolePerms(prev => ({
                ...prev,
                [mod]: { ...prev[mod], [action]: !prev[mod]?.[action] }
              }))
            }

            const toggleAllForModule = (mod) => {
              const current = rolePerms[mod] || {}
              const allEnabled = current.can_view && current.can_create && current.can_edit && current.can_delete
              setRolePerms(prev => ({
                ...prev,
                [mod]: { can_view: !allEnabled, can_create: !allEnabled, can_edit: !allEnabled, can_delete: !allEnabled }
              }))
            }

            const onSubmit = (formData) => {
              const permissions = Object.entries(rolePerms)
                .filter(([, p]) => p.can_view || p.can_create || p.can_edit || p.can_delete)
                .map(([module, p]) => ({ module, ...p }))
              handleRoleSubmit({ ...formData, permissions })
            }

            return (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input label="Role Name" required {...register('role_name')} error={errors.role_name?.message} />
                  <Input label="Description" {...register('description')} />
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-navy-500" /> Permissions
                  </h4>

                  {/* Desktop permission table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-200 text-sm">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="border border-gray-200 px-3 py-2 text-left">Module</th>
                          <th className="border border-gray-200 px-3 py-2 text-center">All</th>
                          <th className="border border-gray-200 px-3 py-2 text-center">View</th>
                          <th className="border border-gray-200 px-3 py-2 text-center">Create</th>
                          <th className="border border-gray-200 px-3 py-2 text-center">Edit</th>
                          <th className="border border-gray-200 px-3 py-2 text-center">Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.values(PERMISSION_MODULES).map(mod => {
                          const p = rolePerms[mod] || {}
                          const allChecked = p.can_view && p.can_create && p.can_edit && p.can_delete
                          return (
                            <tr key={mod} className="hover:bg-gray-50">
                              <td className="border border-gray-200 px-3 py-2 font-medium">{MODULE_LABELS[mod] || mod}</td>
                              <td className="border border-gray-200 px-3 py-2 text-center">
                                <input type="checkbox" checked={allChecked || false}
                                  onChange={() => toggleAllForModule(mod)}
                                  className="h-4 w-4 text-primary-600 border-gray-300 rounded" />
                              </td>
                              {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                                <td key={action} className="border border-gray-200 px-3 py-2 text-center">
                                  <input type="checkbox" checked={rolePerms[mod]?.[action] || false}
                                    onChange={() => togglePerm(mod, action)}
                                    className="h-4 w-4 text-navy-600 border-gray-300 rounded" />
                                </td>
                              ))}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile permission cards */}
                  <div className="sm:hidden space-y-3">
                    {Object.values(PERMISSION_MODULES).map(mod => (
                      <div key={mod} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-900">{MODULE_LABELS[mod] || mod}</span>
                          <button type="button" onClick={() => toggleAllForModule(mod)}
                            className="text-xs text-primary-600 hover:text-primary-800 font-medium">
                            Toggle All
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {['can_view', 'can_create', 'can_edit', 'can_delete'].map(action => (
                            <label key={action} className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={rolePerms[mod]?.[action] || false}
                                onChange={() => togglePerm(mod, action)}
                                className="h-4 w-4 text-navy-600 border-gray-300 rounded" />
                              <span className="capitalize">{action.replace('can_', '')}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t">
                  <Button variant="outline" type="button" onClick={() => setIsRoleModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
                  <Button type="submit" loading={isCreating || isUpdating} className="w-full sm:w-auto">{editingRole ? 'Update' : 'Create'} Role</Button>
                </div>
              </form>
            )
          }
          return <RoleFormInner />
        })()}
      </Modal>

      <Modal isOpen={isPermModalOpen} onClose={() => setIsPermModalOpen(false)}
        title={`Permissions - ${users.find(u => u.id === selectedUserId)?.full_name || ''}`} size="xl">
        <PermissionMatrix userId={selectedUserId} permissions={userPermissions}
          onSave={handlePermSave} isLoading={isUpdating} />
      </Modal>
    </div>
  )
}
