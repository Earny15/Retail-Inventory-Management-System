import React, { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import PermissionGate from '../../components/shared/PermissionGate'
import { currencyToWords } from '../../utils/numberToWords'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import { downloadNoteKeepingPDF, blobToDataUri } from '../../pdf/NoteKeepingPDF'
import { logNoteKeepingActivity } from '../../services/noteKeepingService'
import { ArrowLeft, Calendar, Building, FileText, AlertTriangle, XCircle, Download, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'

const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2
}).format(amount || 0)

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function NoteKeepingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isDownloading, setIsDownloading] = useState(false)

  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase.from('companies').select('*').order('created_at', { ascending: false }).limit(1).single()
      if (error) throw error
      return data
    }
  })

  const { data: invoice, isLoading, error } = useQuery({
    queryKey: ['nk-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_keeping_invoices')
        .select(`
          *,
          customers(*),
          note_keeping_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code))
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
    enabled: !!id
  })

  const { data: activityLog = [] } = useQuery({
    queryKey: ['nk-activity', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('note_keeping_activity_logs')
        .select('*')
        .eq('invoice_id', id)
        .order('created_at', { ascending: false })
      if (error) { console.warn(error); return [] }
      return data || []
    },
    enabled: !!id
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelReason.trim()) throw new Error('Cancellation reason is required')
      const { error } = await supabase
        .from('note_keeping_invoices')
        .update({ status: 'CANCELLED', notes: cancelReason })
        .eq('id', id)
      if (error) throw error
      await logNoteKeepingActivity({ invoiceId: id, action: 'cancelled', details: { reason: cancelReason }, actor: user })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nk-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['nk-invoices'] })
      queryClient.invalidateQueries({ queryKey: ['nk-activity', id] })
      toast.success('Note Keeping cancelled')
      setCancelOpen(false)
      setCancelReason('')
    },
    onError: (err) => toast.error('Failed to cancel: ' + err.message)
  })

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      let logoDataUri = null
      if (company?.logo_url) {
        try {
          const urlParts = company.logo_url.split('/company-logos/')
          if (urlParts[1]) {
            const filePath = decodeURIComponent(urlParts[1])
            const { data: logoBlob } = await supabase.storage.from('company-logos').download(filePath)
            if (logoBlob) logoDataUri = await blobToDataUri(logoBlob)
          }
        } catch (e) { console.warn('Logo fetch failed:', e) }
      }
      await downloadNoteKeepingPDF(invoice, company, { logoDataUri })
      toast.success('PDF downloaded')
    } catch (e) {
      toast.error('PDF generation failed: ' + e.message)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) return <div className="flex items-center justify-center min-h-96"><Spinner size="xl" /></div>
  if (error || !invoice) {
    return (
      <div>
        <PageHeader title="Note Keeping Not Found" description="The requested entry could not be loaded" />
        <Card><CardContent className="text-center py-8">
          <p className="text-red-600 mb-4">{error?.message || 'Not found'}</p>
          <Button onClick={() => navigate('/note-keeping')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
        </CardContent></Card>
      </div>
    )
  }

  const isActive = invoice.status === 'ACTIVE'
  const isCancelled = invoice.status === 'CANCELLED'
  const items = invoice.note_keeping_invoice_items || []

  return (
    <div>
      <PageHeader
        title={`Note Keeping ${invoice.invoice_number}`}
        description={`Created on ${formatDate(invoice.invoice_date)}`}
        actions={
          <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:flex-wrap">
            <Button variant="outline" size="sm" onClick={() => navigate('/note-keeping')}>
              <ArrowLeft className="h-4 w-4 sm:mr-2" />
              <span>Back</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={isDownloading}>
              <Download className="h-4 w-4 mr-1.5" />
              <span>{isDownloading ? 'Generating...' : 'PDF'}</span>
            </Button>
            <PermissionGate module="customer_invoice" action="edit">
              <Button variant="outline" size="sm" onClick={() => navigate(`/note-keeping/${invoice.id}/edit`)}>
                <Pencil className="h-4 w-4 mr-1.5" />
                <span>Edit</span>
              </Button>
            </PermissionGate>
            {isActive && (
              <PermissionGate module="customer_invoice" action="edit">
                <Button
                  variant="outline" size="sm"
                  className="text-red-600 hover:text-red-800 border-red-300 col-span-2 sm:col-span-1"
                  onClick={() => setCancelOpen(true)}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  <span>Cancel</span>
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      {isCancelled && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-800 flex items-center gap-2">
              CANCELLED <Badge variant="danger">CANCELLED</Badge>
            </div>
            {invoice.notes && <p className="text-sm text-red-700 mt-1">Reason: {invoice.notes}</p>}
          </div>
        </div>
      )}

      {invoice.converted_from_invoice_id && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-3">
          <FileText className="h-5 w-5 text-blue-600 flex-shrink-0" />
          <div className="text-sm">
            <span className="text-blue-900">Converted from customer invoice </span>
            <Link to={`/invoices/${invoice.converted_from_invoice_id}`} className="font-semibold text-blue-700 hover:underline">
              {invoice.converted_from_invoice_number}
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="flex items-center"><FileText className="h-5 w-5 mr-2" />Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between"><span className="text-sm text-gray-600">Number:</span><span className="font-medium">{invoice.invoice_number}</span></div>
              <div className="flex justify-between"><span className="text-sm text-gray-600">Date:</span><span className="flex items-center"><Calendar className="h-4 w-4 mr-1 text-gray-400" />{formatDate(invoice.invoice_date)}</span></div>
              {invoice.due_date && <div className="flex justify-between"><span className="text-sm text-gray-600">Due Date:</span><span>{formatDate(invoice.due_date)}</span></div>}
              <div className="flex justify-between"><span className="text-sm text-gray-600">Status:</span>{isActive ? <Badge variant="info">ACTIVE</Badge> : <Badge variant="danger">CANCELLED</Badge>}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center"><Building className="h-5 w-5 mr-2" />Party</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {invoice.customers ? (
                <>
                  <div><div className="text-sm text-gray-600">Name</div><div className="font-medium">{invoice.customers.customer_name}</div></div>
                  <div><div className="text-sm text-gray-600">Location</div><div>{invoice.customers.billing_city}, {invoice.customers.billing_state}</div></div>
                  {invoice.customers.phone && <div><div className="text-sm text-gray-600">Phone</div><div>{invoice.customers.phone}</div></div>}
                </>
              ) : <p className="text-gray-500">No customer linked (memo entry)</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Line Items ({items.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Rate</TableHeader>
                    <TableHeader>Amount</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={item.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell><div className="font-medium">{item.sku?.sku_name || '-'}</div></TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>{item.sku?.unit_of_measure || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.rate)}</TableCell>
                      <TableCell className="font-semibold">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="lg:hidden space-y-3">
              {items.map((item, i) => (
                <div key={item.id} className={`rounded-xl p-4 space-y-2 border ${i % 2 === 0 ? 'bg-white border-gray-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-gray-900">{item.sku?.sku_name || '-'}</div>
                    <span className="text-xs font-medium text-gray-400">#{i + 1}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500 text-xs block">Qty</span><span className="font-medium">{item.quantity} {item.sku?.unit_of_measure || ''}</span></div>
                    <div><span className="text-gray-500 text-xs block">Rate</span><span className="font-medium">{formatCurrency(item.rate)}</span></div>
                    <div><span className="text-gray-500 text-xs block">Amount</span><span className="font-medium text-navy-600">{formatCurrency(item.amount)}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                <p className="text-sm font-medium">{currencyToWords(Math.round(invoice.total_amount || 0))}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-6 flex justify-between text-lg font-bold border-t">
                <span>Total:</span>
                <span className="text-navy-600">{formatCurrency(invoice.total_amount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center"><FileText className="h-5 w-5 mr-2" />Activity Log</CardTitle></CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-gray-500">No activity yet.</p>
            ) : (
              <ol className="relative border-l border-gray-200 ml-2 space-y-4">
                {activityLog.map(entry => {
                  const badge =
                    entry.action === 'created' ? { label: 'CREATED', cls: 'bg-emerald-100 text-emerald-700' } :
                    entry.action === 'updated' ? { label: 'EDITED', cls: 'bg-blue-100 text-blue-700' } :
                    entry.action === 'cancelled' ? { label: 'CANCELLED', cls: 'bg-red-100 text-red-700' } :
                    entry.action === 'converted_from_customer_invoice' ? { label: 'CONVERTED', cls: 'bg-purple-100 text-purple-700' } :
                    { label: entry.action?.toUpperCase() || 'ACTION', cls: 'bg-gray-100 text-gray-700' }
                  const d = entry.details || {}
                  const when = new Date(entry.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  return (
                    <li key={entry.id} className="ml-4">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-gray-300 border border-white" />
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                        <span className="text-xs text-gray-500">{when}</span>
                        {entry.actor_name && <span className="text-xs text-gray-500">by {entry.actor_name}</span>}
                      </div>
                      <div className="text-sm text-gray-700 space-y-1">
                        {entry.action === 'created' && (
                          <p>Created with <strong>{d.items_count || 0}</strong> item{d.items_count === 1 ? '' : 's'} · Total <strong>{formatCurrency(d.total)}</strong></p>
                        )}
                        {entry.action === 'updated' && d.next_total !== undefined && (
                          <p>Updated. New total <strong>{formatCurrency(d.next_total)}</strong></p>
                        )}
                        {entry.action === 'cancelled' && <p>Cancelled{d.reason ? ` — ${d.reason}` : ''}</p>}
                        {entry.action === 'converted_from_customer_invoice' && (
                          <p>
                            Converted from customer invoice{' '}
                            {d.source_invoice_id ? (
                              <Link to={`/invoices/${d.source_invoice_id}`} className="text-blue-700 hover:underline font-semibold">
                                {d.source_invoice_number}
                              </Link>
                            ) : (
                              <strong>{d.source_invoice_number}</strong>
                            )}
                            {d.customer_series_reset !== undefined && (
                              <span className="text-gray-500"> · customer series reset to {d.customer_series_reset}</span>
                            )}
                          </p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Note Keeping" size="md">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              Cancelling this note keeping marks it as CANCELLED. It won't affect any inventory (note-keeping entries never move stock).
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason <span className="text-red-500">*</span></label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-400"
              required
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelMutation.isPending}>Close</Button>
            <Button variant="danger" onClick={() => cancelMutation.mutate()} disabled={!cancelReason.trim() || cancelMutation.isPending}>
              {cancelMutation.isPending ? <Spinner size="sm" className="mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
