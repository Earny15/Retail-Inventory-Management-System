import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf
} from '@react-pdf/renderer'
import { currencyToWords } from '../utils/numberToWords'

const COLORS = {
  primary: '#1a365d',
  primaryLight: '#2b6cb0',
  tableBorder: '#333333',
  tableHeaderBg: '#e8edf3',
  altRowBg: '#f7f9fc',
  text: '#1a202c',
  textLight: '#4a5568',
  border: '#999999',
  lightBorder: '#cccccc'
}

const B = `1pt solid ${COLORS.tableBorder}`
const BL = `0.5pt solid ${COLORS.lightBorder}`

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 8.5,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
    color: COLORS.text
  },
  outerBorder: {
    border: `1.5pt solid ${COLORS.tableBorder}`
  },
  headerSection: {
    borderBottom: B,
    padding: 10,
    alignItems: 'center'
  },
  headerTop: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 4
  },
  logoContainer: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logo: {
    width: 50,
    height: 50,
    objectFit: 'contain'
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center'
  },
  headerRight: {
    width: 70,
    alignItems: 'flex-end'
  },
  gstin: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2
  },
  companyName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 6
  },
  companyAddress: {
    fontSize: 7.5,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 1
  },
  originalCopy: {
    fontSize: 7.5,
    color: COLORS.primaryLight,
    fontFamily: 'Helvetica-Bold'
  },
  titleBar: {
    borderBottom: B,
    paddingVertical: 3,
    alignItems: 'center'
  },
  taxInvoiceTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    textDecoration: 'underline'
  },
  metaRow: {
    flexDirection: 'row',
    borderBottom: B
  },
  metaCell: {
    padding: 4,
    paddingHorizontal: 6
  },
  metaCellBorder: {
    borderRight: B
  },
  metaLine: {
    flexDirection: 'row',
    marginBottom: 1
  },
  metaLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    width: 80
  },
  metaValue: {
    fontSize: 8,
    flex: 1
  },
  addressRow: {
    flexDirection: 'row',
    borderBottom: B
  },
  addressBlock: {
    width: '50%',
    padding: 5,
    paddingHorizontal: 6
  },
  addressBlockLeft: {
    borderRight: B
  },
  addressLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    marginBottom: 2
  },
  addressName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1
  },
  addressText: {
    fontSize: 7.5,
    color: COLORS.textLight,
    marginBottom: 1
  },
  gstinRow: {
    flexDirection: 'row',
    borderBottom: B
  },
  gstinBlock: {
    width: '50%',
    padding: 3,
    paddingHorizontal: 6
  },
  gstinBlockLeft: {
    borderRight: B
  },
  gstinLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold'
  },
  gstinValue: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary
  },
  table: {
    borderBottom: B
  },
  tRow: {
    flexDirection: 'row'
  },
  tHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.tableHeaderBg,
    borderBottom: B
  },
  tCell: {
    borderRight: BL,
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: 'center'
  },
  tCellLast: {
    paddingVertical: 3,
    paddingHorizontal: 2,
    justifyContent: 'center'
  },
  th: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center'
  },
  tdR: {
    fontSize: 7.5,
    textAlign: 'right',
    paddingRight: 3
  },
  colSno: { width: '4%' },
  colDesc: { width: '22%' },
  colHsn: { width: '7%' },
  colTax: { width: '6%' },
  colQty: { width: '7%' },
  colUnit: { width: '5%' },
  colPrice: { width: '9%' },
  colAmt: { width: '10%' },
  colCgst: { width: '8%' },
  colSgst: { width: '8%' },
  colIgst: { width: '16%' },
  colTotal: { width: '10%' },
  grandTotalRow: {
    flexDirection: 'row',
    borderBottom: B,
    backgroundColor: COLORS.tableHeaderBg
  },
  taxSummaryRow: {
    borderBottom: B,
    padding: 5,
    paddingHorizontal: 6
  },
  taxLine: {
    flexDirection: 'row',
    paddingVertical: 2
  },
  taxCol: {
    width: '20%',
    fontSize: 7.5
  },
  taxColBold: {
    width: '20%',
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline'
  },
  wordsRow: {
    borderBottom: B,
    padding: 5,
    paddingHorizontal: 6
  },
  wordsText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary
  },
  declRow: {
    borderBottom: B,
    padding: 5,
    alignItems: 'center'
  },
  declTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    marginBottom: 2
  },
  declText: {
    fontSize: 7.5,
    color: COLORS.textLight
  },
  bankRow: {
    borderBottom: B,
    padding: 5,
    paddingHorizontal: 6
  },
  bankTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2
  },
  bankText: {
    fontSize: 8,
    marginBottom: 1
  },
  footerRow: {
    flexDirection: 'row',
    minHeight: 80
  },
  footerLeft: {
    width: '50%',
    borderRight: B,
    padding: 5,
    paddingHorizontal: 6
  },
  footerRight: {
    width: '50%',
    padding: 5,
    paddingHorizontal: 6,
    justifyContent: 'space-between'
  },
  termsTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textDecoration: 'underline',
    marginBottom: 2
  },
  termsText: {
    fontSize: 7,
    color: COLORS.textLight,
    marginBottom: 1
  },
  forCompany: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    marginBottom: 25
  },
  authSignatory: {
    fontSize: 8,
    fontFamily: 'Helvetica-BoldOblique',
    textAlign: 'right',
    color: COLORS.primary
  },
  cancelledBanner: {
    backgroundColor: '#fed7d7',
    padding: 6,
    alignItems: 'center',
    borderBottom: B
  },
  cancelledText: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#c53030'
  }
})

