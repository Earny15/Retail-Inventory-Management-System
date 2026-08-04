-- Note Keeping Invoices
-- A parallel invoice type for cash/off-GST entries. No CGST/SGST/IGST columns,
-- no gst_rate on items — each line item just has an amount and the invoice has
-- a grand total. Its own prefix + number series stored on the companies row.
--
-- Run this in your Supabase SQL Editor.

BEGIN;

-- 1) Company master: NK prefix + counter (mirrors invoice_prefix/invoice_number_series)
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS note_keeping_prefix TEXT DEFAULT 'NK-';
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS note_keeping_number_series TEXT DEFAULT '000';

-- 2) Note keeping invoices header
CREATE TABLE IF NOT EXISTS note_keeping_invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number TEXT NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | CANCELLED
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  notes TEXT,
  converted_from_invoice_id UUID REFERENCES customer_invoices(id) ON DELETE SET NULL,
  converted_from_invoice_number TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nk_invoices_date ON note_keeping_invoices (invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_nk_invoices_customer ON note_keeping_invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_nk_invoices_status ON note_keeping_invoices (status);

-- 3) Line items (SKU + qty + rate + amount only — no GST)
CREATE TABLE IF NOT EXISTS note_keeping_invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES note_keeping_invoices(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES skus(id) ON DELETE SET NULL,
  quantity NUMERIC(14,3) NOT NULL DEFAULT 0,
  rate NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nk_items_invoice ON note_keeping_invoice_items (invoice_id);

-- 4) Activity log (same shape as invoice_activity_logs)
CREATE TABLE IF NOT EXISTS note_keeping_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES note_keeping_invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,   -- 'created' | 'updated' | 'cancelled' | 'converted_from_customer_invoice'
  details JSONB,
  actor_id UUID,
  actor_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nk_activity_invoice
  ON note_keeping_activity_logs (invoice_id, created_at DESC);

-- 5) RLS: same authenticated-only model as the rest of the app
ALTER TABLE note_keeping_invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage note_keeping_invoices"
  ON note_keeping_invoices;
CREATE POLICY "Authenticated users can manage note_keeping_invoices"
  ON note_keeping_invoices FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE note_keeping_invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage note_keeping_invoice_items"
  ON note_keeping_invoice_items;
CREATE POLICY "Authenticated users can manage note_keeping_invoice_items"
  ON note_keeping_invoice_items FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE note_keeping_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can manage note_keeping_activity_logs"
  ON note_keeping_activity_logs;
CREATE POLICY "Authenticated users can manage note_keeping_activity_logs"
  ON note_keeping_activity_logs FOR ALL USING (auth.role() = 'authenticated');

COMMIT;
