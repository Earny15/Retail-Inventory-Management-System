-- Rollback for ENABLE-RLS-ALL.sql — disables Row Level Security on the same
-- 15 tables. Run this ONLY if the app breaks after the enable migration and
-- you need to unblock users while diagnosing.
--
-- Note: the policies themselves are NOT dropped. RLS-disabled + policies-exist
-- is exactly the state the linter warned about, so this rollback is a
-- short-term unblock, not a permanent state. Re-run ENABLE-RLS-ALL.sql once
-- the root cause is fixed.

BEGIN;

ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE skus DISABLE ROW LEVEL SECURITY;
ALTER TABLE sku_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_sku_aliases DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE customer_invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_inwards DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_inward_items DISABLE ROW LEVEL SECURITY;

COMMIT;
