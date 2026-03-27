export default function PageHeader({ title, description, actions }) {
  return (
    <div className="mb-3 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 sm:gap-3">{actions}</div>}
    </div>
  )
}
