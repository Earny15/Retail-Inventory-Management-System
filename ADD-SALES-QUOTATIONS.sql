-- Sales Quotations Module
-- Run this in your Supabase SQL Editor

-- Header table
CREATE TABLE IF NOT EXISTS sales_quotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_uid VARCHAR(20) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  company_id UUID REFERENCES companies(id),
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Line items table
CREATE TABLE IF NOT EXISTS sales_quotation_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quotation_id UUID REFERENCES sales_quotations(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES skus(id),
  quantity DECIMAL(12,3) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT
);

-- Enable RLS
ALTER TABLE sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_quotation_items ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can manage sales_quotations"
  ON sales_quotations FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage sales_quotation_items"
  ON sales_quotation_items FOR ALL USING (auth.role() = 'authenticated');
