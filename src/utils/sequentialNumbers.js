import supabase from '../services/supabase'

/**
 * Generate sequential number for different document types
 * @param {string} type - Document type (invoice, quotation, etc.)
 * @param {string} companyId - Company ID for prefix lookup
 * @returns {Promise<string>} Sequential number with prefix
 */
export async function generateSequentialNumber(type, companyId) {
  try {
    // Get company details for prefix
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('invoice_prefix, company_code')
      .eq('id', companyId)
      .single()

    if (companyError) {
      console.error('Error fetching company:', companyError)
      throw new Error('Failed to fetch company details')
    }

    // Determine prefix based on document type
    let prefix = 'DOC-'
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

    switch (type) {
      case 'invoice':
        prefix = company.invoice_prefix || 'INV-'
        break
      case 'quotation':
        prefix = 'QTN-'
        break
      case 'purchase_order':
        prefix = 'PO-'
        break
      case 'delivery_note':
        prefix = 'DN-'
        break
      default:
        prefix = 'DOC-'
    }

    // Get or create sequence for this type/company/year-month combination
    const sequenceKey = `${type}_${companyId}_${currentYear}${currentMonth}`

    // Use Supabase's built-in sequential numbering or implement custom logic
    // First, try to get the latest sequence number for this pattern
    const { data: existingDocs, error: fetchError } = await supabase
      .from(getTableForType(type))
      .select('*')
      .ilike(getNumberFieldForType(type), `${prefix}${currentYear}${currentMonth}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('Error fetching existing documents:', fetchError)
      // Fallback to basic sequence
      return `${prefix}${currentYear}${currentMonth}001`
    }

    // Extract sequence number from existing documents
    let nextSequence = 1
    if (existingDocs && existingDocs.length > 0) {
      const lastNumber = existingDocs[0][getNumberFieldForType(type)]
      const match = lastNumber.match(/(\d{3,})$/) // Match last 3+ digits
      if (match) {
        nextSequence = parseInt(match[1]) + 1
      }
    }

    // Format sequence number with leading zeros
    const sequenceStr = String(nextSequence).padStart(3, '0')

    return `${prefix}${currentYear}${currentMonth}${sequenceStr}`

  } catch (error) {
    console.error('Error generating sequential number:', error)
    // Fallback number with timestamp
    const timestamp = Date.now().toString().slice(-6)
    return `INV-${timestamp}`
  }
}

/**
 * Get database table name for document type
 * @param {string} type - Document type
 * @returns {string} Table name
 */
function getTableForType(type) {
  const tableMap = {
    'invoice': 'customer_invoices',
    'quotation': 'quotations',
    'purchase_order': 'purchase_orders',
    'delivery_note': 'delivery_notes'
  }
  return tableMap[type] || 'customer_invoices'
}

/**
 * Get number field name for document type
 * @param {string} type - Document type
 * @returns {string} Field name
 */
function getNumberFieldForType(type) {
  const fieldMap = {
    'invoice': 'invoice_number',
    'quotation': 'quotation_number',
    'purchase_order': 'po_number',
    'delivery_note': 'dn_number'
  }
  return fieldMap[type] || 'invoice_number'
}

/**
 * Reset sequence for a new financial year
 * @param {string} type - Document type
 * @param {string} companyId - Company ID
 * @returns {Promise<boolean>} Success status
 */
export async function resetSequenceForNewYear(type, companyId) {
  try {
    // This function can be called at the start of a new financial year
    // to reset sequences. For now, it's a placeholder as the main function
    // already handles year-month based sequences
    console.log(`Sequence reset for ${type} in company ${companyId}`)
    return true
  } catch (error) {
    console.error('Error resetting sequence:', error)
    return false
  }
}

/**
 * Validate sequential number format
 * @param {string} number - Number to validate
 * @param {string} type - Document type
 * @returns {boolean} Whether number format is valid
 */
export function validateSequentialNumber(number, type = 'invoice') {
  if (!number || typeof number !== 'string') {
    return false
  }

  // Basic validation for format: PREFIX-YYYYMM###
  const patterns = {
    'invoice': /^[A-Z]{2,4}-\d{6}\d{3,}$/,
    'quotation': /^QTN-\d{6}\d{3,}$/,
    'purchase_order': /^PO-\d{6}\d{3,}$/,
    'delivery_note': /^DN-\d{6}\d{3,}$/
  }

  const pattern = patterns[type] || patterns.invoice
  return pattern.test(number)
}

/**
 * Get next available sequence number (utility for manual override)
 * @param {string} prefix - Document prefix
 * @param {string} type - Document type
 * @param {string} companyId - Company ID
 * @returns {Promise<number>} Next sequence number
 */
export async function getNextSequenceNumber(prefix, type, companyId) {
  try {
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

    const { data: existingDocs, error } = await supabase
      .from(getTableForType(type))
      .select(getNumberFieldForType(type))
      .ilike(getNumberFieldForType(type), `${prefix}${currentYear}${currentMonth}%`)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      console.error('Error fetching sequence:', error)
      return 1
    }

    if (!existingDocs || existingDocs.length === 0) {
      return 1
    }

    const lastNumber = existingDocs[0][getNumberFieldForType(type)]
    const match = lastNumber.match(/(\d{3,})$/)
    return match ? parseInt(match[1]) + 1 : 1

  } catch (error) {
    console.error('Error getting next sequence:', error)
    return 1
  }
}