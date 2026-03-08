import { forwardRef } from 'react'

const Table = forwardRef(({ className = '', children, ...props }, ref) => (
  <div className="overflow-x-auto">
    <table
      ref={ref}
      className={`min-w-full divide-y divide-gray-200 ${className}`}
      {...props}
    >
      {children}
    </table>
  </div>
))

const TableHead = ({ className = '', children, ...props }) => (
  <thead className={`bg-gray-50 ${className}`} {...props}>
    {children}
  </thead>
)

const TableBody = ({ className = '', children, ...props }) => (
  <tbody className={`bg-white divide-y divide-gray-200 ${className}`} {...props}>
    {children}
  </tbody>
)

const TableRow = ({ className = '', children, ...props }) => (
  <tr className={`hover:bg-gray-50 ${className}`} {...props}>
    {children}
  </tr>
)

const TableHeader = ({ className = '', children, ...props }) => (
  <th
    className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
    {...props}
  >
    {children}
  </th>
)

const TableCell = ({ className = '', children, ...props }) => (
  <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`} {...props}>
    {children}
  </td>
)

Table.displayName = 'Table'

export { Table, TableHead, TableBody, TableRow, TableHeader, TableCell }