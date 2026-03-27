-- =====================================================
-- AluminiumPro - Add terms_and_conditions and declaration to companies
-- RUN THIS IN SUPABASE SQL EDITOR
-- =====================================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS terms_and_conditions TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS declaration TEXT;
