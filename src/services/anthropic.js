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

  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const isPdf = mimeType === 'application/pdf'
  const isImage = supportedImageTypes.includes(mimeType)

  if (!isImage && !isPdf) {
    throw new Error(`Unsupported file type: ${mimeType}. Please upload a JPG, PNG, WebP image, or PDF.`)
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
        model: 'claude-opus-4-7',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            {
              type: isPdf ? 'document' : 'image',
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

Quantity extraction rules (IMPORTANT):
1. ALWAYS prefer the quantity in PIECES (PCS / NOS / NUMBERS / count) when the invoice shows it.
2. Many invoices show multiple quantity columns per line (e.g. PCS and KGS, or PCS and MTR). In that case, set "quantity" to the PCS/NOS value and set "unit" to "PCS".
3. Only fall back to weight/length units (KGS, MTR, FT, SQM, etc.) if the invoice does NOT show a piece/number count for that line.
4. If you fall back, set "unit" to the actual unit shown on the invoice.

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
 * Match a voice transcript to a list of line items (SKU + optional quantity).
 * The user may dictate multiple items in one breath, e.g.
 *   "10 pieces of aluminium pipe 25mm, 5 nos of L-bracket large, 20 sheets of channel"
 * Returns: [{ matched_sku_id, matched_sku_name, quantity, confidence }, ...]
 */
export async function extractInvoiceItemsFromVoice(transcript, skuList) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key is not configured. Set VITE_ANTHROPIC_API_KEY in .env')
  }
  if (!transcript || !transcript.trim()) {
    return { items: [] }
  }

  const skuListCompact = skuList.map(s => ({
    id: s.id,
    code: s.sku_code,
    name: s.sku_name,
    uom: s.unit_of_measure
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
      model: 'claude-opus-4-7',
      max_tokens: 2048,
      messages: [{
        role: 'user',
        content: `You are helping an aluminium hardware shop owner dictate an invoice in spoken English/Hindi mix.

The user dictated this (auto-transcribed, may have errors):
"${transcript}"

For each distinct item the user mentioned, return up to 3 candidate SKUs from the catalogue, ranked by likelihood.

SKU CATALOGUE:
${JSON.stringify(skuListCompact)}

Return ONLY a JSON object (no markdown, no commentary):
{
  "items": [
    {
      "heard_as": "verbatim phrase from transcript (e.g. 'aluminium pipe')",
      "quantity": number (default 1 if not stated),
      "candidates": [
        { "sku_id": "UUID from catalogue", "sku_name": "internal SKU name", "confidence": 0-100 }
      ]
    }
  ]
}

Rules:
- One entry per distinct item mentioned. Order matches the order spoken.
- "PCS", "pieces", "nos", "numbers", "pcs", "pc" all mean pieces.
- If a quantity is mentioned (e.g. "10 pieces of X", "five X"), set quantity to that number. Otherwise default to 1.
- candidates: ALWAYS include up to 3 plausible SKUs from the catalogue, ranked by confidence (highest first).
- Confidence scoring:
  * 90-100 = unmistakable single match
  * 70-89  = strong match but other SKUs are similar
  * 40-69  = partial match (e.g. user said only part of the name)
  * 1-39   = weak guess
- Be liberal with candidates — if the user said only part of a SKU name (e.g. "channel" when several channel SKUs exist), include the top 3 most likely so the user can pick.
- Use semantic matching on aluminium product names, sizes, types.
- If you genuinely cannot find any plausible match, return candidates: [] for that item.`
      }]
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMsg = `Anthropic API error: ${response.status}`
    try {
      const errJson = JSON.parse(errorBody)
      errorMsg = errJson.error?.message || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  const data = await response.json()
  const text = data.content.find(b => b.type === 'text')?.text || '{}'
  const cleanText = text.replace(/```json|```/g, '').trim()
  return JSON.parse(cleanText)
}

// JSON schema for extractCustomerInvoice — enforced by structured outputs, so
// the response is always parseable and has every field (null when unknown).
const nullable = (type) => ({ type: [type, 'null'] })
const CUSTOMER_INVOICE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['customer', 'source_invoice_number', 'invoice_date', 'due_date', 'tax_type', 'grand_total', 'line_items'],
  properties: {
    customer: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'gstin', 'state', 'matched_customer_id', 'match_confidence'],
      properties: {
        name: nullable('string'),
        gstin: nullable('string'),
        state: nullable('string'),
        matched_customer_id: nullable('string'),
        match_confidence: { type: 'number' }
      }
    },
    source_invoice_number: nullable('string'),
    invoice_date: nullable('string'),
    due_date: nullable('string'),
    tax_type: { type: 'string', enum: ['INTRA', 'INTER', 'UNKNOWN'] },
    grand_total: nullable('number'),
    line_items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'hsn_code', 'quantity', 'unit', 'rate_excl_gst', 'gst_rate', 'line_total_incl_gst', 'candidates'],
        properties: {
          description: { type: 'string' },
          hsn_code: nullable('string'),
          quantity: { type: 'number' },
          unit: nullable('string'),
          rate_excl_gst: nullable('number'),
          gst_rate: nullable('number'),
          line_total_incl_gst: nullable('number'),
          candidates: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['sku_id', 'confidence'],
              properties: {
                sku_id: { type: 'string' },
                confidence: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Read an already-generated sales invoice (PDF or image) and extract what's
 * needed to recreate it: customer (matched to our customer list), dates,
 * GST type, and line items (matched to our SKU catalogue).
 */
export async function extractCustomerInvoice(fileBase64, mimeType, skuList, customerList) {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('Anthropic API key is not configured. Set VITE_ANTHROPIC_API_KEY in .env')
  }

  const supportedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  const isPdf = mimeType === 'application/pdf'
  if (!isPdf && !supportedImageTypes.includes(mimeType)) {
    throw new Error(`Unsupported file type: ${mimeType}. Please upload a PDF, JPG, PNG or WebP.`)
  }

  const skuListCompact = skuList.map(s => ({
    id: s.id,
    code: s.sku_code,
    name: s.sku_name,
    uom: s.unit_of_measure,
    hsn: s.hsn_code || undefined
  }))
  const customerListCompact = customerList.map(c => ({
    id: c.id,
    name: c.customer_name,
    city: c.billing_city || undefined,
    gstin: c.gstin || undefined
  }))

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'server-side-fallback-2026-07-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: CUSTOMER_INVOICE_SCHEMA }
      },
      messages: [{
        role: 'user',
        content: [
          {
            type: isPdf ? 'document' : 'image',
            source: { type: 'base64', media_type: mimeType, data: fileBase64 }
          },
          {
            type: 'text',
            text: `This is a sales (outward) GST invoice from an aluminium hardware business in India. We want to recreate it in our system, so extract the buyer and every line item, and match them to our records.

OUR CUSTOMERS:
${JSON.stringify(customerListCompact)}

OUR SKU CATALOGUE:
${JSON.stringify(skuListCompact)}

Customer:
- The customer is the BUYER ("Bill to" / "Buyer" / "Consignee"), not the seller who issued the invoice.
- matched_customer_id: the id from OUR CUSTOMERS. A matching GSTIN is a certain match (confidence 100). Otherwise match on name and city; set null if none is plausible.

Dates: YYYY-MM-DD, or null if not shown.

tax_type: "INTER" if the invoice charges IGST, "INTRA" if it charges CGST + SGST, "UNKNOWN" if you can't tell.

Line items — one entry per invoice line, in order:
- quantity: prefer the piece count (PCS / NOS) when the invoice shows both pieces and weight/length; otherwise the quantity shown.
- rate_excl_gst: the per-unit rate BEFORE GST. If the invoice only shows a GST-inclusive rate, divide it by (1 + gst_rate/100).
- gst_rate: the GST percentage for the line (total of CGST + SGST, or IGST). If only an invoice-level rate is shown, use it for every line.
- line_total_incl_gst: the line amount including GST if shown or computable, else null.
- candidates: up to 3 SKUs from OUR SKU CATALOGUE ranked by likelihood, matching on product type, size and section. Confidence 90-100 = unmistakable, 70-89 = strong but similar SKUs exist, below 70 = uncertain. Empty array if nothing plausible.

grand_total: the invoice's final payable total.`
          }
        ]
      }]
    })
  })

  if (!response.ok) {
    const errorBody = await response.text()
    let errorMsg = `Anthropic API error: ${response.status}`
    try {
      const errJson = JSON.parse(errorBody)
      errorMsg = errJson.error?.message || errorMsg
    } catch {}
    throw new Error(errorMsg)
  }

  const data = await response.json()
  if (data.stop_reason === 'refusal') {
    throw new Error('The AI declined to read this file. Please fill the invoice manually.')
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Invoice is too long to read in one go. Try uploading fewer pages.')
  }
  const text = data.content.find(b => b.type === 'text')?.text
  if (!text) throw new Error('AI returned no data')
  return JSON.parse(text)
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