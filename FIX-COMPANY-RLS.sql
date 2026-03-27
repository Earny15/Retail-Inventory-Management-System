-- FIX: Add RLS policies for companies table
-- The table had RLS enabled but NO policies, so all updates were silently blocked
-- Run this in your Supabase SQL Editor

-- Add missing columns first
ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS declaration TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE companies ALTER COLUMN invoice_prefix TYPE VARCHAR(30);

-- Add RLS policies for companies table
CREATE POLICY "Authenticated users can read companies"
  ON companies FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert companies"
  ON companies FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update companies"
  ON companies FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete companies"
  ON companies FOR DELETE USING (auth.role() = 'authenticated');
