-- Twilio WhatsApp Integration with Logging
-- Run this in your Supabase SQL Editor
-- Make sure you have already run SETUP-ALL.sql and ADD-WHATSAPP-LOGS.sql first

-- Drop old versions
DROP FUNCTION IF EXISTS send_whatsapp_invoice(text, text);
DROP FUNCTION IF EXISTS send_whatsapp_invoice(text, text, text, text, text);
DROP FUNCTION IF EXISTS send_whatsapp_invoice(uuid, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS send_whatsapp_invoice(uuid, text, text, text, text, text, uuid);

-- Template: invoice_sending_customer_v10
-- Variables: {{1}}=Customer Name, {{2}}=Invoice Number, {{3}}=Invoice Date, {{4}}=PDF Filename
-- Media URL: https://lwxhjtdnxntfyaompfth.supabase.co/storage/v1/object/public/invoice-pdfs/{{4}}

CREATE OR REPLACE FUNCTION send_whatsapp_invoice(
  p_invoice_id uuid,
  p_to_phone text,
  p_customer_name text,
  p_invoice_number text,
  p_invoice_date text,
  p_pdf_filename text,
  p_sent_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_response record;
  v_body text;
  v_url text;
  v_account_sid text := 'YOUR_TWILIO_ACCOUNT_SID';  -- Replace with your Twilio Account SID
  v_auth_token text := 'YOUR_TWILIO_AUTH_TOKEN';    -- Replace with your Twilio Auth Token
  v_from_number text := 'YOUR_TWILIO_FROM_NUMBER';  -- Replace with your Twilio WhatsApp number
  v_content_sid text := 'YOUR_CONTENT_TEMPLATE_SID'; -- Replace with your Content Template SID
  v_content_vars text;
  v_resp_json jsonb;
  v_msg_sid text;
  v_msg_status text;
  v_error_code text;
  v_error_message text;
BEGIN
  -- ContentVariables: 1=customer name, 2=invoice number, 3=invoice date, 4=pdf filename
  v_content_vars := '{"1":"' || p_customer_name
    || '","2":"' || p_invoice_number
    || '","3":"' || p_invoice_date
    || '","4":"' || p_pdf_filename || '"}';

  v_body := 'From=' || urlencode('whatsapp:' || v_from_number)
    || '&To=' || urlencode('whatsapp:' || p_to_phone)
    || '&ContentSid=' || v_content_sid
    || '&ContentVariables=' || urlencode(v_content_vars);

  -- Basic Auth via URL
  v_url := 'https://' || v_account_sid || ':' || v_auth_token
    || '@api.twilio.com/2010-04-01/Accounts/' || v_account_sid || '/Messages.json';

  SELECT * INTO v_response FROM extensions.http_post(v_url, v_body, 'application/x-www-form-urlencoded');

  -- Parse Twilio response
  BEGIN
    v_resp_json := v_response.content::jsonb;
    v_msg_sid := v_resp_json->>'sid';
    v_msg_status := v_resp_json->>'status';
    v_error_code := v_resp_json->>'error_code';
    v_error_message := v_resp_json->>'error_message';
  EXCEPTION WHEN OTHERS THEN
    v_resp_json := jsonb_build_object('raw', v_response.content);
    v_msg_status := 'parse_error';
  END;

  -- Log the message
  INSERT INTO whatsapp_message_logs (
    invoice_id, invoice_number, customer_name, to_phone,
    template_sid, twilio_message_sid, twilio_status,
    twilio_error_code, twilio_error_message, full_response, sent_by
  ) VALUES (
    p_invoice_id, p_invoice_number, p_customer_name, p_to_phone,
    v_content_sid, v_msg_sid, v_msg_status,
    v_error_code, v_error_message, v_resp_json, p_sent_by
  );

  RETURN jsonb_build_object(
    'success', v_response.status BETWEEN 200 AND 299,
    'status', v_response.status,
    'twilio_status', v_msg_status,
    'message_sid', v_msg_sid,
    'error_code', v_error_code,
    'error_message', v_error_message
  );
END;
$$;

GRANT EXECUTE ON FUNCTION send_whatsapp_invoice(uuid, text, text, text, text, text, uuid) TO authenticated;
