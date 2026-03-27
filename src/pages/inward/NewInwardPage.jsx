import React, { useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { extractVendorInvoice, fileToBase64 } from '../../services/anthropic'
import { confirmInward } from '../../services/inwardService'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import Input from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import {
  Upload,
  FileText,
  Brain,
  CheckCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Save,
  Trash2,
  Camera
} from 'lucide-react'
import toast from 'react-hot-toast'

const STEPS = {
  SELECT_VENDOR: 1,
  UPLOAD_INVOICE: 2,
  AI_PROCESSING: 3,
  REVIEW_ITEMS: 4,
  CONFIRM: 5,
  SAVE_ALIASES: 6
}

const STEP_NAMES = {
  1: 'Select Vendor',
  2: 'Upload Invoice',
  3: 'AI Processing',
  4: 'Review Items',
  5: 'Confirm',
  6: 'Save Aliases'
}

const UNIT_OPTIONS = [
  { value: 'PCS', label: 'PCS' },
  { value: 'KGS', label: 'KGS' },
  { value: 'MTR', label: 'MTR' },
  { value: 'SQM', label: 'SQM' },
  { value: 'BOX', label: 'BOX' },
  { value: 'LTR', label: 'LTR' }
]

function ConfidenceBadge({ confidence }) {
  if (confidence >= 80) return <Badge variant="success">{confidence}%</Badge>
  if (confidence >= 50) return <Badge variant="warning">{confidence}%</Badge>
  return <Badge variant="danger">{confidence}%</Badge>
}

function StepIndicator({ currentStep }) {
  return (
    <Card className="mb-6">
      <CardContent className="py-4">
        {/* Desktop */}
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
                    isActive ? 'bg-blue-500 border-navy-500 text-white' :
                    'border-gray-300 text-gray-400'}
                `}>
                  {isCompleted ? <CheckCircle className="h-4 w-4" /> : stepNum}
                </div>
                <span className={`ml-2 text-sm ${isActive ? 'font-semibold' : 'text-gray-500'}`}>
                  {name}
                </span>
                {stepNum < Object.keys(STEP_NAMES).length && (
                  <ChevronRight className="h-4 w-4 mx-3 text-gray-400" />
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <div className="flex items-center justify-center mb-3">
            <span className="text-sm font-medium text-gray-600">
              Step {currentStep} of {Object.keys(STEP_NAMES).length}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 text-sm font-semibold bg-blue-500 border-navy-500 text-white mr-3">
              {currentStep}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{STEP_NAMES[currentStep]}</div>
            </div>
          </div>
          <div className="mt-3 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / Object.keys(STEP_NAMES).length) * 100}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function NewInwardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

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
  const [isConfirming, setIsConfirming] = useState(false)
  const [aliasesToSave, setAliasesToSave] = useState([])
  const [aliasChecked, setAliasChecked] = useState({})

  // Fetch vendors
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('vendor_name')
      if (error) throw error
      return data
    }
  })

  // Fetch SKUs
  const { data: skus = [], isLoading: skusLoading } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('*')
        .eq('is_active', true)
        .order('sku_name')
      if (error) throw error
      return data
    }
  })

  const vendorOptions = useMemo(() =>
    vendors.map(v => ({
      value: v.id,
      label: `${v.vendor_code} - ${v.vendor_name}`
    })),
    [vendors]
  )

  const skuOptions = useMemo(() =>
    skus.map(s => ({
      value: s.id,
      label: `${s.sku_code} - ${s.sku_name}`,
      sku_name: s.sku_name,
      unit_of_measure: s.unit_of_measure
    })),
    [skus]
  )

  // File upload handlers
  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a JPG, PNG, or WebP image')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploadedFile(file)

    const reader = new FileReader()
    reader.onload = (e) => setFilePreview(e.target.result)
    reader.readAsDataURL(file)
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload({ target: { files: [file] } })
    }
  }, [handleFileUpload])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
  }, [])

  // AI Processing
  const handleAIProcessing = async () => {
    if (!uploadedFile || !selectedVendor) return

    setIsProcessing(true)
    setProcessingMessages([])

    try {
      setProcessingMessages(prev => [...prev, 'Converting file to base64...'])
      const base64 = await fileToBase64(uploadedFile)

      // Fetch vendor aliases
      setProcessingMessages(prev => [...prev, 'Loading vendor SKU aliases...'])
      const { data: vendorAliases = [] } = await supabase
        .from('vendor_sku_aliases')
        .select('*')
        .eq('vendor_id', selectedVendor.id)

      setProcessingMessages(prev => [...prev, 'Preparing SKU catalogue...'])
      const skuList = skus.map(s => ({
        id: s.id,
        sku_code: s.sku_code,
        sku_name: s.sku_name,
        category: s.category_name,
        unit_of_measure: s.unit_of_measure
      }))

      setProcessingMessages(prev => [...prev, 'Sending to Claude AI for analysis...'])
      const aiResult = await extractVendorInvoice(
        base64,
        uploadedFile.type,
        skuList,
        vendorAliases
      )

      setProcessingMessages(prev => [...prev, 'Processing AI response...'])
      setAiResponse(aiResult)

      const itemsForReview = (aiResult.line_items || []).map((item, index) => ({
        id: index + 1,
        vendor_item_name: item.vendor_item_name,
        matched_sku_id: item.matched_sku_id,
        matched_sku_name: item.matched_sku_name,
        match_confidence: item.match_confidence || 0,
        match_method: item.match_method || 'none',
        quantity_vendor_unit: item.quantity || 0,
        vendor_unit: item.unit || 'PCS',
        quantity_internal: item.quantity || 0,
        rate: item.rate || 0,
        amount: item.amount || 0,
        gst_rate: 18
      }))

      setExtractedItems(itemsForReview)
      setInvoiceInfo({
        invoice_no: aiResult.invoice_no || '',
        invoice_date: aiResult.invoice_date || '',
        notes: ''
      })

      setProcessingMessages(prev => [...prev, 'AI processing completed successfully!'])

      setTimeout(() => {
        setCurrentStep(STEPS.REVIEW_ITEMS)
      }, 1000)

    } catch (error) {
      console.error('AI Processing failed:', error)
      toast.error(error.message || 'AI processing failed')
      setProcessingMessages(prev => [...prev, `Error: ${error.message}`])
    } finally {
      setIsProcessing(false)
    }
  }

  // Item editing
  const updateExtractedItem = (index, field, value) => {
    setExtractedItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }

      if (field === 'matched_sku_id') {
        const sku = skus.find(s => s.id === value)
        if (sku) {
          updated[index].matched_sku_name = sku.sku_name
          updated[index].match_confidence = 100
          updated[index].match_method = 'manual'
        }
      }

      if (field === 'quantity_vendor_unit' || field === 'rate') {
        updated[index].amount = (updated[index].quantity_vendor_unit || 0) * (updated[index].rate || 0)
      }

      return updated
    })
  }

  const removeExtractedItem = (index) => {
    setExtractedItems(prev => prev.filter((_, i) => i !== index))
  }

  // Confirm inward (Step 5)
  const handleConfirmInward = async () => {
    const unmatched = extractedItems.filter(item => !item.matched_sku_id)
    if (unmatched.length > 0) {
      toast.error('Please assign SKUs to all items before confirming')
      return
    }

    setIsConfirming(true)

    try {
      const inwardData = {
        vendorId: selectedVendor.id,
        items: extractedItems.map(item => ({
          sku_id: item.matched_sku_id,
          vendor_item_name: item.vendor_item_name,
          quantity: item.quantity_internal || item.quantity_vendor_unit,
          unit: item.vendor_unit,
          rate: item.rate,
          gst_rate: item.gst_rate
        })),
        invoiceNo: invoiceInfo.invoice_no,
        invoiceDate: invoiceInfo.invoice_date,
        notes: invoiceInfo.notes,
        userId: user?.id
      }

      const result = await confirmInward(inwardData)

      // Check for aliases to save
      const newAliases = extractedItems
        .filter(item => item.match_method !== 'alias' && item.matched_sku_id)
        .map(item => ({
          vendor_id: selectedVendor.id,
          vendor_item_name: item.vendor_item_name,
          sku_id: item.matched_sku_id,
          sku_name: item.matched_sku_name
        }))

      if (newAliases.length > 0) {
        setAliasesToSave(newAliases)
        const checked = {}
        newAliases.forEach((_, i) => { checked[i] = true })
        setAliasChecked(checked)
        toast.success(`Inward confirmed! Reference: ${result.inwardNumber}`)
        setCurrentStep(STEPS.SAVE_ALIASES)
      } else {
        toast.success(`Inward confirmed! Reference: ${result.inwardNumber}`)
        navigate('/inward')
      }

    } catch (error) {
      console.error('Inward confirmation failed:', error)
      toast.error(error.message || 'Failed to confirm inward')
    } finally {
      setIsConfirming(false)
    }
  }

  // Save aliases
  const handleSaveAliases = async () => {
    const selectedAliases = aliasesToSave.filter((_, i) => aliasChecked[i])

    if (selectedAliases.length > 0) {
      try {
        const { error } = await supabase
          .from('vendor_sku_aliases')
          .insert(selectedAliases.map(a => ({
            vendor_id: a.vendor_id,
            vendor_item_name: a.vendor_item_name,
            sku_id: a.sku_id
          })))

        if (error) throw error
        toast.success(`${selectedAliases.length} alias(es) saved`)
      } catch (error) {
        console.error('Failed to save aliases:', error)
        toast.error('Failed to save aliases: ' + error.message)
      }
    }

    navigate('/inward')
  }

  const totalAmount = extractedItems.reduce((sum, item) => sum + (item.amount || 0), 0)

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

  return (
    <div>
      <PageHeader
        title="New Vendor Inward (AI-Powered)"
        description="Upload vendor invoice and let AI extract and match items to your catalogue"
      />

      <StepIndicator currentStep={currentStep} />

      {/* Step 1: Select Vendor */}
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
                value={vendorOptions.find(o => o.value === selectedVendor?.id) || null}
                onChange={(selected) => {
                  const vendor = vendors.find(v => v.id === selected?.value)
                  setSelectedVendor(vendor || null)
                }}
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

      {/* Step 2: Upload Invoice */}
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
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 sm:p-8 text-center hover:border-blue-400 transition-colors"
              >
                <Upload className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-gray-400 mb-3 sm:mb-4" />
                <p className="text-base sm:text-lg font-medium text-gray-900 mb-2">
                  Upload or capture your invoice
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supports JPG, PNG, WebP up to 10MB
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="invoice-upload"
                />
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="invoice-camera"
                />
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <label
                    htmlFor="invoice-upload"
                    className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-navy-700 rounded-lg cursor-pointer hover:bg-blue-700 transition-colors w-full sm:w-auto justify-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Browse Files
                  </label>
                  <label
                    htmlFor="invoice-camera"
                    className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-navy-600 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors w-full sm:w-auto justify-center"
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Take Photo
                  </label>
                </div>
              </div>

              {uploadedFile && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <FileText className="h-5 w-5 text-green-600 mr-2 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-green-900 truncate">{uploadedFile.name}</p>
                        <p className="text-sm text-green-600">
                          {(uploadedFile.size / 1024 / 1024).toFixed(1)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setUploadedFile(null); setFilePreview(null) }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {filePreview && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
                  <img
                    src={filePreview}
                    alt="Invoice preview"
                    className="max-w-full max-h-64 object-contain border rounded-lg mx-auto"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Processing */}
      {currentStep === STEPS.AI_PROCESSING && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Brain className="h-5 w-5 mr-2" />
              AI Processing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isProcessing ? (
              <div className="text-center py-8">
                <Spinner size="lg" className="mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Invoice...</h3>
                <p className="text-gray-600 mb-6">
                  Claude AI is analyzing your invoice and matching items to your catalogue
                </p>
                <div className="max-w-md mx-auto text-left">
                  {processingMessages.map((message, index) => (
                    <div key={index} className="flex items-center mb-2">
                      <div className={`w-2 h-2 rounded-full mr-3 ${
                        message.includes('Error') ? 'bg-red-500' :
                        message.includes('completed') ? 'bg-green-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-sm text-gray-700">{message}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : aiResponse ? (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-900 mb-2">Processing Complete!</h3>
                <p className="text-gray-600 mb-4">Found {extractedItems.length} items in the invoice</p>
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {extractedItems.filter(i => i.match_confidence >= 80).length}
                    </div>
                    <div className="text-xs text-gray-500">High Confidence</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {extractedItems.filter(i => i.match_confidence >= 50 && i.match_confidence < 80).length}
                    </div>
                    <div className="text-xs text-gray-500">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {extractedItems.filter(i => i.match_confidence < 50).length}
                    </div>
                    <div className="text-xs text-gray-500">Needs Review</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Brain className="h-16 w-16 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Process</h3>
                <p className="text-gray-600 mb-4">Click &quot;Process with AI&quot; to analyze the uploaded invoice</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review Items */}
      {currentStep === STEPS.REVIEW_ITEMS && (
        <div className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>Review &amp; Edit Items</CardTitle>
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
                      <TableHeader>Rate</TableHeader>
                      <TableHeader>Total</TableHeader>
                      <TableHeader></TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {extractedItems.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium text-sm">{item.vendor_item_name}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(o => o.value === item.matched_sku_id) || null}
                            onChange={(selected) => updateExtractedItem(index, 'matched_sku_id', selected?.value)}
                            placeholder="Select SKU..."
                          />
                        </TableCell>
                        <TableCell>
                          <ConfidenceBadge confidence={item.match_confidence} />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity_vendor_unit}
                            onChange={(e) => updateExtractedItem(index, 'quantity_vendor_unit', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </TableCell>
                        <TableCell className="min-w-[100px]">
                          <Select
                            options={UNIT_OPTIONS}
                            value={UNIT_OPTIONS.find(u => u.value === item.vendor_unit) || null}
                            onChange={(selected) => updateExtractedItem(index, 'vendor_unit', selected?.value)}
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            step="0.01"
                            value={item.quantity_internal}
                            onChange={(e) => updateExtractedItem(index, 'quantity_internal', parseFloat(e.target.value) || 0)}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </TableCell>
                        <TableCell>
                          <input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateExtractedItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.amount)}
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={() => removeExtractedItem(index)}
                            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden space-y-3">
                {extractedItems.map((item, index) => (
                  <div key={item.id} className={`rounded-xl p-4 border ${index % 2 === 0 ? 'bg-white border-gray-200' : 'bg-blue-50/40 border-blue-100'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-medium text-sm">Item #{index + 1}</div>
                        <div className="text-sm text-gray-800">{item.vendor_item_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ConfidenceBadge confidence={item.match_confidence} />
                        <button onClick={() => removeExtractedItem(index)} className="p-1 text-red-500">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Select
                        label="Matched SKU"
                        options={skuOptions}
                        value={skuOptions.find(o => o.value === item.matched_sku_id) || null}
                        onChange={(selected) => updateExtractedItem(index, 'matched_sku_id', selected?.value)}
                        placeholder="Select SKU..."
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Qty (Vendor)"
                          type="number"
                          step="0.01"
                          value={item.quantity_vendor_unit}
                          onChange={(e) => updateExtractedItem(index, 'quantity_vendor_unit', parseFloat(e.target.value) || 0)}
                        />
                        <Input
                          label="Qty (Internal)"
                          type="number"
                          step="0.01"
                          value={item.quantity_internal}
                          onChange={(e) => updateExtractedItem(index, 'quantity_internal', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Rate"
                          type="number"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateExtractedItem(index, 'rate', parseFloat(e.target.value) || 0)}
                        />
                        <div className="pt-6 text-right font-semibold">
                          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(item.amount)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {extractedItems.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-end">
                  <div className="text-right">
                    <div className="text-lg font-semibold">
                      Total: {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
                    </div>
                    <div className="text-sm text-gray-600">{extractedItems.length} items</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 5: Confirm */}
      {currentStep === STEPS.CONFIRM && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Confirm Inward
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Vendor:</span>
                    <p className="font-medium">{selectedVendor?.vendor_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Invoice No:</span>
                    <p className="font-medium">{invoiceInfo.invoice_no || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Items:</span>
                    <p className="font-medium">{extractedItems.length}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Total Amount:</span>
                    <p className="font-medium text-lg">
                      {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(totalAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Confirming will create an inward transaction and update inventory quantities for all items.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 6: Save Aliases */}
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
                    <div className="text-sm text-gray-600">{alias.sku_name}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={aliasChecked[index] !== false}
                    onChange={(e) => setAliasChecked(prev => ({ ...prev, [index]: e.target.checked }))}
                    className="h-4 w-4 text-navy-600"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between gap-3">
        <Button
          variant="outline"
          onClick={currentStep > 1 ? handlePrevStep : () => navigate('/inward')}
          disabled={isProcessing || isConfirming}
          className="order-2 sm:order-1 w-full sm:w-auto"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          {currentStep > 1 ? 'Previous' : 'Cancel'}
        </Button>

        {currentStep === STEPS.SAVE_ALIASES ? (
          <Button
            onClick={handleSaveAliases}
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Aliases & Complete
          </Button>
        ) : currentStep === STEPS.CONFIRM ? (
          <Button
            onClick={handleConfirmInward}
            disabled={isConfirming}
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            {isConfirming ? <Spinner size="sm" className="mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Confirm Inward
          </Button>
        ) : currentStep === STEPS.AI_PROCESSING ? (
          <Button
            onClick={aiResponse ? handleNextStep : handleAIProcessing}
            disabled={isProcessing}
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            {isProcessing ? <Spinner size="sm" className="mr-2" /> : <Brain className="h-4 w-4 mr-2" />}
            {aiResponse ? 'Next' : 'Process with AI'}
          </Button>
        ) : (
          <Button
            onClick={handleNextStep}
            disabled={
              (currentStep === STEPS.SELECT_VENDOR && !selectedVendor) ||
              (currentStep === STEPS.UPLOAD_INVOICE && !uploadedFile) ||
              (currentStep === STEPS.REVIEW_ITEMS && extractedItems.some(i => !i.matched_sku_id))
            }
            className="order-1 sm:order-2 w-full sm:w-auto"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  )
}
