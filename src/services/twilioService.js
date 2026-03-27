import { supabase } from './supabase'

export async function sendWhatsAppInvoice({ invoiceId, toPhone, customerName, invoiceNumber, invoiceDate, pdfFilename, sentBy }) {
  // Normalize: strip spaces, add +91 if no country code
  let normalizedPhone = toPhone.replace(/\s+/g, '')
  if (normalizedPhone.startsWith('+')) {
    // already has country code
  } else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
    normalizedPhone = '+' + normalizedPhone
  } else {
    normalizedPhone = '+91' + normalizedPhone
  }

  const { data, error } = await supabase.rpc('send_whatsapp_invoice', {
    p_invoice_id: invoiceId,
    p_to_phone: normalizedPhone,
    p_customer_name: customerName,
    p_invoice_number: invoiceNumber,
    p_invoice_date: invoiceDate,
    p_pdf_filename: pdfFilename,
    p_sent_by: sentBy || null
  })

  if (error) throw new Error(`Failed to send WhatsApp message: ${error.message}`)

  if (!data?.success) {
    // Show the full Twilio error for debugging
    const errMsg = data?.error_message || data?.error_code || data?.twilio_status || 'Unknown error'
    console.error('Twilio full response:', JSON.stringify(data))
    throw new Error(`WhatsApp API error (${data?.status}): ${errMsg}`)
  }

  return data
}

export function extractPdfFilename(publicPdfUrl) {
  if (!publicPdfUrl) return ''
  return publicPdfUrl.split('/').pop() || ''
}
