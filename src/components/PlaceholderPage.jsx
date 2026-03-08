export default function PlaceholderPage({ title, description }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">{title}</h1>
          <p className="text-gray-600 mb-6">{description}</p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-2xl">🚧</span>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-blue-900 mb-2">Coming Soon</h3>
            <p className="text-blue-700">
              This page is currently under development. All the functionality will be available soon.
            </p>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Navigate back to Dashboard or use the sidebar to explore other sections.
          </div>
        </div>
      </div>
    </div>
  )
}