-- =====================================================
-- AluminiumPro - Add selling_price to SKUs table
-- RUN THIS IN SUPABASE SQL EDITOR
-- This stores the GST-INCLUSIVE selling price
-- =====================================================

ALTER TABLE skus ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2) DEFAULT 0;
