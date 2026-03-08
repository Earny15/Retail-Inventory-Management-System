import Button from '../ui/Button'

export default function PageHeader({
  title,
  description,
  action,
  children
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="mt-1 text-gray-600">{description}</p>
          )}
        </div>
        {action && (
          <div>{action}</div>
        )}
      </div>
      {children}
    </div>
  )
}