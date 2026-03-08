import { forwardRef } from 'react'
import ReactSelect from 'react-select'

const Select = forwardRef(({
  label,
  error,
  required = false,
  className = '',
  ...props
}, ref) => {
  const customStyles = {
    control: (base, state) => ({
      ...base,
      borderColor: error ? '#ef4444' : state.isFocused ? '#3b82f6' : '#d1d5db',
      '&:hover': {
        borderColor: error ? '#ef4444' : '#d1d5db'
      },
      boxShadow: state.isFocused
        ? error
          ? '0 0 0 2px rgba(239, 68, 68, 0.2)'
          : '0 0 0 2px rgba(59, 130, 246, 0.2)'
        : 'none',
      borderRadius: '0.5rem',
      padding: '2px'
    }),
    menu: (base) => ({
      ...base,
      borderRadius: '0.5rem',
      border: '1px solid #d1d5db',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      zIndex: 50
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? '#f3f4f6' : 'white',
      color: '#111827',
      '&:active': {
        backgroundColor: '#e5e7eb'
      }
    })
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <ReactSelect
        ref={ref}
        styles={customStyles}
        isSearchable
        placeholder="Select..."
        noOptionsMessage={() => 'No options found'}
        {...props}
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  )
})

Select.displayName = 'Select'

export default Select