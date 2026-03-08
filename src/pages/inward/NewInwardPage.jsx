import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useVendors } from '../../hooks/useVendors.jsx'
import { useSKUs } from '../../hooks/useSKUs.jsx'
import { useAuth } from '../../hooks/useAuth.simple.jsx'
import { extractVendorInvoice, fileToBase64 } from '../../services/anthropic'
import { confirmInward, saveInwardSession } from '../../services/inwardService'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Modal } from '../../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import {
  Upload,
  FileText,
  Brain,
  CheckCircle,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
  Save
} from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = {
  SELECT_VENDOR: 1,
  UPLOAD_INVOICE: 2,
  AI_PROCESSING: 3,
  REVIEW_ITEMS: 4,
  SAVE_ALIASES: 5
}

const STEP_NAMES = {
  1: 'Select Vendor',
  2: 'Upload Invoice',
  3: 'AI Processing',
  4: 'Review Items',
  5: 'Save Aliases'
}

const units = [
  { value: 'PCS', label: 'PCS' },
  { value: 'KGS', label: 'KGS' },
  { value: 'MTR', label: 'MTR' },
  { value: 'SQM', label: 'SQM' },
  { value: 'BOX', label: 'BOX' },
  { value: 'LTR', label: 'LTR' }
]

function ConfidenceBadge({ confidence }) {
  if (confidence >= 80) {
    return <Badge variant="success">{confidence}%</Badge>
  } else if (confidence >= 50) {
    return <Badge variant="warning">{confidence}%</Badge>
  } else {
    return <Badge variant="danger">{confidence}%</Badge>
  }
}

