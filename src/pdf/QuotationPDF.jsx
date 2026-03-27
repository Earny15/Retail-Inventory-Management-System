import React from 'react'
import {
  Document, Page, Text, View, StyleSheet, pdf
} from '@react-pdf/renderer'
import { currencyToWords } from '../utils/numberToWords'

const COLORS = {
  primary: '#1a365d',
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
  companyName: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    textAlign: 'center',
    marginBottom: 4
  },
  companyAddress: {
    fontSize: 7.5,
    color: COLORS.textLight,
    textAlign: 'center',
    marginBottom: 1
  },
  titleBar: {
    borderBottom: B,
    paddingVertical: 3,
    alignItems: 'center'
  },
  title: {
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
    paddingHorizontal: 6,
    width: '50%'
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
    width: 90
  },
  metaValue: {
    fontSize: 8,
    flex: 1
  },
  customerSection: {
    borderBottom: B,
    padding: 5,
    paddingHorizontal: 6
  },
  customerLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: COLORS.primary,
    marginBottom: 2
  },
  customerName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 1
  },
  customerText: {
    fontSize: 7.5,
    color: COLORS.textLight,
    marginBottom: 1
  },
  table: {
    borderBottom: B
  },
  tHeaderRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.tableHeaderBg,
    borderBottom: B
  },
  tRow: {
    flexDirection: 'row'
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
  colSno: { width: '6%' },
  colItem: { width: '34%' },
  colQty: { width: '12%' },
  colUnit: { width: '10%' },
  colRate: { width: '18%' },
  colTotal: { width: '20%' },
  grandTotalRow: {
    flexDirection: 'row',
    borderBottom: B,
    backgroundColor: COLORS.tableHeaderBg
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
  notesSection: {
    borderBottom: B,
    padding: 5,
    paddingHorizontal: 6
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2
  },
  notesText: {
    fontSize: 7.5,
    color: COLORS.textLight
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

function QuotationPDFDocument({ quotation, company }) {
  const isCancelled = quotation.status === 'CANCELLED'
  const items = quotation.sales_quotation_items || []
  const customer = quotation.customers || {}

  const totalQty = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

  const companyAddress = [company?.address_line1, company?.address_line2].filter(Boolean).join(', ')
  const companyCityState = [company?.city, company?.state, company?.pincode ? `- ${company.pincode}` : ''].filter(Boolean).join(', ')
  const customerAddress = [customer.billing_address_line1, customer.billing_address_line2].filter(Boolean).join(', ')
  const customerCityState = [customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')

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
            {company?.gstin && (
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 2 }}>
                GSTIN : {company.gstin}
              </Text>
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
                {company?.email ? `Email : ${company.email}` : ''}
              </Text>
            )}
          </View>

          <View style={styles.titleBar}>
            <Text style={styles.title}>SALES QUOTATION</Text>
          </View>

          {/* Quotation Number & Date */}
          <View style={styles.metaRow}>
            <View style={[styles.metaCell, styles.metaCellBorder]}>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Quotation No.</Text>
                <Text style={[styles.metaValue, { fontFamily: 'Helvetica-Bold' }]}>: {quotation.quotation_uid}</Text>
              </View>
              <View style={styles.metaLine}>
                <Text style={styles.metaLabel}>Dated</Text>
                <Text style={styles.metaValue}>: {formatDate(quotation.quotation_date)}</Text>
              </View>
            </View>
            <View style={styles.metaCell}>
              {quotation.validity_date && (
                <View style={styles.metaLine}>
                  <Text style={styles.metaLabel}>Valid Until</Text>
                  <Text style={styles.metaValue}>: {formatDate(quotation.validity_date)}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Customer */}
          <View style={styles.customerSection}>
            <Text style={styles.customerLabel}>To :</Text>
            <Text style={styles.customerName}>{customer.customer_name || 'N/A'}</Text>
            {customerAddress && <Text style={styles.customerText}>{customerAddress}</Text>}
            {customerCityState && <Text style={styles.customerText}>{customerCityState}</Text>}
            {customer.phone && <Text style={styles.customerText}>Phone: {customer.phone}</Text>}
          </View>

          {/* ITEMS TABLE */}
          <View style={styles.table}>
            <View style={styles.tHeaderRow}>
              <TH style={styles.colSno}>S.No</TH>
              <TH style={styles.colItem}>Item Name</TH>
              <TH style={styles.colQty}>Qty</TH>
              <TH style={styles.colUnit}>Unit</TH>
              <TH style={styles.colRate}>Per Unit Cost</TH>
              <TH style={styles.colTotal} last>Total Cost</TH>
            </View>

            {items.map((item, index) => {
              const qty = Number(item.quantity) || 0
              const rate = Number(item.rate) || 0
              const amount = Number(item.amount) || 0
              const isAlt = index % 2 === 1

              return (
                <View key={item.id || index} style={[styles.tRow, { borderBottom: BL }, isAlt ? { backgroundColor: COLORS.altRowBg } : {}]}>
                  <TC style={styles.colSno}>{index + 1}.</TC>
                  <TC style={styles.colItem} align="left">{item.sku?.sku_name || 'Item'}</TC>
                  <TC style={styles.colQty} align="right">{fmt(qty)}</TC>
                  <TC style={styles.colUnit}>{item.sku?.unit_of_measure || 'Nos'}</TC>
                  <TC style={styles.colRate} align="right">{fmt(rate)}</TC>
                  <TC style={styles.colTotal} last align="right">{fmt(amount)}</TC>
                </View>
              )
            })}
          </View>

          {/* Grand Total */}
          <View style={styles.grandTotalRow}>
            <View style={[styles.tCell, styles.colSno]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCell, { width: '34%' }]}>
              <Text style={[styles.th, { fontSize: 8, textAlign: 'right', paddingRight: 6 }]}>Grand Total</Text>
            </View>
            <View style={[styles.tCell, styles.colQty]}>
              <Text style={[styles.th, { fontSize: 8 }]}>{fmt(totalQty)}</Text>
            </View>
            <View style={[styles.tCell, styles.colUnit]}>
              <Text style={[styles.th, { fontSize: 7 }]}>Units</Text>
            </View>
            <View style={[styles.tCell, styles.colRate]}><Text style={styles.th}></Text></View>
            <View style={[styles.tCellLast, styles.colTotal]}>
              <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', textAlign: 'right', paddingRight: 3 }}>
                {fmt(quotation.total_amount)}
              </Text>
            </View>
          </View>

          {/* Amount in Words */}
          <View style={styles.wordsRow}>
            <Text style={styles.wordsText}>
              {currencyToWords(Math.round(quotation.total_amount || 0))}
            </Text>
          </View>

          {/* Notes */}
          {quotation.notes && (
            <View style={styles.notesSection}>
              <Text style={styles.notesTitle}>Notes :</Text>
              <Text style={styles.notesText}>{quotation.notes}</Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footerRow}>
            <View style={styles.footerLeft}>
              <Text style={{ fontSize: 7, color: COLORS.textLight, marginBottom: 1 }}>
                This is a quotation and not a tax invoice.
              </Text>
              <Text style={{ fontSize: 7, color: COLORS.textLight }}>
                Prices are subject to change without prior notice.
              </Text>
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

export async function downloadQuotationPDF(quotation, company) {
  const blob = await pdf(
    <QuotationPDFDocument quotation={quotation} company={company} />
  ).toBlob()

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${quotation.quotation_uid || 'Quotation'}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default QuotationPDFDocument
