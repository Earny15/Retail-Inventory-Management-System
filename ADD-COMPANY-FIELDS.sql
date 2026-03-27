-- Add missing columns and fix column sizes in companies table
-- Run this in your Supabase SQL Editor

-- Add missing columns
ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS declaration TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Increase invoice_prefix size (default VARCHAR(10) is too small)
ALTER TABLE companies ALTER COLUMN invoice_prefix TYPE VARCHAR(30);
