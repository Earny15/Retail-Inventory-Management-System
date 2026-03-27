import React, { useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { ArrowLeft, MessageCircle } from 'lucide-react'

const formatDateTime = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

const statusBadge = (status) => {
  switch (status) {
    case 'queued': return <Badge variant="warning">Queued</Badge>
    case 'sent': return <Badge variant="info">Sent</Badge>
    case 'delivered': return <Badge variant="success">Delivered</Badge>
    case 'read': return <Badge variant="success">Read</Badge>
    case 'failed': return <Badge variant="danger">Failed</Badge>
    case 'undelivered': return <Badge variant="danger">Undelivered</Badge>
    case 'parse_error': return <Badge variant="danger">Parse Error</Badge>
    default: return <Badge>{status || 'Unknown'}</Badge>
  }
}

export default function WhatsAppLogsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const invoiceFilter = searchParams.get('invoice')

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['whatsapp-logs', invoiceFilter],
    queryFn: async () => {
      let query = supabase
        .from('whatsapp_message_logs')
        .select('*')
        .order('created_at', { ascending: false })

      if (invoiceFilter) {
        query = query.eq('invoice_id', invoiceFilter)
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  const title = invoiceFilter
    ? `WhatsApp Logs - ${logs[0]?.invoice_number || 'Invoice'}`
    : 'WhatsApp Message Logs'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={title}
        description={`${logs.length} message(s)`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            {invoiceFilter && (
              <Button variant="outline" onClick={() => navigate('/whatsapp-logs')}>
                View All Logs
              </Button>
            )}
          </div>
        }
      />

      {/* Desktop Table */}
      <div className="hidden lg:block">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader>Sent At</TableHeader>
                  <TableHeader>Invoice</TableHeader>
                  <TableHeader>Customer</TableHeader>
                  <TableHeader>Phone</TableHeader>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Message SID</TableHeader>
                  <TableHeader>Error</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No WhatsApp messages sent yet
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </TableCell>
                      <TableCell>
                        {log.invoice_id ? (
                          <Link
                            to={`/invoices/${log.invoice_id}`}
                            className="text-primary-600 font-medium hover:underline"
                          >
                            {log.invoice_number}
                          </Link>
                        ) : (
                          log.invoice_number || '-'
                        )}
                      </TableCell>
                      <TableCell>{log.customer_name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">{log.to_phone}</TableCell>
                      <TableCell>{statusBadge(log.twilio_status)}</TableCell>
                      <TableCell>
                        <span className="text-xs font-mono text-gray-500">
                          {log.twilio_message_sid ? log.twilio_message_sid.slice(0, 15) + '...' : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.twilio_error_code ? (
                          <span className="text-xs text-red-600">
                            {log.twilio_error_code}: {log.twilio_error_message || ''}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="lg:hidden space-y-3">
        {logs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8 text-gray-500">
              No WhatsApp messages sent yet
            </CardContent>
          </Card>
        ) : (
          logs.map(log => (
            <Card key={log.id}>
              <CardContent className="py-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {log.invoice_id ? (
                        <Link to={`/invoices/${log.invoice_id}`} className="text-primary-600 hover:underline">
                          {log.invoice_number}
                        </Link>
                      ) : log.invoice_number}
                    </div>
                    <div className="text-xs text-gray-500">{formatDateTime(log.created_at)}</div>
                  </div>
                  {statusBadge(log.twilio_status)}
                </div>
                <div className="text-sm">{log.customer_name || '-'}</div>
                <div className="text-sm font-mono text-gray-600">{log.to_phone}</div>
                {log.twilio_error_code && (
                  <div className="text-xs text-red-600 bg-red-50 rounded p-2">
                    Error {log.twilio_error_code}: {log.twilio_error_message}
                  </div>
                )}
                {log.twilio_message_sid && (
                  <div className="text-xs text-gray-400 font-mono">{log.twilio_message_sid}</div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
