// GST calculation utilities for Indian tax system

export const GST_RATES = {
  0: 0,
  5: 5,
  12: 12,
  18: 18,
  28: 28
}

export const GST_TYPES = {
  CGST_SGST: 'cgst_sgst', // Central + State GST (intra-state)
  IGST: 'igst'            // Integrated GST (inter-state)
}

// Calculate GST breakdown for a given amount
export function calculateGST(amount, gstRate, gstType = GST_TYPES.CGST_SGST) {
  const baseAmount = amount
  const gstAmount = (baseAmount * gstRate) / 100

  let breakdown = {
    baseAmount,
    gstRate,
    gstType,
    totalGstAmount: gstAmount,
    totalAmount: baseAmount + gstAmount
  }

  if (gstType === GST_TYPES.CGST_SGST) {
    breakdown.cgst = gstAmount / 2
    breakdown.sgst = gstAmount / 2
    breakdown.igst = 0
  } else {
    breakdown.cgst = 0
    breakdown.sgst = 0
    breakdown.igst = gstAmount
  }

  return breakdown
}

// Calculate GST from inclusive amount (reverse calculation)
export function calculateGSTFromInclusive(inclusiveAmount, gstRate, gstType = GST_TYPES.CGST_SGST) {
  const divisor = 100 + gstRate
  const baseAmount = (inclusiveAmount * 100) / divisor
  const gstAmount = inclusiveAmount - baseAmount

  let breakdown = {
    baseAmount,
    gstRate,
    gstType,
    totalGstAmount: gstAmount,
    totalAmount: inclusiveAmount
  }

  if (gstType === GST_TYPES.CGST_SGST) {
    breakdown.cgst = gstAmount / 2
    breakdown.sgst = gstAmount / 2
    breakdown.igst = 0
  } else {
    breakdown.cgst = 0
    breakdown.sgst = 0
    breakdown.igst = gstAmount
  }

  return breakdown
}

// Calculate line item total with GST
export function calculateLineItemTotal(quantity, rate, gstRate, gstType = GST_TYPES.CGST_SGST) {
  const lineAmount = quantity * rate
  return calculateGST(lineAmount, gstRate, gstType)
}

// Calculate invoice totals
export function calculateInvoiceTotals(lineItems, discountAmount = 0, roundOff = true) {
  let totalBaseAmount = 0
  let totalCGST = 0
  let totalSGST = 0
  let totalIGST = 0
  let totalGSTAmount = 0

  lineItems.forEach(item => {
    const lineTotal = calculateLineItemTotal(
      item.quantity,
      item.rate,
      item.gstRate,
      item.gstType
    )

    totalBaseAmount += lineTotal.baseAmount
    totalCGST += lineTotal.cgst
    totalSGST += lineTotal.sgst
    totalIGST += lineTotal.igst
    totalGSTAmount += lineTotal.totalGstAmount
  })

  const subtotal = totalBaseAmount
  const discountedAmount = subtotal - discountAmount

  // Recalculate GST on discounted amount if discount is applied
  if (discountAmount > 0) {
    const discountRatio = discountedAmount / subtotal
    totalCGST = totalCGST * discountRatio
    totalSGST = totalSGST * discountRatio
    totalIGST = totalIGST * discountRatio
    totalGSTAmount = totalGSTAmount * discountRatio
  }

  let grandTotal = discountedAmount + totalGSTAmount

  // Round off to nearest rupee if enabled
  let roundOffAmount = 0
  if (roundOff) {
    const rounded = Math.round(grandTotal)
    roundOffAmount = rounded - grandTotal
    grandTotal = rounded
  }

  return {
    subtotal,
    discountAmount,
    discountedAmount,
    totalCGST,
    totalSGST,
    totalIGST,
    totalGSTAmount,
    roundOffAmount,
    grandTotal
  }
}

// Determine GST type based on states
export function determineGSTType(billingState, shippingState) {
  if (!billingState || !shippingState) return GST_TYPES.CGST_SGST

  // Convert to uppercase and trim for comparison
  const billing = billingState.toUpperCase().trim()
  const shipping = shippingState.toUpperCase().trim()

  return billing === shipping ? GST_TYPES.CGST_SGST : GST_TYPES.IGST
}

// Format currency for Indian rupees
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Format number in Indian numbering system (lakhs, crores)
export function formatIndianNumber(number) {
  return new Intl.NumberFormat('en-IN').format(number)
}

// Validate GSTIN format
export function validateGSTIN(gstin) {
  if (!gstin) return false

  // GSTIN format: 22AAAAA0000A1Z5 (15 characters)
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
  return gstinRegex.test(gstin)
}

// Get state code from GSTIN
export function getStateCodeFromGSTIN(gstin) {
  if (!validateGSTIN(gstin)) return null
  return gstin.substring(0, 2)
}

// Indian state codes mapping
export const INDIAN_STATE_CODES = {
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
  '37': 'Andhra Pradesh'
}