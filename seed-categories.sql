-- Insert default categories for SKU Master
-- Run this in your Supabase SQL editor after setting up the main schema

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