export default function NewInwardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { vendors, isLoading: vendorsLoading } = useVendors()
  const { skus, isLoading: skusLoading } = useSKUs()

  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_VENDOR)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessages, setProcessingMessages] = useState([])
  const [aiResponse, setAiResponse] = useState(null)
  const [extractedItems, setExtractedItems] = useState([])
  const [invoiceInfo, setInvoiceInfo] = useState({
    invoice_no: '',
    invoice_date: '',
    notes: ''
  })
  const [sessionId, setSessionId] = useState(null)
  const [aliasesToSave, setAliasesToSave] = useState([])
  const [isConfirming, setIsConfirming] = useState(false)

  // Vendor options for dropdown
  const vendorOptions = vendors
    .filter(v => v.is_active)
    .map(v => ({
      value: v.id,
      label: `${v.vendor_code} - ${v.vendor_name}`
    }))

  // SKU options for dropdown
  const skuOptions = skus
    .filter(s => s.is_active)
    .map(s => ({
      value: s.id,
      label: `${s.sku_code} - ${s.sku_name}`,
      sku_name: s.sku_name,
      unit_of_measure: s.unit_of_measure
    }))

  const handleVendorSelect = (selectedOption) => {
    const vendor = vendors.find(v => v.id === selectedOption?.value)
    setSelectedVendor(vendor)
  }

  const handleNextStep = () => {
    if (currentStep === STEPS.SELECT_VENDOR && !selectedVendor) {
      toast.error('Please select a vendor')
      return
    }

    if (currentStep === STEPS.UPLOAD_INVOICE && !uploadedFile) {
      toast.error('Please upload an invoice')
      return
    }

    setCurrentStep(prev => prev + 1)
  }

  const handlePrevStep = () => {
    setCurrentStep(prev => prev - 1)
  }

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or PDF file')
      return
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)

    // Create preview
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setFilePreview(e.target.result)
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'application/pdf') {
      setFilePreview('pdf')
    }
  }, [])

  const handleAIProcessing = async () => {
    if (!uploadedFile || !selectedVendor) return

    setIsProcessing(true)
    setProcessingMessages([])

    try {
      // Step 1: Convert file to base64
      setProcessingMessages(prev => [...prev, 'Converting file to base64...'])
      const base64 = await fileToBase64(uploadedFile)

      // Step 2: Get vendor aliases
      setProcessingMessages(prev => [...prev, 'Loading vendor SKU aliases...'])
      // TODO: Fetch vendor aliases from vendor_sku_aliases table
      const vendorAliases = []

      // Step 3: Prepare SKU list for AI
      setProcessingMessages(prev => [...prev, 'Preparing SKU catalogue...'])
      const skuList = skus
        .filter(s => s.is_active)
        .map(s => ({
          id: s.id,
          sku_code: s.sku_code,
          sku_name: s.sku_name,
          category: s.category?.category_name,
          unit_of_measure: s.unit_of_measure
        }))

      // Step 4: Save inward session
      setProcessingMessages(prev => [...prev, 'Saving processing session...'])
      const session = await saveInwardSession({
        vendorId: selectedVendor.id,
        imageUrl: null, // We could upload to Supabase storage if needed
        aiResponse: null,
        extractedItems: null,
        userId: user.id
      })
      setSessionId(session.id)

      // Step 5: Send to Claude AI
      setProcessingMessages(prev => [...prev, 'Sending to Claude AI for analysis...'])
      const aiResult = await extractVendorInvoice(
        base64,
        uploadedFile.type,
        skuList,
        vendorAliases
      )

      setProcessingMessages(prev => [...prev, 'Processing AI response...'])
      setAiResponse(aiResult)

      // Step 6: Prepare extracted items for review
      const itemsForReview = aiResult.line_items.map((item, index) => ({
        id: index + 1,
        vendor_item_name: item.vendor_item_name,
        matched_sku_id: item.matched_sku_id,
        matched_sku_name: item.matched_sku_name,
        match_confidence: item.match_confidence,
        match_method: item.match_method,
        quantity_vendor_unit: item.quantity,
        vendor_unit: item.unit,
        quantity_internal: item.quantity, // Will be editable
        internal_unit: 'PCS', // Will be editable
        rate: item.rate,
        amount: item.amount,
        gst_rate: 18, // Default GST rate
        conversion_factor: 1
      }))

      setExtractedItems(itemsForReview)

      // Update invoice info
      setInvoiceInfo({
        invoice_no: aiResult.invoice_no || '',
        invoice_date: aiResult.invoice_date || '',
        notes: ''
      })

      setProcessingMessages(prev => [...prev, '✅ AI processing completed successfully!'])

      // Auto-advance to review step after 1 second
      setTimeout(() => {
        setCurrentStep(STEPS.REVIEW_ITEMS)
      }, 1000)

    } catch (error) {
      console.error('AI Processing failed:', error)
      toast.error(error.message || 'AI processing failed')
      setProcessingMessages(prev => [...prev, `❌ Error: ${error.message}`])
    } finally {
      setIsProcessing(false)
    }
  }

  const updateExtractedItem = (index, field, value) => {
    setExtractedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      // If SKU is changed, update related fields
      if (field === 'matched_sku_id') {
        const sku = skus.find(s => s.id === value)
        if (sku) {
          updated[index].matched_sku_name = sku.sku_name
          updated[index].internal_unit = sku.unit_of_measure
          updated[index].match_confidence = 100
          updated[index].match_method = 'manual'
        }
      }

      // Recalculate amount if quantity or rate changes
      if (field === 'quantity_vendor_unit' || field === 'rate') {
        updated[index].amount = updated[index].quantity_vendor_unit * updated[index].rate
      }

      return updated
    })
  }

  const removeExtractedItem = (index) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index))
  }

  const handleConfirmInward = async () => {
    // Validate that all items have matched SKUs
    const unmatched = extractedItems.filter(item => !item.matched_sku_id)
    if (unmatched.length > 0) {
      toast.error('Please assign SKUs to all items before confirming')
      return
    }

    setIsConfirming(true)

    try {
      // Prepare data for confirmation
      const inwardData = {
        vendorId: selectedVendor.id,
        items: extractedItems.map(item => ({
          sku_id: item.matched_sku_id,
          vendor_item_name: item.vendor_item_name,
          quantity_vendor_unit: item.quantity_vendor_unit,
          vendor_unit: item.vendor_unit,
          quantity_internal: item.quantity_internal,
          internal_unit: item.internal_unit,
          rate: item.rate,
          gst_rate: item.gst_rate,
          conversion_factor: item.conversion_factor
        })),
        invoiceNo: invoiceInfo.invoice_no,
        invoiceDate: invoiceInfo.invoice_date,
        notes: invoiceInfo.notes,
        sessionId: sessionId,
        userId: user.id
      }

      // Confirm inward
      const result = await confirmInward(inwardData)

      // Check for aliases to save
      const newAliases = extractedItems
        .filter(item => item.match_method !== 'alias' && item.match_confidence >= 50)
        .map(item => ({
          vendor_id: selectedVendor.id,
          vendor_item_name: item.vendor_item_name,
          sku_id: item.matched_sku_id,
          sku_name: item.matched_sku_name
        }))

      if (newAliases.length > 0) {
        setAliasesToSave(newAliases)
        setCurrentStep(STEPS.SAVE_ALIASES)
      } else {
        // No aliases to save, go directly to success
        toast.success(`Inward confirmed successfully! Reference: ${result.referenceNo}`)
        navigate('/inward/list')
      }

    } catch (error) {
      console.error('Inward confirmation failed:', error)
      toast.error(error.message || 'Failed to confirm inward')
    } finally {
      setIsConfirming(false)
    }
  }

  const canProceed = () => {
    switch (currentStep) {
      case STEPS.SELECT_VENDOR:
        return selectedVendor
      case STEPS.UPLOAD_INVOICE:
        return uploadedFile
      case STEPS.AI_PROCESSING:
        return aiResponse && extractedItems.length > 0
      case STEPS.REVIEW_ITEMS:
        return extractedItems.every(item => item.matched_sku_id)
      default:
        return false
    }
  }

  const totalAmount = extractedItems.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div>
      <PageHeader
        title="New Vendor Inward (AI-Powered)"
        description="Upload vendor invoice and let AI extract and match items to your catalogue"
      />

      {/* Progress Steps */}
      <Card className="mb-6">
        <CardContent className="py-4">
          {/* Desktop Progress Steps */}
          <div className="hidden md:flex items-center justify-between">
            {Object.entries(STEP_NAMES).map(([step, name]) => {
              const stepNum = parseInt(step)
              const isActive = stepNum === currentStep
              const isCompleted = stepNum < currentStep

              return (
                <div key={step} className="flex items-center">
                  <div className={`
                    flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-semibold
                    ${isCompleted ? 'bg-green-500 border-green-500 text-white' :
                      isActive ? 'bg-blue-500 border-blue-500 text-white' :
                      'border-gray-300 text-gray-400'}
                  `}>
                    {isCompleted ? <CheckCircle className="h-4 w-4" /> : stepNum}
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'font-semibold' : 'text-gray-500'}`}>
                    {name}
                  </span>
                  {stepNum < Object.keys(STEP_NAMES).length && (
                    <ChevronRight className="h-4 w-4 mx-4 text-gray-400" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile Progress Steps */}
          <div className="md:hidden">
            <div className="flex items-center justify-center mb-4">
              <span className="text-sm font-medium text-gray-600">
                Step {currentStep} of {Object.keys(STEP_NAMES).length}
              </span>
            </div>
            <div className="flex items-center justify-center">
              <div className={`
                flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold mr-3
                bg-blue-500 border-blue-500 text-white
              `}>
                {currentStep}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{STEP_NAMES[currentStep]}</div>
                <div className="text-sm text-gray-500">Current Step</div>
              </div>
            </div>
            {/* Progress Bar */}
            <div className="mt-4">
              <div className="bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / Object.keys(STEP_NAMES).length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step Content */}
      {currentStep === STEPS.SELECT_VENDOR && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Select Vendor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select
                label="Vendor"
                placeholder="Search and select a vendor..."
                options={vendorOptions}
                value={vendorOptions.find(option => option.value === selectedVendor?.id)}
                onChange={handleVendorSelect}
                isLoading={vendorsLoading}
              />

              {selectedVendor && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold">{selectedVendor.vendor_name}</h3>
                  <p className="text-sm text-gray-600">{selectedVendor.vendor_code}</p>
                  <p className="text-sm text-gray-600">{selectedVendor.city}, {selectedVendor.state}</p>
                  {selectedVendor.phone && (
                    <p className="text-sm text-gray-600">{selectedVendor.phone}</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === STEPS.UPLOAD_INVOICE && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Upload className="h-5 w-5 mr-2" />
              Upload Vendor Invoice
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop your invoice here or click to browse
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports JPG, PNG, PDF up to 10MB
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="invoice-upload"
                />
                <label
                  htmlFor="invoice-upload"
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-lg cursor-pointer hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  Browse Files
                </label>
              </div>

              {uploadedFile && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-green-600 mr-2" />
                      <div>
                        <p className="font-medium text-green-900">{uploadedFile.name}</p>
                        <p className="text-sm text-green-600">
                          {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setUploadedFile(null)
                        setFilePreview(null)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {filePreview && filePreview !== 'pdf' && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <img
                    src={filePreview}
                    alt="Invoice preview"
                    className="max-w-full h-64 object-contain border rounded-lg"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === STEPS.AI_PROCESSING && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              AI Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isProcessing ? (
                <div className="text-center py-8">
                  <Spinner size="lg" className="mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Processing Invoice...
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Claude AI is analyzing your invoice and matching items to your catalogue
                  </p>

                  <div className="max-w-md mx-auto text-left">
                    {processingMessages.map((message, index) => (
                      <div key={index} className="flex items-center mb-2">
                        <div className={`w-2 h-2 rounded-full mr-3 ${
                          message.includes('✅') ? 'bg-green-500' :
                          message.includes('❌') ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                        <span className="text-sm text-gray-700">{message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : aiResponse ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-900 mb-2">
                    Processing Complete!
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Found {extractedItems.length} items in the invoice
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {extractedItems.filter(item => item.match_confidence >= 80).length}
                      </div>
                      <div className="text-xs text-gray-500">High Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {extractedItems.filter(item => item.match_confidence >= 50 && item.match_confidence < 80).length}
                      </div>
                      <div className="text-xs text-gray-500">Medium Confidence</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {extractedItems.filter(item => item.match_confidence < 50).length}
                      </div>
                      <div className="text-xs text-gray-500">Needs Review</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Ready to Process
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Click "Process with AI" to analyze the uploaded invoice
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === STEPS.REVIEW_ITEMS && (
        <div className="space-y-6">
          {/* Invoice Info */}
          <Card>
            <CardHeader>
              <CardTitle>Invoice Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Invoice Number"
                  value={invoiceInfo.invoice_no}
                  onChange={(e) => setInvoiceInfo(prev => ({ ...prev, invoice_no: e.target.value }))}
                />
                <Input
                  label="Invoice Date"
                  type="date"
                  value={invoiceInfo.invoice_date}
                  onChange={(e) => setInvoiceInfo(prev => ({ ...prev, invoice_date: e.target.value }))}
                />
                <Input
                  label="Notes"
                  value={invoiceInfo.notes}
                  onChange={(e) => setInvoiceInfo(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items Table */}
          <Card>
            <CardHeader>
              <CardTitle>Review & Edit Items</CardTitle>
              <p className="text-sm text-gray-600">
                Review AI matches and edit as needed. All items must have a matched SKU.
              </p>
            </CardHeader>
            <CardContent>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableHeader>#</TableHeader>
                      <TableHeader>Vendor Item Name</TableHeader>
                      <TableHeader>Matched SKU</TableHeader>
                      <TableHeader>Confidence</TableHeader>
                      <TableHeader>Qty (Vendor)</TableHeader>
                      <TableHeader>Unit</TableHeader>
                      <TableHeader>Qty (Internal)</TableHeader>
                      <TableHeader>Rate (₹)</TableHeader>
                      <TableHeader>Amount (₹)</TableHeader>
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {extractedItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{item.vendor_item_name}</TableCell>
                        <TableCell>
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(opt => opt.value === item.matched_sku_id)}
                            onChange={(selected) => updateExtractedItem(index, 'matched_sku_id', selected?.value)}
                            placeholder="Select SKU..."
                            className="min-w-64"
                          />
                        </TableCell>
                        <TableCell>
                          <ConfidenceBadge confidence={item.match_confidence} />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity_vendor_unit}
                            onChange={(e) => updateExtractedItem(index, 'quantity_vendor_unit', parseFloat(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            options={units}
                            value={units.find(u => u.value === item.vendor_unit)}
                            onChange={(selected) => updateExtractedItem(index, 'vendor_unit', selected?.value)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity_internal}
                            onChange={(e) => updateExtractedItem(index, 'quantity_internal', parseFloat(e.target.value) || 0)}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateExtractedItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          ₹{item.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeExtractedItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-4">
                {extractedItems.map((item, index) => (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 mb-1">
                          Item #{index + 1}
                        </div>
                        <div className="text-sm font-medium text-gray-800">
                          {item.vendor_item_name}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <ConfidenceBadge confidence={item.match_confidence} />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeExtractedItem(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Matched SKU
                        </label>
                        <Select
                          options={skuOptions}
                          value={skuOptions.find(opt => opt.value === item.matched_sku_id)}
                          onChange={(selected) => updateExtractedItem(index, 'matched_sku_id', selected?.value)}
                          placeholder="Select SKU..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Qty (Vendor)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity_vendor_unit}
                            onChange={(e) => updateExtractedItem(index, 'quantity_vendor_unit', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Vendor Unit
                          </label>
                          <Select
                            options={units}
                            value={units.find(u => u.value === item.vendor_unit)}
                            onChange={(selected) => updateExtractedItem(index, 'vendor_unit', selected?.value)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Qty (Internal)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.quantity_internal}
                            onChange={(e) => updateExtractedItem(index, 'quantity_internal', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Rate (₹)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateExtractedItem(index, 'rate', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      </div>

                      <div className="pt-2 border-t border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Amount:</span>
                          <span className="text-lg font-semibold text-gray-900">
                            ₹{item.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {extractedItems.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        Total Amount: ₹{totalAmount.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {extractedItems.length} items
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {currentStep === STEPS.SAVE_ALIASES && aliasesToSave.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Save className="h-5 w-5 mr-2" />
              Save SKU Aliases
            </CardTitle>
            <p className="text-sm text-gray-600">
              Save these item mappings to improve future AI accuracy for this vendor
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aliasesToSave.map((alias, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{alias.vendor_item_name}</div>
                    <div className="text-sm text-gray-600">→ {alias.sku_name}</div>
                  </div>
                  <input
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4 text-blue-600"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between gap-3 sm:gap-0">
        <Button
          variant="outline"
          onClick={currentStep > 1 ? handlePrevStep : () => navigate('/inward/list')}
          disabled={isProcessing || isConfirming}
          className="order-2 sm:order-1 w-full sm:w-auto"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep > 1 ? 'Previous' : 'Cancel'}
        </Button>

        {currentStep < STEPS.SAVE_ALIASES ? (
          <Button
            onClick={currentStep === STEPS.AI_PROCESSING ? handleAIProcessing :
                     currentStep === STEPS.REVIEW_ITEMS ? handleConfirmInward : handleNextStep}
            disabled={!canProceed() || isProcessing || isConfirming}
            loading={isProcessing || isConfirming}
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            {currentStep === STEPS.AI_PROCESSING ? 'Process with AI' :
             currentStep === STEPS.REVIEW_ITEMS ? 'Confirm Inward' : 'Next'}
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => {
              toast.success('Inward completed successfully!')
              navigate('/inward/list')
            }}
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Complete
          </Button>
        )}
      </div>
    </div>
  )
}