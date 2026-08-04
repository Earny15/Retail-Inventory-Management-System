import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer'
import { currencyToWords } from '../utils/numberToWords'

const COLORS = {
  primary: '#1a365d',
  text: '#1a202c',
  textLight: '#4a5568',
  border: '#999999',
  lightBorder: '#cccccc',
  tableBorder: '#333333',
  tableHeaderBg: '#e8edf3',
  altRowBg: '#f7f9fc'
}
const B = `1pt solid ${COLORS.tableBorder}`

const styles = StyleSheet.create({
  page: { padding: 20, fontSize: 9, fontFamily: 'Helvetica', lineHeight: 1.4, color: COLORS.text },
  outerBorder: { border: `1.5pt solid ${COLORS.tableBorder}` },
  header: { borderBottom: B, padding: 10, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 50, height: 50, objectFit: 'contain', marginRight: 12 },
  companyName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: COLORS.primary },
  companyMeta: { fontSize: 8, color: COLORS.textLight, marginTop: 2 },
  titleRow: { padding: 8, alignItems: 'center', backgroundColor: COLORS.tableHeaderBg, borderBottom: B },
  title: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.primary },
  metaRow: { flexDirection: 'row', borderBottom: B },
  metaCell: { flex: 1, padding: 8, borderRight: B },
  metaLabel: { fontSize: 7, color: COLORS.textLight, marginBottom: 2 },
  metaValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  section: { padding: 10, borderBottom: B },
  sectionTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.textLight, marginBottom: 4 },
  table: { marginTop: 4 },
  tRow: { flexDirection: 'row', borderTop: `0.5pt solid ${COLORS.lightBorder}` },
  tRowFirst: { flexDirection: 'row' },
  tHeadRow: { flexDirection: 'row', backgroundColor: COLORS.tableHeaderBg, borderBottom: B },
  th: { padding: 6, fontSize: 8, fontFamily: 'Helvetica-Bold', color: COLORS.text },
  td: { padding: 6, fontSize: 9 },
  totals: { flexDirection: 'row', padding: 10, backgroundColor: COLORS.altRowBg, borderTop: B },
  totalLabel: { flex: 1, fontSize: 10, fontFamily: 'Helvetica-Bold' },
  totalValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: COLORS.primary },
  words: { padding: 10, fontSize: 9 },
  footer: { padding: 8, fontSize: 7, color: COLORS.textLight, textAlign: 'center', borderTop: B }
})

const fmt = (n) => {
  const num = Number(n) || 0
  return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`
}

function NoteKeepingPDFDocument({ invoice, company, logoDataUri }) {
  const items = invoice.note_keeping_invoice_items || []
  const customer = invoice.customers || {}
  const total = items.reduce((s, i) => s + (Number(i.amount) || 0), 0)
  const companyAddress = [company?.address_line1, company?.address_line2, company?.city, company?.state, company?.pincode].filter(Boolean).join(', ')

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.outerBorder}>
          {/* Header */}
          <View style={styles.header}>
            {logoDataUri ? <Image src={logoDataUri} style={styles.logo} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>{company?.company_name || 'Company'}</Text>
              {companyAddress ? <Text style={styles.companyMeta}>{companyAddress}</Text> : null}
              {company?.phone ? <Text style={styles.companyMeta}>Phone: {company.phone}</Text> : null}
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            <Text style={styles.title}>NOTE KEEPING</Text>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>NUMBER</Text>
              <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
            </View>
            <View style={styles.metaCell}>
              <Text style={styles.metaLabel}>DATE</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.invoice_date)}</Text>
            </View>
            <View style={[styles.metaCell, { borderRight: 0 }]}>
              <Text style={styles.metaLabel}>DUE</Text>
              <Text style={styles.metaValue}>{invoice.due_date ? formatDate(invoice.due_date) : '-'}</Text>
            </View>
          </View>

          {/* Customer */}
          {customer?.customer_name && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>PARTY</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold' }}>{customer.customer_name}</Text>
              {customer.billing_address_line1 && <Text>{customer.billing_address_line1}</Text>}
              {[customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).length > 0 && (
                <Text>{[customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ')}</Text>
              )}
              {customer.phone && <Text>Phone: {customer.phone}</Text>}
            </View>
          )}

          {/* Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ITEMS</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow}>
                <View style={[{ width: 28 }]}><Text style={styles.th}>#</Text></View>
                <View style={[{ flex: 3 }]}><Text style={styles.th}>Item</Text></View>
                <View style={[{ width: 60, textAlign: 'right' }]}><Text style={styles.th}>Qty</Text></View>
                <View style={[{ width: 80, textAlign: 'right' }]}><Text style={styles.th}>Rate</Text></View>
                <View style={[{ width: 90, textAlign: 'right' }]}><Text style={styles.th}>Amount</Text></View>
              </View>
              {items.map((item, i) => (
                <View key={item.id} style={i === 0 ? styles.tRowFirst : styles.tRow}>
                  <View style={[{ width: 28 }]}><Text style={styles.td}>{i + 1}</Text></View>
                  <View style={[{ flex: 3 }]}>
                    <Text style={styles.td}>{item.sku?.sku_name || item.description || '-'}</Text>
                  </View>
                  <View style={[{ width: 60 }]}>
                    <Text style={[styles.td, { textAlign: 'right' }]}>
                      {item.quantity} {item.sku?.unit_of_measure || ''}
                    </Text>
                  </View>
                  <View style={[{ width: 80 }]}>
                    <Text style={[styles.td, { textAlign: 'right' }]}>{fmt(item.rate)}</Text>
                  </View>
                  <View style={[{ width: 90 }]}>
                    <Text style={[styles.td, { textAlign: 'right' }]}>{fmt(item.amount)}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Words */}
          <View style={styles.words}>
            <Text style={{ fontSize: 8, color: COLORS.textLight }}>Amount in words</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{currencyToWords(Math.round(total))}</Text>
          </View>

          {/* Total */}
          <View style={styles.totals}>
            <Text style={styles.totalLabel}>TOTAL</Text>
            <Text style={styles.totalValue}>Rs. {fmt(total)}</Text>
          </View>

          {company?.invoice_footer ? (
            <View style={styles.footer}><Text>{company.invoice_footer}</Text></View>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}

export default NoteKeepingPDFDocument

/** Helper: trigger a browser download of the NK PDF. */
export async function downloadNoteKeepingPDF(invoice, company, { logoDataUri } = {}) {
  const blob = await pdf(
    React.createElement(NoteKeepingPDFDocument, { invoice, company, logoDataUri })
  ).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `NoteKeeping_${invoice.invoice_number}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}
