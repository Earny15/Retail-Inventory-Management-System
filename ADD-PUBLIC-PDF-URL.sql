-- Add public_pdf_url column to customer_invoices table
ALTER TABLE customer_invoices ADD COLUMN IF NOT EXISTS public_pdf_url TEXT;