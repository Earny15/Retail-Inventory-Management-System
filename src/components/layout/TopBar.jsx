import { useAuth } from '../../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Menu, LogOut, Bell } from 'lucide-react'
import toast from 'react-hot-toast'

export default function TopBar({ onMenuClick }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out')
      navigate('/login', { replace: true })
    } catch {
      toast.error('Logout failed')
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center justify-between h-14 px-4 sm:px-6">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-navy-600 hover:bg-navy-50"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg text-gray-400 hover:text-navy-600 hover:bg-navy-50 relative">
            <Bell className="h-5 w-5" />
          </button>
          <span className="text-sm font-medium text-navy-700 hidden sm:block">{user?.full_name}</span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
            title="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  )
}
