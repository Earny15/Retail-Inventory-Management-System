-- Enable Row Level Security on every app table with an authenticated-only policy.
-- Addresses Supabase linter findings: rls_disabled_in_public (15 tables) and
-- policy_exists_rls_disabled (companies).
--
-- Design:
--   * Single transaction — either all 15 tables are protected or none change.
--   * Idempotent — safe to re-run (DROP POLICY IF EXISTS before CREATE; enabling
--     RLS twice is a no-op).
--   * "Authenticated" policy matches this app's model: single-tenant, no
--     per-user row isolation, only logged-in users see anything. Anonymous
--     access via the anon key is fully blocked.
--
-- Rollback: run ROLLBACK-RLS-ALL.sql to disable RLS on the same tables.
-- Tables already correctly configured (do NOT need this migration):
--   sales_quotations, sales_quotation_items, role_permissions,
--   invoice_activity_logs, whatsapp_message_logs.

BEGIN;

-- 1) companies: policies already exist from earlier setup, just flip RLS on.
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 2) Remaining 14 tables: create an authenticated policy, then enable RLS.
--    Each block is copy-pasted so it's obvious what's being touched and so
--    a partial run (interrupted by an error) is easy to diagnose.

DROP POLICY IF EXISTS "Authenticated users can manage roles" ON roles;
CREATE POLICY "Authenticated users can manage roles" ON roles
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage users" ON users;
CREATE POLICY "Authenticated users can manage users" ON users
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage user_permissions" ON user_permissions;
CREATE POLICY "Authenticated users can manage user_permissions" ON user_permissions
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage skus" ON skus;
CREATE POLICY "Authenticated users can manage skus" ON skus
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE skus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage sku_categories" ON sku_categories;
CREATE POLICY "Authenticated users can manage sku_categories" ON sku_categories
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE sku_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage vendors" ON vendors;
CREATE POLICY "Authenticated users can manage vendors" ON vendors
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage vendor_sku_aliases" ON vendor_sku_aliases;
CREATE POLICY "Authenticated users can manage vendor_sku_aliases" ON vendor_sku_aliases
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE vendor_sku_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage inventory" ON inventory;
CREATE POLICY "Authenticated users can manage inventory" ON inventory
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage inventory_transactions" ON inventory_transactions;
CREATE POLICY "Authenticated users can manage inventory_transactions" ON inventory_transactions
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;
CREATE POLICY "Authenticated users can manage customers" ON customers
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customer_invoices" ON customer_invoices;
CREATE POLICY "Authenticated users can manage customer_invoices" ON customer_invoices
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE customer_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage customer_invoice_items" ON customer_invoice_items;
CREATE POLICY "Authenticated users can manage customer_invoice_items" ON customer_invoice_items
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE customer_invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage vendor_inwards" ON vendor_inwards;
CREATE POLICY "Authenticated users can manage vendor_inwards" ON vendor_inwards
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE vendor_inwards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can manage vendor_inward_items" ON vendor_inward_items;
CREATE POLICY "Authenticated users can manage vendor_inward_items" ON vendor_inward_items
  FOR ALL USING (auth.role() = 'authenticated');
ALTER TABLE vendor_inward_items ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verification queries — run these AFTER the migration and confirm they all
-- return rowsecurity = true and a matching policy row:
--   SELECT tablename, rowsecurity FROM pg_tables
--    WHERE schemaname='public'
--      AND tablename IN (
--        'companies','roles','users','user_permissions','skus','sku_categories',
--        'vendors','vendor_sku_aliases','inventory','inventory_transactions',
--        'customers','customer_invoices','customer_invoice_items',
--        'vendor_inwards','vendor_inward_items'
--      );
--   SELECT tablename, policyname FROM pg_policies
--    WHERE schemaname='public'
--    ORDER BY tablename, policyname;
