import Sidebar from './Sidebar'
import TopBar from './TopBar'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      {/* Main content area */}
      <div className="lg:pl-64">
        <TopBar />

        <main className="py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}