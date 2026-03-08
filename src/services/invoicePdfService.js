import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { convertNumberToWords } from '../utils/numberToWords'

// Enhanced PDF invoice generation with Indian GST format
export function generateInvoicePDF(invoice) {
  const doc = new jsPDF()

  // Page margins
  const margin = 20
  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height

  let yPosition = margin

  // Helper function to add text with auto-wrap
  const addWrappedText = (text, x, y, maxWidth, lineHeight = 6) => {
    const lines = doc.splitTextToSize(text, maxWidth)
    doc.text(lines, x, y)
    return y + (lines.length * lineHeight)
  }

  // Add header with company logo area and GST details
  const addHeader = () => {
    // Company Logo Area (placeholder)
    doc.setDrawColor(200)
    doc.rect(margin, yPosition, 40, 25)
    doc.setFontSize(8)
    doc.setTextColor(128)
    doc.text('LOGO', margin + 15, yPosition + 15)

    // Company Details
    doc.setFontSize(16)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.company.company_name || 'AluminiumPro', margin + 50, yPosition + 8)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    yPosition += 12

    const companyDetails = [
      invoice.company.address_line1,
      `${invoice.company.city}, ${invoice.company.state} - ${invoice.company.pincode}`,
      `Phone: ${invoice.company.phone}`,
      `Email: ${invoice.company.email || 'info@aluminiumpro.com'}`,
      `GSTIN: ${invoice.company.gstin}`,
      `PAN: ${invoice.company.pan || 'ABCDE1234F'}`
    ].filter(Boolean)

    companyDetails.forEach(detail => {
      doc.text(detail, margin + 50, yPosition)
      yPosition += 5
    })

    // Invoice Title
    yPosition += 10
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 100, 200)
    doc.text('TAX INVOICE', pageWidth / 2, yPosition, { align: 'center' })

    yPosition += 15
    return yPosition
  }

  // Add invoice details section
  const addInvoiceDetails = () => {
    // Invoice details box
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)

    // Left side - Invoice details
    const leftBoxX = margin
    const leftBoxWidth = (pageWidth - 3 * margin) / 2

    doc.rect(leftBoxX, yPosition, leftBoxWidth, 30)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Invoice Details:', leftBoxX + 3, yPosition + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    const invoiceDetails = [
      `Invoice No: ${invoice.invoice_number}`,
      `Date: ${new Date(invoice.invoice_date).toLocaleDateString('en-GB')}`,
      `Due Date: ${new Date(invoice.due_date).toLocaleDateString('en-GB')}`,
      `Place of Supply: ${invoice.place_of_supply || invoice.company.state}`
    ]

    invoiceDetails.forEach((detail, index) => {
      doc.text(detail, leftBoxX + 3, yPosition + 14 + (index * 4))
    })

    // Right side - Customer details
    const rightBoxX = leftBoxX + leftBoxWidth + margin
    const rightBoxWidth = leftBoxWidth

    doc.rect(rightBoxX, yPosition, rightBoxWidth, 30)

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Bill To:', rightBoxX + 3, yPosition + 8)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)

    const customerDetails = [
      invoice.customer.customer_name,
      invoice.customer.billing_address_line1,
      `${invoice.customer.billing_city}, ${invoice.customer.billing_state} - ${invoice.customer.billing_pincode}`,
      invoice.customer.gstin ? `GSTIN: ${invoice.customer.gstin}` : 'GSTIN: Not Provided'
    ].filter(Boolean)

    customerDetails.forEach((detail, index) => {
      const lines = doc.splitTextToSize(detail, rightBoxWidth - 6)
      doc.text(lines, rightBoxX + 3, yPosition + 14 + (index * 4))
    })

    yPosition += 40
    return yPosition
  }

  // Add items table with GST breakdown
  const addItemsTable = () => {
    const headers = [
      'S.No', 'Description', 'HSN/SAC', 'UOM', 'Qty',
      'Rate', 'Amount', 'CGST%', 'CGST', 'SGST%', 'SGST', 'IGST%', 'IGST', 'Total'
    ]

    const rows = invoice.items.map((item, index) => {
      const amount = item.quantity * item.unit_price
      const isInterState = invoice.customer.billing_state !== invoice.company.state

      let cgstRate = 0, sgstRate = 0, igstRate = 0
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0

      if (isInterState) {
        igstRate = item.gst_rate
        igstAmount = (amount * igstRate) / 100
      } else {
        cgstRate = item.gst_rate / 2
        sgstRate = item.gst_rate / 2
        cgstAmount = (amount * cgstRate) / 100
        sgstAmount = (amount * sgstRate) / 100
      }

      const totalAmount = amount + cgstAmount + sgstAmount + igstAmount

      return [
        index + 1,
        item.sku_name || item.description,
        item.hsn_code || '7601',
        item.unit_of_measure || 'KG',
        item.quantity.toFixed(2),
        `₹${item.unit_price.toFixed(2)}`,
        `₹${amount.toFixed(2)}`,
        cgstRate ? `${cgstRate}%` : '-',
        cgstAmount ? `₹${cgstAmount.toFixed(2)}` : '-',
        sgstRate ? `${sgstRate}%` : '-',
        sgstAmount ? `₹${sgstAmount.toFixed(2)}` : '-',
        igstRate ? `${igstRate}%` : '-',
        igstAmount ? `₹${igstAmount.toFixed(2)}` : '-',
        `₹${totalAmount.toFixed(2)}`
      ]
    })

    doc.autoTable({
      startY: yPosition,
      head: [headers],
      body: rows,
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: [0, 0, 0],
        lineWidth: 0.1
      },
      headStyles: {
        fillColor: [240, 240, 240],
        textColor: [0, 0, 0],
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250]
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 12 },  // S.No
        1: { cellWidth: 35 },  // Description
        2: { halign: 'center', cellWidth: 18 },  // HSN
        3: { halign: 'center', cellWidth: 12 },  // UOM
        4: { halign: 'right', cellWidth: 15 },   // Qty
        5: { halign: 'right', cellWidth: 18 },   // Rate
        6: { halign: 'right', cellWidth: 20 },   // Amount
        7: { halign: 'center', cellWidth: 12 },  // CGST%
        8: { halign: 'right', cellWidth: 15 },   // CGST
        9: { halign: 'center', cellWidth: 12 },  // SGST%
        10: { halign: 'right', cellWidth: 15 },  // SGST
        11: { halign: 'center', cellWidth: 12 }, // IGST%
        12: { halign: 'right', cellWidth: 15 },  // IGST
        13: { halign: 'right', cellWidth: 20 }   // Total
      },
      margin: { left: margin, right: margin },
      tableWidth: 'auto'
    })

    yPosition = doc.lastAutoTable.finalY + 10
    return yPosition
  }

  // Add GST summary and totals
  const addTotalsSection = () => {
    const rightColX = pageWidth - 80
    const leftColX = margin

    // GST Summary (left side)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('GST Summary:', leftColX, yPosition)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    // Calculate GST summary
    const gstSummary = {}
    invoice.items.forEach(item => {
      const amount = item.quantity * item.unit_price
      const gstRate = item.gst_rate
      const isInterState = invoice.customer.billing_state !== invoice.company.state

      if (!gstSummary[gstRate]) {
        gstSummary[gstRate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 }
      }

      gstSummary[gstRate].taxable += amount

      if (isInterState) {
        gstSummary[gstRate].igst += (amount * gstRate) / 100
      } else {
        gstSummary[gstRate].cgst += (amount * gstRate / 2) / 100
        gstSummary[gstRate].sgst += (amount * gstRate / 2) / 100
      }
    })

    yPosition += 8

    // GST Summary table
    const gstHeaders = ['GST%', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total']
    const gstRows = Object.entries(gstSummary).map(([rate, amounts]) => [
      `${rate}%`,
      `₹${amounts.taxable.toFixed(2)}`,
      `₹${amounts.cgst.toFixed(2)}`,
      `₹${amounts.sgst.toFixed(2)}`,
      `₹${amounts.igst.toFixed(2)}`,
      `₹${(amounts.taxable + amounts.cgst + amounts.sgst + amounts.igst).toFixed(2)}`
    ])

    doc.autoTable({
      startY: yPosition,
      head: [gstHeaders],
      body: gstRows,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [220, 220, 220],
        fontStyle: 'bold'
      },
      margin: { left: leftColX, right: pageWidth - 120 },
      tableWidth: 110
    })

    // Invoice totals (right side)
    const totalsY = yPosition
    doc.setFontSize(10)

    const totalsData = [
      ['Subtotal:', `₹${invoice.subtotal_amount.toFixed(2)}`],
      ['Total GST:', `₹${invoice.total_gst_amount.toFixed(2)}`],
      ['Round Off:', `₹${invoice.round_off_amount.toFixed(2)}`],
      ['Total Amount:', `₹${invoice.grand_total.toFixed(2)}`]
    ]

    totalsData.forEach((row, index) => {
      const isLastRow = index === totalsData.length - 1
      if (isLastRow) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)

        // Add border for grand total
        doc.setDrawColor(0)
        doc.setLineWidth(0.5)
        doc.rect(rightColX - 5, totalsY + (index * 8) - 2, 85, 10)
        doc.setFillColor(240, 240, 240)
        doc.rect(rightColX - 5, totalsY + (index * 8) - 2, 85, 10, 'F')
      } else {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
      }

      doc.text(row[0], rightColX, totalsY + (index * 8) + 5)
      doc.text(row[1], pageWidth - margin, totalsY + (index * 8) + 5, { align: 'right' })
    })

    yPosition = Math.max(doc.lastAutoTable.finalY, totalsY + 40) + 10
    return yPosition
  }

  // Add amount in words
  const addAmountInWords = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Amount in Words:', margin, yPosition)

    doc.setFont('helvetica', 'normal')
    const amountWords = convertNumberToWords(Math.round(invoice.grand_total))
    yPosition = addWrappedText(
      `${amountWords} Rupees Only`,
      margin,
      yPosition + 8,
      pageWidth - 2 * margin,
      6
    )

    yPosition += 10
    return yPosition
  }

  // Add terms and conditions
  const addTermsAndConditions = () => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Terms & Conditions:', margin, yPosition)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    yPosition += 8

    const terms = [
      '1. Payment is due within 30 days of invoice date.',
      '2. Interest @ 18% per annum will be charged on overdue amounts.',
      '3. All disputes subject to local jurisdiction only.',
      '4. Goods once sold will not be taken back.',
      '5. This is a computer generated invoice.'
    ]

    terms.forEach(term => {
      yPosition = addWrappedText(term, margin, yPosition, pageWidth - 2 * margin, 5)
    })

    yPosition += 10
    return yPosition
  }

  // Add signature and footer
  const addFooter = () => {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = margin
    }

    // Signature section
    const signatureY = Math.max(yPosition, pageHeight - 50)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('For ' + (invoice.company.company_name || 'AluminiumPro'), pageWidth - margin - 60, signatureY)

    // Signature line
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(pageWidth - margin - 60, signatureY + 20, pageWidth - margin, signatureY + 20)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.text('Authorized Signatory', pageWidth - margin - 60, signatureY + 25)

    // QR Code placeholder
    doc.setDrawColor(200)
    doc.rect(margin, signatureY, 30, 30)
    doc.setFontSize(8)
    doc.setTextColor(128)
    doc.text('QR CODE', margin + 8, signatureY + 18)

    // Footer note
    doc.setTextColor(0)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(8)
    doc.text('This is a computer generated document. No signature required.',
             pageWidth / 2, pageHeight - 10, { align: 'center' })
  }

  // Generate the invoice
  try {
    yPosition = addHeader()
    yPosition = addInvoiceDetails()
    yPosition = addItemsTable()
    yPosition = addTotalsSection()
    yPosition = addAmountInWords()
    yPosition = addTermsAndConditions()
    addFooter()

    return doc
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate invoice PDF')
  }
}

// Function to download the PDF
export function downloadInvoicePDF(invoice, filename) {
  try {
    const doc = generateInvoicePDF(invoice)
    const pdfFilename = filename || `Invoice_${invoice.invoice_number}_${new Date().toISOString().split('T')[0]}.pdf`
    doc.save(pdfFilename)
  } catch (error) {
    console.error('Error downloading PDF:', error)
    throw new Error('Failed to download invoice PDF')
  }
}

// Function to get PDF as blob for email or other uses
export function getInvoicePDFBlob(invoice) {
  try {
    const doc = generateInvoicePDF(invoice)
    return doc.output('blob')
  } catch (error) {
    console.error('Error generating PDF blob:', error)
    throw new Error('Failed to generate invoice PDF blob')
  }
}

// Function to print the PDF
export function printInvoicePDF(invoice) {
  try {
    const doc = generateInvoicePDF(invoice)
    const pdfUrl = doc.output('bloburl')

    // Open in new window for printing
    const printWindow = window.open(pdfUrl, '_blank')
    printWindow.onload = () => {
      printWindow.print()
    }
  } catch (error) {
    console.error('Error printing PDF:', error)
    throw new Error('Failed to print invoice PDF')
  }
}