const fmt = (amount) => {
  const num = Number(amount) || 0
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function TC({ children, style, last, align }) {
  const alignStyle = align === 'right' ? { textAlign: 'right', paddingRight: 3 }
    : align === 'left' ? { textAlign: 'left', paddingLeft: 2 }
    : { textAlign: 'center' }
  return (
    <View style={[last ? styles.tCellLast : styles.tCell, style]}>
      <Text style={[{ fontSize: 7.5 }, alignStyle]}>{children}</Text>
    </View>
  )
}

function TH({ children, style, last }) {
  return (
    <View style={[last ? styles.tCellLast : styles.tCell, style, { borderRight: last ? undefined : `0.5pt solid ${COLORS.border}` }]}>
      <Text style={styles.th}>{children}</Text>
    </View>
  )
}

/**
 * Convert a Blob to a base64 data URI
 */
function blobToDataUri(blob) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

function InvoicePDFDocument({ invoice, company, vehicleNo, ewayBillNo, logoDataUri }) {
  const isIntraState = (invoice.cgst_amount || 0) > 0 || (invoice.igst_amount || 0) === 0
  const isCancelled = invoice.status === 'CANCELLED'
  const items = invoice.customer_invoice_items || []
  const customer = invoice.customers || {}

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
  const totalTaxableAmt = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  const totalCgst = isIntraState ? items.reduce((sum, item) => sum + ((Number(item.gst_amount) || 0) / 2), 0) : 0
  const totalSgst = totalCgst
  const totalIgst = !isIntraState ? items.reduce((sum, item) => sum + (Number(item.gst_amount) || 0), 0) : 0

  const taxGroups = {}
  items.forEach(item => {
    const rate = item.gst_rate || 0
    if (!taxGroups[rate]) taxGroups[rate] = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 }
    taxGroups[rate].taxable += Number(item.amount) || 0
    if (isIntraState) {
      taxGroups[rate].cgst += (Number(item.gst_amount) || 0) / 2
      taxGroups[rate].sgst += (Number(item.gst_amount) || 0) / 2
    } else {
      taxGroups[rate].igst += Number(item.gst_amount) || 0
    }
    taxGroups[rate].total += (Number(item.gst_amount) || 0)
  })

  const billingAddress = [customer.billing_address_line1, customer.billing_address_line2].filter(Boolean).join(', ')
  const billingCityState = [customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')
  const shippingAddress = [customer.shipping_address_line1, customer.shipping_address_line2].filter(Boolean).join(', ')
  const shippingCityState = [customer.shipping_city, customer.shipping_state, customer.shipping_pincode].filter(Boolean).join(', ')
  const hasShipping = customer.shipping_address_line1 || customer.shipping_city
  const companyAddress = [company?.address_line1, company?.address_line2].filter(Boolean).join(', ')
  const companyCityState = [company?.city, company?.state, company?.pincode ? `- ${company.pincode}` : ''].filter(Boolean).join(', ')

  const declarationText = company?.declaration || 'Certified that all the particulars shown in the above Invoice are true and correct'

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outerBorder}>
          {isCancelled && (
            <View style={styles.cancelledBanner}>
              <Text style={styles.cancelledText}>CANCELLED</Text>
            </View>
          )}

          {/* HEADER */}
          <View style={styles.headerSection}>
            <View style={styles.headerTop}>
              <View style={styles.logoContainer}>
                {logoDataUri ? (
                  <Image src={logoDataUri} style={styles.logo} />
                ) : (
                  <Text></Text>
                )}
              </View>
              <View style={styles.headerCenter}>
                {company?.gstin && (
                  <Text style={styles.gstin}>GSTIN : {company.gstin}</Text>
                )}
                <Text style={styles.companyName}>
                  {company?.company_name || 'Company Name'}
                </Text>
                {companyAddress && <Text style={styles.companyAddress}>{companyAddress}</Text>}
                {companyCityState && <Text style={styles.companyAddress}>{companyCityState}</Text>}
                {(company?.phone || company?.email) && (
                  <Text style={styles.companyAddress}>
                    {company?.phone ? `Tel. : ${company.phone}` : ''}
                    {company?.phone && company?.email ? '   ' : ''}
                    {company?.email ? `email : ${company.email}` : ''}
                  </Text>
                )}
              </View>
              <View style={styles.headerRight}>
                <Text style={styles.originalCopy}>Original Copy</Text>
              </View>
            </View>
          </View>

          <View style={styles.titleBar}>
            <Text style={styles.taxInvoiceTitle}>TAX INVOICE</Text>
          </View>

          {/* Invoice No, Date | Vehicle No, E-Way Bill */}
          <View style={styles.metaRow}>
            <View style={[styles.metaCell, styles.metaCellBorder, { width: '50%' }]}>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Invoice No.</Text>
                <Text style={[styles.metaValue, { fontFamily: 'Helvetica-Bold' }]}>: {invoice.invoice_number}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Dated</Text>
                <Text style={styles.metaValue}>: {formatDate(invoice.invoice_date)}</Text>
              </View>
              {invoice.due_date && (
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Due Date</Text>
                  <Text style={styles.metaValue}>: {formatDate(invoice.due_date)}</Text>
                </View>
              )}
            </View>
            <View style={[styles.metaCell, { width: '50%' }]}>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Vehicle No.</Text>
                <Text style={styles.metaValue}>: {vehicleNo || ''}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>E-Way Bill No.</Text>
                <Text style={styles.metaValue}>: {ewayBillNo || ''}</Text>
              </View>
            </View>
          </View>

          {/* Billed To / Shipped To */}
          <View style={styles.addressRow}>
            <View style={[styles.addressBlock, styles.addressBlockLeft]}>
              <Text style={styles.addressLabel}>Billed to :</Text>
              <Text style={styles.addressName}>{customer.customer_name || 'N/A'}</Text>
              {billingAddress && <Text style={styles.addressText}>{billingAddress}</Text>}
              {billingCityState && <Text style={styles.addressText}>{billingCityState}</Text>}
            </View>
            <View style={styles.addressBlock}>
              <Text style={styles.addressLabel}>Shipped to :</Text>
              <Text style={styles.addressName}>{customer.customer_name || 'N/A'}</Text>
              {hasShipping ? (
                <>
                  {shippingAddress && <Text style={styles.addressText}>{shippingAddress}</Text>}
                  {shippingCityState && <Text style={styles.addressText}>{shippingCityState}</Text>}
                </>
              ) : (
                <>
                  {billingAddress && <Text style={styles.addressText}>{billingAddress}</Text>}
                  {billingCityState && <Text style={styles.addressText}>{billingCityState}</Text>}
                </>
              )}
            </View>
          </View>

          {/* GSTIN Row */}
          <View style={styles.gstinRow}>
            <View style={[styles.gstinBlock, styles.gstinBlockLeft]}>
              <Text>
                <Text style={styles.gstinLabel}>GSTIN / UIN   :   </Text>
                <Text style={styles.gstinValue}>{customer.gstin || 'N/A'}</Text>
              </Text>
            </View>
            <View style={styles.gstinBlock}>
              <Text>
                <Text style={styles.gstinLabel}>GSTIN / UIN   :   </Text>
                <Text style={styles.gstinValue}>{customer.gstin || 'N/A'}</Text>
              </Text>
            </View>
          </View>

          {/* ITEMS TABLE */}
          <View style={styles.table}>
            <View style={styles.tHeaderRow}>
              <TH style={styles.colSno}>S.N.</TH>
              <TH style={styles.colDesc}>Description of Goods</TH>
              <TH style={styles.colHsn}>HSN/SAC</TH>
              <TH style={styles.colTax}>Tax %</TH>
              <TH style={styles.colQty}>Qty</TH>
              <TH style={styles.colUnit}>Unit</TH>
              <TH style={styles.colPrice}>Price</TH>
              <TH style={styles.colAmt}>Amt. Before</TH>
              {isIntraState ? (
                <>
                  <TH style={styles.colCgst}>CGST Amt</TH>
                  <TH style={styles.colSgst}>SGST Amt</TH>
                </>
              ) : (
                <TH style={styles.colIgst}>IGST Amt</TH>
              )}
              <TH style={styles.colTotal} last>Amount</TH>
            </View>

            {items.map((item, index) => {
              const taxableAmt = Number(item.amount) || 0
              const gstAmt = Number(item.gst_amount) || 0
              const totalAmt = Number(item.total_amount) || 0
              const rate = Number(item.rate) || 0
              const qty = Number(item.quantity) || 0
              const isAlt = index % 2 === 1

              return (
                <View key={item.id || index} style={[styles.tRow, { borderBottom: BL }, isAlt ? { backgroundColor: COLORS.altRowBg } : {}]}>
                  <TC style={styles.colSno}>{index + 1}.</TC>
                  <TC style={styles.colDesc} align="left">{item.sku?.sku_name || 'Item'}</TC>
                  <TC style={styles.colHsn}>{item.sku?.hsn_code || '-'}</TC>
                  <TC style={styles.colTax}>{item.gst_rate || 0}%</TC>
                  <TC style={styles.colQty} align="right">{fmt(qty)}</TC>
                  <TC style={styles.colUnit}>{item.sku?.unit_of_measure || 'Nos'}</TC>
                  <TC style={styles.colPrice} align="right">{fmt(rate)}</TC>
                  <TC style={styles.colAmt} align="right">{fmt(taxableAmt)}</TC>
                  {isIntraState ? (
                    <>
                      <TC style={styles.colCgst} align="right">{fmt(gstAmt / 2)}</TC>
                      <TC style={styles.colSgst} align="right">{fmt(gstAmt / 2)}</TC>
                    </>
                  ) : (
                    <TC style={styles.colIgst} align="right">{fmt(gstAmt)}</TC>
                  )}
                  <TC style={styles.colTotal} last align="right">{fmt(totalAmt)}</TC>
                </View>
              )
            })}
          </View>

          {/* Grand Total */}
          <View style={styles.grandTotalRow}>
            <View style={[styles.tCell, styles.colSno]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCell, { width: '22%' }]}>
              <Text style={[styles.th, { fontSize: 8, textAlign: 'right', paddingRight: 6 }]}>Grand Total</Text>
            </View>
            <View style={[styles.tCell, styles.colHsn]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCell, styles.colTax]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCell, styles.colQty]}>
              <Text style={[styles.th, { fontSize: 8 }]}>{fmt(totalQty)}</Text>
            </View>
            <View style={[styles.tCell, styles.colUnit]}>
              <Text style={[styles.th, { fontSize: 7 }]}>Units</Text>
            </View>
            <View style={[styles.tCell, styles.colPrice]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCell, styles.colAmt]}>
              <Text style={[styles.tdR, { fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>{fmt(totalTaxableAmt)}</Text>
            </View>
            {isIntraState ? (
              <>
                <View style={[styles.tCell, styles.colCgst]}>
                  <Text style={[styles.tdR, { fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>{fmt(totalCgst)}</Text>
                </View>
                <View style={[styles.tCell, styles.colSgst]}>
                  <Text style={[styles.tdR, { fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>{fmt(totalSgst)}</Text>
                </View>
              </>
            ) : (
              <View style={[styles.tCell, styles.colIgst]}>
                <Text style={[styles.tdR, { fontFamily: 'Helvetica-Bold', fontSize: 7.5 }]}>{fmt(totalIgst)}</Text>
              </View>
            )}
            <View style={[styles.tCellLast, styles.colTotal]}>
              <Text style={[styles.tdR, { fontFamily: 'Helvetica-Bold', fontSize: 8 }]}>{fmt(invoice.total_amount)}</Text>
            </View>
          </View>

          {/* Tax Summary */}
          <View style={styles.taxSummaryRow}>
            <View style={[styles.taxLine, { borderBottom: `0.5pt solid ${COLORS.border}`, paddingBottom: 2, marginBottom: 2 }]}>
              <Text style={styles.taxColBold}>Tax Rate</Text>
              <Text style={styles.taxColBold}>Taxable Amt.</Text>
              {isIntraState ? (
                <>
                  <Text style={styles.taxColBold}>CGST Amt.</Text>
                  <Text style={styles.taxColBold}>SGST Amt.</Text>
                </>
              ) : (
                <Text style={styles.taxColBold}>IGST Amt.</Text>
              )}
              <Text style={styles.taxColBold}>Total Tax</Text>
            </View>
            {Object.entries(taxGroups).map(([rate, group]) => (
              <View key={rate} style={styles.taxLine}>
                <Text style={styles.taxCol}>{rate}%</Text>
                <Text style={styles.taxCol}>{fmt(group.taxable)}</Text>
                {isIntraState ? (
                  <>
                    <Text style={styles.taxCol}>{fmt(group.cgst)}</Text>
                    <Text style={styles.taxCol}>{fmt(group.sgst)}</Text>
                  </>
                ) : (
                  <Text style={styles.taxCol}>{fmt(group.igst)}</Text>
                )}
                <Text style={styles.taxCol}>{fmt(group.total)}</Text>
              </View>
            ))}
          </View>

          {/* Amount in Words */}
          <View style={styles.wordsRow}>
            <Text style={styles.wordsText}>
              {currencyToWords(Math.round(invoice.total_amount || 0))}
            </Text>
          </View>

          {/* Declaration */}
          <View style={styles.declRow}>
            <Text style={styles.declTitle}>Declaration</Text>
            <Text style={styles.declText}>{declarationText}</Text>
          </View>

          {/* Bank Details */}
          {company?.bank_name && (
            <View style={styles.bankRow}>
              <Text style={styles.bankTitle}>Bank Details :</Text>
              <Text style={styles.bankText}>
                Bank : {company.bank_name}
                {company.bank_branch ? `        Branch : ${company.bank_branch}` : ''}
              </Text>
              {company.bank_account_number && (
                <Text style={styles.bankText}>
                  A/C  : {company.bank_account_number}
                  {company.ifsc_code ? `              IFSC : ${company.ifsc_code}` : ''}
                </Text>
              )}
            </View>
          )}

          {/* Footer */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={styles.termsTitle}>Terms & Conditions</Text>
              {company?.terms_and_conditions ? (
                <Text style={styles.termsText}>{company.terms_and_conditions}</Text>
              ) : (
                <>
                  <Text style={styles.termsText}>E.& O.E.</Text>
                  <Text style={styles.termsText}>Subject to local Jurisdiction only.</Text>
                </>
              )}
              <View style={{ marginTop: 15 }}>
                <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold' }}>Receiver's Signature   :</Text>
              </View>
            </View>
            <View style={styles.footerRight}>
              <View style={{ alignItems: 'flex-end', justifyContent: 'flex-end', flex: 1, paddingTop: 10 }}>
                <Text style={styles.forCompany}>
                  For {company?.company_name || 'Company'}
                </Text>
                <Text style={styles.authSignatory}>Authorised Signatory</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}

/**
 * Generate and download PDF for an invoice
 * @param {Object} invoice - Full invoice with items and customer
 * @param {Object} company - Company record
 * @param {Object} options - { vehicleNo, ewayBillNo, logoDataUri }
 */
export async function downloadInvoicePDF(invoice, company, { vehicleNo, ewayBillNo, logoDataUri } = {}) {
  const blob = await pdf(
    <InvoicePDFDocument invoice={invoice} company={company} vehicleNo={vehicleNo} ewayBillNo={ewayBillNo} logoDataUri={logoDataUri || null} />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoice.invoice_number || 'Invoice'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export { blobToDataUri }
export default InvoicePDFDocument
