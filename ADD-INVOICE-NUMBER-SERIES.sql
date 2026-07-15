-- Invoice Number Series
-- Run this in your Supabase SQL Editor.
-- Adds an editable counter column on the companies table so invoice numbers
-- follow a predictable sequence (e.g. XYZ-001, XYZ-002, ...) driven by the
-- master value. The width of the value determines zero-padding — '000'
-- gives 3-digit padding, '0000' gives 4-digit, and so on.

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS invoice_number_series TEXT DEFAULT '000';

-- If you already have invoices in this company, set the series to the last
-- generated number so the next invoice continues from there. Example:
--   UPDATE companies SET invoice_number_series = '042' WHERE id = '<company-id>';
