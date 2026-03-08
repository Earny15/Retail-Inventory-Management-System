import { forwardRef } from 'react'

const Input = forwardRef(({
  label,
  error,
  className = '',
  required = false,
  ...props
}, ref) => {
  const inputClasses = `
    w-full px-3 py-2 border rounded-lg transition-colors
    focus:ring-2 focus:ring-primary-500 focus:border-primary-500
    ${error ? 'border-red-500' : 'border-gray-300'}
    ${className}
  `

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={inputClasses}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
})

Input.displayName = 'Input'

export default Input