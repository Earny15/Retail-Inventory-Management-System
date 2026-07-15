import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../services/supabase'
import { useAuth } from '../../hooks/useAuth'
import { currencyToWords } from '../../utils/numberToWords'
import { extractInvoiceItemsFromVoice } from '../../services/anthropic'
import { uploadInvoicePDFToStorage } from '../../services/invoicePdfService'
import { logInvoiceActivity, buildEditDiff } from '../../services/invoiceActivityService'
import PageHeader from '../../components/shared/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '../../components/ui/Table'
import {
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

const GST_RATE_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5, label: '5%' },
  { value: 12, label: '12%' },
  { value: 18, label: '18%' },
  { value: 28, label: '28%' }
]

const GST_TYPE_OPTIONS = [
  { value: 'INTRA', label: 'CGST + SGST (Intra-state)' },
  { value: 'INTER', label: 'IGST (Inter-state)' }
]

const GST_MODE_OPTIONS = [
  { value: 'same', label: 'Same GST % for all items' },
  { value: 'different', label: 'Different GST % per item' }
]

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount || 0)
}

const formatDateDDMMYYYY = (dateStr) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

const todayISO = () => new Date().toISOString().split('T')[0]

export default function NewInvoicePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  // Edit mode: /invoices/:id/edit
  const { id: editingInvoiceId } = useParams()
  const isEditMode = !!editingInvoiceId

  // Form state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [invoiceDate, setInvoiceDate] = useState(todayISO())
  const [dueDate, setDueDate] = useState('')

  // GST settings - user chooses at invoice level
  const [gstType, setGstType] = useState('INTRA') // INTRA = CGST+SGST, INTER = IGST
  const [gstMode, setGstMode] = useState('same') // same = uniform GST%, different = per-line
  const [uniformGstRate, setUniformGstRate] = useState(18) // used when gstMode === 'same'

  const initialItemId = useRef(Date.now()).current
  const [lineItems, setLineItems] = useState([
    { id: initialItemId, sku_id: null, hsn_code: '', qty: '', unit: '', sellingPrice: 0, gst_rate: 18, included: true }
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Accordion: only one mobile card expanded at a time. Latest-added is auto-expanded.
  const [expandedItemId, setExpandedItemId] = useState(initialItemId)
  const itemRefs = useRef({})

  // Voice dictation state
  const [isListening, setIsListening] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  // Items the AI heard but couldn't auto-pick; user disambiguates inline
  const [pendingMatches, setPendingMatches] = useState([])
  const recognitionRef = useRef(null)

  // Confidence threshold: top candidate >= this number is auto-added
  const AUTO_MATCH_THRESHOLD = 85

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, customer_name, phone, billing_city, billing_state, gstin')
        .order('customer_name')
      if (error) throw error
      return data
    }
  })

  // Fetch company (first row)
  const { data: company } = useQuery({
    queryKey: ['company-first'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      if (error) throw error
      return data
    }
  })

  // Fetch SKUs - include selling_price if column exists
  const { data: skus = [] } = useQuery({
    queryKey: ['skus'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skus')
        .select('id, sku_code, sku_name, unit_of_measure, hsn_code, selling_price, gst_rate')
        .order('sku_name')
      if (error) {
        // Fallback without selling_price if column doesn't exist
        const { data: fallback, error: err2 } = await supabase
          .from('skus')
          .select('id, sku_code, sku_name, unit_of_measure, hsn_code, gst_rate')
          .order('sku_name')
        if (err2) throw err2
        return fallback
      }
      return data
    }
  })

  // Fetch inventory for stock checks
  const { data: inventoryData = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select('sku_id, current_stock')
      if (error) throw error
      return data
    }
  })

  // Fetch existing invoice (edit mode)
  const { data: existingInvoice, isLoading: existingLoading } = useQuery({
    queryKey: ['invoice-edit', editingInvoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_invoices')
        .select(`
          *,
          customer_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code))
        `)
        .eq('id', editingInvoiceId)
        .single()
      if (error) throw error
      return data
    },
    enabled: isEditMode
  })

  // Original items snapshot (for inventory rebalance on save)
  const originalItemsRef = useRef([])
  const [editPrepopulated, setEditPrepopulated] = useState(false)

  // Prepopulate form state when existing invoice loads
  useEffect(() => {
    if (!isEditMode || !existingInvoice || editPrepopulated) return

    setSelectedCustomerId(existingInvoice.customer_id)
    setInvoiceDate(existingInvoice.invoice_date)
    setDueDate(existingInvoice.due_date || '')

    const isIntra = (existingInvoice.cgst_amount || 0) > 0 || (existingInvoice.igst_amount || 0) === 0
    setGstType(isIntra ? 'INTRA' : 'INTER')

    const dbItems = existingInvoice.customer_invoice_items || []
    const rates = [...new Set(dbItems.map(i => i.gst_rate || 0))]
    const uniformRate = rates.length === 1 ? rates[0] : 18
    setGstMode(rates.length === 1 ? 'same' : 'different')
    setUniformGstRate(uniformRate)

    const mappedItems = dbItems.length
      ? dbItems.map((it, idx) => ({
          id: Date.now() + idx,
          sku_id: it.sku_id,
          hsn_code: it.sku?.hsn_code || '',
          qty: it.quantity || 1,
          unit: it.sku?.unit_of_measure || '',
          sellingPrice: Number(it.rate) || 0,
          gst_rate: it.gst_rate ?? uniformRate,
          included: true
        }))
      : [{ id: Date.now(), sku_id: null, hsn_code: '', qty: '', unit: '', sellingPrice: 0, gst_rate: 18, included: true }]

    setLineItems(mappedItems)
    setExpandedItemId(mappedItems[0]?.id || null)
    originalItemsRef.current = dbItems.map(it => ({ sku_id: it.sku_id, quantity: it.quantity || 0 }))
    setEditPrepopulated(true)
  }, [isEditMode, existingInvoice, editPrepopulated, editingInvoiceId, navigate])

  const inventoryMap = useMemo(() => {
    const map = {}
    inventoryData.forEach(inv => { map[inv.sku_id] = inv.current_stock })
    return map
  }, [inventoryData])

  const selectedCustomer = useMemo(
    () => customers.find(c => c.id === selectedCustomerId),
    [customers, selectedCustomerId]
  )

  // Customer options
  const customerOptions = useMemo(() =>
    customers.map(c => ({
      value: c.id,
      label: `${c.customer_name} - ${c.billing_city || ''}`
    })),
    [customers]
  )

  // SKU options
  const skuOptions = useMemo(() =>
    skus.map(s => ({
      value: s.id,
      label: s.sku_name
    })),
    [skus]
  )

  // Scroll a line item into view (used after adding new items)
  const scrollToItem = (itemId) => {
    setTimeout(() => {
      const el = itemRefs.current[itemId]
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  // Line item handlers
  const addLineItem = () => {
    const newId = Date.now()
    setLineItems(prev => [...prev, {
      id: newId,
      sku_id: null,
      hsn_code: '',
      qty: '',
      unit: '',
      sellingPrice: 0,
      gst_rate: uniformGstRate,
      included: true
    }])
    setExpandedItemId(newId)
    scrollToItem(newId)
    return newId
  }

  const removeLineItem = (index) => {
    if (lineItems.length <= 1) return
    setLineItems(prev => prev.filter((_, i) => i !== index))
  }

  const updateLineItem = (index, field, value) => {
    setLineItems(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const handleSkuSelect = (index, skuId) => {
    const sku = skus.find(s => s.id === skuId)
    if (sku) {
      setLineItems(prev => {
        const updated = [...prev]
        updated[index] = {
          ...updated[index],
          sku_id: skuId,
          hsn_code: sku.hsn_code || '',
          unit: sku.unit_of_measure || '',
          sellingPrice: sku.selling_price || 0,
          gst_rate: gstMode === 'same' ? uniformGstRate : (sku.gst_rate ?? updated[index].gst_rate)
        }
        return updated
      })
    }
  }

  // When uniform GST rate changes, update all line items
  const handleUniformGstChange = (rate) => {
    setUniformGstRate(rate)
    if (gstMode === 'same') {
      setLineItems(prev => prev.map(item => ({ ...item, gst_rate: rate })))
    }
  }

  // When GST mode changes to 'same', sync all items to uniform rate
  const handleGstModeChange = (mode) => {
    setGstMode(mode)
    if (mode === 'same') {
      setLineItems(prev => prev.map(item => ({ ...item, gst_rate: uniformGstRate })))
    }
  }

  // Build a line item from a chosen SKU
  const buildItemFromSku = (sku, qty, gstRateForItem) => ({
    id: Date.now() + Math.floor(Math.random() * 1000),
    sku_id: sku.id,
    hsn_code: sku.hsn_code || '',
    qty: Math.max(1, Number(qty) || 1),
    unit: sku.unit_of_measure || '',
    sellingPrice: sku.selling_price || 0,
    gst_rate: gstRateForItem,
    included: true
  })

  // Add new line items, optionally filling the first empty slot. Returns the id of the last added/updated item.
  const appendItemsToInvoice = (newItems) => {
    let lastId = null
    setLineItems(prev => {
      const firstEmptyIdx = prev.findIndex(i => !i.sku_id)
      const toAdd = [...newItems]
      if (firstEmptyIdx >= 0 && toAdd.length > 0) {
        const updated = [...prev]
        const first = toAdd.shift()
        updated[firstEmptyIdx] = { ...first, id: prev[firstEmptyIdx].id }
        lastId = prev[firstEmptyIdx].id
        if (toAdd.length === 0) return updated
        lastId = toAdd[toAdd.length - 1].id
        return [...updated, ...toAdd]
      }
      if (toAdd.length === 0) return prev
      lastId = toAdd[toAdd.length - 1].id
      return [...prev, ...toAdd]
    })
    return lastId
  }

  // Process the recognized speech: match SKUs via Claude, auto-add high-confidence matches,
  // queue ambiguous ones for the user to disambiguate.
  const processVoiceTranscript = async (transcript) => {
    setIsProcessingVoice(true)
    try {
      const result = await extractInvoiceItemsFromVoice(transcript, skus)
      const items = result.items || []
      if (items.length === 0) {
        toast.error("Couldn't recognize any items. Try again.")
        return
      }

      const gstRate = gstMode === 'same' ? uniformGstRate : 18
      const autoAddItems = []
      const ambiguous = []
      const unrecognized = []

      for (const it of items) {
        const candidates = (it.candidates || [])
          .map(c => ({ ...c, sku: skus.find(s => s.id === c.sku_id) }))
          .filter(c => c.sku)

        if (candidates.length === 0) {
          unrecognized.push(it.heard_as)
          continue
        }

        const top = candidates[0]
        if (top.confidence >= AUTO_MATCH_THRESHOLD && candidates.length === 1) {
          autoAddItems.push(buildItemFromSku(top.sku, it.quantity, gstRate))
        } else if (top.confidence >= AUTO_MATCH_THRESHOLD) {
          // Top is strong but others exist — still auto-pick top
          autoAddItems.push(buildItemFromSku(top.sku, it.quantity, gstRate))
        } else {
          // Ambiguous — queue for user to pick
          ambiguous.push({
            id: `pending-${Date.now()}-${ambiguous.length}`,
            heard_as: it.heard_as,
            quantity: it.quantity || 1,
            candidates: candidates.slice(0, 3)
          })
        }
      }

      // Add auto-matched items immediately
      if (autoAddItems.length > 0) {
        const lastId = appendItemsToInvoice(autoAddItems)
        if (lastId) {
          setExpandedItemId(lastId)
          scrollToItem(lastId)
        }
      }

      // Queue ambiguous matches for user to disambiguate
      if (ambiguous.length > 0) {
        setPendingMatches(prev => [...prev, ...ambiguous])
      }

      const parts = []
      if (autoAddItems.length) parts.push(`Added ${autoAddItems.length}`)
      if (ambiguous.length) parts.push(`${ambiguous.length} to confirm`)
      if (unrecognized.length) parts.push(`${unrecognized.length} not recognized`)
      if (parts.length) toast.success(parts.join(' · '))

    } catch (err) {
      console.error('Voice processing failed:', err)
      toast.error(`Voice processing failed: ${err.message}`)
    } finally {
      setIsProcessingVoice(false)
      setVoiceTranscript('')
    }
  }

  // User picked a candidate for an ambiguous match
  const resolvePendingMatch = (pendingId, sku) => {
    const pending = pendingMatches.find(p => p.id === pendingId)
    if (!pending) return
    const gstRate = gstMode === 'same' ? uniformGstRate : 18
    const newItem = buildItemFromSku(sku, pending.quantity, gstRate)
    const lastId = appendItemsToInvoice([newItem])
    setPendingMatches(prev => prev.filter(p => p.id !== pendingId))
    if (lastId) {
      setExpandedItemId(lastId)
      scrollToItem(lastId)
    }
  }

  const dismissPendingMatch = (pendingId) => {
    setPendingMatches(prev => prev.filter(p => p.id !== pendingId))
  }

  // Start voice dictation
  const startVoiceCapture = () => {
    console.log('[voice] startVoiceCapture called', {
      hasSpeechRecognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
      selectedCustomerId,
      skuCount: skus.length,
      isSecureContext: typeof window !== 'undefined' && window.isSecureContext
    })
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      toast.error('Voice not supported on this browser. Use Chrome (Android/Desktop) or Safari (iOS 14.5+).')
      return
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      toast.error('Voice needs HTTPS. Open the deployed site, not a local file.')
      return
    }
    if (!selectedCustomerId) {
      toast('Please select a customer first', { icon: '👆' })
      return
    }
    if (skus.length === 0) {
      toast.error('SKU list is still loading — try again in a second.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-IN'
    recognition.interimResults = true
    recognition.continuous = true
    recognition.maxAlternatives = 1

    let finalText = ''

    recognition.onresult = (event) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) finalText += t + ' '
        else interim += t
      }
      setVoiceTranscript((finalText + interim).trim())
    }

    recognition.onerror = (event) => {
      setIsListening(false)
      if (event.error === 'no-speech') {
        toast.error('No speech detected. Tap mic and try again.')
      } else if (event.error === 'not-allowed') {
        toast.error('Microphone permission denied. Allow it in your browser.')
      } else if (event.error !== 'aborted') {
        toast.error(`Voice error: ${event.error}`)
      }
    }

    recognition.onend = () => {
      setIsListening(false)
      const transcript = finalText.trim() || voiceTranscript.trim()
      if (transcript) {
        processVoiceTranscript(transcript)
      }
    }

    recognition.start()
    setIsListening(true)
    setVoiceTranscript('')
    recognitionRef.current = recognition
  }

  const stopVoiceCapture = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const toggleVoice = () => {
    if (isListening) stopVoiceCapture()
    else startVoiceCapture()
  }

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort() } catch {}
      }
    }
  }, [])

  // Calculations per line item
  // Selling price is GST-INCLUSIVE. Taxable amount is back-calculated.
  // sellingPrice = 118 (incl 18% GST) → total = 118*qty, taxable = 118*qty/1.18 = 100*qty, GST = 18*qty
  const calcLineItem = (item) => {
    const price = Number(item.sellingPrice) || 0
    const qty = Number(item.qty) || 0
    const gstRate = gstMode === 'same' ? uniformGstRate : (Number(item.gst_rate) || 0)

    const total = price * qty
    const taxableAmount = gstRate > 0 ? total / (1 + gstRate / 100) : total
    const totalGst = total - taxableAmount

    let cgst = 0, sgst = 0, igst = 0
    if (gstType === 'INTRA') {
      cgst = totalGst / 2
      sgst = totalGst / 2
    } else {
      igst = totalGst
    }

    return { taxableAmount, cgst, sgst, igst, totalGst, total, gstRate }
  }

  // Summary calculations (only included items)
  const summary = useMemo(() => {
    let subTotal = 0
    let totalCgst = 0
    let totalSgst = 0
    let totalIgst = 0
    let grandTotal = 0

    lineItems.forEach(item => {
      if (!item.included) return
      const calc = calcLineItem(item)
      subTotal += calc.taxableAmount
      totalCgst += calc.cgst
      totalSgst += calc.sgst
      totalIgst += calc.igst
      grandTotal += calc.total
    })

    return { subTotal, totalCgst, totalSgst, totalIgst, grandTotal }
  }, [lineItems, gstType, gstMode, uniformGstRate])

  // Update an existing invoice: restore old inventory, replace items, deduct new inventory,
  // recalc totals, optionally regenerate the public PDF.
  const updateExistingInvoice = async () => {
    if (!existingInvoice) {
      toast.error('Invoice not loaded yet')
      return
    }

    setIsSubmitting(true)
    try {
      const wasCancelled = existingInvoice.status === 'CANCELLED'

      // Cancelled invoices already had their inventory restored during cancellation,
      // and the edited items should not re-deduct stock (the invoice remains cancelled).
      // For ACTIVE invoices we net the delta: restore original items, deduct new items.
      if (!wasCancelled) {
        const inventoryDelta = {} // sku_id -> net delta to apply
        for (const orig of originalItemsRef.current) {
          inventoryDelta[orig.sku_id] = (inventoryDelta[orig.sku_id] || 0) + orig.quantity
        }
        for (const item of lineItems) {
          if (!item.included || !item.sku_id) continue
          inventoryDelta[item.sku_id] = (inventoryDelta[item.sku_id] || 0) - item.qty
        }
        for (const [skuId, delta] of Object.entries(inventoryDelta)) {
          if (delta === 0) continue
          const { data: invRow, error: invFetchErr } = await supabase
            .from('inventory')
            .select('current_stock, available_stock')
            .eq('sku_id', skuId)
            .single()
          if (invFetchErr) throw invFetchErr
          const newStock = (invRow?.current_stock || 0) + delta
          const { error: invUpdErr } = await supabase
            .from('inventory')
            .update({ current_stock: newStock, available_stock: newStock })
            .eq('sku_id', skuId)
          if (invUpdErr) throw invUpdErr
        }
      }

      // 4. Update the invoice header (totals, dates, customer)
      const { error: updErr } = await supabase
        .from('customer_invoices')
        .update({
          invoice_date: invoiceDate,
          customer_id: selectedCustomerId,
          subtotal: summary.subTotal,
          cgst_amount: summary.totalCgst,
          sgst_amount: summary.totalSgst,
          igst_amount: summary.totalIgst,
          total_gst_amount: summary.totalCgst + summary.totalSgst + summary.totalIgst,
          total_amount: summary.grandTotal,
          due_date: dueDate || null
        })
        .eq('id', editingInvoiceId)
      if (updErr) throw updErr

      // 5. Replace all items: delete old, insert new
      const { error: delErr } = await supabase
        .from('customer_invoice_items')
        .delete()
        .eq('invoice_id', editingInvoiceId)
      if (delErr) throw delErr

      const itemRows = lineItems
        .filter(item => item.included && item.sku_id)
        .map(item => {
          const calc = calcLineItem(item)
          return {
            invoice_id: editingInvoiceId,
            sku_id: item.sku_id,
            quantity: item.qty,
            rate: item.sellingPrice,
            amount: calc.taxableAmount,
            gst_rate: calc.gstRate,
            gst_amount: calc.totalGst,
            total_amount: calc.total,
            description: item.hsn_code ? `HSN: ${item.hsn_code}` : null
          }
        })

      if (itemRows.length) {
        const { error: insErr } = await supabase
          .from('customer_invoice_items')
          .insert(itemRows)
        if (insErr) throw insErr
      }

      // 6. If a public PDF link existed, regenerate it so the shared link reflects the edits
      if (existingInvoice.public_pdf_url) {
        try {
          const { data: fresh, error: freshErr } = await supabase
            .from('customer_invoices')
            .select(`*, customers(*), customer_invoice_items(*, sku:skus(id, sku_code, sku_name, unit_of_measure, hsn_code))`)
            .eq('id', editingInvoiceId)
            .single()
          if (freshErr) throw freshErr

          const { data: companyData } = await supabase
            .from('companies').select('*').order('created_at', { ascending: false }).limit(1).single()

          const newUrl = await uploadInvoicePDFToStorage(fresh, companyData)
          await supabase
            .from('customer_invoices')
            .update({ public_pdf_url: newUrl })
            .eq('id', editingInvoiceId)
        } catch (e) {
          console.warn('Public PDF regeneration failed (saved anyway):', e)
          toast('Invoice saved. Re-generate the public link manually from the detail page.', { icon: 'ℹ️' })
        }
      }

      // Log the edit for the activity trail
      const diff = buildEditDiff({
        originalDbItems: existingInvoice.customer_invoice_items || [],
        newLineItems: lineItems,
        skus
      })
      const prevTotal = Number(existingInvoice.total_amount) || 0
      await logInvoiceActivity({
        invoiceId: editingInvoiceId,
        action: 'updated',
        details: {
          prev_total: prevTotal,
          next_total: summary.grandTotal,
          status: existingInvoice.status,
          ...diff
        },
        actor: user
      })

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['invoice-detail', editingInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoice-edit', editingInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['invoice-activity', editingInvoiceId] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      toast.success(`Invoice ${existingInvoice.invoice_number} updated`)
      navigate(`/invoices/${editingInvoiceId}`)
    } catch (error) {
      console.error('Invoice update failed:', error)
      toast.error('Failed to update invoice: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Save: create a new invoice OR update an existing one
  const generateInvoice = async () => {
    if (!selectedCustomerId) {
      toast.error('Please select a customer')
      return
    }
    if (!invoiceDate) {
      toast.error('Please select an invoice date')
      return
    }
    const includedItems = lineItems.filter(item => item.included)
    const validIncluded = includedItems.filter(item => item.sku_id && item.qty > 0 && item.sellingPrice > 0)
    if (validIncluded.length === 0) {
      toast.error('At least one item with SKU, quantity and selling price is required')
      return
    }
    const allItems = lineItems.filter(item => item.sku_id)
    if (allItems.length !== lineItems.length) {
      toast.error('All line items must have a SKU selected')
      return
    }

    if (isEditMode) {
      return updateExistingInvoice()
    }

    setIsSubmitting(true)

    try {
      // Step 1: Get next invoice number from the master's series counter.
      // The value stored in invoice_number_series is the LAST used number
      // (or the seed if no invoices yet); the next invoice uses seed + 1,
      // zero-padded to the seed's width.
      let companyData
      {
        const { data, error } = await supabase
          .from('companies')
          .select('id, invoice_prefix, invoice_number_series')
          .order('created_at', { ascending: false })
          .limit(1)
          .single()
        if (error) throw error
        companyData = data
      }

      const rawSeries = (companyData.invoice_number_series || '').trim()
      let baseSeries = rawSeries || '000' // fallback seed
      // Backfill for legacy rows that have no series set yet: derive from
      // the highest existing invoice number for this prefix.
      if (!rawSeries) {
        const { data: lastInvoice } = await supabase
          .from('customer_invoices')
          .select('invoice_number')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (lastInvoice?.invoice_number) {
          const m = lastInvoice.invoice_number.match(/(\d+)$/)
          if (m) baseSeries = m[1] // keep its width
        }
      }
      const currentNum = parseInt(baseSeries, 10) || 0
      const nextSeries = String(currentNum + 1).padStart(baseSeries.length, '0')
      const invoiceNumber = `${companyData.invoice_prefix || 'INV-'}${nextSeries}`

      // Step 2: Insert customer invoice
      const { data: invoiceRecord, error: txError } = await supabase
        .from('customer_invoices')
        .insert({
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          customer_id: selectedCustomerId,
          status: 'ACTIVE',
          subtotal: summary.subTotal,
          cgst_amount: summary.totalCgst,
          sgst_amount: summary.totalSgst,
          igst_amount: summary.totalIgst,
          total_gst_amount: summary.totalCgst + summary.totalSgst + summary.totalIgst,
          total_amount: summary.grandTotal,
          due_date: dueDate || null,
          notes: null,
          created_by: user?.id
        })
        .select()
        .single()

      if (txError) throw txError

      // Step 3: Insert invoice items
      for (const item of lineItems) {
        if (!item.included) continue
        const calc = calcLineItem(item)

        const { error: itemError } = await supabase
          .from('customer_invoice_items')
          .insert({
            invoice_id: invoiceRecord.id,
            sku_id: item.sku_id,
            quantity: item.qty,
            rate: item.sellingPrice,
            amount: calc.taxableAmount,
            gst_rate: calc.gstRate,
            gst_amount: calc.totalGst,
            total_amount: calc.total,
            description: item.hsn_code ? `HSN: ${item.hsn_code}` : null
          })

        if (itemError) throw itemError

        // Step 4: Update inventory - reduce stock
        const currentStock = inventoryMap[item.sku_id] || 0
        await supabase
          .from('inventory')
          .update({
            current_stock: currentStock - item.qty,
            available_stock: currentStock - item.qty
          })
          .eq('sku_id', item.sku_id)
      }

      // Activity: invoice created
      const createdItems = lineItems
        .filter(i => i.included && i.sku_id)
        .map(i => {
          const s = skus.find(x => x.id === i.sku_id)
          return { sku_name: s?.sku_name || 'Unknown SKU', qty: i.qty }
        })
      await logInvoiceActivity({
        invoiceId: invoiceRecord.id,
        action: 'created',
        details: {
          total: summary.grandTotal,
          items_count: createdItems.length,
          items: createdItems
        },
        actor: user
      })

      // Bump the master's number series so the next invoice uses the next value.
      // If this fails (e.g. the column doesn't exist yet), the invoice itself
      // is already saved — we just log and move on.
      try {
        await supabase
          .from('companies')
          .update({ invoice_number_series: nextSeries })
          .eq('id', companyData.id)
      } catch (e) {
        console.warn('Failed to bump invoice_number_series:', e)
      }

      queryClient.invalidateQueries({ queryKey: ['invoices'] })
      queryClient.invalidateQueries({ queryKey: ['inventory'] })
      queryClient.invalidateQueries({ queryKey: ['company-first'] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      toast.success(`Invoice ${invoiceNumber} generated successfully!`)
      navigate(`/invoices/${invoiceRecord.id}`)

    } catch (error) {
      console.error('Invoice generation failed:', error)
      toast.error('Failed to generate invoice: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isEditMode && existingLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 sm:mb-6 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {isEditMode ? `Edit Invoice ${existingInvoice?.invoice_number || ''}` : 'Create New Invoice'}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5 hidden sm:block">
            {isEditMode
              ? 'Update items, quantities, or rates. Inventory and the public PDF link will be re-synced on save.'
              : 'Generate a GST-compliant outward invoice'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(isEditMode ? `/invoices/${editingInvoiceId}` : '/invoices')}>
          Back
        </Button>
      </div>

      <div className="space-y-6">
        {/* Customer & Invoice Details */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Select
                label="Customer"
                required
                options={customerOptions}
                value={customerOptions.find(o => o.value === selectedCustomerId) || null}
                onChange={(selected) => setSelectedCustomerId(selected?.value || null)}
                placeholder="Search customer..."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Invoice Date"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  required
                />
                <Input
                  label="Due Date (optional)"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>

            {selectedCustomer && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Name:</span>
                    <p className="font-medium">{selectedCustomer.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Location:</span>
                    <p className="font-medium">{selectedCustomer.billing_city}, {selectedCustomer.billing_state}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">GSTIN:</span>
                    <p className="font-medium">{selectedCustomer.gstin || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* GST Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>GST Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Select
                  label="Invoice Type"
                  options={GST_TYPE_OPTIONS}
                  value={GST_TYPE_OPTIONS.find(o => o.value === gstType)}
                  onChange={(s) => setGstType(s?.value || 'INTRA')}
                />
                <div className="mt-2">
                  {gstType === 'INTRA' ? (
                    <Badge variant="info">CGST + SGST</Badge>
                  ) : (
                    <Badge variant="purple">IGST</Badge>
                  )}
                </div>
              </div>
              <div>
                <Select
                  label="GST % Mode"
                  options={GST_MODE_OPTIONS}
                  value={GST_MODE_OPTIONS.find(o => o.value === gstMode)}
                  onChange={(s) => handleGstModeChange(s?.value || 'same')}
                />
              </div>
              {gstMode === 'same' && (
                <div>
                  <Select
                    label="GST Rate (all items)"
                    options={GST_RATE_OPTIONS}
                    value={GST_RATE_OPTIONS.find(o => o.value === uniformGstRate)}
                    onChange={(s) => handleUniformGstChange(s?.value ?? 18)}
                  />
                  {gstType === 'INTRA' ? (
                    <p className="text-xs text-gray-500 mt-1">
                      CGST {uniformGstRate / 2}% + SGST {uniformGstRate / 2}%
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      IGST {uniformGstRate}%
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Line Items</CardTitle>
            <Button type="button" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto -mx-6">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeader>#</TableHeader>
                    <TableHeader>SKU Name</TableHeader>
                    <TableHeader>HSN</TableHeader>
                    <TableHeader>Qty</TableHeader>
                    <TableHeader>Unit</TableHeader>
                    <TableHeader>Price (Incl. GST)</TableHeader>
                    <TableHeader>Taxable Amt</TableHeader>
                    {gstMode === 'different' && <TableHeader>GST %</TableHeader>}
                    {gstType === 'INTRA' ? (
                      <>
                        <TableHeader>CGST</TableHeader>
                        <TableHeader>SGST</TableHeader>
                      </>
                    ) : (
                      <TableHeader>IGST</TableHeader>
                    )}
                    <TableHeader>Total</TableHeader>
                    <TableHeader>Include</TableHeader>
                    <TableHeader></TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => {
                    const calc = calcLineItem(item)
                    const stock = inventoryMap[item.sku_id] || 0
                    const qtyExceedsStock = item.included && item.sku_id && item.qty > stock

                    const rowAlt = !item.included
                      ? 'bg-gray-100 opacity-60'
                      : index % 2 === 0
                        ? 'bg-white'
                        : 'bg-blue-50/40'

                    return (
                      <TableRow
                        key={item.id}
                        ref={(el) => { if (el) itemRefs.current[item.id] = el }}
                        className={rowAlt}
                      >
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="min-w-[250px]">
                          <Select
                            options={skuOptions}
                            value={skuOptions.find(o => o.value === item.sku_id) || null}
                            onChange={(selected) => handleSkuSelect(index, selected?.value)}
                            placeholder="Select SKU..."
                          />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">{item.hsn_code || '-'}</span>
                        </TableCell>
                        <TableCell className="min-w-[90px]">
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.qty}
                              onChange={(e) => updateLineItem(index, 'qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                            {qtyExceedsStock && (
                              <div className="flex items-center mt-1 text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Stock: {stock}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{item.unit || '-'}</span>
                        </TableCell>
                        <TableCell className="min-w-[110px]">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.sellingPrice}
                            onChange={(e) => updateLineItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                          />
                        </TableCell>
                        <TableCell className="text-sm font-medium">
                          {formatCurrency(calc.taxableAmount)}
                        </TableCell>
                        {gstMode === 'different' && (
                          <TableCell className="min-w-[100px]">
                            <Select
                              options={GST_RATE_OPTIONS}
                              value={GST_RATE_OPTIONS.find(o => o.value === item.gst_rate) || null}
                              onChange={(selected) => updateLineItem(index, 'gst_rate', selected?.value ?? 18)}
                              menuPortalTarget={document.body}
                            />
                          </TableCell>
                        )}
                        {gstType === 'INTRA' ? (
                          <>
                            <TableCell className="text-sm">{formatCurrency(calc.cgst)}</TableCell>
                            <TableCell className="text-sm">{formatCurrency(calc.sgst)}</TableCell>
                          </>
                        ) : (
                          <TableCell className="text-sm">{formatCurrency(calc.igst)}</TableCell>
                        )}
                        <TableCell className="text-sm font-semibold">{formatCurrency(calc.total)}</TableCell>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={item.included}
                            onChange={(e) => updateLineItem(index, 'included', e.target.checked)}
                            className="h-4 w-4 text-navy-600 rounded"
                          />
                        </TableCell>
                        <TableCell>
                          {lineItems.length > 1 && (
                            <button
                              onClick={() => removeLineItem(index)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden space-y-3">
              {lineItems.map((item, index) => {
                const calc = calcLineItem(item)
                const stock = inventoryMap[item.sku_id] || 0
                const qtyExceedsStock = item.included && item.sku_id && item.qty > stock
                const isExpanded = expandedItemId === item.id
                const skuLabel = skuOptions.find(o => o.value === item.sku_id)?.label
                const summaryName = skuLabel || 'No SKU selected'

                const altBg = !item.included
                  ? 'bg-gray-100 opacity-60 border-gray-200'
                  : index % 2 === 0
                    ? 'bg-white border-gray-200 shadow-sm'
                    : 'bg-blue-50/50 border-blue-100 shadow-sm'

                return (
                  <div
                    key={item.id}
                    ref={(el) => { if (el) itemRefs.current[item.id] = el }}
                    className={`border rounded-xl ${altBg}`}
                  >
                    {/* Collapsed summary header — always visible, tap to toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="w-full flex items-center justify-between gap-3 p-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">#{index + 1}</span>
                          <span className={`text-sm font-medium truncate ${item.sku_id ? 'text-gray-900' : 'text-gray-400 italic'}`}>
                            {summaryName}
                          </span>
                        </div>
                        {item.sku_id && (
                          <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                            <span>{item.qty} {item.unit || ''}</span>
                            <span>×</span>
                            <span>{formatCurrency(item.sellingPrice)}</span>
                            <span className="ml-auto font-semibold text-navy-600">{formatCurrency(calc.total)}</span>
                          </div>
                        )}
                      </div>
                      {isExpanded
                        ? <ChevronUp className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        : <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />}
                    </button>

                    {/* Expanded body */}
                    {isExpanded && (
                      <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
                        <div className="flex items-center justify-between pt-3">
                          <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input
                              type="checkbox"
                              checked={item.included}
                              onChange={(e) => updateLineItem(index, 'included', e.target.checked)}
                              className="h-4 w-4 text-navy-600 rounded"
                            />
                            Include in invoice
                          </label>
                          {lineItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeLineItem(index)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <Select
                          label="SKU"
                          options={skuOptions}
                          value={skuOptions.find(o => o.value === item.sku_id) || null}
                          onChange={(selected) => handleSkuSelect(index, selected?.value)}
                          placeholder="Select SKU..."
                        />

                        {(item.hsn_code || item.unit) && (
                          <div className="flex gap-4 text-sm text-gray-500">
                            {item.hsn_code && <span>HSN: {item.hsn_code}</span>}
                            {item.unit && <span>Unit: {item.unit}</span>}
                          </div>
                        )}

                        <div className={`grid gap-3 ${gstMode === 'different' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.qty}
                              onChange={(e) => updateLineItem(index, 'qty', e.target.value === '' ? '' : (parseFloat(e.target.value) || 0))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                            {qtyExceedsStock && (
                              <div className="flex items-center mt-1 text-xs text-amber-600">
                                <AlertCircle className="h-3 w-3 mr-1 flex-shrink-0" />
                                Stock: {stock}
                              </div>
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Price (Incl. GST)</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.sellingPrice}
                              onChange={(e) => updateLineItem(index, 'sellingPrice', parseFloat(e.target.value) || 0)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-400 focus:border-primary-400"
                            />
                          </div>
                          {gstMode === 'different' && (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">GST %</label>
                              <Select
                                options={GST_RATE_OPTIONS}
                                value={GST_RATE_OPTIONS.find(o => o.value === item.gst_rate) || null}
                                onChange={(selected) => updateLineItem(index, 'gst_rate', selected?.value ?? 18)}
                                menuPortalTarget={document.body}
                              />
                            </div>
                          )}
                        </div>

                        <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Taxable Amt</span>
                            <span>{formatCurrency(calc.taxableAmount)}</span>
                          </div>
                          {gstType === 'INTRA' ? (
                            <>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">CGST ({calc.gstRate / 2}%)</span>
                                <span>{formatCurrency(calc.cgst)}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-500">SGST ({calc.gstRate / 2}%)</span>
                                <span>{formatCurrency(calc.sgst)}</span>
                              </div>
                            </>
                          ) : (
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">IGST ({calc.gstRate}%)</span>
                              <span>{formatCurrency(calc.igst)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-1.5">
                            <span>Total</span>
                            <span className="text-navy-600">{formatCurrency(calc.total)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Add Item / Voice — visible on every screen, at the bottom of the list */}
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="w-full py-3 border-2 border-dashed border-gray-300 hover:border-navy-400 hover:bg-navy-50 rounded-xl text-gray-700 hover:text-navy-700 transition flex items-center justify-center font-medium"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Add Item
                </button>
                <button
                  type="button"
                  onClick={toggleVoice}
                  disabled={isProcessingVoice}
                  className={`w-full py-3 rounded-xl flex items-center justify-center font-medium transition ${
                    isListening
                      ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                      : isProcessingVoice
                        ? 'bg-gray-200 text-gray-500'
                        : 'bg-navy-700 text-white hover:bg-navy-800'
                  }`}
                  title="Tap to dictate items"
                >
                  {isProcessingVoice ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : isListening ? (
                    <>
                      <MicOff className="h-5 w-5 mr-2" />
                      Stop & Add Items
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5 mr-2" />
                      Dictate Items
                    </>
                  )}
                </button>
              </div>

              {/* Live transcript while listening */}
              {(isListening || voiceTranscript) && (
                <div className="rounded-xl border border-navy-200 bg-navy-50 p-3">
                  <p className="text-xs font-semibold text-navy-700 mb-1">
                    {isListening ? 'Listening...' : 'Heard:'}
                  </p>
                  <p className="text-sm text-gray-800 italic">
                    {voiceTranscript || (isListening ? 'Start speaking — e.g. "10 pieces of aluminium pipe, 5 numbers of L-bracket"' : '')}
                  </p>
                </div>
              )}

              {/* Ambiguous voice matches — let the user pick from candidates */}
              {pendingMatches.length > 0 && (
                <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-amber-900">
                      Confirm which SKU you meant:
                    </p>
                    <span className="text-xs text-amber-700">{pendingMatches.length} to confirm</span>
                  </div>
                  {pendingMatches.map(pending => (
                    <div key={pending.id} className="bg-white rounded-lg border border-amber-200 p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs text-gray-500">You said</p>
                          <p className="text-sm font-medium text-gray-900">
                            "{pending.heard_as}"
                            {pending.quantity > 1 && (
                              <span className="ml-2 text-xs text-gray-500">qty: {pending.quantity}</span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => dismissPendingMatch(pending.id)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Skip
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mb-1.5">Pick the correct SKU:</p>
                      <div className="space-y-1.5">
                        {pending.candidates.map(c => (
                          <button
                            key={c.sku_id}
                            type="button"
                            onClick={() => resolvePendingMatch(pending.id, c.sku)}
                            className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg hover:border-navy-400 hover:bg-navy-50 transition flex items-center justify-between gap-2"
                          >
                            <span className="text-sm text-gray-900 truncate">
                              {c.sku.sku_name}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                              c.confidence >= 70 ? 'bg-green-100 text-green-700' :
                              c.confidence >= 40 ? 'bg-amber-100 text-amber-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {c.confidence}%
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left - amount in words */}
              <div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-500 mb-1">Amount in Words</p>
                  <p className="text-sm font-medium">{currencyToWords(Math.round(summary.grandTotal))}</p>
                </div>

                <div className="mt-4 text-sm text-gray-500">
                  <p>Invoice Date: {formatDateDDMMYYYY(invoiceDate)}</p>
                  {dueDate && <p>Due Date: {formatDateDDMMYYYY(dueDate)}</p>}
                  <p className="mt-1">
                    GST Type: {gstType === 'INTRA' ? 'CGST + SGST' : 'IGST'}
                    {gstMode === 'same' && ` @ ${uniformGstRate}%`}
                  </p>
                </div>
              </div>

              {/* Right - totals */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Sub-total (Taxable):</span>
                  <span className="font-medium">{formatCurrency(summary.subTotal)}</span>
                </div>
                {gstType === 'INTRA' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span>CGST:</span>
                      <span>{formatCurrency(summary.totalCgst)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>SGST:</span>
                      <span>{formatCurrency(summary.totalSgst)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-sm">
                    <span>IGST:</span>
                    <span>{formatCurrency(summary.totalIgst)}</span>
                  </div>
                )}
                <div className="border-t pt-3">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Grand Total:</span>
                    <span className="text-navy-600">{formatCurrency(summary.grandTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate(isEditMode ? `/invoices/${editingInvoiceId}` : '/invoices')}>
            Cancel
          </Button>
          <Button
            onClick={generateInvoice}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isEditMode ? 'Save Changes' : 'Generate Invoice'}
          </Button>
        </div>
      </div>
    </div>
  )
}
