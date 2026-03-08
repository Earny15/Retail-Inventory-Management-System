// GST calculation utilities for Indian tax system

/**
 * Calculate GST amount for a given base amount and GST rate
 * @param {number} amount - Base amount (excluding GST)
 * @param {number} gstRate - GST rate percentage (e.g., 18 for 18%)
 * @returns {number} GST amount
 */
export function calculateGST(amount, gstRate) {
  if (!amount || !gstRate) return 0
  return (amount * gstRate) / 100
}

/**
 * Calculate CGST amount (Central GST) - half of total GST for intra-state transactions
 * @param {number} amount - Base amount (excluding GST)
 * @param {number} gstRate - Total GST rate percentage
 * @returns {number} CGST amount
 */
export function calculateCGST(amount, gstRate) {
  if (!amount || !gstRate) return 0
  return (amount * gstRate) / 200 // Divide by 2 for CGST
}

/**
 * Calculate SGST amount (State GST) - half of total GST for intra-state transactions
 * @param {number} amount - Base amount (excluding GST)
 * @param {number} gstRate - Total GST rate percentage
 * @returns {number} SGST amount
 */
export function calculateSGST(amount, gstRate) {
  if (!amount || !gstRate) return 0
  return (amount * gstRate) / 200 // Divide by 2 for SGST
}

/**
 * Calculate IGST amount (Integrated GST) - full GST for inter-state transactions
 * @param {number} amount - Base amount (excluding GST)
 * @param {number} gstRate - GST rate percentage
 * @returns {number} IGST amount
 */
export function calculateIGST(amount, gstRate) {
  if (!amount || !gstRate) return 0
  return (amount * gstRate) / 100
}

/**
 * Calculate round-off amount to nearest rupee
 * @param {number} amount - Amount to round off
 * @returns {number} Round off adjustment (can be positive or negative)
 */
export function calculateRoundOff(amount) {
  if (!amount) return 0

  const rounded = Math.round(amount)
  return rounded - amount
}

/**
 * Determine if transaction is inter-state based on supplier and customer states
 * @param {string} supplierState - Supplier's state
 * @param {string} customerState - Customer's state
 * @returns {boolean} True if inter-state transaction
 */
export function isInterStateTransaction(supplierState, customerState) {
  if (!supplierState || !customerState) return false
  return supplierState.toLowerCase() !== customerState.toLowerCase()
}

/**
 * Calculate comprehensive GST breakdown for an invoice item
 * @param {Object} item - Invoice item with amount and gst_rate
 * @param {string} supplierState - Supplier's state
 * @param {string} customerState - Customer's state
 * @returns {Object} Complete GST breakdown
 */
export function calculateGSTBreakdown(item, supplierState, customerState) {
  const { amount, gst_rate: gstRate = 0 } = item

  if (!amount) {
    return {
      amount: 0,
      cgst_rate: 0,
      cgst_amount: 0,
      sgst_rate: 0,
      sgst_amount: 0,
      igst_rate: 0,
      igst_amount: 0,
      total_gst: 0,
      total_with_gst: 0
    }
  }

  const isInterState = isInterStateTransaction(supplierState, customerState)

  let cgstRate = 0, sgstRate = 0, igstRate = 0
  let cgstAmount = 0, sgstAmount = 0, igstAmount = 0

  if (isInterState) {
    // Inter-state: IGST only
    igstRate = gstRate
    igstAmount = calculateIGST(amount, gstRate)
  } else {
    // Intra-state: CGST + SGST
    cgstRate = gstRate / 2
    sgstRate = gstRate / 2
    cgstAmount = calculateCGST(amount, gstRate)
    sgstAmount = calculateSGST(amount, gstRate)
  }

  const totalGst = cgstAmount + sgstAmount + igstAmount

  return {
    amount,
    cgst_rate: cgstRate,
    cgst_amount: cgstAmount,
    sgst_rate: sgstRate,
    sgst_amount: sgstAmount,
    igst_rate: igstRate,
    igst_amount: igstAmount,
    total_gst: totalGst,
    total_with_gst: amount + totalGst
  }
}

/**
 * Calculate invoice totals with GST breakdown
 * @param {Array} items - Array of invoice items
 * @param {string} supplierState - Supplier's state
 * @param {string} customerState - Customer's state
 * @returns {Object} Invoice totals breakdown
 */
export function calculateInvoiceTotals(items, supplierState, customerState) {
  if (!items || !items.length) {
    return {
      subtotal: 0,
      total_cgst: 0,
      total_sgst: 0,
      total_igst: 0,
      total_gst: 0,
      total_before_round: 0,
      round_off: 0,
      grand_total: 0,
      items_breakdown: []
    }
  }

  let subtotal = 0
  let totalCgst = 0
  let totalSgst = 0
  let totalIgst = 0
  const itemsBreakdown = []

  items.forEach(item => {
    const itemAmount = (item.quantity || 0) * (item.unit_price || 0)
    const gstBreakdown = calculateGSTBreakdown(
      { amount: itemAmount, gst_rate: item.gst_rate || 0 },
      supplierState,
      customerState
    )

    subtotal += itemAmount
    totalCgst += gstBreakdown.cgst_amount
    totalSgst += gstBreakdown.sgst_amount
    totalIgst += gstBreakdown.igst_amount

    itemsBreakdown.push({
      ...item,
      ...gstBreakdown
    })
  })

  const totalGst = totalCgst + totalSgst + totalIgst
  const totalBeforeRound = subtotal + totalGst
  const roundOff = calculateRoundOff(totalBeforeRound)
  const grandTotal = totalBeforeRound + roundOff

  return {
    subtotal,
    total_cgst: totalCgst,
    total_sgst: totalSgst,
    total_igst: totalIgst,
    total_gst: totalGst,
    total_before_round: totalBeforeRound,
    round_off: roundOff,
    grand_total: grandTotal,
    items_breakdown: itemsBreakdown
  }
}

/**
 * Get GST rates commonly used in India
 * @returns {Array} Array of common GST rates
 */
export function getCommonGSTRates() {
  return [
    { value: 0, label: '0% (Exempt)' },
    { value: 5, label: '5% GST' },
    { value: 12, label: '12% GST' },
    { value: 18, label: '18% GST' },
    { value: 28, label: '28% GST' }
  ]
}

/**
 * Validate GST number format (basic validation)
 * @param {string} gstin - GSTIN to validate
 * @returns {boolean} True if format is valid
 */
export function validateGSTIN(gstin) {
  if (!gstin) return false

  // Basic GSTIN format: 15 characters - 2 state code + 10 PAN + 1 entity + 1 Z + 1 checksum
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return gstinRegex.test(gstin.toUpperCase())
}

/**
 * Extract state code from GSTIN
 * @param {string} gstin - GSTIN number
 * @returns {string} State code (first 2 digits)
 */
export function getStateCodeFromGSTIN(gstin) {
  if (!gstin || gstin.length < 2) return ''
  return gstin.substring(0, 2)
}

/**
 * Get state name from GST state code
 * @param {string} stateCode - 2-digit state code
 * @returns {string} State name
 */
export function getStateNameFromCode(stateCode) {
  const stateMapping = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh'
  }

  return stateMapping[stateCode] || 'Unknown State'
}