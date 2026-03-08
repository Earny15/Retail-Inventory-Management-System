// Invoice number generation utilities

// Generate invoice number with company prefix and financial year
export function generateInvoiceNumber(lastInvoiceNumber, companyPrefix = 'INV', financialYearStart = 4) {
  const now = new Date()
  const currentMonth = now.getMonth() + 1 // JavaScript months are 0-based
  const currentYear = now.getFullYear()

  // Determine financial year (April to March in India)
  let fyStart, fyEnd
  if (currentMonth >= financialYearStart) {
    fyStart = currentYear
    fyEnd = currentYear + 1
  } else {
    fyStart = currentYear - 1
    fyEnd = currentYear
  }

  const fyString = `${fyStart.toString().slice(-2)}${fyEnd.toString().slice(-2)}`

  // Extract sequence number from last invoice
  let sequenceNumber = 1

  if (lastInvoiceNumber) {
    // Expected format: INV/2324/0001
    const parts = lastInvoiceNumber.split('/')
    if (parts.length === 3 && parts[1] === fyString) {
      sequenceNumber = parseInt(parts[2]) + 1
    }
  }

  // Format sequence with leading zeros (4 digits)
  const formattedSequence = sequenceNumber.toString().padStart(4, '0')

  return `${companyPrefix}/${fyString}/${formattedSequence}`
}

// Parse invoice number to extract components
export function parseInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return null

  const parts = invoiceNumber.split('/')
  if (parts.length !== 3) return null

  const [prefix, fy, sequence] = parts

  // Convert FY back to full years
  const fyStart = 2000 + parseInt(fy.substring(0, 2))
  const fyEnd = 2000 + parseInt(fy.substring(2, 4))

  return {
    prefix,
    financialYear: {
      start: fyStart,
      end: fyEnd,
      string: fy
    },
    sequence: parseInt(sequence),
    sequenceString: sequence
  }
}

// Validate invoice number format
export function validateInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
    return { valid: false, error: 'Invoice number is required' }
  }

  const parts = invoiceNumber.split('/')
  if (parts.length !== 3) {
    return { valid: false, error: 'Invalid format. Expected: PREFIX/FYFY/NNNN' }
  }

  const [prefix, fy, sequence] = parts

  // Validate prefix
  if (!prefix || prefix.length === 0) {
    return { valid: false, error: 'Prefix is required' }
  }

  // Validate financial year (4 digits)
  if (!/^\d{4}$/.test(fy)) {
    return { valid: false, error: 'Financial year must be 4 digits (FYFY format)' }
  }

  // Validate sequence (should be numeric)
  if (!/^\d+$/.test(sequence)) {
    return { valid: false, error: 'Sequence must be numeric' }
  }

  return { valid: true }
}

// Get current financial year string
export function getCurrentFinancialYear(financialYearStart = 4) {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  let fyStart, fyEnd
  if (currentMonth >= financialYearStart) {
    fyStart = currentYear
    fyEnd = currentYear + 1
  } else {
    fyStart = currentYear - 1
    fyEnd = currentYear
  }

  return {
    start: fyStart,
    end: fyEnd,
    string: `${fyStart.toString().slice(-2)}${fyEnd.toString().slice(-2)}`,
    display: `${fyStart}-${fyEnd.toString().slice(-2)}`
  }
}

// Generate delivery note number
export function generateDeliveryNoteNumber(lastDeliveryNote, companyPrefix = 'DN') {
  return generateInvoiceNumber(lastDeliveryNote, companyPrefix)
}

// Generate quotation number
export function generateQuotationNumber(lastQuotation, companyPrefix = 'QUO') {
  return generateInvoiceNumber(lastQuotation, companyPrefix)
}

// Generate purchase order number
export function generatePurchaseOrderNumber(lastPO, companyPrefix = 'PO') {
  return generateInvoiceNumber(lastPO, companyPrefix)
}

// Generate receipt number
export function generateReceiptNumber(lastReceipt, companyPrefix = 'RCP') {
  return generateInvoiceNumber(lastReceipt, companyPrefix)
}

// Examples
export const examples = {
  invoiceNumbers: [
    generateInvoiceNumber(null, 'INV'), // First invoice
    generateInvoiceNumber('INV/2324/0001', 'INV'), // Second invoice
    generateInvoiceNumber('INV/2324/0099', 'INV'), // 100th invoice
    generateInvoiceNumber('INV/2223/9999', 'INV'), // New financial year
  ],
  parsing: [
    parseInvoiceNumber('INV/2324/0001'),
    parseInvoiceNumber('QUO/2324/0025'),
    parseInvoiceNumber('DN/2324/0100')
  ],
  validation: [
    validateInvoiceNumber('INV/2324/0001'),
    validateInvoiceNumber('INVALID'),
    validateInvoiceNumber('INV/24/01'),
    validateInvoiceNumber('INV/2324/ABC')
  ],
  financialYear: getCurrentFinancialYear()
}