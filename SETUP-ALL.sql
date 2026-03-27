-- =====================================================
-- RUN THIS IN SUPABASE SQL EDITOR (all at once)
-- Handles: Storage bucket, policies, and Twilio WhatsApp
-- =====================================================

-- 1. Create storage bucket (idempotent - safe to re-run)
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-pdfs', 'invoice-pdfs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies (wrapped in DO blocks so they don't fail if already exist)
DO $$ BEGIN
  CREATE POLICY "invoice_pdfs_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'invoice-pdfs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoice_pdfs_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'invoice-pdfs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "invoice_pdfs_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'invoice-pdfs');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Public PDF URL column on invoices
ALTER TABLE customer_invoices ADD COLUMN IF NOT EXISTS public_pdf_url TEXT;

-- 4. Enable HTTP extension (needed for Twilio API calls)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- 5. URL encode helper function
CREATE OR REPLACE FUNCTION urlencode(input_text text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(
    CASE
      WHEN c ~ '[A-Za-z0-9_.~-]' THEN c
      ELSE '%' || upper(encode(convert_to(c, 'UTF8'), 'hex'))
    END, ''
  )
  FROM regexp_split_to_table($1, '') AS c;
$$;

-- 6. WhatsApp send function via Twilio
-- IMPORTANT: Replace the placeholder values below with your actual Twilio credentials
CREATE OR REPLACE FUNCTION send_whatsapp_invoice(
  p_to_phone text,
  p_invoice_url text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_response record;
  v_auth text;
  v_body text;
  v_account_sid text := 'YOUR_TWILIO_ACCOUNT_SID';
  v_auth_token text := 'YOUR_TWILIO_AUTH_TOKEN';
  v_from_number text := 'YOUR_TWILIO_WHATSAPP_NUMBER';
  v_content_sid text := 'YOUR_TWILIO_CONTENT_SID';
BEGIN
  v_auth := 'Basic ' || encode(
    convert_to(v_account_sid || ':' || v_auth_token, 'UTF8'), 'base64'
  );

  v_body := 'From=' || urlencode('whatsapp:' || v_from_number)
    || '&To=' || urlencode('whatsapp:' || p_to_phone)
    || '&ContentSid=' || v_content_sid
    || '&ContentVariables=' || urlencode('{"1":"' || p_invoice_url || '"}');

  SELECT * INTO v_response FROM extensions.http((
    'POST',
    'https://api.twilio.com/2010-04-01/Accounts/' || v_account_sid || '/Messages.json',
    ARRAY[extensions.http_header('Authorization', v_auth)],
    'application/x-www-form-urlencoded',
    v_body
  )::extensions.http_request);

  RETURN jsonb_build_object(
    'success', v_response.status BETWEEN 200 AND 299,
    'status', v_response.status,
    'body', v_response.content
  );
END;
$$;

-- 7. Grant execute permission
GRANT EXECUTE ON FUNCTION send_whatsapp_invoice(text, text) TO authenticated;
