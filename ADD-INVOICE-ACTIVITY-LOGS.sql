-- Invoice Activity Logs
-- Run this in your Supabase SQL Editor.
-- Adds a per-invoice audit trail: creation, edits, and status changes.

CREATE TABLE IF NOT EXISTS invoice_activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES customer_invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,        -- 'created' | 'updated' | 'cancelled' | 'reactivated'
  details JSONB,               -- action-specific payload (diff, totals, reason, etc.)
  actor_id UUID,               -- user who performed the action
  actor_name TEXT,             -- denormalised display name / email for readability
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_activity_logs_invoice
  ON invoice_activity_logs (invoice_id, created_at DESC);

ALTER TABLE invoice_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage invoice_activity_logs"
  ON invoice_activity_logs FOR ALL USING (auth.role() = 'authenticated');
