// Convert numbers to words in Indian English format

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
]

const tens = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
]

// Convert number less than 100 to words
function convertTens(number) {
  if (number < 20) {
    return ones[number]
  } else {
    return tens[Math.floor(number / 10)] + (number % 10 !== 0 ? ' ' + ones[number % 10] : '')
  }
}

// Convert number less than 1000 to words
function convertHundreds(number) {
  if (number === 0) return ''

  let result = ''

  if (number >= 100) {
    result += ones[Math.floor(number / 100)] + ' Hundred'
    number %= 100
    if (number > 0) result += ' '
  }

  if (number > 0) {
    result += convertTens(number)
  }

  return result
}

// Convert full number to words using Indian numbering system
export function numberToWords(number) {
  if (number === 0) return 'Zero'

  if (number < 0) return 'Negative ' + numberToWords(-number)

  let words = ''

  // Crores (10,000,000)
  if (number >= 10000000) {
    const crores = Math.floor(number / 10000000)
    words += convertHundreds(crores) + ' Crore'
    number %= 10000000
    if (number > 0) words += ' '
  }

  // Lakhs (100,000)
  if (number >= 100000) {
    const lakhs = Math.floor(number / 100000)
    words += convertTens(lakhs) + ' Lakh'
    number %= 100000
    if (number > 0) words += ' '
  }

  // Thousands (1,000)
  if (number >= 1000) {
    const thousands = Math.floor(number / 1000)
    words += convertTens(thousands) + ' Thousand'
    number %= 1000
    if (number > 0) words += ' '
  }

  // Hundreds, tens, and ones
  if (number > 0) {
    words += convertHundreds(number)
  }

  return words.trim()
}

// Convert currency amount to words (Rupees and Paise)
export function currencyToWords(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'Invalid Amount'
  }

  // Split into rupees and paise
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)

  let result = ''

  if (rupees > 0) {
    result += numberToWords(rupees) + (rupees === 1 ? ' Rupee' : ' Rupees')
  }

  if (paise > 0) {
    if (result.length > 0) result += ' and '
    result += numberToWords(paise) + (paise === 1 ? ' Paisa' : ' Paise')
  }

  if (result.length === 0) {
    result = 'Zero Rupees'
  }

  return result + ' Only'
}

// Format number in Indian format with commas
export function formatIndianNumber(number) {
  if (typeof number !== 'number') return number

  const numStr = number.toString()
  const lastThree = numStr.substring(numStr.length - 3)
  const otherNumbers = numStr.substring(0, numStr.length - 3)

  if (otherNumbers !== '') {
    return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
  } else {
    return lastThree
  }
}

// Format currency in Indian format
export function formatIndianCurrency(amount, showSymbol = true) {
  if (typeof amount !== 'number') return amount

  const symbol = showSymbol ? '₹' : ''
  const formatted = formatIndianNumber(amount.toFixed(2))

  return symbol + formatted
}

// Examples and test cases
export const examples = {
  numbers: [
    { input: 0, output: numberToWords(0) },
    { input: 1, output: numberToWords(1) },
    { input: 25, output: numberToWords(25) },
    { input: 100, output: numberToWords(100) },
    { input: 1000, output: numberToWords(1000) },
    { input: 100000, output: numberToWords(100000) },
    { input: 10000000, output: numberToWords(10000000) },
    { input: 12345678, output: numberToWords(12345678) }
  ],
  currency: [
    { input: 0, output: currencyToWords(0) },
    { input: 1, output: currencyToWords(1) },
    { input: 1.50, output: currencyToWords(1.50) },
    { input: 100.25, output: currencyToWords(100.25) },
    { input: 1000, output: currencyToWords(1000) },
    { input: 100000.99, output: currencyToWords(100000.99) },
    { input: 1234567.89, output: currencyToWords(1234567.89) }
  ]
}

// Alias for backward compatibility
export const convertNumberToWords = currencyToWords