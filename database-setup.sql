-- Complete AluminiumPro Database Setup for Supabase
-- Run this entire script in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create tables
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_code VARCHAR(20) UNIQUE,
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  phone VARCHAR(20),
  email VARCHAR(255),
  gstin VARCHAR(15),
  pan_number VARCHAR(10),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  ifsc_code VARCHAR(11),
  invoice_prefix VARCHAR(10) DEFAULT 'INV',
  invoice_footer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  role_name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role_id UUID REFERENCES roles(id),
  is_super_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  module VARCHAR(100) NOT NULL,
  can_view BOOLEAN DEFAULT FALSE,
  can_create BOOLEAN DEFAULT FALSE,
  can_edit BOOLEAN DEFAULT FALSE,
  can_delete BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, module)
);

CREATE TABLE IF NOT EXISTS sku_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  category_name VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS skus (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku_code VARCHAR(50) UNIQUE NOT NULL,
  sku_name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES sku_categories(id),
  unit_of_measure VARCHAR(20) DEFAULT 'PCS',
  secondary_uom VARCHAR(20),
  conversion_factor DECIMAL(10,4) DEFAULT 1,
  weight_per_unit DECIMAL(10,3),
  dimensions VARCHAR(100),
  gst_rate DECIMAL(5,2) DEFAULT 18,
  hsn_code VARCHAR(20),
  min_stock_level DECIMAL(10,2) DEFAULT 0,
  max_stock_level DECIMAL(10,2),
  reorder_level DECIMAL(10,2),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_code VARCHAR(20) UNIQUE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  customer_type VARCHAR(50) DEFAULT 'retail',
  phone VARCHAR(20),
  email VARCHAR(255),
  billing_address_line1 TEXT,
  billing_address_line2 TEXT,
  billing_city VARCHAR(100),
  billing_state VARCHAR(100),
  billing_pincode VARCHAR(10),
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_pincode VARCHAR(10),
  gstin VARCHAR(15),
  pan_number VARCHAR(10),
  credit_limit DECIMAL(15,2) DEFAULT 0,
  credit_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_code VARCHAR(20) UNIQUE NOT NULL,
  vendor_name VARCHAR(255) NOT NULL,
  contact_person VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  address_line1 TEXT,
  address_line2 TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  gstin VARCHAR(15),
  pan_number VARCHAR(10),
  bank_name VARCHAR(255),
  bank_account_number VARCHAR(50),
  ifsc_code VARCHAR(11),
  payment_terms VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_sku_aliases (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES skus(id) ON DELETE CASCADE,
  vendor_item_name VARCHAR(255) NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(vendor_id, sku_id, vendor_item_name)
);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku_id UUID REFERENCES skus(id),
  company_id UUID REFERENCES companies(id),
  current_stock DECIMAL(12,3) DEFAULT 0,
  reserved_stock DECIMAL(12,3) DEFAULT 0,
  available_stock DECIMAL(12,3) DEFAULT 0,
  average_cost DECIMAL(10,2) DEFAULT 0,
  last_purchase_cost DECIMAL(10,2),
  last_purchase_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(sku_id, company_id)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  sku_id UUID REFERENCES skus(id),
  company_id UUID REFERENCES companies(id),
  transaction_type VARCHAR(20) NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(15,2),
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  vendor_inward_id UUID,
  customer_invoice_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_inwards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inward_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES vendors(id),
  company_id UUID REFERENCES companies(id),
  inward_date DATE NOT NULL,
  vendor_invoice_number VARCHAR(100),
  vendor_invoice_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_gst_amount DECIMAL(15,2) DEFAULT 0,
  round_off_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_inward_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  inward_id UUID REFERENCES vendor_inwards(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES skus(id),
  quantity DECIMAL(12,3) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL,
  gst_amount DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS customer_invoices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  company_id UUID REFERENCES companies(id),
  invoice_date DATE NOT NULL,
  due_date DATE,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_gst_amount DECIMAL(15,2) DEFAULT 0,
  round_off_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  terms_and_conditions TEXT,
  shipping_address_line1 TEXT,
  shipping_address_line2 TEXT,
  shipping_city VARCHAR(100),
  shipping_state VARCHAR(100),
  shipping_pincode VARCHAR(10),
  status VARCHAR(20) DEFAULT 'pending',
  paid_amount DECIMAL(15,2) DEFAULT 0,
  payment_date DATE,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP WITH TIME ZONE,
  sent_method VARCHAR(20),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_invoice_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_id UUID REFERENCES customer_invoices(id) ON DELETE CASCADE,
  sku_id UUID REFERENCES skus(id),
  quantity DECIMAL(12,3) NOT NULL,
  rate DECIMAL(10,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  gst_rate DECIMAL(5,2) NOT NULL,
  gst_amount DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) NOT NULL,
  description TEXT
);

-- Create auto-increment functions
CREATE OR REPLACE FUNCTION generate_company_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.company_code IS NULL THEN
    NEW.company_code := 'COMP-' || LPAD(NEXTVAL('company_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_customer_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_code IS NULL THEN
    NEW.customer_code := 'CUST-' || LPAD(NEXTVAL('customer_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_vendor_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.vendor_code IS NULL THEN
    NEW.vendor_code := 'VEND-' || LPAD(NEXTVAL('vendor_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_sku_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku_code IS NULL THEN
    NEW.sku_code := 'SKU-' || LPAD(NEXTVAL('sku_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS company_seq START 1;
CREATE SEQUENCE IF NOT EXISTS customer_seq START 1;
CREATE SEQUENCE IF NOT EXISTS vendor_seq START 1;
CREATE SEQUENCE IF NOT EXISTS sku_seq START 1;

-- Create triggers
DROP TRIGGER IF EXISTS company_code_trigger ON companies;
CREATE TRIGGER company_code_trigger
  BEFORE INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION generate_company_code();

DROP TRIGGER IF EXISTS customer_code_trigger ON customers;
CREATE TRIGGER customer_code_trigger
  BEFORE INSERT ON customers
  FOR EACH ROW
  EXECUTE FUNCTION generate_customer_code();

DROP TRIGGER IF EXISTS vendor_code_trigger ON vendors;
CREATE TRIGGER vendor_code_trigger
  BEFORE INSERT ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION generate_vendor_code();

DROP TRIGGER IF EXISTS sku_code_trigger ON skus;
CREATE TRIGGER sku_code_trigger
  BEFORE INSERT ON skus
  FOR EACH ROW
  EXECUTE FUNCTION generate_sku_code();

-- Enable Row Level Security
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sku_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_sku_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_inwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_inward_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;

-- Insert default roles
INSERT INTO roles (role_name, description) VALUES
('Super Admin', 'Full system access with all permissions'),
('Manager', 'Management level access with most permissions'),
('Staff', 'Staff level access with limited permissions'),
('Viewer', 'View only access to most modules')
ON CONFLICT (role_name) DO NOTHING;

-- Insert default categories
INSERT INTO sku_categories (category_name, description) VALUES
('Sheets', 'Aluminium sheets and plates'),
('Rods', 'Aluminium rods and bars'),
('Tubes', 'Aluminium tubes and pipes'),
('Profiles', 'Aluminium profiles and extrusions'),
('Fasteners', 'Nuts, bolts, and fasteners'),
('Tools', 'Tools and equipment'),
('Accessories', 'Hardware accessories'),
('Raw Material', 'Raw aluminium materials')
ON CONFLICT (category_name) DO NOTHING;