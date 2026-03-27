import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Format for PDF - avoid ₹ symbol as jsPDF default font doesn't support it
const formatCurrency = (amount) => {
  const num = Number(amount) || 0
  const parts = num.toFixed(2).split('.')
  // Indian number grouping: last 3 digits, then groups of 2
  let intPart = parts[0]
  const isNeg = intPart.startsWith('-')
  if (isNeg) intPart = intPart.slice(1)
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3)
    const rest = intPart.slice(0, -3)
    intPart = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3
  }
  return (isNeg ? '-' : '') + 'Rs.' + intPart + '.' + parts[1]
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Generate Invoice Report as PDF
 */
export function generateInvoiceReportPDF(invoices, { fromDate, toDate, companyName }) {
  const doc = new jsPDF({ orientation: 'landscape' })

  // Title
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'AluminiumPro', 14, 15)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Invoice Report', 14, 22)

  // Date range
  doc.setFontSize(9)
  doc.setTextColor(100)
  const rangeText = fromDate || toDate
    ? `Period: ${fromDate ? formatDate(fromDate) : 'Start'} to ${toDate ? formatDate(toDate) : 'Today'}`
    : 'Period: All Time'
  doc.text(rangeText, 14, 28)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 33)
  doc.text(`Total Records: ${invoices.length}`, 14, 38)
  doc.setTextColor(0)

  const headers = [['#', 'Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total', 'Status']]

  const rows = invoices.map((inv, i) => [
    i + 1,
    inv.invoice_number,
    formatDate(inv.invoice_date),
    inv.customers?.customer_name || '-',
    inv.customer_invoice_items?.length || 0,
    formatCurrency(inv.subtotal),
    formatCurrency(inv.cgst_amount),
    formatCurrency(inv.sgst_amount),
    formatCurrency(inv.igst_amount),
    formatCurrency(inv.total_gst_amount),
    formatCurrency(inv.total_amount),
    inv.status
  ])

  // Summary row
  const totals = invoices.reduce((acc, inv) => ({
    subtotal: acc.subtotal + (inv.subtotal || 0),
    cgst: acc.cgst + (inv.cgst_amount || 0),
    sgst: acc.sgst + (inv.sgst_amount || 0),
    igst: acc.igst + (inv.igst_amount || 0),
    totalGst: acc.totalGst + (inv.total_gst_amount || 0),
    grandTotal: acc.grandTotal + (inv.total_amount || 0),
    items: acc.items + (inv.customer_invoice_items?.length || 0)
  }), { subtotal: 0, cgst: 0, sgst: 0, igst: 0, totalGst: 0, grandTotal: 0, items: 0 })

  rows.push([
    '', '', '', 'TOTAL', totals.items,
    formatCurrency(totals.subtotal), formatCurrency(totals.cgst), formatCurrency(totals.sgst),
    formatCurrency(totals.igst), formatCurrency(totals.totalGst), formatCurrency(totals.grandTotal), ''
  ])

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 42,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      // Bold the totals row
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [219, 234, 254]
      }
    }
  })

  doc.save(`Invoice_Report_${fromDate || 'all'}_to_${toDate || 'all'}.pdf`)
}

/**
 * Generate Invoice Report as CSV
 */
