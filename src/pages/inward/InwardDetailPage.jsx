import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usePermissions } from '../../hooks/usePermissions.jsx'
import { useAuth } from '../../hooks/useAuth.simple.jsx'
import { getInwardDetails, reverseInward } from '../../services/inwardService'
import { PermissionGate } from '../../components/shared/PermissionGate'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import { Spinner } from '../../components/ui/Spinner'
import {
  ArrowLeft,
  RefreshCcw,
  FileText,
  Calendar,
  Package,
  User,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

function StatusBadge({ status }) {
  const statusConfig = {
    'CONFIRMED': { variant: 'success', label: 'Confirmed', icon: CheckCircle },
    'REVERSED': { variant: 'danger', label: 'Reversed', icon: RefreshCcw },
    'PROCESSING': { variant: 'warning', label: 'Processing', icon: Package },
    'FAILED': { variant: 'danger', label: 'Failed', icon: AlertTriangle }
  }

  const config = statusConfig[status] || { variant: 'default', label: status, icon: FileText }
  const IconComponent = config.icon

  return (
    <div className="flex items-center">
      <IconComponent className="h-4 w-4 mr-1" />
      <Badge variant={config.variant}>{config.label}</Badge>
    </div>
  )
}

export default function InwardDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canEdit } = usePermissions()
  const queryClient = useQueryClient()

  const [isReversalModalOpen, setIsReversalModalOpen] = useState(false)
  const [reversalReason, setReversalReason] = useState('')

  // Fetch inward details
  const {
    data: inward,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['inward-detail', id],
    queryFn: () => getInwardDetails(id),
    enabled: !!id
  })

  // Reverse inward mutation
  const reversalMutation = useMutation({
    mutationFn: () => reverseInward(id, reversalReason, user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inward-detail', id] })
      queryClient.invalidateQueries({ queryKey: ['inward-list'] })
      toast.success('Inward reversed successfully')
      setIsReversalModalOpen(false)
      setReversalReason('')
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to reverse inward')
    }
  })

  const handleReverse = () => {
    if (!reversalReason.trim()) {
      toast.error('Please provide a reason for reversal')
      return
    }
    reversalMutation.mutate()
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Inward Details"
          description="View inward transaction details"
        />
        <div className="flex items-center justify-center py-12">
          <Spinner size="xl" />
        </div>
      </div>
    )
  }

  if (error || !inward) {
    return (
      <div>
        <PageHeader
          title="Inward Details"
          description="View inward transaction details"
        />
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-red-600 mb-4">Failed to load inward details</p>
            <div className="space-x-2">
              <Button onClick={() => refetch()} variant="outline">
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <Button onClick={() => navigate('/inward/list')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to List
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const canReverseInward = inward.status === 'CONFIRMED' &&
                           inward.transaction_type === 'INWARD' &&
                           canEdit('vendor_inward')

  return (
    <div>
      <PageHeader
        title={`Inward: ${inward.reference_no}`}
        description={`${inward.transaction_type} transaction details`}
        action={
          <div className="flex space-x-2">
            <Button
              variant="outline"
              onClick={() => navigate('/inward/list')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </Button>
            {canReverseInward && (
              <PermissionGate module="vendor_inward" action="edit">
                <Button
                  variant="danger"
                  onClick={() => setIsReversalModalOpen(true)}
                >
                  <RefreshCcw className="h-4 w-4 mr-2" />
                  Reverse Inward
                </Button>
              </PermissionGate>
            )}
          </div>
        }
      />

      <div className="space-y-6">
        {/* Header Information */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Transaction Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Transaction Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Reference Number</div>
                <div className="font-medium">{inward.reference_no}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Transaction Type</div>
                <div className="font-medium">{inward.transaction_type.replace('_', ' ')}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Date</div>
                <div className="flex items-center">
                  <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                  {formatDate(inward.transaction_date)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <StatusBadge status={inward.status} />
              </div>
              <div>
                <div className="text-sm text-gray-600">Created</div>
                <div className="text-sm">{formatDateTime(inward.created_at)}</div>
              </div>
            </CardContent>
          </Card>

          {/* Vendor Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 mr-2" />
                Vendor Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {inward.vendors ? (
                <>
                  <div>
                    <div className="text-sm text-gray-600">Vendor Name</div>
                    <div className="font-medium">{inward.vendors.vendor_name}</div>
                  </div>
                  {inward.vendors.contact_person && (
                    <div>
                      <div className="text-sm text-gray-600">Contact Person</div>
                      <div>{inward.vendors.contact_person}</div>
                    </div>
                  )}
                  {inward.vendors.phone && (
                    <div className="flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{inward.vendors.phone}</span>
                    </div>
                  )}
                  {inward.vendors.email && (
                    <div className="flex items-center">
                      <Mail className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{inward.vendors.email}</span>
                    </div>
                  )}
                  {(inward.vendors.city || inward.vendors.state) && (
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                      <span>{[inward.vendors.city, inward.vendors.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-gray-500">Vendor information not available</div>
              )}
            </CardContent>
          </Card>

          {/* Amount Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="h-5 w-5 mr-2" />
                Amount Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Subtotal</div>
                <div className="font-medium">{formatCurrency(inward.subtotal || 0)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">GST Amount</div>
                <div>{formatCurrency(inward.total_igst || 0)}</div>
              </div>
              <div className="pt-2 border-t">
                <div className="text-sm text-gray-600">Grand Total</div>
                <div className={`text-xl font-bold ${
                  inward.grand_total < 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatCurrency(Math.abs(inward.grand_total || 0))}
                  {inward.grand_total < 0 && (
                    <span className="text-sm block text-red-500">
                      (Reversed Amount)
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Items Count</div>
                <div>{inward.transaction_items?.length || 0} items</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reversal Information */}
        {(inward.status === 'REVERSED' || inward.reversal_reason) && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Reversal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inward.reversal_reason && (
                <div>
                  <div className="text-sm text-red-600 font-medium">Reason for Reversal:</div>
                  <div className="text-red-700">{inward.reversal_reason}</div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Parent Transaction Info */}
        {inward.parent_transaction_id && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-700">
                Reversal Transaction
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700">
                This is a reversal transaction. It reverses the effects of the original inward transaction.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {inward.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap">{inward.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>Line Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {inward.transaction_items && inward.transaction_items.length > 0 ? (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU</TableHeader>
                    <TableHeader>Vendor Item Name</TableHeader>
                    <TableHeader>Qty (Vendor)</TableHeader>
                    <TableHeader>Qty (Internal)</TableHeader>
                    <TableHeader>Rate (₹)</TableHeader>
                    <TableHeader>GST Rate</TableHeader>
                    <TableHeader>Taxable Amount (₹)</TableHeader>
                    <TableHeader>GST Amount (₹)</TableHeader>
                    <TableHeader>Total (₹)</TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {inward.transaction_items.map((item, index) => (
                    <TableRow key={item.id}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {item.skus?.sku_code || 'N/A'}
                          </div>
                          <div className="text-sm text-gray-600">
                            {item.skus?.sku_name || 'Unknown SKU'}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {item.vendor_item_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div>{Math.abs(item.quantity_vendor_unit || 0)}</div>
                          <div className="text-xs text-gray-500">{item.vendor_unit}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className={item.quantity < 0 ? 'text-red-600' : ''}>
                            {Math.abs(item.quantity || 0)}
                          </div>
                          <div className="text-xs text-gray-500">{item.unit}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {formatCurrency(item.buying_cost_per_unit || 0)}
                      </TableCell>
                      <TableCell>
                        {item.gst_rate || 0}%
                      </TableCell>
                      <TableCell>
                        <span className={item.taxable_amount < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(Math.abs(item.taxable_amount || 0))}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={item.igst_amount < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(Math.abs(item.igst_amount || 0))}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className={item.total_amount < 0 ? 'text-red-600' : ''}>
                          {formatCurrency(Math.abs(item.total_amount || 0))}
                          {item.total_amount < 0 && (
                            <span className="text-xs block text-red-500">(Reversed)</span>
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No line items available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reversal Modal */}
      <Modal
        isOpen={isReversalModalOpen}
        onClose={() => setIsReversalModalOpen(false)}
        title="Reverse Inward Transaction"
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-yellow-800 mb-1">Warning</div>
                <div className="text-yellow-700">
                  Reversing this inward will:
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>Create a reversal transaction</li>
                    <li>Reduce inventory quantities for all items</li>
                    <li>Mark the original transaction as REVERSED</li>
                    <li>This action cannot be undone</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Input
            label="Reason for Reversal"
            placeholder="Enter the reason for reversing this inward transaction..."
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
            required
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setIsReversalModalOpen(false)}
              disabled={reversalMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReverse}
              loading={reversalMutation.isPending}
              disabled={!reversalReason.trim()}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Confirm Reversal
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}