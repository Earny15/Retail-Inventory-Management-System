import React from 'react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from './supabase'
import InvoicePDFDocument from '../pdf/InvoicePDF'

const BUCKET_NAME = 'invoice-pdfs'

// Function to upload PDF to public storage and return public URL
export async function uploadInvoicePDFToStorage(invoice, company, options = {}) {
  try {
    console.log('Generating PDF blob for invoice:', invoice?.invoice_number)

    // Generate PDF using the same React PDF renderer that "Download PDF" uses
    const blob = await pdf(
      React.createElement(InvoicePDFDocument, {
        invoice,
        company,
        vehicleNo: options.vehicleNo || '',
        ewayBillNo: options.ewayBillNo || '',
        logoDataUri: options.logoDataUri || null
      })
    ).toBlob()

    console.log('PDF blob generated, size:', blob.size)

    const filename = `invoice_${invoice.invoice_number}_${Date.now()}.pdf`
    console.log('Uploading PDF to storage:', filename)

    // Upload to public bucket
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, blob, {
        contentType: 'application/pdf',
        upsert: true
      })

    if (error) {
      console.error('Supabase storage upload error:', error)
      throw new Error(`Storage upload failed: ${error.message}`)
    }

    console.log('Upload successful:', data)

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filename)

    console.log('Public URL:', urlData.publicUrl)
    return urlData.publicUrl
  } catch (error) {
    console.error('Error in uploadInvoicePDFToStorage:', error)
    throw new Error(`Failed to upload invoice PDF to storage: ${error.message}`)
  }
}
