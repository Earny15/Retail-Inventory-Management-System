-- WhatsApp Message Logs
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES customer_invoices(id),
  invoice_number TEXT,
  customer_name TEXT,
  to_phone TEXT NOT NULL,
  template_sid TEXT,
  twilio_message_sid TEXT,
  twilio_status TEXT,
  twilio_error_code TEXT,
  twilio_error_message TEXT,
  full_response JSONB,
  sent_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage whatsapp_message_logs"
  ON whatsapp_message_logs FOR ALL USING (auth.role() = 'authenticated');
