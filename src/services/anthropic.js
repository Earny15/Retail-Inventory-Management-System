/**
 * Anthropic Claude API Service for Invoice Processing
 */

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Extract vendor invoice data using Claude AI
 */
export async function extractVendorInvoice(imageBase64, mimeType, skuList, vendorAliases = []) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key is not configured. Set VITE_ANTHROPIC_API_KEY in .env')
  }

  // Only image types are supported for vision - PDF must be converted first
  const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (!supportedTypes.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Please upload a JPG, PNG, or WebP image.`)
  }

  try {
    console.log('Sending invoice to Claude AI for processing...')

    // Keep SKU list concise to avoid token limits
    const skuListCompact = skuList.map(s => ({
      id: s.id,
      code: s.sku_code,
      name: s.sku_name,
      uom: s.unit_of_measure
    }))

    const aliasesCompact = vendorAliases.map(a => ({
      vendor_item: a.vendor_item_name,
      sku_id: a.sku_id
    }))

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250620',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: `You are an expert at reading vendor invoices for an aluminium hardware shop in India.

Extract all line items from this vendor invoice and match them to the internal SKU catalogue.

INTERNAL SKU CATALOGUE:
${JSON.stringify(skuListCompact)}

VENDOR-SPECIFIC ALIASES (use these first for matching):
${JSON.stringify(aliasesCompact)}

Extract and return a JSON object with this exact structure (return ONLY valid JSON, no markdown):
{
  "invoice_no": "string or null",
  "invoice_date": "YYYY-MM-DD or null",
  "vendor_name": "string or null",
  "subtotal": number or null,
  "tax_amount": number or null,
  "grand_total": number or null,
  "line_items": [
    {
      "vendor_item_name": "exact name as on invoice",
      "quantity": number,
      "unit": "KGS/PCS/MTR etc",
      "rate": number,
      "amount": number,
      "matched_sku_id": "UUID from catalogue or null",
      "matched_sku_name": "internal SKU name or null",
      "match_confidence": number between 0-100,
      "match_method": "alias/ai/none"
    }
  ]
}

Matching rules:
1. First check vendor aliases - if vendor_item_name matches an alias exactly, use that SKU (confidence: 100, method: "alias")
2. Otherwise use semantic similarity - aluminium product names, sizes, types
3. Set confidence 80-100 for good matches, 50-79 for uncertain, below 50 for no match
4. If no match found, set matched_sku_id to null and confidence to 0`
            }
          ]
        }]
      })
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('Anthropic API error body:', errorBody)
      let errorMsg = `Anthropic API error: ${response.status}`
      try {
        const errJson = JSON.parse(errorBody)
        errorMsg = errJson.error?.message || errorMsg
      } catch {}
      throw new Error(errorMsg)
    }

    const data = await response.json()
    const text = data.content.find(block => block.type === 'text')?.text || '{}'

    // Clean the response text and parse JSON
    const cleanText = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(cleanText)

    console.log('Claude AI processing completed:', result)
    return result

  } catch (error) {
    console.error('Anthropic API error:', error)
    throw new Error(`AI processing failed: ${error.message}`)
  }
}

/**
 * Convert file to base64 string
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1] // Remove data:image/jpeg;base64, prefix
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Validate if API key is configured
 */
export function isAnthropicConfigured() {
  return !!ANTHROPIC_API_KEY
}