export function generateInvoiceReportCSV(invoices, { fromDate, toDate }) {
  const headers = ['#', 'Invoice No', 'Date', 'Customer', 'Items', 'Subtotal', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total', 'Status', 'Due Date', 'Paid Amount']

  const rows = invoices.map((inv, i) => [
    i + 1,
    inv.invoice_number,
    formatDate(inv.invoice_date),
    `"${inv.customers?.customer_name || '-'}"`,
    inv.customer_invoice_items?.length || 0,
    inv.subtotal || 0,
    inv.cgst_amount || 0,
    inv.sgst_amount || 0,
    inv.igst_amount || 0,
    inv.total_gst_amount || 0,
    inv.total_amount || 0,
    inv.status,
    formatDate(inv.due_date),
    inv.paid_amount || 0
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadCSV(csv, `Invoice_Report_${fromDate || 'all'}_to_${toDate || 'all'}.csv`)
}

/**
 * Generate Inventory Report as PDF
 */
export function generateInventoryReportPDF(inventory, { companyName }) {
  const doc = new jsPDF({ orientation: 'landscape' })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(companyName || 'AluminiumPro', 14, 15)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Inventory Report', 14, 22)

  doc.setFontSize(9)
  doc.setTextColor(100)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 28)
  doc.text(`Total SKUs: ${inventory.length}`, 14, 33)
  doc.setTextColor(0)

  const headers = [['#', 'SKU Code', 'SKU Name', 'Category', 'Current Stock', 'Unit', 'Available Stock', 'Reserved', 'Avg Cost', 'Stock Value', 'Reorder Level', 'Status', 'Last Updated']]

  const rows = inventory.map((item, i) => {
    const sku = item.skus
    const qty = item.current_stock ?? 0
    const reorder = sku?.reorder_level ?? 0
    let status = 'In Stock'
    if (qty <= 0) status = 'Out of Stock'
    else if (reorder > 0 && qty <= reorder) status = 'Low Stock'

    return [
      i + 1,
      sku?.sku_code || '-',
      sku?.sku_name || '-',
      sku?.sku_categories?.category_name || '-',
      item.current_stock ?? 0,
      sku?.unit_of_measure || '-',
      item.available_stock ?? 0,
      item.reserved_stock ?? 0,
      formatCurrency(item.average_cost),
      formatCurrency((item.current_stock || 0) * (item.average_cost || 0)),
      sku?.reorder_level ?? '-',
      status,
      item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN') : '-'
    ]
  })

  // Summary row
  const totalStockValue = inventory.reduce((sum, item) =>
    sum + ((item.current_stock || 0) * (item.average_cost || 0)), 0)
  const totalStock = inventory.reduce((sum, item) => sum + (item.current_stock || 0), 0)

  rows.push([
    '', '', '', 'TOTAL', totalStock, '', '', '', '', formatCurrency(totalStockValue), '', '', ''
  ])

  autoTable(doc, {
    head: headers,
    body: rows,
    startY: 37,
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    didParseCell: (data) => {
      if (data.row.index === rows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [219, 234, 254]
      }
      // Color stock status
      if (data.column.index === 11 && data.row.index < rows.length - 1) {
        const val = data.cell.raw
        if (val === 'Out of Stock') data.cell.styles.textColor = [220, 38, 38]
        else if (val === 'Low Stock') data.cell.styles.textColor = [217, 119, 6]
        else data.cell.styles.textColor = [22, 163, 74]
      }
    }
  })

  doc.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Generate Inventory Report as CSV
 */
export function generateInventoryReportCSV(inventory) {
  const headers = ['#', 'SKU Code', 'SKU Name', 'Category', 'Current Stock', 'Unit', 'Available Stock', 'Reserved Stock', 'Avg Cost', 'Stock Value', 'Last Purchase Cost', 'Reorder Level', 'Status', 'Last Updated']

  const rows = inventory.map((item, i) => {
    const sku = item.skus
    const qty = item.current_stock ?? 0
    const reorder = sku?.reorder_level ?? 0
    let status = 'In Stock'
    if (qty <= 0) status = 'Out of Stock'
    else if (reorder > 0 && qty <= reorder) status = 'Low Stock'

    return [
      i + 1,
      sku?.sku_code || '',
      `"${sku?.sku_name || ''}"`,
      `"${sku?.sku_categories?.category_name || ''}"`,
      item.current_stock ?? 0,
      sku?.unit_of_measure || '',
      item.available_stock ?? 0,
      item.reserved_stock ?? 0,
      item.average_cost || 0,
      ((item.current_stock || 0) * (item.average_cost || 0)).toFixed(2),
      item.last_purchase_cost || 0,
      sku?.reorder_level ?? '',
      status,
      item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN') : ''
    ]
  })

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  downloadCSV(csv, `Inventory_Report_${new Date().toISOString().split('T')[0]}.csv`)
}

function downloadCSV(csvContent, filename) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
